"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";

/**
 * Circles.
 *
 * Mutual and opt-in: a connection only exists once both people agree, because CIRCLE
 * visibility depends on it. There is no follower count anywhere — a circle is who you
 * chose to let in, not an audience you accumulated.
 */

export async function requestConnection(targetId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user || user.id === targetId) return;

  /*
   * A block stops a connection request in either direction.
   *
   * Checked here rather than only hidden in the UI, because the button is not the only
   * way to reach this: the profile is a 404 for a blocked person, but a server action is
   * a URL, and someone who kept the target's id could otherwise keep tapping on the door.
   * Returns silently — telling them a block exists is precisely what a block avoids.
   */
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: user.id, blockedId: targetId },
        { blockerId: targetId, blockedId: user.id },
      ],
    },
    select: { id: true },
  });
  if (blocked) return;

  const existing = await db.connection.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: targetId },
        { requesterId: targetId, addresseeId: user.id },
      ],
    },
  });

  // If they already asked us, treat this as accepting.
  if (existing) {
    if (existing.status === "PENDING" && existing.addresseeId === user.id) {
      await db.connection.update({
        where: { id: existing.id },
        data: { status: "ACCEPTED" },
      });
      await notify(existing.requesterId, "CONNECTION", { userId: user.id, accepted: true });
    }
    revalidatePath("/circle");
    return;
  }

  await db.connection.create({
    data: { requesterId: user.id, addresseeId: targetId, status: "PENDING" },
  });
  await notify(targetId, "CONNECTION", { userId: user.id, accepted: false });

  revalidatePath("/circle");
}

export async function acceptConnection(connectionId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.addresseeId !== user.id) return;

  await db.connection.update({
    where: { id: connectionId },
    data: { status: "ACCEPTED" },
  });
  await notify(connection.requesterId, "CONNECTION", { userId: user.id, accepted: true });

  revalidatePath("/circle");
  revalidatePath("/");
}

/**
 * Leaving a circle is deliberately quiet: no notification is sent. Being told you were
 * removed is a small public verdict, and this platform doesn't deal in those.
 */
export async function removeConnection(connectionId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection) return;
  if (connection.requesterId !== user.id && connection.addresseeId !== user.id) return;

  await db.connection.delete({ where: { id: connectionId } });

  revalidatePath("/circle");
  revalidatePath("/");
}
