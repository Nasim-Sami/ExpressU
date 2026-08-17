import Link from "next/link";
import { notFound } from "next/navigation";

import { BookReportButton } from "@/components/BookReportButton";
import { Reader } from "@/components/Reader";
import { getViewer } from "@/lib/auth";
import { canRead } from "@/lib/books";
import { canSeePerson } from "@/lib/visibility";
import { db } from "@/lib/db";
import { findInPages } from "@/lib/pagination";
import { isoDate, readableDate, readableDateTime } from "@/lib/format";

/**
 * The reader.
 *
 * Opening a book puts you straight on page one — there is no cover page to click through
 * and no "start reading" button, because the thing you came here to do is read.
 *
 * Only the page you're on is loaded. A two-thousand-page book would otherwise ship in
 * full to a phone on a slow connection, and the page you want is one of them.
 */
export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; find?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, find = "" } = await searchParams;

  const viewer = await getViewer();

  const book = await db.book.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      author: true,
      blurb: true,
      language: true,
      minAge: true,
      maxAge: true,
      moderationStatus: true,
      uploaderId: true,
      createdAt: true,
      sourceKey: true,
      sourceFilename: true,
      uploader: { select: { handle: true, displayName: true } },
      _count: { select: { pages: true } },
    },
  });

  if (!book || !canRead(viewer, book)) notFound();

  const pageCount = book._count.pages;
  const requested = Number(pageParam);
  const number = Number.isFinite(requested) ? Math.min(Math.max(1, Math.trunc(requested)), pageCount) : 1;

  const page = await db.bookPage.findUnique({
    where: { bookId_number: { bookId: book.id, number } },
    select: { text: true },
  });

  // "Search inside" runs against the database rather than a loaded copy of the book, so
  // it works on a long book without sending the whole thing to the browser. The excerpts
  // then come from findInPages, which is the tested one.
  const query = find.trim();
  const matches =
    query.length >= 2
      ? await db.bookPage.findMany({
          where: { bookId: book.id, text: { contains: query } },
          select: { number: true, text: true },
          orderBy: { number: "asc" },
          take: 20,
        })
      : [];
  const hits = findInPages(matches, query);

  const isUploader = viewer?.id === book.uploaderId;
  const href = (next: number) => `/read/${book.id}?page=${next}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/read" className="text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Reading room
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-2xl font-semibold">{book.title}</h1>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {book.author} · ages {book.minAge}–{book.maxAge}
          {/*
            A book stays on the shelf even if you've blocked whoever put it there — it is
            usually somebody else's story, and removing it from the library would punish
            the reader rather than protect them. What does go is the credit line, since it
            would otherwise link to a profile that 404s for this viewer.
          */}
          {book.uploader && canSeePerson(viewer, book.uploaderId ?? "") && (
            <>
              {" · added by "}
              <Link href={`/u/${book.uploader.handle}`} className="hover:underline">
                {book.uploader.displayName}
              </Link>
            </>
          )}
          {" · "}
          <time dateTime={isoDate(book.createdAt)} title={readableDateTime(book.createdAt)}>
            {readableDate(book.createdAt)}
          </time>
        </p>
        {book.blurb && (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            {book.blurb}
          </p>
        )}
      </header>

      {book.moderationStatus !== "LIVE" && (
        <p
          className="mt-4 rounded-xl p-4 text-sm"
          style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
        >
          {book.moderationStatus === "PENDING" || book.moderationStatus === "UNDER_REVIEW"
            ? "Only you can see this one at the moment — someone is reading it before it goes on the shelf. Books get a closer look because children read them."
            : "This one isn't on the shelf. If you think that's wrong, tell us and a person will look again."}
        </p>
      )}

      {/* Finding a page, either by its number or by something you remember from it. */}
      <form action={`/read/${book.id}`} method="get" className="mt-5 flex flex-wrap gap-2">
        <input
          type="number"
          name="page"
          min={1}
          max={pageCount}
          defaultValue={number}
          aria-label={`Go to a page, 1 to ${pageCount}`}
          className="eu-field w-28"
        />
        <input
          type="search"
          name="find"
          defaultValue={query}
          placeholder="…or find a word in this book"
          aria-label="Find a word in this book"
          className="eu-field min-w-0 flex-1"
        />
        <button type="submit" className="eu-btn eu-btn-quiet">
          Go
        </button>
      </form>

      {query.length >= 2 && (
        <div className="eu-card mt-3 p-4">
          <p className="text-sm font-semibold">
            {hits.length === 0
              ? `“${query}” isn't in this book.`
              : `“${query}” is on ${hits.length} ${hits.length === 1 ? "page" : "pages"}.`}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {hits.map((hit) => (
              <li key={hit.number}>
                <Link
                  href={`/read/${book.id}?page=${hit.number}&find=${encodeURIComponent(query)}`}
                  className="block rounded-lg p-2 text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                >
                  <span className="font-semibold" style={{ color: "var(--accent)" }}>
                    Page {hit.number}
                  </span>{" "}
                  <span style={{ color: "var(--ink-muted)" }}>{hit.excerpt}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="eu-card mt-5 p-6 sm:p-8">
        <Reader text={page?.text ?? ""} language={book.language} />
      </div>

      <nav aria-label="Pages" className="mt-4 flex items-center gap-3">
        {number > 1 ? (
          <Link href={href(number - 1)} className="eu-btn eu-btn-quiet">
            ← Back
          </Link>
        ) : (
          <span />
        )}

        <span className="flex-1 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
          Page {number} of {pageCount}
        </span>

        {number < pageCount ? (
          <Link href={href(number + 1)} className="eu-btn eu-btn-primary">
            Read on →
          </Link>
        ) : (
          <span className="text-sm font-semibold" style={{ color: "var(--growth)" }}>
            The end.
          </span>
        )}
      </nav>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t pt-4">
        <BookReportButton bookId={book.id} title={book.title} signedIn={Boolean(viewer)} />
        {isUploader && (
          <Link href={`/read/${book.id}/manage`} className="eu-btn eu-btn-quiet">
            Manage this book
          </Link>
        )}
      </div>
    </div>
  );
}
