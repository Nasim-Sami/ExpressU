import { describe, expect, it } from "vitest";

import type { ModerationStatus, Visibility } from "./constants";
import { MODERATION_STATUS, VISIBILITY } from "./constants";
import {
  canView,
  canViewForReview,
  visiblePostWhere,
  type Viewer,
  type ViewablePost,
} from "./visibility";

const AUTHOR = "user_author";

const author: Viewer = { id: AUTHOR, role: "MEMBER", connectionIds: new Set() };
const friend: Viewer = { id: "user_friend", role: "MEMBER", connectionIds: new Set([AUTHOR]) };
const stranger: Viewer = { id: "user_stranger", role: "MEMBER", connectionIds: new Set() };
const adminStranger: Viewer = { id: "user_admin", role: "ADMIN", connectionIds: new Set() };
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

    const actual = subject[key as keyof ViewablePost];

    if (typeof condition === "string") return actual === condition;

    if (condition && typeof condition === "object" && "in" in condition) {
      const list = (condition as { in: unknown }).in;
      if (!Array.isArray(list)) throw new Error("`in` must be an array");
      return list.includes(actual);
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
