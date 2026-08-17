"use client";

import { useActionState, useState } from "react";

import { addFollowUp, type InterviewState } from "@/lib/actions/interviews";
import { MAX_INTERVIEW_QUESTIONS } from "@/lib/constants";

/**
 * "Add a follow-up interview" — another round of up to three questions.
 *
 * Collapsed by default so an interview page reads as the questions and the answers, not
 * as a form the owner is being nudged to fill in again.
 */
export function FollowUpComposer({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<InterviewState, FormData>(addFollowUp, {});
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(1);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="eu-btn eu-btn-quiet mt-6">
        Add a follow-up interview
      </button>
    );
  }

  return (
    <form action={action} className="eu-card mt-6 flex flex-col gap-4 p-5">
      <input type="hidden" name="postId" value={postId} />

      <div>
        <p className="font-semibold">A follow-up round</p>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          Up to {MAX_INTERVIEW_QUESTIONS} more questions. Everything you asked before stays
          open — nobody loses the chance to answer it.
        </p>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Anything to say first?</span>
        <textarea
          name="body"
          rows={2}
          maxLength={20_000}
          placeholder="Optional — what made you want to ask more."
          className="eu-field w-full resize-y"
        />
      </label>

      {Array.from({ length: count }, (_, i) => (
        <label key={i} className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            Question {i + 1}
          </span>
          <input
            name={`question${i}`}
            required={i === 0}
            maxLength={300}
            className="eu-field w-full"
          />
        </label>
      ))}

      {count < MAX_INTERVIEW_QUESTIONS && (
        <button
          type="button"
          onClick={() => setCount((n) => n + 1)}
          className="self-start text-sm font-semibold"
          style={{ color: "var(--accent)" }}
        >
          + Add another question
        </button>
      )}

      {state.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Asking…" : "Ask these too"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
