/**
 * Which entries still need a moderation pass.
 *
 * This predicate is the thing standing between "edit" and a way straight past the safety
 * check: post something harmless, wait for it to go live, then rewrite it into whatever
 * you like. It lives here, separately from the worker, so it can be tested without a
 * database or an API key.
 *
 * Deliberately NOT based on Prisma's `updatedAt`: that moves on any write to the row,
 * including renumbering siblings after a delete, which would re-check unchanged content.
 */

export interface ClaimableEntry {
  createdAt: Date;
  /** Set only when the author changed what the entry says. Null means never edited. */
  contentUpdatedAt: Date | null;
  /** When moderation last finished. Null means never checked. */
  moderatedAt: Date | null;
}

export function needsModeration(entry: ClaimableEntry): boolean {
  // Never checked — a brand-new entry.
  if (entry.moderatedAt === null) return true;
  // Never edited since that check.
  if (entry.contentUpdatedAt === null) return false;
  // Edited after the last check.
  return entry.moderatedAt < entry.contentUpdatedAt;
}

/**
 * The next entry to check: oldest first, so a backlog drains in the order people wrote
 * things rather than letting a busy author jump the queue.
 */
export function pickNext<T extends ClaimableEntry>(candidates: T[]): T | null {
  return (
    [...candidates]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .find(needsModeration) ?? null
  );
}
