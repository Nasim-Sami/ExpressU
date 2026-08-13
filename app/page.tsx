import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { KindIcon } from "@/components/KindIcon";
import { LogoMark } from "@/components/Logo";
import { KIND_COPY, POST_KIND } from "@/lib/constants";
import { getSessionUser, getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFeed } from "@/lib/posts";

export default async function FeedPage() {
  const [viewer, user] = await Promise.all([getViewer(), getSessionUser()]);
  const posts = await getFeed(viewer);

  if (!user) return <Welcome posts={posts.length} />;

  const shared = await db.post.count({
    where: { authorId: user.id, moderationStatus: "LIVE" },
  });

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
      {/* Left rail — who you are here, with nothing to measure yourself against. */}
      <aside className="hidden lg:block">
        <div className="eu-card sticky top-22 overflow-hidden">
          <div className="h-16" style={{ background: "var(--accent-soft)" }} />
          <div className="-mt-8 flex flex-col items-center px-4 pb-5 text-center">
            <Avatar user={user} size={64} />
            <Link href={`/u/${user.handle}`} className="mt-2 font-semibold hover:underline">
              {user.displayName}
            </Link>
            <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
              @{user.handle}
            </p>
            {user.bio && (
              <p className="mt-2 text-sm" style={{ color: "var(--ink-muted)" }}>
                {user.bio}
              </p>
            )}
            <p className="mt-4 w-full border-t pt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
              {shared === 0
                ? "You haven't shared anything yet."
                : shared === 1
                  ? "You've shared 1 thing."
                  : `You've shared ${shared} things.`}
            </p>
          </div>
        </div>
      </aside>

      {/* Centre — the feed. */}
      <div className="flex flex-col gap-4">
        <ComposePrompt user={user} />

        {posts.length === 0 ? (
          <EmptyFeed />
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {/* Right rail — an invitation, not a leaderboard. */}
      <aside className="hidden lg:block">
        <WeeklyPrompt />
      </aside>
    </div>
  );
}

function ComposePrompt({ user }: { user: { handle: string; displayName: string; avatarKey: string | null } }) {
  return (
    <div className="eu-card flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={44} />
        <Link
          href="/compose/idea"
          className="eu-field flex-1 text-left"
          style={{ color: "var(--ink-faint)", lineHeight: "1.4" }}
        >
          What have you been thinking about?
        </Link>
      </div>

      {/* All four kinds sit side by side, so none of them reads as the "real" one and
          the others as afterthoughts. A hobby is not a lesser idea. */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        {POST_KIND.map((kind) => (
          <Link
            key={kind}
            href={`/compose/${KIND_COPY[kind].slug}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
            style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
          >
            <KindIcon kind={kind} className="h-4 w-4" />
            {KIND_COPY[kind].singular}
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * The weekly prompt. Phrased as an invitation with an explicit permission to ignore it —
 * a prompt that nags is just another obligation, and this platform doesn't set targets.
 */
const PROMPTS = [
  "What's something you noticed this week that nobody else seemed to?",
  "Is there something you've started and not finished? Show it as it is.",
  "What would you make if you already knew it would work?",
  "What's a small thing that should exist but doesn't?",
  "What did you change your mind about recently?",
];

function WeeklyPrompt() {
  // Stable for the week, so it feels like a shared thing rather than a slot machine.
  const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const prompt = PROMPTS[week % PROMPTS.length];

  return (
    <div className="eu-card sticky top-22 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent)" }}>
        This week
      </p>
      <p className="mt-2 font-display text-lg leading-snug">{prompt}</p>
      <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
        Only if you feel like it. There's no streak to keep.
      </p>
      <Link href="/compose/idea" className="eu-btn eu-btn-quiet mt-4 w-full">
        Share something
      </Link>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="eu-card p-8 text-center">
      <LogoMark className="mx-auto h-10 w-10" />
      <h2 className="mt-3 text-xl font-semibold">It&apos;s quiet in here</h2>
      <p className="mx-auto mt-2 max-w-sm" style={{ color: "var(--ink-muted)" }}>
        Nothing to read yet. You could be the first — even a half-formed thought counts.
      </p>
      <Link href="/compose/idea" className="eu-btn eu-btn-primary mt-5">
        Share an idea
      </Link>
    </div>
  );
}

/** The signed-out landing page: states the promise plainly, because it's unusual. */
function Welcome({ posts }: { posts: number }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <LogoMark className="h-12 w-12" />
      <h1 className="mt-6 text-4xl font-semibold leading-tight sm:text-5xl">
        Say the idea. Nobody here is marking it.
      </h1>

      <p className="mt-5 text-lg" style={{ color: "var(--ink-muted)" }}>
        Everywhere else rewards the ideas that look successful, profitable, or realistic.
        People give up on their first ideas because of those three words. ExpressU is built
        so that doesn&apos;t happen here.
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {[
          "Share an idea, a hobby, something you're learning, or an open letter.",
          "Anything you've made — a video, a recording, a drawing, a document, or just a sentence.",
          "No comments. Not disabled, not hidden — they don't exist.",
          "One reaction: a heart. No counts for anyone but you.",
          "No ranking, no trending, no feed deciding whose work deserves attention.",
          "You choose every time: everyone, your circle, or just you.",
          "People can pass your work on, but never with their own words attached.",
        ].map((line) => (
          <li key={line} className="flex gap-3">
            <span aria-hidden="true" style={{ color: "var(--accent)" }}>
              —
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/join" className="eu-btn eu-btn-primary">
          Make an account
        </Link>
        <Link href="/login" className="eu-btn eu-btn-quiet">
          Sign in
        </Link>
      </div>

      {posts > 0 && (
        <p className="mt-8 text-sm" style={{ color: "var(--ink-muted)" }}>
          {posts} {posts === 1 ? "thing is" : "things are"} public right now. Sign in to read them.
        </p>
      )}
    </div>
  );
}
