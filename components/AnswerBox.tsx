"use client";

import { useActionState, useRef, useState } from "react";

import { submitAnswer, type InterviewState } from "@/lib/actions/interviews";

/**
 * "Share your views" — the box under each question.
 *
 * Collapsed to a single line until tapped. Three open textareas down a page is a form to
 * be completed; one line that opens when you have something to say is an invitation, and
 * people should be able to answer only the question that moved them.
 */
export function AnswerBox({
  questionId,
  alreadyAnswered,
  disabled,
  disabledReason,
}: {
  questionId: string;
  alreadyAnswered: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<InterviewState, FormData>(submitAnswer, {});
  const [open, setOpen] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  if (disabled) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--ink-faint)" }}>
        {disabledReason}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="eu-field mt-3 w-full text-left"
        style={{ color: "var(--ink-faint)", lineHeight: "1.4" }}
      >
        {alreadyAnswered ? "Change what you said…" : "Share your views…"}
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="questionId" value={questionId} />

      <textarea
        name="body"
        rows={4}
        maxLength={20_000}
        autoFocus
        placeholder="However you'd say it out loud. There's no right answer here."
        className="eu-field w-full resize-y"
        aria-label="Your answer"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer text-sm font-semibold" style={{ color: "var(--accent)" }}>
          <input
            type="file"
            name="files"
            multiple
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.md"
            className="sr-only"
            onChange={(event) =>
              setFileNames([...(event.target.files ?? [])].map((file) => file.name))
            }
          />
          + Add a photo, a recording, or a video
        </label>
        {fileNames.length > 0 && (
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {fileNames.join(", ")}
          </span>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Sending…" : alreadyAnswered ? "Update my answer" : "Share this"}
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

      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        We check answers before anyone else sees them, the same as posts. Yours will be
        visible to you straight away.
      </p>
    </form>
  );
}
