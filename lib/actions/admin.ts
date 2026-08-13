"use server";

import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import * as storage from "@/lib/storage";
import { applySuspension, clearStrikes } from "@/lib/moderation/strikes";
import { SUSPENSION_DAYS } from "@/lib/constants";

/**
 * The human end of the safety system.
 *
 * Note that the automated pipeline can warn, hide, and count — but the only code path
 * that suspends an account is `approveBan` below, and it requires an admin's id. That
 * separation is the whole reason a classifier can't take a young person's voice away for
 * two weeks on its own.
 */

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new Error("Not allowed");
  return user;
}

async function resolve(itemId: string, resolution: string, notes?: string) {
  await db.reviewItem.update({
    where: { id: itemId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolution, notes },
  });
  revalidatePath("/admin");
}

/** Approve the 15-day pause. The only place a Suspension is ever created. */
export async function approveBan(itemId: string, userId: string): Promise<void> {
  const admin = await requireAdmin();

  await applySuspension(
    userId,
    admin.id,
    `${SUSPENSION_DAYS}-day pause after repeated off-purpose posts, approved by @${admin.handle}.`,
  );

  await notify(userId, "MODERATION", {
    message: `You can't post new ideas for ${SUSPENSION_DAYS} days. Everything you've already shared is still here and still yours. If you think this is wrong, reply to this and a person will read it.`,
    appealable: true,
  });

  await resolve(itemId, "BAN_APPROVED");
}

/** Decide the strikes were wrong. Wipes the record — no "final warning" hanging over them. */
export async function dismissBan(itemId: string, userId: string): Promise<void> {
  await requireAdmin();
  await clearStrikes(userId);
  await resolve(itemId, "BAN_DISMISSED");
  revalidatePath("/admin");
}

/** The uncertain-originality case: a human confirms the young person did make it. */
export async function confirmOriginal(itemId: string, entryId: string): Promise<void> {
  await requireAdmin();

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { postId: true, post: { select: { authorId: true, moderationStatus: true } } },
  });
  if (!entry) return;

  // If it was held back, let it through now.
  if (entry.post.moderationStatus !== "LIVE") {
    await db.post.update({
      where: { id: entry.postId },
      data: { moderationStatus: "LIVE" },
    });
    await notify(entry.post.authorId, "MODERATION", {
      postId: entry.postId,
      message: "All good — your idea is up. Thanks for waiting.",
    });
  }

  await resolve(itemId, "CONFIRMED_ORIGINAL");
}

/** Uphold a block, or block something that had been published. */
export async function upholdBlock(itemId: string, entryId: string, why: string): Promise<void> {
  await requireAdmin();

  const entry = await db.entry.findUnique({
    where: { id: entryId },
    select: { postId: true, post: { select: { authorId: true } } },
  });
  if (!entry) return;

  await db.post.update({
    where: { id: entry.postId },
    data: { moderationStatus: "BLOCKED" },
  });

  await notify(entry.post.authorId, "MODERATION", {
    postId: entry.postId,
    message: why,
    appealable: true,
  });

  await resolve(itemId, "BLOCK_UPHELD", why);
}

/** An appeal succeeded — put the idea back. */
export async function restoreIdea(itemId: string, postId: string): Promise<void> {
  await requireAdmin();

  const idea = await db.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!idea) return;

  await db.post.update({ where: { id: postId }, data: { moderationStatus: "LIVE" } });
  await clearStrikes(idea.authorId);

  await notify(idea.authorId, "MODERATION", {
    postId,
    message: "You were right and we were wrong — your idea is back up. Sorry about that.",
  });

  await resolve(itemId, "RESTORED");
}

/* -------------------------------------------------------------------------- */
/*  Acting on a person, not just a post                                        */
/* -------------------------------------------------------------------------- */

/**
 * A warning: the lightest thing an admin can do, and the one that should be reached for
 * first. It changes nothing about the account — it is a person saying "this isn't what
 * this place is for", which for most young people is the whole intervention needed.
 */
export async function warnUser(
  itemId: string,
  userId: string,
  message: string,
): Promise<void> {
  const admin = await requireAdmin();

  const note = message.trim().slice(0, 1000);
  await notify(userId, "MODERATION", {
    message:
      note ||
      "Something you posted isn't quite what ExpressU is for. Nothing has been removed — just have a think before the next one.",
    appealable: true,
  });

  await resolve(itemId, "WARNED", `Warned by @${admin.handle}: ${note}`);
}

/**
 * Suspend an account outside the strike process — for a report serious enough that
 * waiting for four strikes would be absurd.
 *
 * Still an admin's decision, still recorded against their id, and still leaves everything
 * the person has already shared exactly where it is. A pause is not an erasure.
 */
