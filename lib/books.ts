import "server-only";

import { db } from "./db";
import { ranked } from "./fuzzy";
import type { Viewer } from "./visibility";

/**
 * The reading room.
 *
 * Books have their own, much simpler visibility rule than posts: a book is either
 * published to everyone or not published at all. There is no "just me" shelf here,
 * because a book nobody may read isn't a book — it's a draft, and the place for private
 * writing on ExpressU is a post, which has a real privacy model.
 *
 * What that means concretely: `LIVE` is readable by anyone, and everything else is
 * readable only by whoever uploaded it (and by an admin, through the review queue).
 */

export interface BookCard {
  id: string;
  title: string;
  author: string;
  blurb: string | null;
  language: string;
  minAge: number;
  maxAge: number;
  coverKey: string | null;
  pageCount: number;
  moderationStatus: string;
  uploader: { handle: string; displayName: string } | null;
}

const cardSelect = {
  id: true,
  title: true,
  author: true,
  blurb: true,
  language: true,
  minAge: true,
  maxAge: true,
  coverKey: true,
  moderationStatus: true,
  uploader: { select: { handle: true, displayName: true } },
  _count: { select: { pages: true } },
} as const;

type CardRow = {
  _count: { pages: number };
} & Omit<BookCard, "pageCount">;

function toCard(row: CardRow): BookCard {
  const { _count, ...rest } = row;
  return { ...rest, pageCount: _count.pages };
}

/** Whether this viewer may open this book at all. */
export function canRead(
  viewer: Viewer | null,
  book: { moderationStatus: string; uploaderId?: string | null },
): boolean {
  if (book.moderationStatus === "LIVE") return true;
  // The person who uploaded it can always see their own, including while it's being
  // checked — nobody should watch a spinner wondering whether their book was allowed.
  return Boolean(viewer && book.uploaderId && viewer.id === book.uploaderId);
}

/** The Prisma equivalent of `canRead`, for list queries. */
export function readableBookWhere(viewer: Viewer | null) {
  if (!viewer) return { moderationStatus: "LIVE" };
  return {
    OR: [{ moderationStatus: "LIVE" }, { uploaderId: viewer.id }],
  };
}

export interface LibraryFilters {
  query?: string;
  language?: string;
  /** Show books suitable for a reader of this age. */
  age?: number;
}

/**
 * The library shelf.
 *
 * Searching is typo-tolerant and covers title, author and blurb — a child who half
 * remembers a name should still find the book. Ordering is by how well it matches, and
 * by recency otherwise. There is no popularity term, here or anywhere.
 */
export async function getLibrary(
  viewer: Viewer | null,
  { query = "", language, age }: LibraryFilters = {},
): Promise<BookCard[]> {
  const rows = await db.book.findMany({
    where: {
      AND: [
        readableBookWhere(viewer),
        ...(language ? [{ language }] : []),
        ...(age ? [{ minAge: { lte: age } }, { maxAge: { gte: age } }] : []),
      ],
    },
    select: cardSelect,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const cards = rows.map(toCard);
  const trimmed = query.trim();
  if (trimmed.length < 2) return cards;

  return ranked(trimmed, cards, (book) => [
    { text: book.title, weight: 1 },
    { text: book.author, weight: 0.9 },
    { text: book.blurb ?? "", weight: 0.4 },
  ]);
}

export async function getBook(viewer: Viewer | null, id: string) {
  const book = await db.book.findUnique({
    where: { id },
    include: {
      uploader: { select: { id: true, handle: true, displayName: true } },
      pages: { orderBy: { number: "asc" }, select: { number: true, text: true } },
    },
  });

  if (!book) return null;
  if (!canRead(viewer, book)) return null;
  return book;
}

/** One page, for the reader. Kept separate so a long book isn't shipped in full. */
export async function getPage(viewer: Viewer | null, bookId: string, number: number) {
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      author: true,
      language: true,
      moderationStatus: true,
      uploaderId: true,
      _count: { select: { pages: true } },
    },
  });

  if (!book || !canRead(viewer, book)) return null;

  const page = await db.bookPage.findUnique({
    where: { bookId_number: { bookId, number } },
    select: { number: true, text: true },
  });

  return { book, page, pageCount: book._count.pages };
}
