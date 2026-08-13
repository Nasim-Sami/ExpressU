import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminActions } from "@/components/AdminActions";
import { MediaBlock } from "@/components/MediaBlock";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toAttachmentView } from "@/lib/posts";
import { STRIKES_BEFORE_BAN_REVIEW, SUSPENSION_DAYS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";

/**
 * The review queue.
 *
 * Every item shows the actual material and the model's own words about it, because the
 * point of a human in this loop is to judge the evidence — an admin shown only a verdict
 * label will rubber-stamp it, which is the same as having no human at all.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") notFound();

  const items = await db.reviewItem.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Review queue</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        {items.length === 0
          ? "Nothing waiting. "
          : `${items.length} ${items.length === 1 ? "thing" : "things"} waiting. `}
        Read the material before you act — the model&apos;s verdict is an opinion, not a
        decision.
      </p>

      {items.length === 0 ? (
        <div className="eu-card mt-6 p-8 text-center">
          <p style={{ color: "var(--ink-muted)" }}>All clear.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {items.map((item) => (
            <li key={item.id}>
              <ReviewCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Item = { id: string; kind: string; subjectId: string; notes: string | null; createdAt: Date };

async function ReviewCard({ item }: { item: Item }) {
  switch (item.kind) {
    case "BAN_CONFIRM":
      return <BanCard item={item} />;
    case "ORIGINALITY_UNSURE":
      return <ChapterCard item={item} />;
    case "BLOCK_APPEAL":
      return <AppealCard item={item} />;
    case "USER_REPORT":
      return <ReportCard item={item} />;
    case "BOOK_REVIEW":
    case "BOOK_BLOCKED":
      return <BookCard item={item} />;
    case "BOOK_REPORT":
      return <BookReportCard item={item} />;
    default:
      return null;
  }
}

function Shell({
  tone,
  label,
  children,
}: {
  tone: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="eu-card p-5">
      <span
        className="inline-block rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
        style={{ background: tone, color: "var(--ink)" }}
      >
        {label}
      </span>
      <div className="mt-3">{children}</div>
    </div>
  );
}

async function BanCard({ item }: { item: Item }) {
  const subject = await db.user.findUnique({
    where: { id: item.subjectId },
    select: { id: true, handle: true, displayName: true, birthYear: true },
  });
  if (!subject) return null;

  const strikes = await db.strike.findMany({
    where: { userId: subject.id, clearedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      entry: {
        include: {
          attachments: true,
          post: { select: { id: true, title: true } },
          moderationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const age = subject.birthYear ? new Date().getUTCFullYear() - subject.birthYear : null;

  return (
    <Shell tone="var(--love-soft)" label={`Pause request — needs your decision`}>
      <p className="font-semibold">
        <Link href={`/u/${subject.handle}`} className="hover:underline">
          {subject.displayName} (@{subject.handle})
        </Link>
        {age !== null && (
          <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
            {" "}
            · {age} years old
          </span>
        )}
      </p>

      <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
        {STRIKES_BEFORE_BAN_REVIEW} posts in a row were judged off-purpose. Approving pauses
        posting for {SUSPENSION_DAYS} days. Their existing ideas stay up either way.
      </p>

      <ol className="mt-4 flex flex-col gap-3">
        {strikes.map((strike) => {
          const run = strike.entry?.moderationRuns[0];
          return (
            <li
              key={strike.id}
              className="rounded-xl p-3 text-sm"
              style={{ background: "var(--surface-sunken)" }}
            >
              <p className="font-semibold">{strike.entry?.post.title ?? "(deleted)"}</p>
              {strike.entry?.body && (
                <p className="mt-1 whitespace-pre-wrap">{strike.entry.body.slice(0, 400)}</p>
              )}
              {strike.entry && <MediaBlock attachments={strike.entry.attachments.map(toAttachmentView)} />}
              {run?.rationale && (
                <p className="mt-2 italic" style={{ color: "var(--ink-muted)" }}>
                  Model said: {run.rationale}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <AdminActions kind="BAN_CONFIRM" itemId={item.id} subjectId={subject.id} />
    </Shell>
  );
}

async function ChapterCard({ item }: { item: Item }) {
  const entry = await db.entry.findUnique({
    where: { id: item.subjectId },
    include: {
      attachments: true,
      post: {
        select: {
          id: true,
          title: true,
          moderationStatus: true,
          author: { select: { handle: true, displayName: true } },
        },
      },
      moderationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!entry) return null;

  const run = entry.moderationRuns[0];

  return (
    <Shell tone="var(--accent-soft)" label="Not sure — a second opinion">
      <p className="font-semibold">
        <Link href={`/post/${entry.post.id}`} className="hover:underline">
          {entry.post.title}
        </Link>{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          by @{entry.post.author.handle} · currently {entry.post.moderationStatus.toLowerCase()}
        </span>
      </p>

      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <MediaBlock attachments={entry.attachments.map(toAttachmentView)} />

      {run && (
        <div className="mt-3 rounded-xl p-3 text-sm" style={{ background: "var(--surface-sunken)" }}>
          <p>
            <strong>Model:</strong> explicit {run.explicitVerdict ?? "—"}, originality{" "}
            {run.originalityVerdict ?? "—"}, relevance {run.relevanceVerdict ?? "—"}
          </p>
          {run.signals && run.signals !== "[]" && <p className="mt-1">Signals: {run.signals}</p>}
          {run.rationale && (
            <p className="mt-1 italic" style={{ color: "var(--ink-muted)" }}>
              {run.rationale}
            </p>
          )}
        </div>
      )}

      {item.notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
          {item.notes}
        </p>
      )}

      <AdminActions kind="ORIGINALITY_UNSURE" itemId={item.id} subjectId={entry.id} />
    </Shell>
  );
}

async function AppealCard({ item }: { item: Item }) {
  const idea = await db.post.findUnique({
    where: { id: item.subjectId },
    include: {
      author: { select: { handle: true, displayName: true } },
      entries: {
        orderBy: { ordinal: "asc" },
        include: {
          attachments: true,
          moderationRuns: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!idea) return null;

  const run = idea.entries[0]?.moderationRuns[0];

  return (
    <Shell tone="var(--growth-soft)" label="Someone says we got it wrong">
      <p className="font-semibold">
        {idea.title}{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          by @{idea.author.handle}
        </span>
      </p>

      <blockquote
        className="mt-3 rounded-xl border-l-4 p-3 text-sm"
        style={{ borderColor: "var(--growth)", background: "var(--surface-sunken)" }}
      >
        {item.notes}
      </blockquote>

      {idea.entries.map((entry) => (
        <div key={entry.id} className="mt-3">
          {entry.body && <p className="whitespace-pre-wrap text-sm">{entry.body}</p>}
          <MediaBlock attachments={entry.attachments.map(toAttachmentView)} />
        </div>
      ))}

      {run?.rationale && (
        <p className="mt-3 text-sm italic" style={{ color: "var(--ink-muted)" }}>
          We blocked it because: {run.rationale}
        </p>
      )}

      <AdminActions kind="BLOCK_APPEAL" itemId={item.id} subjectId={idea.id} />
    </Shell>
  );
}

async function ReportCard({ item }: { item: Item }) {
  const report = await db.report.findUnique({
    where: { id: item.subjectId },
    include: {
      post: {
        select: {
          id: true,
          title: true,
          author: { select: { id: true, handle: true } },
          // The first entry is what "take the post down" acts on.
          entries: { orderBy: { ordinal: "asc" }, take: 1, select: { id: true } },
        },
      },
      reporter: { select: { handle: true } },
    },
  });
  if (!report) return null;

  return (
    <Shell tone="var(--surface-sunken)" label="Reported by someone">
      <p className="font-semibold">
        <Link href={`/post/${report.post.id}`} className="hover:underline">
          {report.post.title}
        </Link>{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          by @{report.post.author.handle} · reported by @{report.reporter.handle}{" "}
          {timeAgo(report.createdAt)}
        </span>
      </p>
      <p className="mt-2 text-sm">{report.reason}</p>
      <AdminActions
        kind="USER_REPORT"
        itemId={item.id}
        subjectId={report.post.id}
        entryId={report.post.entries[0]?.id}
        authorId={report.post.author.id}
        authorHandle={report.post.author.handle}
      />
    </Shell>
  );
}

/**
 * A book the model held back, or blocked outright.
 *
 * The first page is shown inline and the rest is one click away, because "read the
 * material before you act" has to be practical — an admin who has to open a new tab to
 * see what they're judging will stop opening it.
 */
async function BookCard({ item }: { item: Item }) {
  const book = await db.book.findUnique({
    where: { id: item.subjectId },
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
      uploader: { select: { handle: true } },
      _count: { select: { pages: true } },
      pages: { orderBy: { number: "asc" }, take: 1, select: { text: true } },
    },
  });
  if (!book) return null;

  const blocked = book.moderationStatus === "BLOCKED";

  return (
    <Shell
      tone={blocked ? "var(--love-soft)" : "var(--accent-soft)"}
      label={blocked ? "Book blocked automatically" : "Book waiting to be read"}
    >
      <p className="font-semibold">
        <Link href={`/read/${book.id}`} className="hover:underline">
          {book.title}
        </Link>{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          by {book.author} · {book._count.pages} pages · ages {book.minAge}–{book.maxAge}
          {book.uploader && ` · added by @${book.uploader.handle}`}
        </span>
      </p>

      {book.blurb && <p className="mt-1 text-sm">{book.blurb}</p>}

      {item.notes && (
        <p
          className="mt-3 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
        >
          <strong>Why it stopped here:</strong> {item.notes}
        </p>
      )}

      {book.pages[0] && (
        <div className="mt-3">
          <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
            First page
          </p>
          <p className="mt-1 max-h-48 overflow-y-auto text-sm whitespace-pre-wrap" lang={book.language}>
            {book.pages[0].text}
          </p>
        </div>
      )}

      <AdminActions
        kind={blocked ? "BOOK_BLOCKED" : "BOOK_REVIEW"}
        itemId={item.id}
        subjectId={book.id}
        authorId={book.uploaderId ?? undefined}
        authorHandle={book.uploader?.handle}
      />
    </Shell>
  );
}

/** A book somebody reported, with the words they used. */
async function BookReportCard({ item }: { item: Item }) {
  const report = await db.bookReport.findUnique({
    where: { id: item.subjectId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          uploaderId: true,
          uploader: { select: { handle: true } },
          _count: { select: { pages: true } },
        },
      },
      reporter: { select: { handle: true } },
    },
  });
  if (!report) return null;

  return (
    <Shell tone="var(--surface-sunken)" label="Book reported by someone">
      <p className="font-semibold">
        <Link href={`/read/${report.book.id}`} className="hover:underline">
          {report.book.title}
        </Link>{" "}
        <span className="font-normal" style={{ color: "var(--ink-muted)" }}>
          by {report.book.author} · {report.book._count.pages} pages
          {report.book.uploader && ` · added by @${report.book.uploader.handle}`} · reported by
          @{report.reporter.handle} {timeAgo(report.createdAt)}
        </span>
      </p>

      <p className="mt-2 rounded-lg p-3 text-sm" style={{ background: "var(--surface-sunken)" }}>
        {report.reason}
      </p>

      <p className="mt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
        The book is still on the shelf. A report is a reason to read it, not a verdict.
      </p>

      <AdminActions
        kind="BOOK_REPORT"
        itemId={item.id}
        subjectId={report.book.id}
        authorId={report.book.uploaderId ?? undefined}
        authorHandle={report.book.uploader?.handle}
      />
    </Shell>
  );
}
