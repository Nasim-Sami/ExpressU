import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { withdrawBook } from "@/lib/actions/books";
import { mediaUrl } from "@/lib/media-url";

export const metadata = { title: "Manage a book — ExpressU" };

/**
 * The uploader's own controls.
 *
 * Taking your own book back down is unconditional and needs nobody's permission — the
 * same rule as deleting your own post. What you put here stays yours.
 */
export default async function ManageBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const book = await db.book.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      author: true,
      moderationStatus: true,
      uploaderId: true,
      sourceKey: true,
      sourceFilename: true,
      createdAt: true,
      _count: { select: { pages: true, reports: true } },
    },
  });

  if (!book || book.uploaderId !== user.id) notFound();

  const remove = async () => {
    "use server";
    await withdrawBook(id);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href={`/read/${book.id}`} className="text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Back to the book
      </Link>

      <h1 className="font-display mt-4 text-2xl font-semibold">{book.title}</h1>
      <p style={{ color: "var(--ink-muted)" }}>{book.author}</p>

      <dl className="eu-card mt-5 grid grid-cols-2 gap-4 p-5 text-sm">
        <Row label="On the shelf?">
          {book.moderationStatus === "LIVE"
            ? "Yes — anyone can read it."
            : book.moderationStatus === "BLOCKED"
              ? "No. If you think that's wrong, tell us and a person will look again."
              : "Not yet — someone is reading it first."}
        </Row>
        <Row label="Pages">{book._count.pages}</Row>
        <Row label="Added">{book.createdAt.toLocaleDateString()}</Row>
        {book.sourceKey && (
          <Row label="The file you gave us">
            <a href={mediaUrl(book.sourceKey)} className="font-semibold hover:underline" download>
              {book.sourceFilename ?? "Download"}
            </a>
          </Row>
        )}
      </dl>

      <form action={remove} className="eu-card mt-5 p-5">
        <p className="font-semibold">Take it off the shelf</p>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          This removes the book and its pages for good. Nobody has to approve it — it&apos;s
          yours.
        </p>
        <button
          type="submit"
          className="eu-btn mt-4"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          Remove this book
        </button>
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
