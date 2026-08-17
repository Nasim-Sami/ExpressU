import { describe, expect, it } from "vitest";

import type { ModerationStatus, Visibility } from "./constants";
import { MODERATION_STATUS, VISIBILITY } from "./constants";
import {
  canSeePerson,
  canView,
  canViewForReview,
  visiblePostWhere,
  type Viewer,
  type ViewablePost,
} from "./visibility";

const AUTHOR = "user_author";

const author: Viewer = {
  id: AUTHOR,
  role: "MEMBER",
  connectionIds: new Set(),
  blockedIds: new Set(),
};
const friend: Viewer = {
  id: "user_friend",
  role: "MEMBER",
  connectionIds: new Set([AUTHOR]),
  blockedIds: new Set(),
};
const stranger: Viewer = {
  id: "user_stranger",
  role: "MEMBER",
  connectionIds: new Set(),
  blockedIds: new Set(),
};
const adminStranger: Viewer = {
  id: "user_admin",
  role: "ADMIN",
  connectionIds: new Set(),
  blockedIds: new Set(),
};
const loggedOut = null;

const viewers = [
  ["logged out", loggedOut],
  ["author", author],
  ["connected friend", friend],
  ["stranger", stranger],
  ["admin (not connected)", adminStranger],
] as const;

function idea(visibility: Visibility, moderationStatus: ModerationStatus): ViewablePost {
  return { authorId: AUTHOR, visibility, moderationStatus };
}

/**
 * The expected answer, written out by hand rather than derived from the implementation,
 * so this test cannot rubber-stamp a bug in `canView` by reimplementing it.
 */
function expected(viewerName: string, visibility: Visibility, status: ModerationStatus): boolean {
  if (viewerName === "author") return true;
  if (status !== "LIVE") return false;
  if (visibility === "PUBLIC") return true;
  if (visibility === "CIRCLE") return viewerName === "connected friend";
  return false; // PRIVATE, and we already handled the author
}

describe("canView — the full viewer x visibility x status matrix", () => {
  for (const [viewerName, viewer] of viewers) {
    for (const visibility of VISIBILITY) {
      for (const status of MODERATION_STATUS) {
        const want = expected(viewerName, visibility, status);
        it(`${viewerName} ${want ? "CAN" : "cannot"} see a ${visibility} idea that is ${status}`, () => {
          expect(canView(viewer, idea(visibility, status))).toBe(want);
        });
      }
    }
  }
});

describe("the promises the product makes", () => {
  it("never shows a private idea to anyone but its author", () => {
    for (const [name, viewer] of viewers) {
      if (name === "author") continue;
      for (const status of MODERATION_STATUS) {
        expect(canView(viewer, idea("PRIVATE", status))).toBe(false);
      }
    }
  });

  it("never shows a circle idea to someone outside the circle", () => {
    for (const status of MODERATION_STATUS) {
      expect(canView(stranger, idea("CIRCLE", status))).toBe(false);
      expect(canView(loggedOut, idea("CIRCLE", status))).toBe(false);
    }
  });

  it("does not give admins a master key to private ideas", () => {
    expect(canView(adminStranger, idea("PRIVATE", "LIVE"))).toBe(false);
    expect(canView(adminStranger, idea("CIRCLE", "LIVE"))).toBe(false);
    // ...and review access is scoped to things actually awaiting judgement.
    expect(canViewForReview(adminStranger, idea("PRIVATE", "LIVE"))).toBe(false);
    expect(canViewForReview(adminStranger, idea("PUBLIC", "BLOCKED"))).toBe(true);
    expect(canViewForReview(adminStranger, idea("PUBLIC", "UNDER_REVIEW"))).toBe(true);
    // A non-admin gets nothing from the review path, ever.
    expect(canViewForReview(stranger, idea("PUBLIC", "BLOCKED"))).toBe(false);
    expect(canViewForReview(loggedOut, idea("PUBLIC", "BLOCKED"))).toBe(false);
  });

  it("lets an author see their own work in every state, so nothing silently vanishes", () => {
    for (const visibility of VISIBILITY) {
      for (const status of MODERATION_STATUS) {
        expect(canView(author, idea(visibility, status))).toBe(true);
      }
    }
  });

  it("hides not-yet-approved ideas from everyone except the author", () => {
    for (const status of ["PENDING", "UNDER_REVIEW", "BLOCKED"] as const) {
      expect(canView(friend, idea("PUBLIC", status))).toBe(false);
      expect(canView(stranger, idea("PUBLIC", status))).toBe(false);
      expect(canView(loggedOut, idea("PUBLIC", status))).toBe(false);
    }
  });
});

/**
 * A tiny evaluator for exactly the `where` shapes `visiblePostWhere` emits.
 *
 * It throws on anything it does not recognise, so if the where-builder ever grows a new
 * operator this test fails loudly instead of quietly approving an untested filter.
 */
