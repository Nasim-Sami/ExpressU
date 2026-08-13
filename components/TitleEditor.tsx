"use client";

import { useActionState, useState } from "react";

import { editTitle, type ComposeState } from "@/lib/actions/posts";

const initial: ComposeState = {};

/**
 * Rename in place. The title is the one field that can never be emptied — a post with no
 * name is unfindable in your own profile, which is the opposite of "kept safe here".
 */
export function TitleEditor({ postId, title }: { postId: string; title: string }) {
  const [state, action, pending] = useActionState(editTitle, initial);
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="mt-4 flex items-start gap-2">
        <h1 className="flex-1 text-3xl font-semibold leading-tight">{title}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1.5 shrink-0 text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Rename
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await action(formData);
        setEditing(false);
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="post-title" className="text-sm font-semibold">
        Title
      </label>
      <input
        id="post-title"
        name="title"
        className="eu-field font-display text-xl"
        defaultValue={title}
        maxLength={200}
        required
        autoFocus
      />

      {state.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
