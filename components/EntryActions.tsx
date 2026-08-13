"use client";

import { useActionState, useState } from "react";

import { FilePicker } from "./FilePicker";
import { deleteEntry, editEntry, type ComposeState, type DeleteState } from "@/lib/actions/posts";
import { KIND_COPY, type PostKind } from "@/lib/constants";
import type { AttachmentView } from "@/lib/posts";

const initialEdit: ComposeState = {};
const initialDelete: DeleteState = {};

/**
 * Edit and delete controls for one entry.
 *
 * Delete works one entry at a time and never offers a "remove everything" shortcut. A
 * young person who has kept a hobby going for two years should not be able to lose it to
 * a single mis-click, so the only way to remove a whole post is to take it down to its
 * last entry and confirm that specifically.
 */
export function EntryActions({
  entry,
  kind,
  isOnlyEntry,
}: {
  entry: {
    id: string;
    body: string;
    ordinal: number;
    letterTo: string | null;
    letterSubject: string | null;
    attachments: AttachmentView[];
  };
  kind: PostKind;
  isOnlyEntry: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");

  if (mode === "edit") {
    return <EditForm entry={entry} kind={kind} onCancel={() => setMode("idle")} />;
  }

  if (mode === "delete") {
    return (
      <DeleteForm
        entry={entry}
        kind={kind}
        isOnlyEntry={isOnlyEntry}
        onCancel={() => setMode("idle")}
      />
    );
  }

  return (
    <div className="mt-3 flex gap-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setMode("edit")}
        className="text-sm font-semibold"
        style={{ color: "var(--ink-muted)" }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => setMode("delete")}
        className="text-sm font-semibold"
        style={{ color: "var(--ink-muted)" }}
      >
        Delete
      </button>
    </div>
  );
}

function EditForm({
  entry,
  kind,
  onCancel,
}: {
  entry: {
    id: string;
    body: string;
    letterTo: string | null;
    letterSubject: string | null;
    attachments: AttachmentView[];
  };
  kind: PostKind;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(editEntry, initialEdit);
  const isLetter = kind === "LETTER";

  return (
    <form action={action} className="mt-3 flex flex-col gap-4 border-t pt-4">
      <input type="hidden" name="entryId" value={entry.id} />

      {isLetter && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`to-${entry.id}`} className="text-sm font-semibold">
              To
            </label>
            <input
              id={`to-${entry.id}`}
              name="letterTo"
              className="eu-field"
              defaultValue={entry.letterTo ?? ""}
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`subject-${entry.id}`} className="text-sm font-semibold">
              Subject
            </label>
            <input
              id={`subject-${entry.id}`}
              name="letterSubject"
              className="eu-field"
              defaultValue={entry.letterSubject ?? ""}
              maxLength={200}
              required
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`body-${entry.id}`} className="text-sm font-semibold">
          {isLetter ? "Body" : "Your words"}
        </label>
        <textarea
          id={`body-${entry.id}`}
          name="body"
          rows={6}
          className="eu-field resize-y"
          defaultValue={entry.body}
          maxLength={20_000}
        />
      </div>

      <FilePicker
        label="Files"
        help="Remove what you don't want, add anything new."
        existing={entry.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          sizeBytes: a.sizeBytes,
        }))}
      />

      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Edits go back through the same quick check as a new post, so this may take a moment
        to reappear for other people.
      </p>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
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
    </form>
  );
}

function DeleteForm({
  entry,
  kind,
  isOnlyEntry,
  onCancel,
}: {
  entry: { id: string; ordinal: number };
  kind: PostKind;
  isOnlyEntry: boolean;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(deleteEntry, initialDelete);
  const noun = KIND_COPY[kind].entryNoun.toLowerCase();

  return (
    <form action={action} className="mt-3 flex flex-col gap-3 border-t pt-4">
      <input type="hidden" name="entryId" value={entry.id} />

      <p className="text-sm">
        {isOnlyEntry ? (
          <>
            This is the only {noun} here, so deleting it removes the whole{" "}
            {KIND_COPY[kind].noun}. That can&apos;t be undone.
          </>
        ) : (
          <>
            Delete {noun} {entry.ordinal}? The rest stay exactly as they are.
          </>
        )}
      </p>

      {isOnlyEntry && (
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" name="confirmWholePost" value="yes" className="mt-1" required />
          <span>Yes, remove the whole {KIND_COPY[kind].noun}.</span>
        </label>
      )}

      {state.error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="eu-btn"
          disabled={pending}
          style={{ background: "var(--love-strong)", color: "#fff" }}
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
