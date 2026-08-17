"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Avatar } from "./Avatar";
import { MediaBlock } from "./MediaBlock";
import { deleteAnswer, loveAnswer } from "@/lib/actions/interviews";
import { isoDate, readableDate, timeAgo } from "@/lib/format";
import type { AnswerView } from "@/lib/interviews";

/**
 * One person's answer.
 *
 * The heart works exactly as it does on a post: the count is rendered only for the
 * answer's own author. Everyone else sees the heart and no number, so an answer with one
 * love and an answer with forty look identical to a passer-by — there is nothing here to
 * come first in.
 */
export function AnswerCard({ answer }: { answer: AnswerView }) {
  const [loved, setLoved] = useState(answer.viewerLoved);
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  const pendingCheck = answer.moderationStatus !== "LIVE";

  return (
    <li className="rounded-xl p-4" style={{ background: "var(--surface-sunken)" }}>
      <div className="flex items-start gap-3">
        <Link href={`/u/${answer.author.handle}`} className="shrink-0">
          <Avatar user={answer.author} size={36} />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link href={`/u/${answer.author.handle}`} className="font-semibold hover:underline">
              {answer.author.displayName}
            </Link>
            <span style={{ color: "var(--ink-muted)" }}>@{answer.author.handle}</span>
            <span aria-hidden="true" style={{ color: "var(--ink-faint)" }}>·</span>
            <time
              dateTime={isoDate(answer.createdAt)}
              title={readableDate(answer.createdAt)}
              style={{ color: "var(--ink-muted)" }}
            >
              {timeAgo(answer.createdAt)}
            </time>
            {answer.editedAt && (
              <span style={{ color: "var(--ink-faint)" }}>· edited</span>
            )}
          </p>

          {/* Only its author ever sees this, and only until the check finishes. */}
          {pendingCheck && (
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              {answer.moderationStatus === "BLOCKED"
                ? "This one isn't showing to others. If you think that's a mistake, tell us."
                : "Only you can see this so far — we're having a quick look."}
            </p>
          )}

          {answer.body && <p className="mt-2 whitespace-pre-wrap">{answer.body}</p>}
          <MediaBlock attachments={answer.attachments} />

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={pending || answer.isAuthor}
              onClick={() =>
                startTransition(async () => {
                  const result = await loveAnswer(answer.id);
                  setLoved(result.loved);
                })
              }
              className="flex items-center gap-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ color: loved ? "var(--love-strong)" : "var(--ink-faint)" }}
              aria-pressed={loved}
              aria-label={loved ? "You loved this answer. Tap to undo." : "Love this answer"}
            >
              <span aria-hidden="true">{loved ? "♥" : "♡"}</span>
              Love
            </button>

            {/* Author-only, like every count on ExpressU. */}
            {answer.isAuthor && answer.loveCount !== null && answer.loveCount > 0 && (
              <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                {answer.loveCount === 1
                  ? "1 person was moved by this"
                  : `${answer.loveCount} people were moved by this`}
              </span>
            )}

            {answer.isAuthor && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setRemoved(true);
                    await deleteAnswer(answer.id);
                  })
                }
                className="ml-auto text-sm font-semibold"
                style={{ color: "var(--ink-faint)" }}
              >
                Take mine down
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
