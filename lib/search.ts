import "server-only";

import { db } from "./db";
import { getLibrary, type BookCard } from "./books";
import { ranked, type Field } from "./fuzzy";
import { visiblePostWhere, type Viewer } from "./visibility";
import { toAttachmentView, type PostView } from "./posts";
import { POST_KIND } from "./constants";
import type { ModerationStatus, PostKind, Visibility } from "./constants";

/**
 * Searching people and posts.
 *
 * The rule that matters: results come out of `visiblePostWhere`, exactly like the feed and
 * profiles. Search is the easiest place in an app to accidentally build a second, laxer
 * read path — one that quietly surfaces a private post because it happened to match a
 * word — so it deliberately has no query of its own.
 */

export interface PersonResult {
  id: string;
  handle: string;
  displayName: string;
  avatarKey: string | null;
  bio: string | null;
}

export interface SearchResults {
  people: PersonResult[];
  posts: PostView[];
  /** The reading room, so one search covers everywhere something might be. */
  books: BookCard[];
}

/** How much a hit in each place counts. A title is what a post is *about*. */
const TITLE = 1;
const BODY = 0.45;
const AUTHOR = 0.5;
const META = 0.7; // hobby name, letter recipient

const postInclude = {
  author: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
  entries: { orderBy: { ordinal: "asc" }, include: { attachments: true } },
  _count: { select: { entries: true, loves: true, echoes: true } },
} as const;

export interface SearchOptions {
  /** Limit to one kind — how the per-section search bars work. */
  kind?: PostKind;
  /** Limit to one person's shelf — how the search box on a profile works. */
  authorId?: string;
  /** People are skipped when the search is already scoped to posts. */
  people?: boolean;
  /**
   * How many people to return. The default is a short list, because on the "everything"
   * tab people are one section competing with posts and books. The dedicated People tab
   * raises it — there, the list IS the result.
   */
  peopleLimit?: number;
}

export async function search(
  viewer: Viewer | null,
  query: string,
  { kind, authorId, people: wantPeople, peopleLimit = 12 }: SearchOptions = {},
): Promise<SearchResults> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return { people: [], posts: [], books: [] };

  const searchPeople = wantPeople ?? (!kind && !authorId);
  // Books aren't scoped to a post kind or an author's shelf, so a narrowed search skips
  // them — the reading room has its own search for that.
  const searchBooks = !kind && !authorId;

  const [postRows, peopleRows, books] = await Promise.all([
    db.post.findMany({
      where: {
        AND: [
          ...(kind ? [{ kind }] : []),
          ...(authorId ? [{ authorId }] : []),
          visiblePostWhere(viewer),
        ],
      },
      include: postInclude,
      orderBy: { lastEntryAt: "desc" },
      // Bounded: scoring happens in memory, so this caps the work rather than the
      // relevance. At ExpressU's size everything visible fits comfortably.
      take: 500,
    }),
    // People aren't searched from inside a section — you're looking for posts then.
    !searchPeople
      ? Promise.resolve([])
      : db.user.findMany({
          // Blocked in either direction means invisible in either direction: searching
          // someone who blocked you must not reveal that they exist.
          ...(viewer && viewer.blockedIds.size > 0
            ? { where: { id: { notIn: [...viewer.blockedIds] } } }
            : {}),
          // No status filter: a deleted account is gone from the table entirely, and a
          // suspended one is still a person whose profile should be findable — the pause
          // is on posting, not on existing.
          select: { id: true, handle: true, displayName: true, avatarKey: true, bio: true },
          take: 500,
        }),
    searchBooks ? getLibrary(viewer, { query: trimmed }) : Promise.resolve([]),
  ]);

  const posts = ranked(trimmed, postRows, (row): Field[] => [
    { text: row.title, weight: TITLE },
    { text: row.hobbyName ?? "", weight: META },
    { text: row.recipientType ?? "", weight: META },
    { text: row.author.displayName, weight: AUTHOR },
    { text: row.author.handle, weight: AUTHOR },
    // Every entry, so a search finds chapter 7 of a long journal, not just the opening.
    ...row.entries.map((entry) => ({ text: entry.body, weight: BODY })),
    ...row.entries.map((entry) => ({ text: entry.letterSubject ?? "", weight: META })),
  ]);

  const people = ranked(trimmed, peopleRows, (row): Field[] => [
    { text: row.displayName, weight: TITLE },
    { text: row.handle, weight: TITLE },
    { text: row.bio ?? "", weight: BODY },
  ], peopleLimit);

  return {
    people,
    books,
    posts: await withViewerState(posts.map((row) => toView(row, viewer)), viewer),
  };
}

/**
 * Counts per kind, derived from one result set rather than a second query — so a tab can
 * never claim a number the results then fail to produce.
 */
export function countByKind(posts: PostView[]): Record<PostKind, number> {
  const counts = Object.fromEntries(POST_KIND.map((k) => [k, 0])) as Record<PostKind, number>;
  for (const post of posts) counts[post.kind] += 1;
  return counts;
}

type Row = (typeof postInclude) extends never ? never : Awaited<ReturnType<typeof db.post.findFirst<{ include: typeof postInclude }>>>;

function toView(row: NonNullable<Row>, viewer: Viewer | null): PostView {
  const isAuthor = viewer?.id === row.authorId;
  const first = row.entries[0];

  return {
    id: row.id,
    kind: row.kind as PostKind,
    title: row.title,
    hobbyName: row.hobbyName,
    recipientType: row.recipientType,
    visibility: row.visibility as Visibility,
    moderationStatus: row.moderationStatus as ModerationStatus,
    createdAt: row.createdAt,
    lastEntryAt: row.lastEntryAt,
    author: row.author,
    entryCount: row._count.entries,
    firstEntry: first
      ? {
          id: first.id,
          body: first.body,
          letterTo: first.letterTo,
          letterSubject: first.letterSubject,
          attachments: first.attachments.map(toAttachmentView),
        }
      : null,
    loveCount: isAuthor ? row._count.loves : null,
    echoCount: isAuthor ? row._count.echoes : null,
    viewerLoved: false,
    viewerEchoed: false,
    isAuthor,
  };
}

async function withViewerState(views: PostView[], viewer: Viewer | null): Promise<PostView[]> {
  if (!viewer || views.length === 0) return views;

  const postIds = views.map((v) => v.id);
  const [loves, echoes] = await Promise.all([
    db.love.findMany({ where: { userId: viewer.id, postId: { in: postIds } }, select: { postId: true } }),
    db.echo.findMany({ where: { userId: viewer.id, postId: { in: postIds } }, select: { postId: true } }),
  ]);

  const loved = new Set(loves.map((l) => l.postId));
  const echoed = new Set(echoes.map((e) => e.postId));

  return views.map((v) => ({ ...v, viewerLoved: loved.has(v.id), viewerEchoed: echoed.has(v.id) }));
}
