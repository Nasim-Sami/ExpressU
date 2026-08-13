import "server-only";

import { db } from "./db";
import { canView, visiblePostWhere, type Viewer } from "./visibility";
import { POST_KIND } from "./constants";
import type { ModerationStatus, PostKind, Visibility } from "./constants";

/**
 * Every read path for posts. Nothing outside this module builds its own `where` clause
 * for Post, so the rules in visibility.ts are impossible to bypass by accident.
 */

/**
 * What a card or page is allowed to know.
 *
 * `loveCount` is nullable and is populated ONLY when the viewer is the author. For
 * everyone else it is null and there is nothing to render — the number never reaches the
 * browser, so it can't be read out of the page source or a network response either.
 */
export interface PostView {
  id: string;
  kind: PostKind;
  title: string;
  hobbyName: string | null;
  recipientType: string | null;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  createdAt: Date;
  lastEntryAt: Date;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarKey: string | null;
  };
  entryCount: number;
  firstEntry: {
    id: string;
    body: string;
    letterTo: string | null;
    letterSubject: string | null;
    attachments: AttachmentView[];
  } | null;
  /** Author-only. Null for every other viewer. */
  loveCount: number | null;
  /** Author-only: how far it has travelled. A journey, not a metric. */
  echoCount: number | null;
  /** Whether *this* viewer has loved it — needed to render their own heart state. */
  viewerLoved: boolean;
  viewerEchoed: boolean;
  isAuthor: boolean;
}

export interface AttachmentView {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  posterKey: string | null;
  durationSec: number | null;
  pageCount: number | null;
  width: number | null;
  height: number | null;
}

export interface EntryView {
  id: string;
  body: string;
  ordinal: number;
  letterTo: string | null;
  letterSubject: string | null;
  createdAt: Date;
  /** Null unless the author has actually changed what this entry says. */
  contentUpdatedAt: Date | null;
  attachments: AttachmentView[];
}

const postInclude = {
  author: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
  entries: {
    orderBy: { ordinal: "asc" },
    include: { attachments: true },
  },
  _count: { select: { entries: true, loves: true, echoes: true } },
} as const;

type PostRow = Awaited<ReturnType<typeof db.post.findFirst<{ include: typeof postInclude }>>>;

function toView(row: NonNullable<PostRow>, viewer: Viewer | null): PostView {
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
    // The two lines this whole product turns on.
    loveCount: isAuthor ? row._count.loves : null,
    echoCount: isAuthor ? row._count.echoes : null,
    viewerLoved: false,
    viewerEchoed: false,
    isAuthor,
  };
}

export function toAttachmentView(a: {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  posterKey: string | null;
  durationSec: number | null;
  pageCount: number | null;
  width: number | null;
  height: number | null;
}): AttachmentView {
  return {
    id: a.id,
    kind: a.kind,
    filename: a.filename,
    mimeType: a.mimeType,
    sizeBytes: a.sizeBytes,
    storageKey: a.storageKey,
    posterKey: a.posterKey,
    durationSec: a.durationSec,
    pageCount: a.pageCount,
    width: a.width,
    height: a.height,
  };
}

/** Fills in whether this particular viewer has already loved / echoed each post. */
async function withViewerState(views: PostView[], viewer: Viewer | null): Promise<PostView[]> {
  if (!viewer || views.length === 0) return views;

  const postIds = views.map((v) => v.id);
  const [loves, echoes] = await Promise.all([
    db.love.findMany({
      where: { userId: viewer.id, postId: { in: postIds } },
      select: { postId: true },
    }),
    db.echo.findMany({
      where: { userId: viewer.id, postId: { in: postIds } },
      select: { postId: true },
    }),
  ]);

  const loved = new Set(loves.map((l) => l.postId));
  const echoed = new Set(echoes.map((e) => e.postId));

  return views.map((v) => ({
    ...v,
    viewerLoved: loved.has(v.id),
    viewerEchoed: echoed.has(v.id),
  }));
}

/**
 * The feed.
 *
 * Chronological, with one deliberate intervention: every fourth slot is given to a post
 * that nobody has loved yet. That is not ranking — nothing is scored, ordered by quality,
 * or promoted for being popular. It is the opposite: a guarantee that being unnoticed
 * doesn't compound. On a strictly chronological feed the quiet posts still scroll past
 * fastest, and this platform exists so that a young person who spoke once gets heard.
 */
export async function getFeed(viewer: Viewer | null, limit = 40): Promise<PostView[]> {
  const rows = await db.post.findMany({
    where: visiblePostWhere(viewer),
    include: postInclude,
    orderBy: { lastEntryAt: "desc" },
    take: limit * 2,
  });

  const chronological = rows.map((row) => toView(row, viewer));

  // Love counts are used here for ordering only and never leave the server for
  // non-authors — `toView` has already nulled them out.
  const loveCounts = new Map(rows.map((row) => [row.id, row._count.loves]));

  const quiet = chronological.filter((post) => (loveCounts.get(post.id) ?? 0) === 0);
  const rest = chronological.filter((post) => (loveCounts.get(post.id) ?? 0) > 0);

  const woven: PostView[] = [];
  const seen = new Set<string>();
  let quietIndex = 0;
  let restIndex = 0;

  while (woven.length < limit && (quietIndex < quiet.length || restIndex < rest.length)) {
    const takeQuiet = woven.length % 4 === 3 && quietIndex < quiet.length;
    const next = takeQuiet
      ? quiet[quietIndex++]
      : restIndex < rest.length
        ? rest[restIndex++]
        : quiet[quietIndex++];

    if (next && !seen.has(next.id)) {
      seen.add(next.id);
      woven.push(next);
    }
  }

  return withViewerState(woven, viewer);
}

