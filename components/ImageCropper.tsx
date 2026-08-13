"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pick the part of a picture you actually want.
 *
 * Drag to move, zoom with the slider, the wheel, or two fingers. What you see in the frame
 * is exactly what gets saved: the preview and the export run the same maths against the
 * same bitmap, so there is no "it looked right in the editor" gap.
 *
 * The image is decoded with `createImageBitmap(..., { imageOrientation: "from-image" })`
 * rather than loaded into an `<img>`. A photo from a phone usually carries an EXIF
 * rotation flag, and browsers disagree about whether `drawImage` honours it — decoding
 * once, upright, means a portrait selfie can't come out sideways only after saving.
 */

export interface CropResult {
  blob: Blob;
  previewUrl: string;
}

const MAX_ZOOM = 5;

/**
 * Zoom is measured against "just fills the frame" (cover), so 1 means no empty space.
 *
 * You can go BELOW 1, down to whatever shows the whole picture. That's the difference
 * between a cropper that fits your photo and one that quietly eats the edges of it: a
 * tall portrait in a wide cover strip has no cover framing that keeps everyone's head in,
 * so the honest options are "cut something" or "show it all with space around it", and the
 * person whose photo it is should be the one choosing.
 */
const PAD_COLOUR = "#ffffff";

export function ImageCropper({
  file,
  aspect,
  outputWidth,
  outputHeight,
  title,
  onCancel,
  onDone,
}: {
  file: File;
  /** width / height of the frame you're cropping to. */
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title: string;
  onCancel: () => void;
  onDone: (result: CropResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  /** How far out you may go: the point where the whole picture is visible. */
  const [minZoom, setMinZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  // Kept in refs, not state: these change on every pointer move, and re-rendering React
  // at that rate would make dragging feel heavy on a phone.
  const offset = useRef({ x: 0, y: 0 });
  const baseScale = useRef(1);
  const zoomRef = useRef(1);
  const minZoomRef = useRef(1);
  const viewport = useRef({ w: 0, h: 0 });
  const framed = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  /**
   * Keeps the framing sane in both directions.
   *
   * While the picture is bigger than the frame you can't drag a gap into view. Once it's
   * smaller than the frame on an axis — which is allowed, so the whole picture can be
   * shown — it locks to the middle instead, so it can't drift into a corner.
   */
  const clampOffset = useCallback(() => {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;

    const scale = baseScale.current * zoomRef.current;
    const { w: vw, h: vh } = viewport.current;
    const shownW = bitmap.width * scale;
    const shownH = bitmap.height * scale;

    offset.current.x =
      shownW <= vw ? (vw - shownW) / 2 : Math.min(0, Math.max(vw - shownW, offset.current.x));
    offset.current.y =
      shownH <= vh ? (vh - shownH) / 2 : Math.min(0, Math.max(vh - shownH, offset.current.y));
  }, []);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w: vw, h: vh } = viewport.current;
    const scale = baseScale.current * zoomRef.current;

    // Paint the padding first, so zoomed-out framing shows the same background here as it
    // will in the saved file. The preview must not be prettier than the result.
    ctx.fillStyle = PAD_COLOUR;
    ctx.fillRect(0, 0, vw, vh);

    ctx.drawImage(
      bitmap,
      offset.current.x,
      offset.current.y,
      bitmap.width * scale,
      bitmap.height * scale,
    );
  }, []);

  /**
   * Measure the frame and size the canvas to it.
   *
   * This runs from a ResizeObserver rather than once on mount, and that is load-bearing:
   * the frame is an `aspect-ratio` box inside a form that is still laying out when the
   * effect first fires, so measuring immediately returns 0×0. Every scale below is derived
   * from those numbers, so a zero measurement silently produced a nonsense crop — which is
   * exactly what "my picture came out cut off" looks like from the outside.
   */
  const layout = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    if (!canvas || !bitmap) return;

    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    if (vw === 0 || vh === 0) return; // not laid out yet — the observer will call again

    viewport.current = { w: vw, h: vh };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    // setTransform, not scale: this runs on every resize, and scale() would compound.
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);

    baseScale.current = Math.max(vw / bitmap.width, vh / bitmap.height);
    const fitZoom = Math.min(vw / bitmap.width, vh / bitmap.height) / baseScale.current;
    minZoomRef.current = fitZoom;
    setMinZoom(fitZoom);

    if (!framed.current) {
      // First real measurement: open showing the WHOLE picture. Starting filled means a
      // portrait dropped into a wide cover strip loses its top and bottom before the
      // person has touched anything, and most never realise they can pull it back out.
      framed.current = true;
      zoomRef.current = fitZoom;
      setZoom(fitZoom);
    } else if (zoomRef.current < fitZoom) {
      // The frame grew; don't leave the picture smaller than it can now be shown.
      zoomRef.current = fitZoom;
      setZoom(fitZoom);
    }

    clampOffset();
    paint();
    setReady(true);
  }, [clampOffset, paint]);

  // Decode the file once, upright.
  useEffect(() => {
    let cancelled = false;
    let bitmap: ImageBitmap | null = null;

    (async () => {
      try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        if (cancelled) {
          bitmap.close();
          return;
        }
        bitmapRef.current = bitmap;
        framed.current = false;
        layout();
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      bitmap?.close();
      bitmapRef.current = null;
    };
  }, [file, layout]);

  // Re-measure whenever the frame changes size — first layout, window resize, rotation.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => layout());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [layout]);

  /** Zoom while keeping whatever is under (px, py) in the same place on screen. */
  const zoomAround = useCallback(
    (nextZoom: number, px: number, py: number) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(minZoomRef.current, nextZoom));
      const previous = zoomRef.current;
      if (clamped === previous) return;

      const ratio = clamped / previous;
      offset.current.x = px - (px - offset.current.x) * ratio;
      offset.current.y = py - (py - offset.current.y) * ratio;

      zoomRef.current = clamped;
      clampOffset();
      setZoom(clamped);
      paint();
    },
    [clampOffset, paint],
  );

  function localPoint(event: { clientX: number; clientY: number }) {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    (event.target as Element).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoomRef.current,
      };
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.distance > 0) {
        const mid = localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
        zoomAround(
          pinchStart.current.zoom * (distance / pinchStart.current.distance),
          mid.x,
          mid.y,
        );
      }
      return;
    }

    offset.current.x += current.x - previous.x;
    offset.current.y += current.y - previous.y;
    clampOffset();
    paint();
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  // Wheel zoom is registered non-passively so it can preventDefault; React's onWheel
  // attaches passively and would let the whole page scroll instead.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const point = localPoint(event);
      zoomAround(zoomRef.current * (event.deltaY < 0 ? 1.12 : 1 / 1.12), point.x, point.y);
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [ready, zoomAround]);

  /** Put the whole picture back in view. */
  function fitAll() {
    const { w, h } = viewport.current;
    zoomAround(minZoomRef.current, w / 2, h / 2);
  }

  /** Fill the frame edge to edge, accepting that something gets cut. */
  function fillFrame() {
    const { w, h } = viewport.current;
    zoomAround(1, w / 2, h / 2);
  }

  async function save() {
    const bitmap = bitmapRef.current;
    if (!bitmap) return;
    setSaving(true);

    const out = document.createElement("canvas");
    out.width = outputWidth;
    out.height = outputHeight;
    const ctx = out.getContext("2d");
    if (!ctx) {
      setSaving(false);
      return;
    }

    // Identical framing to the preview, scaled to the output size — so what you saw in
    // the frame is exactly what gets written, padding included.
    const ratio = outputWidth / viewport.current.w;
    const scale = baseScale.current * zoomRef.current;

    ctx.fillStyle = PAD_COLOUR;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
    ctx.drawImage(
      bitmap,
      offset.current.x * ratio,
      offset.current.y * ratio,
      bitmap.width * scale * ratio,
      bitmap.height * scale * ratio,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob(resolve, "image/jpeg", 0.9),
    );
    setSaving(false);
    if (blob) onDone({ blob, previewUrl: URL.createObjectURL(blob) });
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-4"
      style={{ background: "var(--surface-sunken)" }}
    >
      <p className="font-semibold">{title}</p>

      {failed ? (
        <p className="text-sm" style={{ color: "var(--love-strong)" }}>
          We couldn&apos;t read that picture. Try a JPEG or PNG.
        </p>
      ) : (
        <>
          <div
            className="relative overflow-hidden rounded-xl"
            style={{
              aspectRatio: String(aspect),
              background: PAD_COLOUR,
              // A circular mask for avatars, so you're framing what you'll actually see.
              maskImage:
                aspect === 1 ? "radial-gradient(circle, #000 99%, transparent 100%)" : undefined,
            }}
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full touch-none"
              style={{ cursor: "grab" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            {!ready && (
              <p
                className="absolute inset-0 flex items-center justify-center text-sm"
                style={{ color: "var(--ink-muted)" }}
              >
                Opening…
              </p>
            )}
          </div>

          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            The whole picture is showing. Drag to move it, and zoom with the slider, your
            scroll wheel or two fingers.
          </p>

          <label className="flex items-center gap-3 text-sm">
            <span className="shrink-0 font-semibold">Zoom</span>
            <input
              type="range"
              min={minZoom}
              max={MAX_ZOOM}
              step={0.001}
              value={zoom}
              onChange={(e) => {
                const { w, h } = viewport.current;
                zoomAround(Number(e.target.value), w / 2, h / 2);
              }}
              className="w-full"
              aria-label="Zoom"
            />
          </label>

          {/* Both framings in one tap, because "show all of it" and "fill the frame" are
              the two things people actually want and neither is obvious from a slider. */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fitAll}
              className="rounded-full border px-3 py-1.5 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}
            >
              Show all of it
            </button>
            <button
              type="button"
              onClick={fillFrame}
              className="rounded-full border px-3 py-1.5 text-sm font-semibold"
              style={{ borderColor: "var(--line)", color: "var(--ink-muted)" }}
            >
              Fill the frame
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              className="eu-btn eu-btn-primary"
              disabled={!ready || saving}
            >
              {saving ? "Saving…" : "Use this"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-sm font-semibold"
              style={{ color: "var(--ink-muted)" }}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
