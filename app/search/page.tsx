import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { BookCard } from "@/components/BookCard";
import { KindIcon } from "@/components/KindIcon";
import { PostCard } from "@/components/PostCard";
import { SearchBar } from "@/components/SearchBar";
import { getViewer } from "@/lib/auth";
import { KIND_COPY, POST_KIND, isPostKind, type PostKind } from "@/lib/constants";
import { countByKind, search, type PersonResult } from "@/lib/search";

export const metadata = { title: "Search · ExpressU" };

/**
 * Search results.
 *
 * Ordered by how well things match and nothing else — there is no popularity term, so a
 * post nobody has loved ranks exactly as high as one everybody has. Ranking by attention
 * is the thing this platform doesn't do, and search is the easiest place to smuggle it
 * back in.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q = "", kind: rawKind } = await searchParams;
  const viewer = await getViewer();
  const kind: PostKind | undefined = rawKind && isPostKind(rawKind) ? rawKind : undefined;
  // "People" is a tab like the post kinds, but it isn't a PostKind — finding a person to
  // visit is its own reason to search, not a filter over posts.
  const peopleTab = rawKind === "PEOPLE";
  const query = q.trim();

  // Both tabs and results come from one pass, so a tab can never promise a count the
  // results then fail to deliver. The People tab asks for a longer list, since there it
  // is the result rather than one section among several.
  const { posts: allPosts, people, books } = query
    ? await search(viewer, query, peopleTab ? { peopleLimit: 60 } : {})
    : { posts: [], people: [], books: [] };
  const posts = kind ? allPosts.filter((post) => post.kind === kind) : allPosts;

  const counts = countByKind(allPosts);

  const tabHref = (next?: PostKind | "PEOPLE") => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (next) params.set("kind", next);
    const qs = params.toString();
    return qs ? `/search?${qs}` : "/search";
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-2xl font-semibold">Search</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        People and anything shared with you. Spelling doesn&apos;t have to be exact.
      </p>

      <div className="mt-4 flex">
        <SearchBar
          defaultValue={query}
          // Keeps you on whichever tab you're on when you search again — including
          // People, which isn't a PostKind and would otherwise be dropped.
          hidden={{ kind: peopleTab ? "PEOPLE" : kind }}
          placeholder={
            peopleTab ? "Search for someone by name or @handle" : "Search for a person, an idea, a hobby, a letter…"
          }
          autoFocus={!query}
        />
      </div>

      {query.length > 0 && query.length < 2 ? (
        <p className="mt-6 text-sm" style={{ color: "var(--ink-muted)" }}>
          Keep typing — two letters is enough to start.
        </p>
      ) : query === "" ? (
        <Suggestions />
      ) : (
        <>
          <nav aria-label="Filter results" className="mt-5 flex flex-wrap gap-2">
            <Tab
              href={tabHref()}
              active={!kind && !peopleTab}
              label="Everything"
              count={allPosts.length}
            />
            {/* First after Everything: looking someone up is one of the two main reasons
                anyone opens this page, and it shouldn't be buried behind five post kinds. */}
            <Tab
              href={tabHref("PEOPLE")}
              active={peopleTab}
              label="People"
              count={people.length}
              icon={<PersonIcon />}
            />
            {POST_KIND.map((k) => (
              <Tab
                key={k}
                href={tabHref(k)}
                active={kind === k}
                label={KIND_COPY[k].plural}
                count={counts[k]}
                icon={<KindIcon kind={k} className="h-4 w-4" />}
              />
            ))}
          </nav>

          {/* The People tab: just the list, nothing else competing with it. */}
          {peopleTab &&
            (people.length === 0 ? (
              <div className="eu-card mt-5 p-8 text-center">
                <p className="font-semibold">Nobody here called “{query}”.</p>
                <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
                  Try part of their name, or their @handle. Spelling doesn&apos;t have to be
                  exact.
                </p>
              </div>
            ) : (
              <ul className="eu-card mt-5 divide-y" style={{ borderColor: "var(--line)" }}>
                {people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </ul>
            ))}

          {!kind && !peopleTab && people.length > 0 && (
            <section className="mt-5">
              <h2 className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
                People
                {/* Only a handful show here; this is the way to the rest. */}
                {people.length >= 12 && (
                  <Link href={tabHref("PEOPLE")} className="font-semibold normal-case" style={{ color: "var(--accent)" }}>
                    See all
                  </Link>
                )}
              </h2>
              <ul className="eu-card mt-2 divide-y" style={{ borderColor: "var(--line)" }}>
                {people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </ul>
            </section>
          )}

          {!kind && !peopleTab && books.length > 0 && (
            <section className="mt-5">
              <h2 className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
                In the reading room
              </h2>
              <ul className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {books.slice(0, 4).map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </ul>
            </section>
          )}

          {/* Posts are hidden entirely on the People tab — you asked for people. */}
          {!peopleTab && (
            <section className="mt-5 flex flex-col gap-4">
              {posts.length === 0 && (kind || (people.length === 0 && books.length === 0)) ? (
                <Nothing query={query} />
              ) : (
                posts.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function PersonRow({ person }: { person: PersonResult }) {
  return (
    <li>
      <Link href={`/u/${person.handle}`} className="flex items-center gap-3 p-3 transition-colors hover:bg-[var(--surface-sunken)]">
        <Avatar user={person} size={44} />
        <span className="min-w-0">
          {/* The handle is always shown, never replaced by the bio. Two people can share a
              display name; the handle is the one thing that identifies who you've found,
              and it's often what was typed to find them. */}
          <span className="block font-semibold">{person.displayName}</span>
          <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
            @{person.handle}
          </span>
          {person.bio && (
            <span className="mt-0.5 block truncate text-sm" style={{ color: "var(--ink-faint)" }}>
              {person.bio}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * The empty state. Worth writing carefully: "no results" reads as *you searched wrong*,
 * and the honest reason is usually that a post exists but wasn't shared with you.
 */
function Nothing({ query }: { query: string }) {
  return (
    <div className="eu-card p-8 text-center">
      <p className="font-semibold">Nothing here for “{query}”.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--ink-muted)" }}>
        Try fewer words, or a different one. Some things are kept private or shared only
        with a circle, and those never appear in search.
      </p>
      <Link href="/compose/idea" className="eu-btn eu-btn-quiet mt-5">
        Share something about it yourself
      </Link>
    </div>
  );
}

function Suggestions() {
  return (
    <div className="eu-card mt-5 p-6">
      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Search a person&apos;s name, or a word you remember from something you read. Type a
        little of it — “mang”, “mago” and “Mango” all find the same thing.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {POST_KIND.map((kind) => (
          <Link
            key={kind}
            href={`/search?kind=${kind}`}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{ background: "var(--surface-sunken)", color: "var(--ink-muted)" }}
          >
            <KindIcon kind={kind} className="h-4 w-4" />
            {KIND_COPY[kind].plural}
          </Link>
        ))}
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

/** A single person — the People tab's mark. */
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 20c.5-3.4 3.4-5.8 7-5.8s6.5 2.4 7 5.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
