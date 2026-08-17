"use client";

import { useState, useTransition } from "react";

import { deleteInterview } from "@/lib/actions/interviews";

/**
 * Closing your own interview.
 *
 * Confirmed rather than instant, and the confirmation names the real consequence: other
 * people answered these questions, and deleting the interview takes their answers with
 * it. That is unavoidable — an answer without its question is meaningless — but somebody
 * should know it before they tap, not after.
 */
export function DeleteInterview({ postId, answerCount }: { postId: string; answerCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold"
        style={{ color: "var(--ink-faint)" }}
      >
        Close this interview
      </button>
    );
  }

  return (
    <div className="eu-card p-4">
      <p className="font-semibold">Close this interview?</p>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        {answerCount === 0
          ? "Nobody has answered yet, so this only removes your questions."
          : answerCount === 1
            ? "One person has answered. Their answer goes too — an answer can't stay without its question."
            : `${answerCount} people have answered. Their answers go too — an answer can't stay without its question.`}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--love-strong)" }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          className="eu-btn"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteInterview(postId);
              // A successful delete redirects, so reaching here means it refused.
              if (result?.error) setError(result.error);
            })
          }
        >
          {pending ? "Closing…" : "Yes, close it"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
