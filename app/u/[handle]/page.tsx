import Link from "next/link";
import { notFound } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { ConnectButton } from "@/components/ConnectButton";
import { ImageViewer } from "@/components/ImageViewer";
import { KindIcon } from "@/components/KindIcon";
import { PassedEntry } from "@/components/PassedEntry";
import { PostCard } from "@/components/PostCard";
import { SearchBar } from "@/components/SearchBar";
import { getSessionUser, getViewer } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPassedCount, getPassedPosts, getProfileKindCounts, getProfilePosts } from "@/lib/posts";
import { search } from "@/lib/search";
import {
  KIND_COPY,
  POST_KIND,
  VISIBILITY_LABEL,
  isPostKind,
  type PostKind,
  type Visibility,
} from "@/lib/constants";
import { hostOf, readLinks } from "@/lib/links";
import { mediaUrl } from "@/lib/media-url";

/**
 * "Their work is kept safe inside their profile" — this page is where that promise is
 * visible. The owner sees shelves for Everyone / My circle / Just me across every kind;
 * a visitor sees only what `canView` returns for them, and is told nothing about what
 * else might be here.
 */
export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ tab?: string; shelf?: string; q?: string }>;
}) {
  const { handle } = await params;
  const { tab, shelf, q = "" } = await searchParams;
  const query = q.trim();

  const [viewer, sessionUser] = await Promise.all([getViewer(), getSessionUser()]);

  const profile = await db.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarKey: true,
      coverKey: true,
      avatarOriginalKey: true,
      coverOriginalKey: true,
      bio: true,
      links: true,
      createdAt: true,
    },
  });
  if (!profile) notFound();

  const isOwner = sessionUser?.id === profile.id;
  const links = readLinks(profile.links);
  const showPassed = tab === "PASSED";
  const activeKind: PostKind | undefined = tab && isPostKind(tab) ? tab : undefined;

  // Searching a profile runs through the same matcher and the same visibility gate as
  // global search — it's the same query, narrowed to one shelf. "Passed" is its own list
  // (what THEY sent on, not what they wrote) so it skips both search and the kind filter.
  const [posts, counts, passedCount] = await Promise.all([
    showPassed
      ? getPassedPosts(viewer, profile.id)
      : query
        ? search(viewer, query, { authorId: profile.id, kind: activeKind }).then((r) => r.posts)
        : getProfilePosts(viewer, profile.id, activeKind),
    getProfileKindCounts(viewer, profile.id),
    getPassedCount(viewer, profile.id),
  ]);

  // The visibility shelf is the owner's private filing system for what THEY wrote — it
  // has nothing to say about someone else's post they merely passed on, so it never
  // applies to the Passed list.
  const filtered =
    !showPassed && isOwner && shelf && shelf !== "ALL"
      ? posts.filter((post) => post.visibility === shelf)
      : posts;

  const connection = sessionUser
    ? await db.connection.findFirst({
        where: {
          OR: [
            { requesterId: sessionUser.id, addresseeId: profile.id },
            { requesterId: profile.id, addresseeId: sessionUser.id },
          ],
        },
        select: { status: true, requesterId: true },
      })
    : null;

  const base = `/u/${profile.handle}`;
  const linkTo = (next: { tab?: string; shelf?: string; q?: string }) => {
    const parts = new URLSearchParams();
    const nextTab = next.tab ?? tab;
    const nextShelf = next.shelf ?? shelf;
    // A search survives switching tabs and shelves — otherwise every click throws away
    // what you typed. Pass `q: ""` to clear it.
    const nextQuery = next.q ?? query;
    if (nextTab && nextTab !== "ALL") parts.set("tab", nextTab);
    if (nextShelf && nextShelf !== "ALL") parts.set("shelf", nextShelf);
    if (nextQuery) parts.set("q", nextQuery);
    const qs = parts.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="eu-card overflow-hidden">
        {profile.coverKey ? (
          <ImageViewer
            src={mediaUrl(profile.coverOriginalKey ?? profile.coverKey)}
            alt={`${profile.displayName}'s cover image`}
            className="block h-28 w-full cursor-zoom-in"
          >
            <span
              className="block h-28 w-full"
              style={{
                backgroundImage: `url(${mediaUrl(profile.coverKey)})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          </ImageViewer>
        ) : (
          <div className="h-28" style={{ background: "var(--accent-soft)" }} />
        )}

        <div className="-mt-10 px-6 pb-6">
          {profile.avatarKey ? (
            <ImageViewer
              src={mediaUrl(profile.avatarOriginalKey ?? profile.avatarKey)}
              alt={`${profile.displayName}'s profile picture`}
              className="cursor-zoom-in rounded-full"
            >
              <Avatar user={profile} size={80} />
            </ImageViewer>
          ) : (
            <Avatar user={profile} size={80} />
          )}
          <h1 className="mt-3 text-2xl font-semibold">{profile.displayName}</h1>
          <p style={{ color: "var(--ink-muted)" }}>@{profile.handle}</p>
          {profile.bio && <p className="mt-3 whitespace-pre-wrap">{profile.bio}</p>}

          {links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {links.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    // noopener/noreferrer stop the destination reaching back into this
                    // page; nofollow/ugc stop a profile being used to pass on credit.
                    rel="noopener noreferrer nofollow ugc"
                    className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--surface-sunken)]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <span className="font-semibold">{link.label}</span>
                    {/* The host is always shown, so nobody taps a friendly label and
                        lands somewhere they didn't expect. */}
                    <span style={{ color: "var(--ink-faint)" }}>{hostOf(link.url)}</span>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                      <path
                        d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {isOwner ? (
              <>
                <Link href="/compose/idea" className="eu-btn eu-btn-primary">
                  Share something
                </Link>
                <Link href="/settings/profile" className="eu-btn eu-btn-quiet">
                  Edit profile
                </Link>
              </>
            ) : (
              sessionUser && (
                <ConnectButton
                  targetId={profile.id}
                  status={connection?.status ?? null}
                  incoming={connection?.requesterId === profile.id}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* What kind of thing. Everyone sees these — they're a way to read someone's
          profile, not a private filing system. "Passed" sits apart from the rest: it's
          not something this person wrote, it's what they chose to send on. */}
      <nav aria-label="Kinds" className="mt-5 flex flex-wrap gap-2">
        <Tab href={linkTo({ tab: "ALL" })} active={!activeKind && !showPassed} label="Everything" count={counts.ALL} />
        {POST_KIND.map((kind) => (
          <Tab
            key={kind}
            href={linkTo({ tab: kind })}
            active={activeKind === kind}
            label={KIND_COPY[kind].plural}
            count={counts[kind]}
            icon={<KindIcon kind={kind} className="h-4 w-4" />}
          />
        ))}
        <Tab
          href={linkTo({ tab: "PASSED" })}
          active={showPassed}
          label="Passed"
          count={passedCount}
          icon={<PassedIcon className="h-4 w-4" />}
        />
      </nav>

      {!showPassed && isOwner && (
        <nav aria-label="Your shelves" className="mt-3 flex flex-wrap gap-2">
          <Shelf href={linkTo({ shelf: "ALL" })} active={!shelf || shelf === "ALL"} label="All" />
          {(["PUBLIC", "CIRCLE", "PRIVATE"] as Visibility[]).map((v) => (
            <Shelf key={v} href={linkTo({ shelf: v })} active={shelf === v} label={VISIBILITY_LABEL[v]} />
          ))}
        </nav>
      )}

      {!showPassed && (
        <div className="mt-3 flex">
          <SearchBar
            action={base}
            defaultValue={query}
            hidden={{ tab: activeKind, shelf: shelf && shelf !== "ALL" ? shelf : undefined }}
            placeholder={
              isOwner
                ? "Search everything you've shared"
                : `Search ${profile.displayName}'s ${activeKind ? KIND_COPY[activeKind].plural.toLowerCase() : "shelf"}`
            }
            label={`Search ${profile.displayName}'s profile`}
            compact
          />
        </div>
      )}

      {showPassed && (
        <p className="mt-3 text-sm" style={{ color: "var(--ink-muted)" }}>
          {isOwner
            ? "Other people's work you've passed on. If someone deletes what you passed, it goes from here too."
            : `What ${profile.displayName} has passed on. Anything set to "just me" stays hidden here, same as everywhere else.`}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="eu-card p-8 text-center">
            <p style={{ color: "var(--ink-muted)" }}>
              {showPassed
                ? isOwner
                  ? "You haven't passed anything on yet."
                  : `${profile.displayName} hasn't passed on anything you can see.`
                : query
                  ? `Nothing here matching “${query}”.`
                  : isOwner
                    ? "Nothing on this shelf yet."
                    : `${profile.displayName} hasn't shared anything you can see.`}
            </p>
            {query && !showPassed && (
              <Link href={linkTo({ q: "" })} className="eu-btn eu-btn-quiet mt-4">
                Clear search
              </Link>
            )}
            {isOwner && !query && !showPassed && activeKind && (
              <Link
                href={`/compose/${KIND_COPY[activeKind].slug}`}
                className="eu-btn eu-btn-primary mt-4"
              >
                {KIND_COPY[activeKind].action}
              </Link>
            )}
          </div>
        ) : showPassed && isOwner ? (
          // Only the shelf's own owner ever sees the remove control — a visitor gets the
          // plain card below, with nothing on the page to touch.
          filtered.map((post) => (
            <PassedEntry key={post.id} postId={post.id}>
              <PostCard post={post} />
            </PassedEntry>
          ))
        ) : (
          filtered.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  label,
  count,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--on-accent)" : "var(--ink-muted)",
        borderColor: active ? "var(--accent)" : "var(--line)",
      }}
    >
      {icon}
      {label}
      <span
        className="rounded-full px-1.5 text-xs"
        style={{ background: active ? "rgb(255 255 255 / 0.22)" : "var(--surface-sunken)" }}
      >
        {count}
      </span>
    </Link>
  );
}

/** Two arcs passing something along — the same gesture as the Echo button, borrowed here
    so the tab reads as "sent onward" rather than another kind of post. */
function PassedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M7.8 8.4a5.6 5.6 0 0 0 0 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16.2 8.4a5.6 5.6 0 0 1 0 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
    </svg>
  );
}

function Shelf({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className="rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
      style={{
        background: active ? "var(--growth-soft)" : "transparent",
        color: active ? "var(--growth)" : "var(--ink-faint)",
      }}
    >
      {label}
    </Link>
  );
}
