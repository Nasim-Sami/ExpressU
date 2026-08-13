import Link from "next/link";

import { Avatar } from "./Avatar";
import { EchoButton } from "./EchoButton";
import { KindIcon } from "./KindIcon";
import { LoveButton } from "./LoveButton";
import { MediaBlock } from "./MediaBlock";
import { VisibilityBadge } from "./VisibilityBadge";
import { authorStatusMessage } from "@/lib/visibility";
import { isoDate, timeAgo } from "@/lib/format";
import { KIND_COPY } from "@/lib/constants";
import type { PostView } from "@/lib/posts";

/**
 * One post in the feed, whatever kind it is.
 *
 * Take stock of what is absent below the fold: no comment box, no comment count, no
 * "1,204 views", no reactions bar, no engagement rate, nothing that ranks this against
 * the one above it. Two buttons — love, and pass on — and that is the whole surface area
 * another person has for responding in public.
 */
export function PostCard({ post }: { post: PostView }) {
  const statusNote = post.isAuthor ? authorStatusMessage(post.moderationStatus) : null;
  const copy = KIND_COPY[post.kind];
  const first = post.firstEntry;

  return (
    <article className="eu-card p-5">
      <header className="flex items-start gap-3">
        <Link href={`/u/${post.author.handle}`} className="shrink-0">
          <Avatar user={post.author} size={44} />
        </Link>

        <div className="min-w-0 flex-1">
          <Link href={`/u/${post.author.handle}`} className="font-semibold hover:underline">
            {post.author.displayName}
          </Link>
          <p className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "var(--ink-muted)" }}>
            <span>@{post.author.handle}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={isoDate(post.lastEntryAt)}>{timeAgo(post.lastEntryAt)}</time>
            {post.isAuthor && (
              <>
                <span aria-hidden="true">·</span>
                <VisibilityBadge visibility={post.visibility} />
              </>
            )}
          </p>
        </div>

        {/* Which kind this is, stated quietly. It's context, not a category badge to
            be compared against anyone else's. */}
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
        >
          <KindIcon kind={post.kind} className="h-3.5 w-3.5" />
          {post.kind === "HOBBY" && post.hobbyName ? post.hobbyName : copy.singular}
        </span>
      </header>

      {statusNote && (
        <p
          className="mt-3 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--ink)" }}
        >
          {statusNote}
        </p>
      )}

      <h2 className="mt-3 text-xl font-semibold leading-snug">
        <Link href={`/post/${post.id}`} className="hover:underline">
          {post.title}
        </Link>
      </h2>

      {post.kind === "LETTER" && first?.letterTo && (
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          To {first.letterTo}
          {post.recipientType ? ` · ${post.recipientType}` : ""}
          {first.letterSubject ? ` — ${first.letterSubject}` : ""}
        </p>
      )}

      {first?.body && (
        <p className="mt-2 whitespace-pre-wrap" style={{ color: "var(--ink)" }}>
          {first.body}
        </p>
      )}

      {first && <MediaBlock attachments={first.attachments} />}

      {post.entryCount > 1 && (
        <Link
          href={`/post/${post.id}`}
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
          style={{ color: "var(--growth)" }}
        >
          <SproutIcon />
          {post.entryCount} {copy.entryPlural} — see how this has grown
        </Link>
      )}

      <footer className="mt-4 flex flex-wrap items-center gap-1 border-t pt-3">
        <LoveButton postId={post.id} initialLoved={post.viewerLoved} count={post.loveCount} />
        <EchoButton
          postId={post.id}
          initialEchoed={post.viewerEchoed}
          count={post.echoCount}
          isAuthor={post.isAuthor}
        />
        <div className="flex-1" />
        <Link
          href={`/post/${post.id}`}
          className="rounded-full px-3 py-2 text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          {post.isAuthor ? "Open" : "Send a note"}
        </Link>
      </footer>
    </article>
  );
}

function SproutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M12 20V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 15.4c-3-.1-5.3-2.3-5.5-5.2 3 -.3 5.3 1.9 5.5 5.2z" fill="currentColor" opacity="0.6" />
      <path d="M12 12.3c.2-3.5 2.7-6.2 6-6.3.2 3.5-2.5 6.2-6 6.3z" fill="currentColor" />
    </svg>
  );
}
