"use client";

import { useState, useTransition } from "react";

import { setVisibility } from "@/lib/actions/posts";
import { VISIBILITY, VISIBILITY_HELP, VISIBILITY_LABEL, type Visibility } from "@/lib/constants";
import { VisibilityBadge } from "./VisibilityBadge";

/**
 * Changing who can see a post, after the fact.
 *
 * The author's own choice at posting time was never meant to be final — a "just me" idea
 * someone works up the nerve to share later, or a "everyone" post someone decides they'd
 * rather pull back to their circle, are both completely ordinary. This is the same
 * three-way choice as the composer, just collapsed to a badge until it's touched.
 */
export function VisibilityEditor({ postId, visibility }: { postId: string; visibility: Visibility }) {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(visibility);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-full"
        aria-label={`Change who can see this — currently ${VISIBILITY_LABEL[current]}`}
      >
        <VisibilityBadge visibility={current} />
        <span className="text-xs font-semibold underline" style={{ color: "var(--ink-faint)" }}>
          Change
        </span>
      </button>
    );
  }

  function choose(next: Visibility) {
    setCurrent(next);
    startTransition(async () => {
      await setVisibility(postId, next);
    });
  }

  return (
    // w-full so this reliably wraps onto its own line inside the flex-wrap byline it
    // sits in, rather than squeezing to content width next to the other metadata.
    <div className="eu-card mt-2 flex w-full flex-col gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        {VISIBILITY.map((option) => {
          const active = current === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(option)}
              disabled={pending}
              aria-pressed={active}
              className="flex-1 rounded-xl border-2 p-2.5 text-left transition-colors"
              style={{
                borderColor: active ? "var(--accent)" : "var(--line)",
                background: active ? "var(--accent-soft)" : "transparent",
              }}
            >
              <span className="block text-sm font-semibold">{VISIBILITY_LABEL[option]}</span>
              <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                {VISIBILITY_HELP[option]}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="self-start text-sm font-semibold"
        style={{ color: "var(--ink-muted)" }}
      >
        Done
      </button>
    </div>
  );
}
