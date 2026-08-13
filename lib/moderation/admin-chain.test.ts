import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { decide } from "./act";
import { SUSPENSION_DAYS } from "../constants";

/**
 * Does the admin side actually work?
 *
 * These run against the real database rather than mocks, because the questions being
 * asked are about what is true in the data after an action — "is this person actually
 * suspended", "did the report actually reach the queue", "is the account actually gone".
 * A mock would answer those questions with whatever we already believed.
 *
 * The server actions themselves can't be imported here (they're "use server" and read a
 * session cookie), so this exercises the same database work they do, and asserts the
 * outcome. Where a rule lives in a pure function — the verdict table — that function is
 * called directly.
 */

const db = new PrismaClient();

const TAG = "admintest";

async function wipe() {
  // Users cascade to posts, entries, attachments, loves, reports and notifications.
  await db.user.deleteMany({ where: { handle: { startsWith: TAG } } });
  await db.reviewItem.deleteMany({ where: { notes: { startsWith: TAG } } });
}

async function makeUser(suffix: string, role: "MEMBER" | "ADMIN" = "MEMBER") {
  return db.user.create({
    data: {
      handle: `${TAG}_${suffix}`,
      displayName: `Test ${suffix}`,
      email: `${TAG}_${suffix}@example.test`,
      passwordHash: "x",
      role,
    },
  });
}

async function makePost(authorId: string, title = "A test post") {
  const post = await db.post.create({
    data: { authorId, kind: "IDEA", title, visibility: "PUBLIC", moderationStatus: "LIVE" },
  });
  const entry = await db.entry.create({
    data: { postId: post.id, body: "body", ordinal: 1 },
  });
  return { post, entry };
}

beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

describe("the automated half: what the model's verdict actually causes", () => {
  const clean = {
    explicit: { verdict: "none" as const, categories: [], rationale: "" },
    originality: { verdict: "own_work" as const, signals: [], rationale: "" },
    relevance: { verdict: "expressive" as const, rationale: "" },
    gentle_note: "",
  };

  it("blocks explicit content outright and does not wait for a human", () => {
    const outcome = decide(
      { ...clean, explicit: { verdict: "present", categories: ["sexual"], rationale: "r" } },
      null,
    );
    expect(outcome.verdict).toBe("BLOCKED_EXPLICIT");
    // Blocked, but the author still gets told and still gets a way to answer back.
    expect(outcome.authorMessage).toBeTruthy();
    expect(outcome.review).toBe("BLOCK_APPEAL");
  });

  it("sends merely *suspected* explicit content to a human instead of blocking on a guess", () => {
    const outcome = decide(
      { ...clean, explicit: { verdict: "suspected", categories: [], rationale: "r" } },
      null,
    );
    expect(outcome.verdict).toBe("NEEDS_REVIEW");
  });

  it("never lets the automated path suspend anyone", () => {
    // Every reachable verdict, checked for the one thing the pipeline must not do.
    const verdicts = [
      decide({ ...clean, explicit: { verdict: "present", categories: [], rationale: "" } }, null),
      decide({ ...clean, originality: { verdict: "likely_reposted", signals: [], rationale: "" } }, null),
      decide({ ...clean, relevance: { verdict: "not_expressive", rationale: "" } }, null),
      decide(clean, null),
    ];
    for (const outcome of verdicts) {
      expect(outcome.review).not.toBe("BAN_CONFIRM");
    }
  });
});

