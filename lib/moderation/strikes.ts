import "server-only";

import { db } from "@/lib/db";
import { STRIKES_BEFORE_BAN_REVIEW, SUSPENSION_DAYS } from "@/lib/constants";

/**
 * The strike ledger.
 *
 * "Four consecutive off-purpose posts" is measured as: strikes recorded since the
 * author's most recent approved post. Any approved post wipes the slate — a young
 * person who posts three pieces of spam and then shares a real drawing starts again
 * from zero. Strikes never expire into a permanent record.
 *
 * Note what this module does NOT do: suspend anyone. Reaching the threshold opens a
 * BAN_CONFIRM review item and stops there. Only an admin acting on that item creates a
 * Suspension. An automated system should not be able to silence a child for 15 days
 * because a classifier misread four posts in a row.
 */

export async function recordStrike(userId: string, entryId: string): Promise<number> {
  await db.strike.create({
    data: { userId, entryId, kind: "IRRELEVANT" },
  });
  return countConsecutive(userId);
}

/** Strikes still counting against this user — i.e. not yet cleared by an approved post. */
export async function countConsecutive(userId: string): Promise<number> {
  return db.strike.count({ where: { userId, clearedAt: null } });
}

/** Called on every approved post. Forgiveness is the default, not a manual action. */
export async function clearStrikes(userId: string): Promise<void> {
  await db.strike.updateMany({
    where: { userId, clearedAt: null },
    data: { clearedAt: new Date() },
  });
}

/**
 * At the threshold, open a review item — and only if one isn't already open, so a user
 * can't accumulate a queue of duplicate ban requests.
 * Returns true when a new item was opened.
 */
export async function maybeOpenBanReview(userId: string): Promise<boolean> {
  const consecutive = await countConsecutive(userId);
  if (consecutive < STRIKES_BEFORE_BAN_REVIEW) return false;

  const existing = await db.reviewItem.findFirst({
    where: { kind: "BAN_CONFIRM", subjectId: userId, status: "OPEN" },
  });
  if (existing) return false;

  await db.reviewItem.create({
    data: {
      kind: "BAN_CONFIRM",
      subjectId: userId,
      notes: `${consecutive} consecutive off-purpose posts. A ${SUSPENSION_DAYS}-day pause is available, but needs a person to agree it's right.`,
    },
  });
  return true;
}

/**
 * Apply the suspension. Only ever called from the admin route, with an admin id.
 * Refusing to run without one is a guard against a future caller wiring this into
 * the automated path by mistake.
 */
export async function applySuspension(
  userId: string,
  adminId: string,
  reason: string,
): Promise<void> {
  if (!adminId) {
    throw new Error("A suspension requires an approving admin — never apply one automatically");
  }

  const endsAt = new Date(Date.now() + SUSPENSION_DAYS * 24 * 60 * 60 * 1000);

  await db.$transaction([
    db.suspension.create({
      data: { userId, endsAt, reason, approvedByAdminId: adminId },
    }),
    db.user.update({
      where: { id: userId },
      data: { status: "SUSPENDED", suspendedUntil: endsAt },
    }),
    // The slate is clean when they come back. They are not one mistake from another ban.
    db.strike.updateMany({
      where: { userId, clearedAt: null },
      data: { clearedAt: new Date() },
    }),
  ]);
}

/** Lift an expired suspension. Safe to call on every sign-in. */
export async function liftExpiredSuspension(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { status: true, suspendedUntil: true },
  });
  if (!user || user.status !== "SUSPENDED") return;
  if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) return;

  await db.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", suspendedUntil: null },
  });
}
