"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Avatar } from "./Avatar";
import { ImageCropper, type CropResult } from "./ImageCropper";
import { updateProfile, type ProfileState } from "@/lib/actions/profile";
import { MAX_BIO_WORDS, countWords } from "@/lib/constants";
import { LinksEditor } from "./LinksEditor";
import { mediaUrl } from "@/lib/media-url";
import type { ProfileLink } from "@/lib/links";

const initial: ProfileState = {};

/** What the server stores. The cropper produces exactly these, so nothing is re-cropped. */
const AVATAR = { width: 512, height: 512, aspect: 1 };
const COVER = { width: 1600, height: 400, aspect: 4 };

/**
 * Editing your own profile.
 *
 * Everything here is optional, and the page says so. A profile that nags you to complete
 * it is a profile that measures you, and the first thing a young person should feel on
 * this platform is that nothing about them is currently being scored.
 */
export function ProfileEditor({
  user,
}: {
  user: {
    handle: string;
    displayName: string;
    avatarKey: string | null;
    coverKey: string | null;
    bio: string | null;
    links: ProfileLink[];
  };
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  const [bio, setBio] = useState(user.bio ?? "");

  const words = countWords(bio);
  const over = words > MAX_BIO_WORDS;

  return (
    <form action={action} className="eu-card flex flex-col gap-6 p-6">
      <PicturePicker
        name="avatar"
        label="Your picture"
        help="Optional. Plenty of people here don't have one."
        cropTitle="Move and zoom until it sits how you want"
        spec={AVATAR}
        existingKey={user.avatarKey}
        removeName="removeAvatar"
        removeLabel="Use my initials instead"
        fallback={
          <Avatar
            user={{ handle: user.handle, displayName: user.displayName, avatarKey: null }}
            size={72}
          />
        }
        shape="circle"
      />

      <PicturePicker
        name="cover"
        label="Cover image"
        help="The strip across the top of your profile. Also optional."
        cropTitle="Choose the part that shows"
        spec={COVER}
        existingKey={user.coverKey}
        removeName="removeCover"
        removeLabel="Remove the cover"
        shape="banner"
      />

      <LinksEditor initial={user.links} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="font-semibold">
          Your name
        </label>
        <input
          id="displayName"
          name="displayName"
          className="eu-field"
          defaultValue={user.displayName}
          maxLength={60}
          required
        />
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Whatever you want to be called. It doesn&apos;t have to be your real name.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="font-semibold">
          About you
        </label>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Up to {MAX_BIO_WORDS} words. What you&apos;re into, what you&apos;re making, what
          you&apos;re curious about.
        </p>
        <textarea
          id="bio"
          name="bio"
          rows={5}
          className="eu-field resize-y"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="I'm 14. I fold paper birds and I'm trying to work out how to make one that actually glides."
          aria-describedby="bio-count"
        />
        <p
          id="bio-count"
          className="text-sm"
          style={{ color: over ? "var(--love-strong)" : "var(--ink-muted)" }}
        >
          {words} of {MAX_BIO_WORDS} words
          {over && ` — ${words - MAX_BIO_WORDS} over`}
        </p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          {state.error}
        </p>
      )}

      {state.saved && !state.error && (
        <p
          role="status"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
        >
          Saved.
        </p>
      )}

      <button type="submit" className="eu-btn eu-btn-primary self-start" disabled={pending || over}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}

/**
 * One picture field: choose a file, frame it, or take the existing one away.
 *
 * The chosen file goes through the cropper before it goes anywhere near the form. What
 * gets submitted is the cropped JPEG, written into a hidden file input via DataTransfer,
 * so the server receives a picture already the right shape rather than guessing where to
 * cut — which is how you end up with someone's head sliced off by an automatic crop.
 */
