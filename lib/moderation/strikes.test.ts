import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { STRIKES_BEFORE_BAN_REVIEW } from "@/lib/constants";
import { useIsolatedSchema, type IsolatedDb } from "@/lib/test-db";

/**
 * The strike ledger, against a real database.
 *
 * This file exists to prove one specific promise: **the automated pipeline cannot suspend
 * anybody.** Four strikes opens a review item and stops. If someone later wires
 * `applySuspension` into the worker, or removes the admin-id guard, these tests fail.
 *
 * It runs in its own throwaway Postgres schema so it never touches the dev database.
 */

let db: import("@prisma/client").PrismaClient;
let strikes: typeof import("./strikes");
let isolated: IsolatedDb;

beforeAll(async () => {
  isolated = useIsolatedSchema("strikes");

  // Imported after DATABASE_URL is set, so the client points at the throwaway schema.
  ({ db } = await import("@/lib/db"));
  strikes = await import("./strikes");
});

afterAll(async () => {
  await db?.$disconnect();
  isolated?.drop();
});

let counter = 0;
async function makeUser(role = "MEMBER") {
  counter++;
  return db.user.create({
    data: {
      handle: `person${counter}`,
      displayName: `Person ${counter}`,
      email: `person${counter}@example.com`,
      passwordHash: "x",
      role,
    },
  });
}

async function makeChapter(authorId: string) {
  const idea = await db.post.create({
    data: { authorId, title: "An idea", visibility: "PUBLIC", moderationStatus: "PENDING" },
  });
  return db.entry.create({ data: { postId: idea.id, body: "…", ordinal: 1 } });
}

describe("four strikes opens a review, and nothing more", () => {
  it("counts consecutive strikes without ever suspending", async () => {
    const user = await makeUser();

    for (let i = 1; i <= STRIKES_BEFORE_BAN_REVIEW; i++) {
      const chapter = await makeChapter(user.id);
      const count = await strikes.recordStrike(user.id, chapter.id);
      expect(count).toBe(i);
    }

    const opened = await strikes.maybeOpenBanReview(user.id);
    expect(opened).toBe(true);

    const item = await db.reviewItem.findFirst({
      where: { kind: "BAN_CONFIRM", subjectId: user.id, status: "OPEN" },
    });
    expect(item).not.toBeNull();

    // The whole point: the account is untouched.
    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("ACTIVE");
    expect(after?.suspendedUntil).toBeNull();
    expect(await db.suspension.count({ where: { userId: user.id } })).toBe(0);
  });

  it("does not open a review before the threshold", async () => {
    const user = await makeUser();

    for (let i = 1; i < STRIKES_BEFORE_BAN_REVIEW; i++) {
      const chapter = await makeChapter(user.id);
      await strikes.recordStrike(user.id, chapter.id);
      expect(await strikes.maybeOpenBanReview(user.id)).toBe(false);
    }

    expect(await db.reviewItem.count({ where: { subjectId: user.id } })).toBe(0);
  });

  it("does not stack duplicate ban reviews for the same person", async () => {
    const user = await makeUser();
    for (let i = 0; i < STRIKES_BEFORE_BAN_REVIEW + 3; i++) {
      const chapter = await makeChapter(user.id);
      await strikes.recordStrike(user.id, chapter.id);
      await strikes.maybeOpenBanReview(user.id);
    }
    expect(
      await db.reviewItem.count({ where: { kind: "BAN_CONFIRM", subjectId: user.id } }),
    ).toBe(1);
  });
});

describe("forgiveness is automatic", () => {
  it("an approved post wipes the slate, so strikes never accumulate across good posts", async () => {
    const user = await makeUser();

    for (let i = 0; i < 3; i++) {
      const chapter = await makeChapter(user.id);
      await strikes.recordStrike(user.id, chapter.id);
    }
    expect(await strikes.countConsecutive(user.id)).toBe(3);

    // They post something real. This is what the pipeline calls on every approval.
    await strikes.clearStrikes(user.id);
    expect(await strikes.countConsecutive(user.id)).toBe(0);

    // Three more strikes must NOT tip them over — the earlier three are forgiven, not
    // merely hidden.
    for (let i = 0; i < 3; i++) {
      const chapter = await makeChapter(user.id);
      await strikes.recordStrike(user.id, chapter.id);
    }
    expect(await strikes.maybeOpenBanReview(user.id)).toBe(false);
  });
});

describe("a suspension requires a human", () => {
  it("refuses to apply one without an approving admin", async () => {
    const user = await makeUser();
    await expect(strikes.applySuspension(user.id, "", "no admin")).rejects.toThrow(
      /approving admin/i,
    );

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("ACTIVE");
  });

  it("applies the pause when an admin approves, and clears the record", async () => {
    const user = await makeUser();
    const admin = await makeUser("ADMIN");

    for (let i = 0; i < STRIKES_BEFORE_BAN_REVIEW; i++) {
      const chapter = await makeChapter(user.id);
      await strikes.recordStrike(user.id, chapter.id);
    }

    await strikes.applySuspension(user.id, admin.id, "approved by a person");

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("SUSPENDED");
    expect(after?.suspendedUntil).toBeInstanceOf(Date);
    expect(after!.suspendedUntil!.getTime()).toBeGreaterThan(Date.now());

    const suspension = await db.suspension.findFirst({ where: { userId: user.id } });
    expect(suspension?.approvedByAdminId).toBe(admin.id);

    // They come back with a clean record, not one mistake from another pause.
    expect(await strikes.countConsecutive(user.id)).toBe(0);
  });

  it("lifts itself once the time is up, with no admin action needed", async () => {
    const user = await makeUser();
    await db.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED", suspendedUntil: new Date(Date.now() - 1000) },
    });

    await strikes.liftExpiredSuspension(user.id);

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("ACTIVE");
    expect(after?.suspendedUntil).toBeNull();
  });

  it("leaves a suspension that has not expired alone", async () => {
    const user = await makeUser();
    const endsAt = new Date(Date.now() + 60_000);
    await db.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED", suspendedUntil: endsAt },
    });

    await strikes.liftExpiredSuspension(user.id);

    const after = await db.user.findUnique({ where: { id: user.id } });
    expect(after?.status).toBe("SUSPENDED");
  });
});