/** A single post with all of its entries, or null when this viewer isn't allowed to see it. */
export async function getPost(viewer: Viewer | null, id: string) {
  const row = await db.post.findUnique({ where: { id }, include: postInclude });
  if (!row) return null;
  if (
    !canView(viewer, {
      authorId: row.authorId,
      visibility: row.visibility as Visibility,
      moderationStatus: row.moderationStatus as ModerationStatus,
    })
  ) {
    return null;
  }

  const view = toView(row, viewer);
  const [withState] = await withViewerState([view], viewer);

  const entries: EntryView[] = row.entries.map((entry) => ({
    id: entry.id,
    body: entry.body,
    ordinal: entry.ordinal,
    letterTo: entry.letterTo,
    letterSubject: entry.letterSubject,
    createdAt: entry.createdAt,
    contentUpdatedAt: entry.contentUpdatedAt,
    attachments: entry.attachments.map(toAttachmentView),
  }));

  return { ...withState, entries };
}

/**
 * Posts on a profile. The owner sees everything; visitors see only what they may.
 * `kind` narrows to one tab; omit it for "Everything".
 */
export async function getProfilePosts(
  viewer: Viewer | null,
  authorId: string,
  kind?: PostKind,
): Promise<PostView[]> {
  const rows = await db.post.findMany({
    where: {
      AND: [{ authorId }, ...(kind ? [{ kind }] : []), visiblePostWhere(viewer)],
    },
    include: postInclude,
    orderBy: { lastEntryAt: "desc" },
  });

  return withViewerState(
    rows.map((row) => toView(row, viewer)),
    viewer,
  );
}

function zeroCounts(): Record<PostKind, number> {
  return Object.fromEntries(POST_KIND.map((kind) => [kind, 0])) as Record<PostKind, number>;
}

/**
 * How many posts of each kind this viewer can see on a profile — used to label the tabs.
 * Runs through the same visibility filter, so a visitor's counts never hint at the
 * existence of private work.
 */
export async function getProfileKindCounts(
  viewer: Viewer | null,
  authorId: string,
): Promise<Record<PostKind, number> & { ALL: number }> {
  const rows = await db.post.groupBy({
    by: ["kind"],
    where: { AND: [{ authorId }, visiblePostWhere(viewer)] },
    _count: { _all: true },
  });

  // Built from POST_KIND rather than written out, so adding a kind never leaves a tab
  // silently missing its count.
  const counts = { ...zeroCounts(), ALL: 0 };
  for (const row of rows) {
    const kind = row.kind as PostKind;
    if (kind in counts) counts[kind] = row._count._all;
    counts.ALL += row._count._all;
  }
  return counts;
}

/**
 * What this person has passed on — other people's work they chose to send further.
 *
 * Filtered by the ORIGINAL post's visibility right now, not by anything about the person
 * who passed it or what it looked like when they did. That single choice — reusing
 * `visiblePostWhere` exactly as every other list here does — is what makes the three
 * rules below fall out for free instead of needing their own logic:
 *
 *   - A stranger never sees a "just me" post here, because `visiblePostWhere` never
 *     matches PRIVATE for anyone but its author, no matter who passed it on.
 *   - Someone sees a "my circle" post here only while they're connected to its ORIGINAL
 *     author — the passer's own circle is irrelevant.
 *   - If the author deletes the post, the Echo row is gone with it (the relation cascades)
 *     and the entry disappears from every "Passed" shelf that ever held it.
 */
export async function getPassedPosts(viewer: Viewer | null, passerId: string): Promise<PostView[]> {
  const echoes = await db.echo.findMany({
    where: { userId: passerId, post: visiblePostWhere(viewer) },
    include: { post: { include: postInclude } },
    orderBy: { createdAt: "desc" },
  });

  const views = echoes.map((echo) => toView(echo.post, viewer));
  return withViewerState(views, viewer);
}

/** How many passed posts this viewer may actually see — for the tab's count badge. */
export async function getPassedCount(viewer: Viewer | null, passerId: string): Promise<number> {
  return db.echo.count({ where: { userId: passerId, post: visiblePostWhere(viewer) } });
}

/** Who loved a post. Author-only — throws rather than leaking if called wrongly. */
export async function getLovers(viewer: Viewer | null, postId: string) {
  const post = await db.post.findUnique({ where: { id: postId }, select: { authorId: true } });
  if (!post || !viewer || viewer.id !== post.authorId) {
    throw new Error("Only the author may see who loved their post");
  }

  const loves = await db.love.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, handle: true, displayName: true, avatarKey: true } },
    },
  });

  return loves.map((love) => ({ ...love.user, at: love.createdAt }));
}
