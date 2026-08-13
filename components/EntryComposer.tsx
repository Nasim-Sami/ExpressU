"use client";

import { useActionState, useState } from "react";

import { FilePicker } from "./FilePicker";
import { addEntry, type ComposeState } from "@/lib/actions/posts";
import { KIND_COPY, type PostKind } from "@/lib/constants";

const initial: ComposeState = {};

/**
 * Adding to something you already started — the part that makes a post a journal rather
 * than a one-off. Collapsed by default so the page reads as the work itself, not as a
 * form demanding to be filled in.
 */
export function EntryComposer({
  postId,
  kind,
  nextOrdinal,
}: {
  postId: string;
  kind: PostKind;
  nextOrdinal: number;
}) {
  const [state, action, pending] = useActionState(addEntry, initial);
  const [open, setOpen] = useState(false);

  const copy = KIND_COPY[kind];
  const isLetter = kind === "LETTER";
  const label = `Add ${copy.entryNoun.toLowerCase()} ${nextOrdinal}`;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="eu-card flex items-center gap-3 p-5 text-left transition-colors"
        style={{ color: "var(--growth)" }}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold"
          style={{ background: "var(--growth-soft)" }}
        >
          +
        </span>
        <span>
          <span className="block font-semibold">{label}</span>
          <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
            {isLetter
              ? "Write again — say it another way, or to someone else."
              : "Something changed? Add it here. Nothing is ever finished."}
          </span>
        </span>
      </button>
    );
  }

  return (
    <form action={action} className="eu-card flex flex-col gap-4 p-6">
      <input type="hidden" name="postId" value={postId} />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{label}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Cancel
        </button>
      </div>

      {isLetter && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="letterTo" className="font-semibold">
              To
            </label>
            <input id="letterTo" name="letterTo" className="eu-field" maxLength={200} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="letterSubject" className="font-semibold">
              Subject
            </label>
            <input
              id="letterSubject"
              name="letterSubject"
              className="eu-field"
              maxLength={200}
              required
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="entry-body" className="font-semibold">
          {isLetter ? "Body" : "What's new?"}
        </label>
        <textarea
          id="entry-body"
          name="body"
          rows={isLetter ? 8 : 5}
          className="eu-field resize-y"
          placeholder={copy.bodyPlaceholder}
          maxLength={20_000}
        />
      </div>

      <FilePicker label={isLetter ? "Attachments" : "Anything to show?"} />

      {state.error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          {state.error}
        </p>
      )}

      <button type="submit" className="eu-btn eu-btn-primary self-start" disabled={pending}>
        {pending ? "Adding…" : label}
      </button>
    </form>
  );
}
