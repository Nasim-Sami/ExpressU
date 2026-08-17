"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser, isSuspended } from "@/lib/auth";
import { db } from "@/lib/db";
import * as storage from "@/lib/storage";
import { extractDocxText, extractPdfPages, extractPdfText, extractPlainText } from "@/lib/media/text";
import { checkBook } from "@/lib/moderation/books";
import { paginate } from "@/lib/pagination";

/**
 * Putting a book on the shelf, and reporting one that shouldn't be there.
 *
 * As with posts, the upload returns immediately and the book waits in PENDING while it's
 * checked. Unlike posts, it is not readable by anyone else until that check comes back
 * clean — a reading room used by eight-year-olds doesn't get to publish first and ask
 * questions later.
 */

export interface BookFormState {
  error?: string;
}

const MAX_BOOK_BYTES = 64 * 1024 * 1024;
const MAX_PAGES = 2000;

const uploadSchema = z.object({
  title: z.string().trim().min(1, "A book needs a title.").max(200),
  author: z.string().trim().min(1, "Say who wrote it — even if that's you.").max(200),
  blurb: z.string().trim().max(600).optional(),
  language: z.enum(["bn", "en"]),
  minAge: z.coerce.number().int().min(0).max(18),
  maxAge: z.coerce.number().int().min(0).max(18),
});

const ACCEPTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
]);

export async function uploadBook(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const user = await getSessionUser();
  if (!user) return { error: "You need to be signed in to add a book." };
  if (isSuspended(user)) {
    return { error: "Your account is paused at the moment, so you can't add a book." };
  }

  const parsed = uploadSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    blurb: formData.get("blurb") || undefined,
    language: formData.get("language"),
    minAge: formData.get("minAge"),
    maxAge: formData.get("maxAge"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { title, author, blurb, language, minAge, maxAge } = parsed.data;
  if (minAge > maxAge) return { error: "The youngest age can't be higher than the oldest." };

  const file = formData.get("file");
  const typed = formData.get("text");
  const typedText = typeof typed === "string" ? typed.trim() : "";

  let pages: string[] = [];
  let sourceKey: string | null = null;
  let sourceFilename: string | null = null;
  let sourceMimeType: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BOOK_BYTES) return { error: "That file is too big — 64 MB is the limit." };

    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    const looksAccepted =
      ACCEPTED.has(file.type) || ["pdf", "docx", "doc", "txt", "md"].includes(ext);
    if (!looksAccepted) {
      return { error: "Books can be a PDF, a Word document, or a plain text file." };
    }

    const data = Buffer.from(await file.arrayBuffer());

    if (file.type === "application/pdf" || ext === "pdf") {
      // Keep the PDF's own pages where we can, so "go to page 12" means page 12.
      const perPage = (await extractPdfPages(data)).filter((page) => page.trim().length > 0);
      if (perPage.length > 0) {
        pages = perPage;
      } else {
        const { text } = await extractPdfText(data);
        pages = paginate(text);
      }
    } else if (ext === "docx" || ext === "doc") {
      pages = paginate(await extractDocxText(data));
    } else {
      pages = paginate(extractPlainText(data));
    }

    if (pages.length === 0) {
      return {
        error:
          "We couldn't read any text out of that file. If it's a scan of printed pages, we can't read those yet — a PDF with real text, or a Word or text file, will work.",
      };
    }

    sourceKey = storage.buildKey(file.name);
    sourceFilename = file.name;
    sourceMimeType = file.type || "application/octet-stream";
    await storage.put(sourceKey, data);
  } else if (typedText) {
    pages = paginate(typedText);
  } else {
    return { error: "Add a file, or write the story straight into the box." };
  }

  if (pages.length > MAX_PAGES) pages = pages.slice(0, MAX_PAGES);

  const cover = formData.get("cover");
  let coverKey: string | null = null;
  if (cover instanceof File && cover.size > 0 && cover.type.startsWith("image/")) {
    coverKey = storage.buildKey(cover.name);
    await storage.put(coverKey, Buffer.from(await cover.arrayBuffer()));
  }

  const book = await db.book.create({
    data: {
      title,
      author,
      blurb: blurb || null,
      language,
      minAge,
      maxAge,
      coverKey,
      sourceKey,
      sourceFilename,
      sourceMimeType,
      uploaderId: user.id,
      moderationStatus: "PENDING",
      pages: {
        create: pages.map((text, index) => ({ number: index + 1, text })),
      },
    },
  });

  // Checked after the response is sent: the uploader gets their page back straight away
  // and a notification when it lands on the shelf. `after` rather than a bare floating
  // promise, so the work is guaranteed a chance to finish instead of racing the request
  // teardown.
  after(async () => {
    try {
      await checkBook(book.id);
    } catch {
      // A crashed check must never leave a book readable. PENDING is already the safe
      // state, so there is nothing to undo — it simply waits for a person.
    }
  });

  revalidatePath("/read");
  redirect(`/read/${book.id}`);
}

/**
 * Reporting a book, with a description — the user asked for the description specifically,
 * and it's the right call: "what happened" is exactly what the person reading the queue
 * needs, and a category alone rarely says it.
 */
export async function reportBook(
  bookId: string,
  reason: string,
): Promise<{ sent: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { sent: false, error: "Sign in first." };

  const trimmed = reason.trim().slice(0, 2000);
  if (trimmed.length < 3) {
    return { sent: false, error: "Say what's wrong with it, even briefly." };
  }

  const book = await db.book.findUnique({ where: { id: bookId }, select: { title: true } });
  if (!book) return { sent: false, error: "That book isn't here any more." };

  const already = await db.bookReport.findUnique({
    where: { bookId_reporterId: { bookId, reporterId: user.id } },
  });
  // Reported twice is reported once — and saying so would tell them their first report
  // is still sitting there, which is not information a reporter needs.
  if (already) return { sent: true };

  const report = await db.bookReport.create({
    data: { bookId, reporterId: user.id, reason: trimmed },
  });

  // The book stays readable until a person decides otherwise. A report is a reason to
  // look, not a verdict — otherwise reporting becomes a way to silence someone.
  await db.reviewItem.create({
    data: {
      kind: "BOOK_REPORT",
      subjectId: report.id,
      notes: `“${book.title}” — ${trimmed}`,
    },
  });

  revalidatePath("/admin");
  return { sent: true };
}

/** The uploader taking their own book back down. */
export async function withdrawBook(bookId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { uploaderId: true, coverKey: true, sourceKey: true },
  });
  if (!book || book.uploaderId !== user.id) return;

  for (const key of [book.coverKey, book.sourceKey]) {
    if (key) await storage.remove(key);
  }
  await db.book.delete({ where: { id: bookId } });

  revalidatePath("/read");
  redirect("/read");
}