function PicturePicker({
  name,
  label,
  help,
  cropTitle,
  spec,
  existingKey,
  removeName,
  removeLabel,
  fallback,
  shape,
}: {
  name: string;
  label: string;
  help: string;
  cropTitle: string;
  spec: { width: number; height: number; aspect: number };
  existingKey: string | null;
  removeName: string;
  removeLabel: string;
  fallback?: React.ReactNode;
  shape: "circle" | "banner";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const originalRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const [pending, setPending] = useState<File | null>(null);
  const [cropped, setCropped] = useState<CropResult | null>(null);
  const [remove, setRemove] = useState(false);

  // Object URLs are a manual allocation; without this every re-crop leaks one.
  useEffect(() => {
    return () => {
      if (cropped) URL.revokeObjectURL(cropped.previewUrl);
    };
  }, [cropped]);

  function accept(result: CropResult) {
    const file = new File([result.blob], `${name}.jpg`, { type: "image/jpeg" });
    if (fileRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileRef.current.files = transfer.files;
    }
    // The unframed file travels too, so the picture can be opened full-size later and
    // re-framed without the author having to find the original again.
    if (originalRef.current && pending) {
      const transfer = new DataTransfer();
      transfer.items.add(pending);
      originalRef.current.files = transfer.files;
    }
    setCropped((previous) => {
      if (previous) URL.revokeObjectURL(previous.previewUrl);
      return result;
    });
    setPending(null);
    setRemove(false);
  }

  const showing = cropped?.previewUrl ?? (!remove && existingKey ? mediaUrl(existingKey) : null);

  return (
    <div className="flex flex-col gap-2">
      <span className="font-semibold">{label}</span>
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        {help}
      </p>

      {/* The real submitted field. Populated only by the cropper. */}
      <input ref={fileRef} type="file" name={name} accept="image/*" className="sr-only" tabIndex={-1} />
      <input
        ref={originalRef}
        type="file"
        name={`${name}Original`}
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
      />

      {pending ? (
        <ImageCropper
          file={pending}
          aspect={spec.aspect}
          outputWidth={spec.width}
          outputHeight={spec.height}
          title={cropTitle}
          onCancel={() => setPending(null)}
          onDone={accept}
        />
      ) : (
        <div className={shape === "circle" ? "flex items-center gap-4" : "flex flex-col gap-3"}>
          {showing ? (
            // eslint-disable-next-line @next/next/no-img-element -- object URL or an
            // access-checked media route; next/image can fetch neither on the server.
            <img
              src={showing}
              alt=""
              className="border object-cover"
              style={
                shape === "circle"
                  ? { width: 72, height: 72, borderRadius: "50%" }
                  : { width: "100%", aspectRatio: String(spec.aspect), borderRadius: "0.75rem" }
              }
            />
          ) : (
            fallback ?? (
              <div
                className="flex items-center justify-center rounded-xl border border-dashed text-sm"
                style={{
                  width: "100%",
                  aspectRatio: String(spec.aspect),
                  color: "var(--ink-faint)",
                }}
              >
                No cover yet
              </div>
            )
          )}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`${name}-picker`}
              className="cursor-pointer text-sm font-semibold"
              style={{ color: "var(--accent)" }}
            >
              {showing ? "Choose a different picture" : "Choose a picture"}
            </label>
            <input
              ref={pickerRef}
              id={`${name}-picker`}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPending(file);
                // Reset, so picking the same file twice still reopens the cropper.
                e.target.value = "";
              }}
            />

            {cropped && (
              <button
                type="button"
                onClick={() => {
                  const file = fileRef.current?.files?.[0];
                  if (file) setPending(file);
                }}
                className="self-start text-sm font-semibold"
                style={{ color: "var(--ink-muted)" }}
              >
                Reframe it
              </button>
            )}

            {(existingKey || cropped) && (
              <label className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                <input
                  type="checkbox"
                  name={removeName}
                  value="yes"
                  checked={remove}
                  onChange={(e) => {
                    setRemove(e.target.checked);
                    if (e.target.checked && fileRef.current) fileRef.current.value = "";
                  }}
                />
                {removeLabel}
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