export async function suspendUser(
  itemId: string,
  userId: string,
  why: string,
): Promise<void> {
  const admin = await requireAdmin();

  const reason = why.trim().slice(0, 500) || "Reported content";
  await applySuspension(
    userId,
    admin.id,
    `${SUSPENSION_DAYS}-day pause after a report, approved by @${admin.handle}. ${reason}`,
  );

  await notify(userId, "MODERATION", {
    message: `You can't post for ${SUSPENSION_DAYS} days. Everything you've already shared is still here and still yours. If you think this is wrong, reply to this and a person will read it.`,
    appealable: true,
  });

  await resolve(itemId, "USER_SUSPENDED", `${reason} (by @${admin.handle})`);
}

/**
 * Remove an account and everything in it.
 *
 * The last resort, and irreversible. Every Post, Entry, Attachment row, Love, Echo, note
 * and connection goes with the User via the schema's cascades — but the *files* on disk
 * are not covered by a database cascade, so they are deleted explicitly here first.
 * Leaving a deleted child's photographs sitting in storage would be the worst possible
 * outcome of a delete.
 *
 * The `reason` is written to the resolved review item before the user disappears, so the
 * record of why survives the account.
 */
export async function deleteUser(
  itemId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    throw new Error("You can't delete your own account from the review queue.");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { handle: true, role: true, avatarKey: true, coverKey: true },
  });
  if (!target) throw new Error("No such user");
  if (target.role === "ADMIN") {
    // Removing another admin is an account-administration decision, not a moderation one.
    throw new Error("Admin accounts can't be deleted from the review queue.");
  }

  const attachments = await db.attachment.findMany({
    where: { entry: { post: { authorId: userId } } },
    select: { storageKey: true, posterKey: true },
  });

  for (const attachment of attachments) {
    await storage.remove(attachment.storageKey);
    if (attachment.posterKey) await storage.remove(attachment.posterKey);
  }
  if (target.avatarKey) await storage.remove(target.avatarKey);
  if (target.coverKey) await storage.remove(target.coverKey);

  // Resolve first: once the user row is gone, anything referencing it is gone too, and
  // we would lose the record of who did this and why.
  await resolve(
    itemId,
    "USER_DELETED",
    `@${target.handle} deleted by @${admin.handle}. ${reason.trim().slice(0, 500)}`,
  );

  await db.user.delete({ where: { id: userId } });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function dismissReport(itemId: string): Promise<void> {
  await requireAdmin();
  await resolve(itemId, "REPORT_DISMISSED");
}

/* ── The reading room ─────────────────────────────────────────────────────────────
 *
 * Three decisions an admin can make about a book, and only these three. Note what is
 * missing: there is no "edit the book" — an admin either lets a book stand or takes it
 * off the shelf, but never quietly rewrites what somebody wrote.
 */

/** Put a book on the shelf: the model held it, a person read it, it's fine. */
export async function shelveBook(itemId: string, bookId: string): Promise<void> {
  const admin = await requireAdmin();

  const book = await db.book.update({
    where: { id: bookId },
    data: { moderationStatus: "LIVE", moderatedAt: new Date() },
    select: { title: true, uploaderId: true },
  });

  if (book.uploaderId) {
    await notify(book.uploaderId, "MODERATION", {
      message: `“${book.title}” is on the shelf now. Anyone can read it.`,
      bookId,
    });
  }

  await resolve(itemId, `SHELVED by @${admin.handle}`);
  revalidatePath("/read");
}

/** Take a book off the shelf. It stays readable by whoever uploaded it, and appealable. */
export async function unshelveBook(
  itemId: string,
  bookId: string,
  reason: string,
): Promise<void> {
  const admin = await requireAdmin();

  const book = await db.book.update({
    where: { id: bookId },
    data: { moderationStatus: "BLOCKED", moderatedAt: new Date() },
    select: { title: true, uploaderId: true },
  });

  if (book.uploaderId) {
    await notify(book.uploaderId, "MODERATION", {
      message:
        reason.trim() ||
        `We've taken “${book.title}” off the shelf. If you think that's wrong, tell us and a person will read it again.`,
      bookId,
    });
  }

  await resolve(itemId, `UNSHELVED by @${admin.handle}`, reason.trim() || undefined);
  revalidatePath("/read");
}

/** Delete a book outright: the pages, the uploaded file, the cover, all of it. */
export async function destroyBook(itemId: string, bookId: string, reason: string): Promise<void> {
  const admin = await requireAdmin();

  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { title: true, uploaderId: true, coverKey: true, sourceKey: true },
  });
  if (!book) return;

  // Files first: a row deleted with its storage still on disk leaves the file orphaned
  // and unreachable, which is the one state nobody can clean up later.
  for (const key of [book.coverKey, book.sourceKey]) {
    if (key) await storage.remove(key);
  }

  await db.book.delete({ where: { id: bookId } });

  if (book.uploaderId) {
    await notify(book.uploaderId, "MODERATION", {
      message:
        reason.trim() ||
        `We've removed “${book.title}” from ExpressU. If you think that's wrong, tell us and a person will look.`,
    });
  }

  await resolve(itemId, `BOOK DELETED by @${admin.handle}`, reason.trim() || undefined);
  revalidatePath("/read");
}
