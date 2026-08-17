import "server-only";

import { after } from "next/server";

import { moderateEntry } from "./pipeline";
import { moderateAnswer } from "./answers";
import { maybeMilestone } from "../notify";
import { db } from "./../db";

/**
 * Run a moderation pass immediately after the response is sent.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────────
 *
 * Moderation used to happen only in `worker/index.ts`, a separate process started by
 * hand. That is fine in principle and awful in practice: if the worker isn't running,
 * every post sits in PENDING forever, and since PENDING is visible only to its author,
 * the entire platform silently appears broken. Two people testing with two accounts see
 * nothing of each other's work and conclude the visibility rules are broken, when in fact
 * they are working perfectly on posts that were never published.
 *
 * `after()` closes that gap. It schedules work to run once the response has already been
 * sent, so the composer still returns instantly — nobody watches a spinner while a model
 * decides whether their idea is allowed, which was the point of the worker in the first
 * place — but the check now happens on its own, in the same request, with no process to
 * remember.
 *
 * The worker is deliberately kept. It is now a safety net rather than the main path: it
 * catches anything whose request died mid-flight, and drains a backlog after downtime.
 * Both routes call the same pipeline, and both are idempotent, so an item checked twice
 * simply gets the same verdict.
 */

/** Moderate one entry after the response goes out. Never throws into the caller. */
export function scheduleEntryCheck(entryId: string, authorId: string): void {
  after(async () => {
    try {
      const outcome = await moderateEntry(entryId);
      if (outcome.verdict === "APPROVED") await maybeMilestone(authorId);
    } catch (error) {
      console.error(`[moderation] entry ${entryId} failed:`, error);
      // Leave it PENDING rather than publishing it. The worker will retry, and an
      // unchecked post staying invisible is the safe direction to fail in.
    }
  });
}

/** Moderate one interview answer after the response goes out. */
export function scheduleAnswerCheck(responseId: string): void {
  after(async () => {
    try {
      await moderateAnswer(responseId);
    } catch (error) {
      console.error(`[moderation] answer ${responseId} failed:`, error);
    }
  });
}

/**
 * Moderate every entry of a post that still needs it.
 *
 * Used when a post is created with its first entry, where the caller has the post id to
 * hand but not necessarily the entry id.
 */
export function schedulePostCheck(postId: string, authorId: string): void {
  after(async () => {
    try {
      const entries = await db.entry.findMany({
        where: { postId, moderatedAt: null },
        select: { id: true },
        orderBy: { ordinal: "asc" },
      });

      for (const entry of entries) {
        const outcome = await moderateEntry(entry.id);
        if (outcome.verdict === "APPROVED") await maybeMilestone(authorId);
      }
    } catch (error) {
      console.error(`[moderation] post ${postId} failed:`, error);
    }
  });
}
