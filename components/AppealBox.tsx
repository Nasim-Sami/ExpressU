"use client";

import { useState, useTransition } from "react";

import { appealBlock } from "@/lib/actions/appeals";

/**
 * The way back from a "no".
 *
 * Shown to the author whenever their own idea is blocked. This is the piece that makes
 * the difference between a platform that judged a young person and a platform that made
 * a call and is willing to hear otherwise. It is never hidden behind a help centre, and
 * it always reaches a person rather than a form.
 */
export function AppealBox({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <div
        className="rounded-xl px-4 py-4 text-sm"
        style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
      >
        Thanks — a person will read this and get back to you. Your idea is safe in the
        meantime.
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="eu-btn eu-btn-quiet">
        I think this is a mistake
      </button>
    );
  }

  return (
    <div className="eu-card p-5">
      <h2 className="font-display text-lg font-semibold">Tell us what happened</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        A person reads every one of these. If you made this yourself, say so — that&apos;s
        usually all we need to know.
      </p>

      <textarea
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        className="eu-field mt-3 resize-y"
        placeholder="I made this myself. The music is mine too — I recorded it on my phone."
        aria-label="Why you think this was a mistake"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="eu-btn eu-btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await appealBlock(postId, message);
              setSent(true);
            })
          }
        >
          {pending ? "Sending…" : "Send this to a person"}
        </button>
        <button type="button" className="eu-btn eu-btn-quiet" onClick={() => setOpen(false)}>
          Not now
        </button>
      </div>
    </div>
  );
}
