import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { blockedIdsFor } from "../auth";

/**
 * What blocking does to the data underneath it.
 *
 * The pure rules live in visibility.test.ts. This file covers the part that can only be
 * checked against a real database: that a block is seen from BOTH sides, and that making
 * one actually severs the connection rather than leaving a row that would quietly grant
 * access to circle-only posts the moment anything reads connections without also reading
 * blocks.
 *
 * The server actions themselves can't be imported here ("use server", and they read a
 * session cookie), so this exercises the same writes and asserts the outcome.
 */

const db = new PrismaClient();
const TAG = "blocktest";

async function wipe() {
  await db.user.deleteMany({ where: { handle: { startsWith: TAG } } });
}

async function makeUser(suffix: string) {
  return db.user.create({
    data: {
      handle: `${TAG}_${suffix}`,
      displayName: `Test ${suffix}`,
      email: `${TAG}_${suffix}@example.test`,
      passwordHash: "x",
    },
  });
}

/** Connections between exactly these two people — never a global count. */
async function countBetween(a: string, b: string): Promise<number> {
  return db.connection.count({
    where: {
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
}

beforeEach(wipe);
afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

describe("a block is visible from both sides", () => {
  it("puts each person in the other's blocked set, from one row", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    await db.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });

    // The half that's obvious: Alice blocked Bob.
    expect([...(await blockedIdsFor(alice.id))]).toEqual([bob.id]);

    // The half that actually protects Alice: Bob can't see her either, even though he
    // did nothing and knows nothing about it.
    expect([...(await blockedIdsFor(bob.id))]).toEqual([alice.id]);
  });

  it("leaves everyone else's blocked set empty", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    const carol = await makeUser("carol");

    await db.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });

    expect((await blockedIdsFor(carol.id)).size).toBe(0);
  });

  it("is unique per direction, so blocking twice is not an error", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    await db.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: alice.id, blockedId: bob.id } },
      update: {},
      create: { blockerId: alice.id, blockedId: bob.id },
    });

    expect(await db.block.count({ where: { blockerId: alice.id } })).toBe(1);
  });

  it("disappears entirely when either account is deleted", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");
    await db.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });

    await db.user.delete({ where: { id: bob.id } });

    // Cascade, not an orphaned row pointing at a user that no longer exists — the exact
    // shape of bug that broke the feed earlier in this project.
    expect(await db.block.count()).toBe(0);
  });
});

describe("blocking severs the connection", () => {
  it("removes an accepted connection in either direction", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    await db.connection.create({
      data: { requesterId: bob.id, addresseeId: alice.id, status: "ACCEPTED" },
    });

    // What blockUser does, in the same order.
    await db.$transaction(async (tx) => {
      await tx.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
      await tx.connection.deleteMany({
        where: {
          OR: [
            { requesterId: alice.id, addresseeId: bob.id },
            { requesterId: bob.id, addresseeId: alice.id },
          ],
        },
      });
    });

    // A surviving connection row is not cosmetic: it is what grants access to CIRCLE
    // posts, so leaving one would keep two people inside each other's circle.
    //
    // Scoped to these two accounts on purpose. These suites share the development
    // database, so an unscoped count() also counts real people's real connections and
    // fails for reasons that have nothing to do with blocking.
    expect(await countBetween(alice.id, bob.id)).toBe(0);
  });

  it("removes a still-pending request too", async () => {
    const alice = await makeUser("alice");
    const bob = await makeUser("bob");

    await db.connection.create({
      data: { requesterId: bob.id, addresseeId: alice.id, status: "PENDING" },
    });

    await db.connection.deleteMany({
      where: {
        OR: [
          { requesterId: alice.id, addresseeId: bob.id },
          { requesterId: bob.id, addresseeId: alice.id },
        ],
      },
    });

    // Otherwise the request would still be sitting in their circle page, from someone
    // they can no longer see.
    expect(await countBetween(alice.id, bob.id)).toBe(0);
  });
});