function matchesWhere(where: Record<string, unknown>, subject: ViewablePost): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "OR") {
      if (!Array.isArray(condition)) throw new Error("OR must be an array");
      return condition.some((clause) => matchesWhere(clause as Record<string, unknown>, subject));
    }

    if (key === "AND") {
      if (!Array.isArray(condition)) throw new Error("AND must be an array");
      return condition.every((clause) => matchesWhere(clause as Record<string, unknown>, subject));
    }

    const actual = subject[key as keyof ViewablePost];

    if (typeof condition === "string") return actual === condition;

    if (condition && typeof condition === "object" && "in" in condition) {
      const list = (condition as { in: unknown }).in;
      if (!Array.isArray(list)) throw new Error("`in` must be an array");
      return list.includes(actual);
    }

    if (condition && typeof condition === "object" && "notIn" in condition) {
      const list = (condition as { notIn: unknown }).notIn;
      if (!Array.isArray(list)) throw new Error("`notIn` must be an array");
      return !list.includes(actual);
    }

    throw new Error(`Unsupported where condition for "${key}": ${JSON.stringify(condition)}`);
  });
}

describe("visiblePostWhere agrees with canView on every combination", () => {
  // If these two ever diverge, the feed shows something the idea page would refuse —
  // or hides something the author is entitled to see. Neither is acceptable.
  for (const [viewerName, viewer] of viewers) {
    for (const visibility of VISIBILITY) {
      for (const status of MODERATION_STATUS) {
        it(`${viewerName} / ${visibility} / ${status}`, () => {
          const subject = idea(visibility, status);
          const viaWhere = matchesWhere(
            visiblePostWhere(viewer) as Record<string, unknown>,
            subject,
          );
          expect(viaWhere).toBe(canView(viewer, subject));
        });
      }
    }
  }
});

/* ── Blocking ──────────────────────────────────────────────────────────────────── */

describe("blocking hides people in both directions", () => {
  const OTHER = "user_other";

  /** Someone who blocked OTHER, or was blocked by them — the Viewer is identical either way. */
  const blocker: Viewer = {
    id: "user_blocker",
    role: "MEMBER",
    connectionIds: new Set(),
    blockedIds: new Set([OTHER]),
  };

  const post = (visibility: Visibility): ViewablePost => ({
    authorId: OTHER,
    visibility,
    moderationStatus: "LIVE",
  });

  it("hides a blocked person's PUBLIC post, which nothing else does", () => {
    // The whole point: public is normally visible to everyone, so this is the case that
    // proves the block outranks visibility rather than merely agreeing with it.
    expect(canView(stranger, post("PUBLIC"))).toBe(true);
    expect(canView(blocker, post("PUBLIC"))).toBe(false);
  });

  it("hides their circle posts even when the connection still exists", () => {
    // A stale Connection row must not grant access. blockUser deletes connections, but
    // this asserts the read path is safe regardless of what is left in the database.
    const connectedButBlocked: Viewer = {
      id: "user_cb",
      role: "MEMBER",
      connectionIds: new Set([OTHER]),
      blockedIds: new Set([OTHER]),
    };
    expect(canView(connectedButBlocked, post("CIRCLE"))).toBe(false);
  });

  it("never hides your own work from you, whatever the block set says", () => {
    // Defensive: a self-block should be impossible, but if one were ever written it must
    // not lock someone out of their own profile.
    const selfBlocked: Viewer = {
      id: "user_self",
      role: "MEMBER",
      connectionIds: new Set(),
      blockedIds: new Set(["user_self"]),
    };
    for (const visibility of VISIBILITY) {
      for (const status of MODERATION_STATUS) {
        expect(
          canView(selfBlocked, { authorId: "user_self", visibility, moderationStatus: status }),
        ).toBe(true);
      }
    }
  });

  it("leaves everyone else visible", () => {
    expect(canView(blocker, { authorId: "user_third", visibility: "PUBLIC", moderationStatus: "LIVE" })).toBe(true);
  });

  it("keeps visiblePostWhere in step with canView for a blocked author", () => {
    // The important half: if the where-clause forgot the block, the feed would show a
    // post the post page then refuses to open.
    const where = visiblePostWhere(blocker) as Record<string, unknown>;
    for (const visibility of VISIBILITY) {
      for (const status of MODERATION_STATUS) {
        const subject: ViewablePost = { authorId: OTHER, visibility, moderationStatus: status };
        expect(matchesWhere(where, subject), `${visibility}/${status}`).toBe(
          canView(blocker, subject),
        );
      }
    }
  });

  it("still returns the viewer's own and third parties' posts through the where clause", () => {
    const where = visiblePostWhere(blocker) as Record<string, unknown>;
    expect(
      matchesWhere(where, { authorId: blocker.id, visibility: "PRIVATE", moderationStatus: "PENDING" }),
    ).toBe(true);
    expect(
      matchesWhere(where, { authorId: "user_third", visibility: "PUBLIC", moderationStatus: "LIVE" }),
    ).toBe(true);
  });
});

describe("canSeePerson", () => {
  const blocker: Viewer = {
    id: "user_blocker",
    role: "MEMBER",
    connectionIds: new Set(),
    blockedIds: new Set(["user_other"]),
  };

  it("hides a blocked person", () => {
    expect(canSeePerson(blocker, "user_other")).toBe(false);
  });

  it("shows everyone else, and always yourself", () => {
    expect(canSeePerson(blocker, "user_third")).toBe(true);
    expect(canSeePerson(blocker, blocker.id)).toBe(true);
  });

  it("shows everyone to a logged-out visitor, who has blocked nobody", () => {
    expect(canSeePerson(null, "user_other")).toBe(true);
  });
});
