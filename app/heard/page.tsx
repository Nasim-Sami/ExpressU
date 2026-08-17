import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { getSessionUser, getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDistant, isoDate, readableDate, readableDateTime, timeAgo } from "@/lib/format";

/**
 * Heard — every private note anyone has ever sent you.
 *
 * This page is the whole answer to "what replaces comments". A young person who posts
 * something and gets nothing back learns not to post again; a young person who opens this
 * and finds three people said "this made me think" learns the opposite. Nobody but the
 * owner can load this route, and none of it is visible on the ideas themselves.
 */
export default async function HeardPage() {
  const [user, viewer] = await Promise.all([getSessionUser(), getViewer()]);
  if (!user || !viewer) redirect("/login");

  const notes = await db.encouragement.findMany({
    where: {
      post: { authorId: user.id },
      // Notes from someone you've since blocked are hidden, not deleted. Blocking
      // shouldn't destroy kind words that were already received and may still mean
      // something — but nor should the person you blocked keep appearing in the one
      // place on ExpressU that exists to feel good to open.
      ...(viewer.blockedIds.size > 0 ? { fromUserId: { notIn: [...viewer.blockedIds] } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      preset: true,
      post: { select: { id: true, title: true } },
      fromUser: { select: { handle: true, displayName: true, avatarKey: true } },
    },
  });

  // Opening the page marks them read — there is no badge to farm.
  await db.encouragement.updateMany({
    where: { post: { authorId: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Heard</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Notes people sent you about your ideas. Only you can see this page.
      </p>

      {notes.length === 0 ? (
        <div className="eu-card mt-6 p-8 text-center">
          <p style={{ color: "var(--ink-muted)" }}>
            Nothing here yet. It fills up slowly, and that&apos;s alright.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {notes.map((note) => (
            <li
              key={note.id}
              // Anchored by the POST it is about, because that is what the notification
              // knows — an "someone sent you a note" notification carries the post id, not
              // the note id. scroll-mt keeps the sticky top bar off the note it lands on.
              id={`note-${note.post.id}`}
              className="eu-card scroll-mt-24 p-5"
            >
              <p className="font-display text-lg leading-snug">
                &ldquo;{note.preset?.text ?? note.body}&rdquo;
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                <Avatar user={note.fromUser} size={24} />
                <Link href={`/u/${note.fromUser.handle}`} className="hover:underline">
                  {note.fromUser.displayName}
                </Link>
                <span aria-hidden="true">·</span>
                <time dateTime={isoDate(note.createdAt)} title={readableDateTime(note.createdAt)}>
                  {timeAgo(note.createdAt)}
                </time>
                {isDistant(note.createdAt) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{readableDate(note.createdAt)}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <Link href={`/post/${note.post.id}`} className="hover:underline">
                  {note.post.title}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
