"use client";

import { useState, useTransition } from "react";

import { echoIdea } from "@/lib/actions/reactions";

/**
 * Share — called Echo here, because the idea travels onward unchanged.
 *
 * Look at what this component does NOT have: no dialog, no text field, no "add your
 * thoughts". You cannot quote-share on ExpressU. Every other platform's share-with-comment
 * is the exact mechanism by which someone else's work gets a verdict attached to it as it
 * spreads, and that is the thing this platform is built to prevent.
 */
export function EchoButton({
  postId,
  initialEchoed,
  /** Author-only: how far it has travelled. */
  count,
  /** The author can't pass on their own work — there's nobody new it would reach. */
  isAuthor = false,
}: {
  postId: string;
  initialEchoed: boolean;
  count?: number | null;
  isAuthor?: boolean;
}) {
  const [echoed, setEchoed] = useState(initialEchoed);
  const [ripple, setRipple] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (echoed) return;
    setEchoed(true);
    setRipple(true);
    setTimeout(() => setRipple(false), 720);
    startTransition(async () => {
      await echoIdea(postId);
    });
  }

  if (isAuthor) {
    return typeof count === "number" && count > 0 ? (
      <span className="px-3 py-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        {count === 1 ? "travelled to 1 person" : `travelled to ${count} people`}
      </span>
    ) : null;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending || echoed}
        aria-label={echoed ? "You passed this on" : "Pass this on"}
        className="relative flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors"
        style={{ color: echoed ? "var(--growth)" : "var(--ink-muted)" }}
      >
        <span className="relative inline-flex">
          <EchoIcon />
          {ripple && (
            <span
              aria-hidden="true"
              className="eu-ripple absolute inset-0 rounded-full"
              style={{ border: "2px solid var(--growth)" }}
            />
          )}
        </span>
        <span>{echoed ? "Passed on" : "Pass on"}</span>
      </button>

      {typeof count === "number" && count > 0 && (
        <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {count === 1 ? "travelled to 1 person" : `travelled to ${count} people`}
        </span>
      )}
    </div>
  );
}

function EchoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <path d="M7.8 8.4a5.6 5.6 0 0 0 0 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16.2 8.4a5.6 5.6 0 0 1 0 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 5.6a9.4 9.4 0 0 0 0 12.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
      <path d="M19 5.6a9.4 9.4 0 0 1 0 12.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
