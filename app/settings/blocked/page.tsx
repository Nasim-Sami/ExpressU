import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { UnblockButton } from "@/components/UnblockButton";
import { listBlocked } from "@/lib/actions/blocks";
import { getSessionUser } from "@/lib/auth";
import { readableDate } from "@/lib/format";

export const metadata = { title: "People you've blocked — ExpressU" };

/**
 * The list of people this person has blocked, and the only place a block can be undone.
 *
 * It shows blocks you MADE, never blocks made against you. Being able to enumerate who
 * has blocked you would defeat the point of not being told — and would be a fairly
 * effective tool for working out who to go and find.
 */
export default async function BlockedPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/settings/blocked");

  const blocked = await listBlocked();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/settings/profile" className="text-sm font-semibold" style={{ color: "var(--ink-muted)" }}>
        ← Profile settings
      </Link>

      <h1 className="font-display mt-4 text-2xl font-semibold">People you&apos;ve blocked</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        You can&apos;t see them and they can&apos;t see you — not in the feed, not in search,
        not by opening your profile. They were never told, and they won&apos;t be told if you
        change your mind.
      </p>

      {blocked.length === 0 ? (
        <div className="eu-card mt-6 p-8 text-center">
          <p style={{ color: "var(--ink-muted)" }}>You haven&apos;t blocked anyone.</p>
        </div>
      ) : (
        <ul className="eu-card mt-6 divide-y" style={{ borderColor: "var(--line)" }}>
          {blocked.map((person) => (
            <li key={person.id} className="flex flex-wrap items-center gap-3 p-4">
              <Avatar user={person} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{person.displayName}</span>
                <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
                  @{person.handle} · blocked {readableDate(person.blockedAt)}
                </span>
              </span>
              <UnblockButton targetId={person.id} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-sm" style={{ color: "var(--ink-faint)" }}>
        Unblocking doesn&apos;t put you back in each other&apos;s circle. If you were connected
        before, one of you would need to ask again.
      </p>
    </div>
  );
}
