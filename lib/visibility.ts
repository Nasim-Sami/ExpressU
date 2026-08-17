/**
 * WHO CAN SEE WHAT — the single chokepoint.
 *
 * ExpressU promises a young person that their posts are safe inside their profile and
 * that they decide who sees each one. This file is that promise expressed as code. A
 * leak here is the one bug that would break a child's trust in the product, so:
 *
 *   - No route, query, page, or component may filter visibility inline.
 *   - Reads of a single post go through `canView`.
 *   - Reads of a LIST of posts go through `visiblePostWhere`, which pushes the same
 *     rules into the database so nothing unauthorised is ever even loaded.
 *
 * The two must agree exactly. A test asserts that over the entire viewer x visibility
 * x status matrix; if you change one, the test will fail until you change the other.
 */

import type { ModerationStatus, UserRole, Visibility } from "./constants";

export interface Viewer {
  id: string;
  role: UserRole;
  /** Ids of users this viewer has an ACCEPTED connection with, in either direction. */
  connectionIds: ReadonlySet<string>;
  /**
   * Everyone this viewer can no longer see, in EITHER direction — people they blocked
   * and people who blocked them, in one set.
   *
   * Merging both directions here is deliberate. Every read path then needs one check
   * rather than two, and it becomes impossible to implement "don't show me their posts"
   * while forgetting "don't show them mine" — which is the half of blocking that actually
   * protects someone.
   */
  blockedIds: ReadonlySet<string>;
}

/** The minimum a post must expose to be access-checked. */
export interface ViewablePost {
  authorId: string;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
}

/**
 * Only LIVE posts are ever visible to anyone other than the author.
 *
 * PENDING       — still being processed. The author sees it with a "checking this over"
 *                 banner; nobody else knows it exists yet.
 * UNDER_REVIEW  — a human is looking at it (appeal or report). Held back while they do.
 * BLOCKED       — the author can still see their own work and appeal. We do not make a
 *                 young person's creation vanish without explanation.
 */
function isPubliclyReadable(status: ModerationStatus): boolean {
  return status === "LIVE";
}

/**
 * Can `viewer` see this post? `null` viewer means a logged-out visitor.
 *
 * Note what this function deliberately does NOT do: grant ADMIN a master key. An admin
 * reviewing flagged content uses `canViewForReview` instead, which is scoped to items
 * actually sitting in the review queue. Nobody gets to browse a child's private posts
 * because of a role column.
 */
export function canView(viewer: Viewer | null, post: ViewablePost): boolean {
  // The author always sees their own work, in every state.
  if (viewer && viewer.id === post.authorId) return true;

  // A block outranks everything below, including PUBLIC. Checked before visibility so a
  // public post can't leak past it, and after the author check so a block can never hide
  // someone's work from themselves.
  if (viewer && viewer.blockedIds.has(post.authorId)) return false;

  if (!isPubliclyReadable(post.moderationStatus)) return false;

  switch (post.visibility) {
    case "PUBLIC":
      return true;

    case "CIRCLE":
      return viewer !== null && viewer.connectionIds.has(post.authorId);

    case "PRIVATE":
      // Author-only, and the author was already handled above.
      return false;

    default: {
      // Unknown visibility is treated as private. If a bad value ever reaches the
      // database, it must fail closed.
      const _exhaustive: never = post.visibility;
      void _exhaustive;
      return false;
    }
  }
}

/**
 * Narrow, explicit admin access for the review queue.
 *
 * An admin can only open a post that a human genuinely needs to judge: one that has
 * been blocked, is under review, or has been reported. This is not a general-purpose
 * override, and callers must confirm an OPEN ReviewItem exists first.
 */
export function canViewForReview(viewer: Viewer | null, post: ViewablePost): boolean {
  if (!viewer || viewer.role !== "ADMIN") return false;
  return post.moderationStatus === "BLOCKED" || post.moderationStatus === "UNDER_REVIEW";
}

/**
 * The same rules as `canView`, shaped as a Prisma `where` fragment so list queries
 * filter in the database. Use this for the feed, profiles, and search — never fetch
 * and then filter in JavaScript.
 */
export function visiblePostWhere(viewer: Viewer | null) {
  if (!viewer) {
    return {
      moderationStatus: "LIVE",
      visibility: "PUBLIC",
    };
  }

  // A block hides someone's work in both directions, so anyone blocked is excluded from
  // the circle list too — otherwise blocking a friend would leave their circle-only posts
  // still showing.
  const blocked = [...viewer.blockedIds];
  const circleAuthorIds = [...viewer.connectionIds].filter((id) => !viewer.blockedIds.has(id));

  return {
    AND: [
      {
        OR: [
          // Everything the viewer wrote, whatever its state.
          { authorId: viewer.id },
          // Live public posts from anyone.
          { moderationStatus: "LIVE", visibility: "PUBLIC" },
          // Live circle posts from people they're connected with.
          {
            moderationStatus: "LIVE",
            visibility: "CIRCLE",
            authorId: { in: circleAuthorIds },
          },
        ],
      },
      // Applied as a separate AND rather than folded into the branches above, so it
      // cannot be forgotten if someone later adds a fourth way to see a post.
      ...(blocked.length > 0 ? [{ authorId: { notIn: blocked } }] : []),
    ],
  };
}

/**
 * Whether these two people can see each other at all.
 *
 * Used for profiles, search results and connection requests — the places where a *person*
 * rather than a post is being shown. Posts go through `canView`.
 */
export function canSeePerson(viewer: Viewer | null, personId: string): boolean {
  if (!viewer) return true;
  if (viewer.id === personId) return true;
  return !viewer.blockedIds.has(personId);
}

/**
 * Why a post is not currently public, phrased for its author. Returns null when the
 * post is live and needs no explanation.
 */
export function authorStatusMessage(status: ModerationStatus): string | null {
  switch (status) {
    case "PENDING":
      return "We're just having a quick look at this one. It'll be up shortly.";
    case "UNDER_REVIEW":
      return "A person from our team is taking a look at this. We'll let you know soon.";
    case "BLOCKED":
      return "This one isn't showing on ExpressU right now. If you think that's a mistake, tell us — a person will read it.";
    case "LIVE":
      return null;
    default:
      return null;
  }
}
