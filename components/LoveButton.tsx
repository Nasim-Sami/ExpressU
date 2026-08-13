"use client";

import { useState, useTransition } from "react";

import { toggleLove } from "@/lib/actions/reactions";

/**
 * The only reaction on ExpressU.
 *
 * There is no number next to it for anyone but the author, and that absence is the point:
 * a count turns every idea into a comparison with every other idea, including the
 * author's own last one. The heart says "someone was here and was moved". It does not
 * say how many, so it cannot say "not many".
 */
export function LoveButton({
  postId,
  initialLoved,
  /** Author-only. Rendered as words, never a bare integer. */
  count,
}: {
  postId: string;
  initialLoved: boolean;
  count?: number | null;
}) {
  const [loved, setLoved] = useState(initialLoved);
  const [bloom, setBloom] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const next = !loved;
    setLoved(next); // optimistic — the heart should never lag behind the tap
    if (next) {
      setBloom(true);
      setTimeout(() => setBloom(false), 460);
    }
    startTransition(async () => {
      const result = await toggleLove(postId);
      setLoved(result.loved);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-pressed={loved}
        aria-label={loved ? "You loved this. Tap to undo." : "Love this"}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors"
        style={{
          color: loved ? "var(--love-strong)" : "var(--ink-muted)",
          background: loved ? "var(--love-soft)" : "transparent",
        }}
      >
        <span className={bloom ? "eu-bloom" : undefined} style={{ display: "inline-flex" }}>
          <HeartIcon filled={loved} />
        </span>
        <span>Love</span>
      </button>

      {typeof count === "number" && <AuthorLoveNote count={count} />}
    </div>
  );
}

/**
 * What the author sees. Deliberately phrased as people, not a score — "4 people" reads as
 * four human beings who stopped; "4" reads as a number that could have been higher.
 */
function AuthorLoveNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
      {count === 1 ? "1 person was moved by this" : `${count} people were moved by this`}
    </span>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill={filled ? "currentColor" : "none"} aria-hidden="true">
      <path
        d="M12 20.3s-7.6-4.6-7.6-9.7a4.3 4.3 0 0 1 7.6-2.7 4.3 4.3 0 0 1 7.6 2.7c0 5.1-7.6 9.7-7.6 9.7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
