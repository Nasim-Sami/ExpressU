"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Blocking and unblocking.
 *
 * Blocking is the one action on ExpressU that is entirely about withdrawal rather than
 * expression, and it is built to be quiet: nobody is notified, nothing is announced, and
 * the blocked person sees only what a stranger sees. Telling someone they were blocked
 * gives them a reason to come back through another account, and it turns a private
 * decision into a confrontation.
 *
 * It is also not a report. Blocking says "not for me"; reporting says "someone should
 * look at this". They are deliberately separate, so nobody has to accuse another person
 * of wrongdoing just to stop seeing them.
 */

export interface BlockResult {
  ok: boolean;
  error?: string;
}

export async function blockUser(targetId: string): Promise<BlockResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (targetId === user.id) return { ok: false, error: "You can't block yourself." };

  const target = await db.user.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!target) return { ok: false, error: "That person isn't here any more." };

  await db.$transaction(async (tx) => {
    await tx.block.upsert({
      where: { blockerId_blockedId: { blockerId: user.id, blockedId: targetId } },
      update: {},
      create: { blockerId: user.id, blockedId: targetId },
    });

    /*
     * Blocking severs the connection too.
     *
     * Leaving it in place would be a genuine leak rather than an untidiness: a connection
     * is what grants access to CIRCLE posts, so a dormant one means that the moment the
     * block is lifted — or anywhere a code path checks connections without checking
     * blocks — the two are back inside each other's circle without either of them
     * choosing that.
     */
    await tx.connection.deleteMany({
      where: {
        OR: [
          { requesterId: user.id, addresseeId: targetId },
          { requesterId: targetId, addresseeId: user.id },
        ],
      },
    });

    // Their hearts and passes on each other's work go too — a Love is a signal to the
    // author, and one from someone you've blocked shouldn't keep sitting there.
    await tx.love.deleteMany({
      where: {
        OR: [
          { userId: user.id, post: { authorId: targetId } },
          { userId: targetId, post: { authorId: user.id } },
        ],
      },
    });
    await tx.echo.deleteMany({
      where: {
        OR: [
          { userId: user.id, post: { authorId: targetId } },
          { userId: targetId, post: { authorId: user.id } },
        ],
      },
    });
  });

  // Deliberately no notification to the blocked person.
  revalidatePath("/");
  revalidatePath("/circle");
  revalidatePath("/settings/blocked");
  return { ok: true };
}

export async function unblockUser(targetId: string): Promise<BlockResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  // Scoped to blocks this person made: you can lift your own block, never someone
  // else's block of you.
  await db.block.deleteMany({ where: { blockerId: user.id, blockedId: targetId } });

  // The connection is not restored. It was deleted when the block was made, and quietly
  // putting two people back in each other's circle is not something to do on their behalf.
  revalidatePath("/");
  revalidatePath("/settings/blocked");
  return { ok: true };
}

/** The people this viewer has blocked, for the manage list. Never who blocked them. */
export async function listBlocked() {
  const user = await getSessionUser();
  if (!user) return [];

  const rows = await db.block.findMany({
    where: { blockerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      blocked: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
    },
  });

  return rows.map((row) => ({ ...row.blocked, blockedAt: row.createdAt }));
}
