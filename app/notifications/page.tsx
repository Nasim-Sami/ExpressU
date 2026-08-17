import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listNotifications, markAllRead } from "@/lib/notify";
import { isoDate, readableDateTime, timeAgo } from "@/lib/format";

/**
 * Notifications tell you something happened. They never tell you how you're doing.
 * "Someone was moved by this" rather than "+3 likes" — no totals, no comparisons,
 * nothing that makes the next post feel like it has a number to beat.
 */
export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const notifications = await listNotifications(user.id);
  await markAllRead(user.id);

  const postIds = notifications
    .map((n) => n.payload.postId)
    .filter((id): id is string => typeof id === "string");

  const posts = await db.post.findMany({
    where: { id: { in: postIds } },
    select: { id: true, title: true },
  });
  const titles = new Map(posts.map((post) => [post.id, post.title]));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">What&apos;s happened</h1>

      {notifications.length === 0 ? (
        <div className="eu-card mt-6 p-8 text-center">
          <p style={{ color: "var(--ink-muted)" }}>Nothing new.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {notifications.map((n) => {
            const postId = typeof n.payload.postId === "string" ? n.payload.postId : null;
            const title = (postId ? titles.get(postId) : null) ?? null;
            const href = destination(n.kind, n.payload);

            return (
              <li key={n.id} className="eu-card flex items-start gap-3 p-4">
                <span aria-hidden="true" className="text-lg">
                  {icon(n.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{describe(n.kind, n.payload, title)}</p>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    <time dateTime={isoDate(n.createdAt)} title={readableDateTime(n.createdAt)}>
                      {timeAgo(n.createdAt)}
                    </time>
                  </p>
                  {href && (
                    <Link
                      href={href}
                      className="mt-1 inline-block text-sm font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {destinationLabel(n.kind)} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Where a notification actually takes you.
 *
 * Not every notification is about a post, and sending them all to /post was the bug: a
 * note someone sent you lives in Heard, a circle request lives in Circle, and a book
 * decision lives in the reading room. Landing on the wrong page — or on no page at all —
 * makes a notification something to dismiss rather than something to follow.
 *
 * Where a page can be scrolled to the exact thing, the link carries an anchor.
 */
function destination(kind: string, payload: Record<string, unknown>): string | null {
  const postId = typeof payload.postId === "string" ? payload.postId : null;
  const bookId = typeof payload.bookId === "string" ? payload.bookId : null;

  switch (kind) {
    case "LOVED":
    case "ECHOED":
      return postId ? `/post/${postId}` : null;

    // The note itself is in Heard, not on the post — that is the whole point of Heard.
    case "ENCOURAGED":
      return postId ? `/heard#note-${postId}` : "/heard";

    case "CONNECTION":
      return "/circle";

    case "MODERATION":
      // A moderation decision can be about a book or a post; the payload says which.
      if (bookId) return `/read/${bookId}`;
      return postId ? `/post/${postId}` : null;

    case "MILESTONE":
      return "/";

    default:
      return postId ? `/post/${postId}` : null;
  }
}

/** What the link should say, so it names where it goes rather than "Open it". */
function destinationLabel(kind: string): string {
  switch (kind) {
    case "ENCOURAGED":
      return "Read it in Heard";
    case "CONNECTION":
      return "Open your circle";
    case "MILESTONE":
      return "Go to your feed";
    case "MODERATION":
      return "See what happened";
    default:
      return "Open it";
  }
}

function icon(kind: string): string {
  switch (kind) {
    case "LOVED":
      return "♥";
    case "ENCOURAGED":
      return "✉";
    case "ECHOED":
      return "◎";
    case "MILESTONE":
      return "🌱";
    case "MODERATION":
      return "•";
    default:
      return "•";
  }
}

function describe(kind: string, payload: Record<string, unknown>, title: string | null): string {
  const named = title ? `“${title}”` : "one of your ideas";

  switch (kind) {
    // Note the singular framing: one person, one moment. Never a running total.
    case "LOVED":
      return `Someone was moved by ${named}.`;
    case "ENCOURAGED":
      return `Someone sent you a note about ${named}. It's in Heard.`;
    case "ECHOED":
      return `${named} travelled a little further — someone passed it on.`;
    case "MILESTONE":
      return typeof payload.text === "string" ? payload.text : "A small milestone.";
    case "MODERATION":
      return typeof payload.message === "string" ? payload.message : `An update about ${named}.`;
    case "CONNECTION":
      return payload.accepted
        ? "Someone accepted your circle request."
        : "Someone would like to be in your circle.";
    default:
      return "Something happened.";
  }
}
