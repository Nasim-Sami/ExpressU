"use server";

import { revalidatePath } from "next/cache";

import { getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { canView } from "@/lib/visibility";
import { FREE_TEXT_MIN_AGE } from "@/lib/constants";
import type { ModerationStatus, Visibility } from "@/lib/constants";

/**
 * The only three things a person can do to someone else's post: love it, pass it on, or
 * send the author a private note. There is no fourth action, and in particular there is
 * nothing here that produces public text attached to another person's work.
 */

async function loadViewableIdea(postId: string) {
  const viewer = await getViewer();
  if (!viewer) return null;

  const idea = await db.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, visibility: true, moderationStatus: true },
  });
  if (!idea) return null;

  const allowed = canView(viewer, {
    authorId: idea.authorId,
    visibility: idea.visibility as Visibility,
    moderationStatus: idea.moderationStatus as ModerationStatus,
  });
  if (!allowed) return null;

  return { viewer, idea };
}

export async function toggleLove(postId: string): Promise<{ loved: boolean }> {
  const context = await loadViewableIdea(postId);
  if (!context) return { loved: false };
  const { viewer, idea } = context;

  const existing = await db.love.findUnique({
    where: { postId_userId: { postId, userId: viewer.id } },
  });

  if (existing) {
    await db.love.delete({ where: { id: existing.id } });
    revalidatePath("/");
    revalidatePath(`/idea/${postId}`);
    return { loved: false };
  }

  await db.love.create({ data: { postId, userId: viewer.id } });

  // The author is told that someone was moved — never a running total.
  if (idea.authorId !== viewer.id) {
    await notify(idea.authorId, "LOVED", { postId });
  }

  revalidatePath("/");
  revalidatePath(`/idea/${postId}`);
  return { loved: true };
}

/**
 * Share. Note the signature: it takes an idea id and nothing else.
 *
 * There is no `caption`, `comment`, or `message` parameter, and the Echo table has no
 * column to put one in. A share carries the idea exactly as its author made it, so nobody
 * can wrap someone else's work in a verdict on the way past.
 */
export async function echoIdea(postId: string): Promise<{ echoed: boolean }> {
  const context = await loadViewableIdea(postId);
  if (!context) return { echoed: false };
  const { viewer, idea } = context;

  // Passing on your own work isn't sharing — there's nobody it reaches who couldn't
  // already see it on your profile. The button is hidden for the author too; this is
  // the check that holds even if someone calls the action directly.
  if (idea.authorId === viewer.id) return { echoed: false };

  const existing = await db.echo.findUnique({
    where: { postId_userId: { postId, userId: viewer.id } },
  });
  if (existing) return { echoed: true };

  await db.echo.create({ data: { postId, userId: viewer.id } });
  await notify(idea.authorId, "ECHOED", { postId });

  revalidatePath("/");
  revalidatePath(`/idea/${postId}`);
  return { echoed: true };
}

/**
 * Taking something off your own "Passed" shelf.
 *
 * This deletes only your Echo row — the record that you sent this on. It has no effect
 * on the post itself: the author keeps it exactly as it was, on their own profile and in
 * the feed. The only thing that disappears is your own note that you passed it along.
 *
 * No lookup of the post or its author is needed to make this safe: the delete is scoped
 * to `userId: viewer.id`, so the only row anyone can ever remove this way is their own.
 * Nobody can reach into another person's profile and clear an item from their shelf —
 * visiting a profile is never enough to change what's on it.
 */
export async function removeFromPassed(postId: string): Promise<{ removed: boolean }> {
  const viewer = await getViewer();
  if (!viewer) return { removed: false };

  await db.echo.deleteMany({ where: { postId, userId: viewer.id } });
  return { removed: true };
}

export async function sendEncouragement(
  postId: string,
  input: { presetId?: string; body?: string },
): Promise<{ sent: boolean; error?: string }> {
  const context = await loadViewableIdea(postId);
  if (!context) return { sent: false, error: "That idea isn't available." };
  const { viewer, idea } = context;

  if (idea.authorId === viewer.id) {
    return { sent: false, error: "This is your own idea." };
  }

  const author = await db.user.findUnique({
    where: { id: idea.authorId },
    select: { birthYear: true },
  });

  const year = new Date().getUTCFullYear();
  const authorAge = author?.birthYear ? year - author.birthYear : null;
  // Unknown age is treated as young. Fail closed, always.
  const freeTextAllowed = authorAge !== null && authorAge >= FREE_TEXT_MIN_AGE;

  if (input.body && !freeTextAllowed) {
    return {
      sent: false,
      error: "You can send one of the phrases to this person, but not a written note.",
    };
  }

  if (!input.presetId && !input.body?.trim()) {
    return { sent: false, error: "Pick something to send." };
  }

  if (input.presetId) {
    const preset = await db.preset.findUnique({ where: { id: input.presetId } });
    if (!preset) return { sent: false, error: "Pick something to send." };
  }

  await db.encouragement.create({
    data: {
      postId,
      fromUserId: viewer.id,
      presetId: input.presetId ?? null,
      body: freeTextAllowed ? input.body?.trim().slice(0, 500) || null : null,
    },
  });

  await notify(idea.authorId, "ENCOURAGED", { postId });

  revalidatePath(`/idea/${postId}`);
  return { sent: true };
}
