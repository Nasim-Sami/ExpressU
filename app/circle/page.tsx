import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { CircleActions } from "@/components/CircleActions";
import { getSessionUser, getViewer } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Your circle — the people who can see your "My circle" ideas.
 *
 * Framed as a list of people rather than a number. There is no follower count on ExpressU
 * because a count invites you to grow it, and a circle that grows for its own sake stops
 * being the group you'd show an unfinished thing to.
 */
export default async function CirclePage() {
  const [user, viewer] = await Promise.all([getSessionUser(), getViewer()]);
  if (!user || !viewer) redirect("/login");

  const connections = await db.connection.findMany({
    where: { OR: [{ requesterId: user.id }, { addresseeId: user.id }] },
    include: {
      requester: { select: { id: true, handle: true, displayName: true, avatarKey: true, bio: true } },
      addressee: { select: { id: true, handle: true, displayName: true, avatarKey: true, bio: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const other = (c: (typeof connections)[number]) =>
    c.requesterId === user.id ? c.addressee : c.requester;

  /*
   * Belt and braces. `blockUser` deletes the connection inside the same transaction as
   * the block, so in practice nothing here should involve a blocked person. This filter
   * exists because the cost of being wrong is asymmetric: a stale row would put someone
   * you blocked back in your circle list, and the row is exactly what grants access to
   * CIRCLE posts.
   */
  const visible = connections.filter((c) => !viewer.blockedIds.has(other(c).id));

  const accepted = visible.filter((c) => c.status === "ACCEPTED");
  const incoming = visible.filter(
    (c) => c.status === "PENDING" && c.addresseeId === user.id,
  );
  const outgoing = visible.filter(
    (c) => c.status === "PENDING" && c.requesterId === user.id,
  );

  // Anyone not already connected — a small directory, not a recommendation engine.
  //
  // Blocked people are excluded explicitly. Without this the directory would cheerfully
  // suggest connecting to someone you blocked, or to someone who blocked you — which is
  // the exact opposite of what a block is for, and the sort of place it leaks from,
  // because this query never touches a post and so never passes through the post
  // visibility chokepoint.
  const connectedIds = new Set(connections.map((c) => other(c).id));
  const others = await db.user.findMany({
    where: { id: { notIn: [...connectedIds, user.id, ...viewer.blockedIds] } },
    select: { id: true, handle: true, displayName: true, avatarKey: true, bio: true },
    take: 12,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-semibold">Your circle</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        These are the people who can see the ideas you keep for your circle.
      </p>

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Waiting for you</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {incoming.map((c) => (
              <PersonRow key={c.id} person={other(c)} connectionId={c.id} mode="accept" />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">In your circle</h2>
        {accepted.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            Nobody yet. That&apos;s completely fine — your public ideas still reach everyone.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {accepted.map((c) => (
              <PersonRow key={c.id} person={other(c)} connectionId={c.id} mode="remove" />
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">You&apos;ve asked</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {outgoing.map((c) => (
              <PersonRow key={c.id} person={other(c)} connectionId={c.id} mode="pending" />
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Other people here</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {others.map((person) => (
              <PersonRow key={person.id} person={person} mode="add" />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PersonRow({
  person,
  connectionId,
  mode,
}: {
  person: { id: string; handle: string; displayName: string; avatarKey: string | null; bio: string | null };
  connectionId?: string;
  mode: "accept" | "remove" | "pending" | "add";
}) {
  return (
    <li className="eu-card flex items-center gap-3 p-4">
      <Link href={`/u/${person.handle}`}>
        <Avatar user={person} size={44} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${person.handle}`} className="font-semibold hover:underline">
          {person.displayName}
        </Link>
        <p className="truncate text-sm" style={{ color: "var(--ink-muted)" }}>
          {person.bio ?? `@${person.handle}`}
        </p>
      </div>
      <CircleActions targetId={person.id} connectionId={connectionId} mode={mode} />
    </li>
  );
}
