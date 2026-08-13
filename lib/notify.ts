import "server-only";

import { db } from "./db";
import type { NotificationKind } from "./constants";

/**
 * Notifications on ExpressU tell you that something happened, never how you're doing.
 *
 * "Someone was moved by your idea" — not "3 new likes". The distinction is the whole
 * product: a count invites you to compare this post to your last one, and to compare
 * yourself to everyone else. A count is a scoreboard with extra steps.
 */
export async function notify(
  userId: string,
  kind: NotificationKind,
  payload: Record<string, unknown>,
): Promise<void> {
  await db.notification.create({
    data: { userId, kind, payload: JSON.stringify(payload) },
  });
}

/**
 * Private milestones. Only the person who reached it ever sees it, and they exist to
 * mark that you kept going — not to set a target for next week.
 *
 * Note there is no streak. A streak punishes you for the day you didn't feel like
 * speaking, and this platform has no opinion about that.
 */
const MILESTONES: Record<number, string> = {
  1: "You shared your first idea. That's the hard one — every one after this is easier.",
  3: "Three ideas out in the world now.",
  5: "Five ideas shared. You're building something.",
  10: "Ten ideas. Look back at your first one sometime — you'll see how far it's come.",
  25: "Twenty-five ideas. That's a body of work.",
  50: "Fifty ideas shared. You've made this a habit, and that's rare.",
};

export async function maybeMilestone(userId: string): Promise<void> {
  const shared = await db.post.count({
    where: { authorId: userId, moderationStatus: "LIVE" },
  });

  const text = MILESTONES[shared];
  if (!text) return;

  const already = await db.notification.findFirst({
    where: { userId, kind: "MILESTONE", payload: { contains: `"count":${shared}` } },
  });
  if (already) return;

  await notify(userId, "MILESTONE", { count: shared, text });
}

export interface ParsedNotification {
  id: string;
  kind: string;
  createdAt: Date;
  readAt: Date | null;
  payload: Record<string, unknown>;
}

export async function listNotifications(userId: string): Promise<ParsedNotification[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    createdAt: row.createdAt,
    readAt: row.readAt,
    payload: safeParse(row.payload),
  }));
}

function safeParse(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function markAllRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
