import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listNotifications, markAllRead } from "@/lib/notify";
import { timeAgo } from "@/lib/format";

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

            return (
              <li key={n.id} className="eu-card flex items-start gap-3 p-4">
                <span aria-hidden="true" className="text-lg">
                  {icon(n.kind)}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{describe(n.kind, n.payload, title)}</p>
                  <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                    {timeAgo(n.createdAt)}
                  </p>
                  {postId && (
                    <Link
                      href={`/post/${postId}`}
                      className="mt-1 inline-block text-sm font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      Open it
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
