import Link from "next/link";
import { notFound } from "next/navigation";

import { AppealBox } from "@/components/AppealBox";
import { Avatar } from "@/components/Avatar";
import { EchoButton } from "@/components/EchoButton";
import { EncouragementSender } from "@/components/EncouragementSender";
import { EntryActions } from "@/components/EntryActions";
import { EntryComposer } from "@/components/EntryComposer";
import { KindIcon } from "@/components/KindIcon";
import { LoveButton } from "@/components/LoveButton";
import { MediaBlock } from "@/components/MediaBlock";
import { ReportButton } from "@/components/ReportButton";
import { TitleEditor } from "@/components/TitleEditor";
import { VisibilityEditor } from "@/components/VisibilityEditor";
import { getSessionUser, getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { FREE_TEXT_MIN_AGE, KIND_COPY } from "@/lib/constants";
import { isoDate, readableDate, timeAgo } from "@/lib/format";
import { getLovers, getPost } from "@/lib/posts";
import { authorStatusMessage } from "@/lib/visibility";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [viewer, sessionUser] = await Promise.all([getViewer(), getSessionUser()]);

  const post = await getPost(viewer, id);
  // 404 rather than 403 — a "you may not see this" would still confirm it exists.
  if (!post) notFound();

  const isAuthor = post.isAuthor;
  const statusNote = isAuthor ? authorStatusMessage(post.moderationStatus) : null;
  const copy = KIND_COPY[post.kind];

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <article className="flex flex-col gap-4">
        <header className="eu-card p-6">
          <div className="flex items-start gap-3">
            <Link href={`/u/${post.author.handle}`}>
              <Avatar user={post.author} size={48} />
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/u/${post.author.handle}`} className="font-semibold hover:underline">
                {post.author.displayName}
              </Link>
              {/* A div, not a p — VisibilityEditor expands into a block-level panel when
                  the author taps "Change", and a div can't legally sit inside a p. */}
              <div className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                <span>@{post.author.handle}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={isoDate(post.createdAt)}>started {timeAgo(post.createdAt)}</time>
                {isAuthor && (
                  <>
                    <span aria-hidden="true">·</span>
                    <VisibilityEditor postId={post.id} visibility={post.visibility} />
                  </>
                )}
              </div>
            </div>
            <span
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
            >
              <KindIcon kind={post.kind} className="h-3.5 w-3.5" />
              {post.kind === "HOBBY" && post.hobbyName
                ? post.hobbyName
                : copy.singular}
            </span>
          </div>

          {statusNote && (
            <div className="mt-4 flex flex-col items-start gap-3">
              <p
                className="rounded-xl px-4 py-3 text-sm"
                style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
              >
                {statusNote}
              </p>
              {/* A block always comes with a way to answer back. */}
              {post.moderationStatus === "BLOCKED" && <AppealBox postId={post.id} />}
            </div>
          )}

          {isAuthor ? (
            <TitleEditor postId={post.id} title={post.title} />
          ) : (
            <h1 className="mt-4 text-3xl font-semibold leading-tight">{post.title}</h1>
          )}

          {post.kind === "LETTER" && post.recipientType && (
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              An open letter to a {post.recipientType.toLowerCase()}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
            <LoveButton postId={post.id} initialLoved={post.viewerLoved} count={post.loveCount} />
            <EchoButton
              postId={post.id}
              initialEchoed={post.viewerEchoed}
              count={post.echoCount}
              isAuthor={isAuthor}
            />
          </div>
        </header>

        {/*
          The journal. First entry at the top, everything since below it, connected by a
          single line — so the page reads as a thing that is still going, not a thing that
          happened once.
        */}
        <ol className="flex flex-col gap-4">
          {post.entries.map((entry, index) => {
            const isLast = index === post.entries.length - 1;
            const edited = Boolean(entry.contentUpdatedAt);

            return (
              <li key={entry.id} className="relative pl-8">
                <span
                  aria-hidden="true"
                  className="absolute left-2.5 top-6 bottom-0 w-px"
                  style={{ background: isLast ? "transparent" : "var(--line-strong)" }}
                />
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-4 flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem] font-bold"
                  style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
                >
                  {entry.ordinal}
                </span>

                <div className="eu-card p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--growth)" }}>
                    {index === 0 ? copy.firstEntryLabel : `${copy.entryNoun} ${entry.ordinal}`}
                    <span className="ml-2 font-normal normal-case tracking-normal" style={{ color: "var(--ink-muted)" }}>
                      {readableDate(entry.createdAt)}
                      {edited && " · edited"}
                    </span>
                  </p>

                  {post.kind === "LETTER" && (entry.letterTo || entry.letterSubject) && (
                    <dl className="mt-3 grid gap-x-3 gap-y-1 text-sm" style={{ gridTemplateColumns: "auto 1fr" }}>
                      {entry.letterTo && (
                        <>
                          <dt className="font-semibold" style={{ color: "var(--ink-muted)" }}>
                            To
                          </dt>
                          <dd>{entry.letterTo}</dd>
                        </>
                      )}
                      {entry.letterSubject && (
                        <>
                          <dt className="font-semibold" style={{ color: "var(--ink-muted)" }}>
                            Subject
                          </dt>
                          <dd>{entry.letterSubject}</dd>
                        </>
                      )}
                    </dl>
                  )}

                  {entry.body && (
                    <p className="mt-2 whitespace-pre-wrap text-[1.05rem]">{entry.body}</p>
                  )}

                  <MediaBlock attachments={entry.attachments} />

                  {isAuthor && (
                    <EntryActions
                      entry={entry}
                      kind={post.kind}
                      isOnlyEntry={post.entries.length === 1}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {isAuthor && (
          <EntryComposer
            postId={post.id}
            kind={post.kind}
            nextOrdinal={post.entries.length + 1}
          />
        )}
      </article>

      <aside className="flex flex-col gap-4">
        {isAuthor ? (
          <AuthorPanel postId={post.id} kindNoun={copy.noun} />
        ) : (
          sessionUser && (
            <>
              <SendNote postId={post.id} authorId={post.author.id} />
              <div className="eu-card p-5">
                <h2 className="font-display text-lg font-semibold">Something wrong?</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
                  If this shouldn&apos;t be here, tell us and a person will look.
                </p>
                <div className="mt-2">
                  <ReportButton postId={post.id} />
                </div>
              </div>
            </>
          )
        )}
      </aside>
    </div>
  );
}

/** What only the author sees: who was moved, and the private notes they were sent. */
async function AuthorPanel({ postId, kindNoun }: { postId: string; kindNoun: string }) {
  const viewer = await getViewer();
  const lovers = await getLovers(viewer, postId);

  const encouragements = await db.encouragement.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    include: {
      preset: true,
      fromUser: { select: { handle: true, displayName: true, avatarKey: true } },
    },
  });

  const echoes = await db.echo.count({ where: { postId } });

  return (
    <>
      <div className="eu-card p-5">
        <h2 className="font-display text-lg font-semibold">Just for you</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          Nobody else can see this panel.
        </p>

        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          <p className="text-sm">
            {lovers.length === 0
              ? "Nobody has loved this yet."
              : lovers.length === 1
                ? "1 person was moved by this."
                : `${lovers.length} people were moved by this.`}
          </p>

          {lovers.length > 0 && (
            <ul className="flex flex-col gap-2">
              {lovers.map((lover) => (
                <li key={lover.id} className="flex items-center gap-2 text-sm">
                  <Avatar user={lover} size={28} />
                  <Link href={`/u/${lover.handle}`} className="hover:underline">
                    {lover.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {echoes > 0 && (
            <p className="text-sm" style={{ color: "var(--growth)" }}>
              Your {kindNoun} has travelled to {echoes} {echoes === 1 ? "person" : "people"}.
            </p>
          )}
        </div>
      </div>

      <div className="eu-card p-5">
        <h2 className="font-display text-lg font-semibold">Notes people sent you</h2>
        {encouragements.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            None yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {encouragements.map((note) => (
              <li key={note.id} className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-sunken)" }}>
                <p>{note.preset?.text ?? note.body}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
                  {note.fromUser.displayName} · {timeAgo(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

async function SendNote({ postId, authorId }: { postId: string; authorId: string }) {
  const [presets, author] = await Promise.all([
    db.preset.findMany({ orderBy: { ordinal: "asc" } }),
    db.user.findUnique({ where: { id: authorId }, select: { birthYear: true } }),
  ]);

  const age = author?.birthYear ? new Date().getUTCFullYear() - author.birthYear : null;
  // Unknown age is treated as young: presets only. Fail closed.
  const allowFreeText = age !== null && age >= FREE_TEXT_MIN_AGE;

  return (
    <EncouragementSender
      postId={postId}
      presets={presets.map((p) => ({ id: p.id, text: p.text }))}
      allowFreeText={allowFreeText}
    />
  );
}
