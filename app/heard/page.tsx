import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeAgo } from "@/lib/format";

/**
 * Heard — every private note anyone has ever sent you.
 *
 * This page is the whole answer to "what replaces comments". A young person who posts
 * something and gets nothing back learns not to post again; a young person who opens this
 * and finds three people said "this made me think" learns the opposite. Nobody but the
 * owner can load this route, and none of it is visible on the ideas themselves.
 */
export default async function HeardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notes = await db.encouragement.findMany({
    where: { post: { authorId: user.id } },
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
            <li key={note.id} className="eu-card p-5">
              <p className="font-display text-lg leading-snug">
                &ldquo;{note.preset?.text ?? note.body}&rdquo;
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                <Avatar user={note.fromUser} size={24} />
                <Link href={`/u/${note.fromUser.handle}`} className="hover:underline">
                  {note.fromUser.displayName}
                </Link>
                <span aria-hidden="true">·</span>
                <span>{timeAgo(note.createdAt)}</span>
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
