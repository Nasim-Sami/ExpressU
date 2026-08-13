"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Appeals and reports — the two routes from a person to a person.
 *
 * Every block an author receives carries an appeal link. That matters more here than on
 * most platforms: the thing being blocked may be the first creative work a fourteen-year-old
 * ever showed anyone, and "computer says no" with no way to answer back is precisely the
 * verdict ExpressU exists to avoid.
 */

export async function appealBlock(
  postId: string,
  message: string,
): Promise<{ sent: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { sent: false, error: "Sign in first." };

  const idea = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!idea || idea.authorId !== user.id) {
    return { sent: false, error: "That isn't yours to appeal." };
  }

  const open = await db.reviewItem.findFirst({
    where: { kind: "BLOCK_APPEAL", subjectId: postId, status: "OPEN" },
  });
  if (open) return { sent: true };

  await db.reviewItem.create({
    data: {
      kind: "BLOCK_APPEAL",
      subjectId: postId,
      notes: message.trim().slice(0, 2000) || "(no message)",
    },
  });

  // Held, not hidden, while a person looks.
  await db.post.update({
    where: { id: postId },
    data: { moderationStatus: "UNDER_REVIEW" },
  });

  revalidatePath(`/idea/${postId}`);
  return { sent: true };
}

export async function reportPost(
  postId: string,
  reason: string,
): Promise<{ sent: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { sent: false, error: "Sign in first." };

  const already = await db.report.findUnique({
    where: { postId_reporterId: { postId, reporterId: user.id } },
  });
  if (already) return { sent: true };

  const report = await db.report.create({
    data: { postId, reporterId: user.id, reason: reason.trim().slice(0, 1000) },
  });

  await db.reviewItem.create({
    data: { kind: "USER_REPORT", subjectId: report.id, notes: reason.trim().slice(0, 1000) },
  });

  return { sent: true };
}
