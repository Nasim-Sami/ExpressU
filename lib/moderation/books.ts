import "server-only";

import { assess } from "./claude";
import { db } from "../db";
import { notify } from "../notify";

/**
 * Checking a book before anyone can read it.
 *
 * This runs the same model, with the same verdict ladder, as the check on posts — but a
 * book is text a child will sit and read for an hour, so the bar for what reaches the
 * shelf is deliberately the strict end of that ladder: anything the model flags as
 * *suspected*, not only *present*, goes to a person rather than to the shelf.
 *
 * When there's no API key the book waits for a human instead of being published unchecked.
 * A reading room that opens by default is the one failure mode not worth the convenience.
 */
export async function checkBook(bookId: string): Promise<void> {
  const book = await db.book.findUnique({
    where: { id: bookId },
    include: {
      uploader: { select: { handle: true } },
      pages: { orderBy: { number: "asc" }, select: { text: true } },
    },
  });
  if (!book) return;

  // Enough of the text to judge what the book is, without shipping a novel to the model.
  const text = book.pages
    .map((page) => page.text)
    .join("\n\n")
    .slice(0, 40_000);

  const result = await assess({
    title: book.title,
    caption: [book.blurb, `Written by ${book.author}`, `For readers aged ${book.minAge}–${book.maxAge}`]
      .filter(Boolean)
      .join(". "),
    authorHandle: book.uploader?.handle ?? "the platform",
    attachments: [],
    frames: [],
    documentText: text,
  });

  if (!result.ok) {
    // No verdict is not the same as a good verdict.
    await hold(book.id, book.uploaderId, "UNDER_REVIEW", result.failure);
    return;
  }

  const { explicit, relevance, gentle_note } = result.assessment;

  if (explicit.verdict === "present") {
    await block(book.id, book.uploaderId, gentle_note || EXPLICIT_MESSAGE, explicit.rationale);
    return;
  }

  if (explicit.verdict === "suspected" || relevance.verdict === "not_expressive") {
    await hold(book.id, book.uploaderId, "UNDER_REVIEW", explicit.rationale || relevance.rationale);
    return;
  }

  await db.book.update({
    where: { id: book.id },
    data: { moderationStatus: "LIVE", moderatedAt: new Date() },
  });

  if (book.uploaderId) {
    await notify(book.uploaderId, "MODERATION", {
      message: `“${book.title}” is on the shelf. Anyone can read it now.`,
      bookId: book.id,
    });
  }
}

const EXPLICIT_MESSAGE =
  "We've kept this book off the shelf. Some things aren't a fit for a reading room younger children use. If you think we've got this wrong, tell us — a real person will read it.";

async function block(bookId: string, uploaderId: string | null, message: string, rationale: string) {
  await db.book.update({
    where: { id: bookId },
    data: { moderationStatus: "BLOCKED", moderatedAt: new Date() },
  });

  await db.reviewItem.create({
    data: { kind: "BOOK_BLOCKED", subjectId: bookId, notes: rationale },
  });

  if (uploaderId) await notify(uploaderId, "MODERATION", { message, bookId });
}

async function hold(bookId: string, uploaderId: string | null, status: string, reason: string) {
  await db.book.update({
    where: { id: bookId },
    data: { moderationStatus: status, moderatedAt: new Date() },
  });

  await db.reviewItem.create({
    data: { kind: "BOOK_REVIEW", subjectId: bookId, notes: reason },
  });

  if (uploaderId) {
    await notify(uploaderId, "MODERATION", {
      message:
        "Someone from our team is reading this one before it goes on the shelf. That's not a mark against you — books get a closer look because children read them.",
      bookId,
    });
  }
}
