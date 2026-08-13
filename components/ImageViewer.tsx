"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Full-screen look at a picture, with zoom.
 *
 * Wraps whatever you give it in a button, so a profile picture is reachable by keyboard
 * and announced as openable rather than being a decorative image that happens to respond
 * to clicks.
 */
export function ImageViewer({
  src,
  alt,
  children,
  className,
}: {
  src: string;
  alt: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={`${alt} — open larger`}
      >
        {children}
      </button>

      {open && (
        <Lightbox
          src={src}
          alt={alt}
          onClose={() => {
            setOpen(false);
            // Send focus back where it came from, or a keyboard user is dropped at the
            // top of the document with no idea what just happened.
            opener.current?.focus();
          }}
        />
      )}
    </>
  );
}

const MAX_ZOOM = 6;

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // A minimal focus trap: only two controls exist in here, so keeping Tab inside is
      // just a matter of not letting it escape into the page behind.
      if (event.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("button, input");
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const applyZoom = useCallback((next: number) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
    setZoom(clamped);
    // Back at natural size there is nothing to pan to, so recentre rather than leaving
    // the picture stranded off to one side.
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  }, []);

  function onPointerDown(event: React.PointerEvent) {
    (event.target as Element).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragging.current = zoom > 1;

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(event: React.PointerEvent) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart.current.distance > 0) {
        applyZoom(pinchStart.current.zoom * (distance / pinchStart.current.distance));
      }
      return;
    }

    if (!dragging.current) return;
    setOffset((o) => ({
      x: o.x + (current.x - previous.x),
      y: o.y + (current.y - previous.y),
    }));
  }

  function onPointerUp(event: React.PointerEvent) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) dragging.current = false;
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ background: "rgb(12 14 17 / 0.94)" }}
      onPointerDown={(e) => {
        // Only a click on the backdrop itself closes — not one that lands on the picture.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 p-3">
        <p className="truncate text-sm" style={{ color: "rgb(255 255 255 / 0.75)" }}>
          {alt}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgb(255 255 255 / 0.12)", color: "#fff" }}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))}
        onDoubleClick={() => applyZoom(zoom > 1 ? 1 : 2.5)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served from the
            access-checked media route, which next/image cannot fetch server-side. */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full touch-none select-none object-contain"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            cursor: zoom > 1 ? "grab" : "zoom-in",
            transition: pointers.current.size ? "none" : "transform 0.12s ease-out",
          }}
        />
      </div>

      <div className="flex items-center gap-3 p-4">
        <label className="flex flex-1 items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: "rgb(255 255 255 / 0.75)" }}>
            Zoom
          </span>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            className="w-full"
            aria-label="Zoom"
          />
        </label>
      </div>
    </div>
  );
}