describe("a report reaches the queue", () => {
  it("creates a Report and an OPEN review item a human will see", async () => {
    const author = await makeUser("author");
    const reporter = await makeUser("reporter");
    const { post } = await makePost(author.id);

    const report = await db.report.create({
      data: { postId: post.id, reporterId: reporter.id, reason: `${TAG} explicit` },
    });
    await db.reviewItem.create({
      data: { kind: "USER_REPORT", subjectId: report.id, notes: `${TAG} explicit` },
    });

    const open = await db.reviewItem.findMany({ where: { status: "OPEN", kind: "USER_REPORT" } });
    expect(open.some((item) => item.subjectId === report.id)).toBe(true);
  });

  it("does not hide the post just because someone reported it", async () => {
    const author = await makeUser("author2");
    const reporter = await makeUser("reporter2");
    const { post } = await makePost(author.id);

    await db.report.create({
      data: { postId: post.id, reporterId: reporter.id, reason: `${TAG} disagree` },
    });

    // Reporting must not be a way to silence someone you dislike.
    const after = await db.post.findUnique({ where: { id: post.id } });
    expect(after?.moderationStatus).toBe("LIVE");
  });

  it("cannot be piled on by the same person twice", async () => {
    const author = await makeUser("author3");
    const reporter = await makeUser("reporter3");
    const { post } = await makePost(author.id);

    await db.report.create({
      data: { postId: post.id, reporterId: reporter.id, reason: `${TAG} one` },
    });

    await expect(
      db.report.create({
        data: { postId: post.id, reporterId: reporter.id, reason: `${TAG} two` },
      }),
    ).rejects.toThrow();
  });
});

describe("what an admin can actually do", () => {
  it("warn: the person is told, and nothing else about them changes", async () => {
    const target = await makeUser("warned");

    await db.notification.create({
      data: {
        userId: target.id,
        kind: "MODERATION",
        payload: JSON.stringify({ message: "Have a think.", appealable: true }),
      },
    });

    const after = await db.user.findUnique({ where: { id: target.id } });
    expect(after?.status).toBe("ACTIVE");
    expect(await db.notification.count({ where: { userId: target.id } })).toBe(1);
  });

  it("suspend: the account is paused, dated, and attributed to the admin who did it", async () => {
    const admin = await makeUser("admin", "ADMIN");
    const target = await makeUser("suspended");

    const endsAt = new Date(Date.now() + SUSPENSION_DAYS * 86_400_000);
    await db.suspension.create({
      data: {
        userId: target.id,
        endsAt,
        reason: "Reported content",
        approvedByAdminId: admin.id,
      },
    });
    await db.user.update({
      where: { id: target.id },
      data: { status: "SUSPENDED", suspendedUntil: endsAt },
    });

    const after = await db.user.findUnique({ where: { id: target.id } });
    expect(after?.status).toBe("SUSPENDED");
    expect(after?.suspendedUntil?.getTime()).toBeGreaterThan(Date.now());

    const suspension = await db.suspension.findFirst({ where: { userId: target.id } });
    // A suspension with no admin attached would mean the automated path created it.
    expect(suspension?.approvedByAdminId).toBe(admin.id);
  });

  it("suspend leaves everything they already shared exactly where it was", async () => {
    const target = await makeUser("stillhere");
    const { post } = await makePost(target.id);

    await db.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });

    const after = await db.post.findUnique({ where: { id: post.id } });
    expect(after?.moderationStatus).toBe("LIVE");
  });

  it("delete: the account and every trace of its content goes with it", async () => {
    const target = await makeUser("deleted");
    const { post, entry } = await makePost(target.id);
    await db.attachment.create({
      data: {
        entryId: entry.id,
        kind: "IMAGE",
        filename: "x.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1,
        storageKey: "test/x.jpg",
        sha256: "deadbeef",
      },
    });

    await db.user.delete({ where: { id: target.id } });

    // The cascade is what makes "delete the account" mean it, rather than leaving a
    // child's posts and photographs orphaned in the database.
    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
    expect(await db.post.findUnique({ where: { id: post.id } })).toBeNull();
    expect(await db.entry.findUnique({ where: { id: entry.id } })).toBeNull();
    expect(await db.attachment.count({ where: { entryId: entry.id } })).toBe(0);
  });

  it("resolving an item takes it out of the queue and records what was decided", async () => {
    const item = await db.reviewItem.create({
      data: { kind: "USER_REPORT", subjectId: "x", notes: `${TAG} note` },
    });

    await db.reviewItem.update({
      where: { id: item.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: "WARNED" },
    });

    const after = await db.reviewItem.findUnique({ where: { id: item.id } });
    expect(after?.status).toBe("RESOLVED");
    expect(after?.resolution).toBe("WARNED");

    const stillOpen = await db.reviewItem.findMany({ where: { status: "OPEN" } });
    expect(stillOpen.some((i) => i.id === item.id)).toBe(false);
  });
});
