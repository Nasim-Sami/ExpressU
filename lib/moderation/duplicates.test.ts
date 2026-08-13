import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Who is allowed to "own" a piece of media in the duplicate index.
 *
 * Two rules are tested here, and both protect the same person — the young creator:
 *
 *   1. You can always re-post your own work (Growth Journal chapters, a better cut).
 *   2. A BLOCKED upload never counts as "already here". Without this, anyone could take
 *      a teenager's video, upload it first, get blocked for it — and thereby lock the
 *      real creator out of ever posting their own work.
 */

let db: import("@prisma/client").PrismaClient;
let findDuplicate: typeof import("./duplicates").findDuplicate;
let tempDir: string;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "expressu-dup-"));
  const dbPath = path.join(tempDir, "test.db");
  process.env.DATABASE_URL = `file:${dbPath}`;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"], {
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
    stdio: "pipe",
  });

  ({ db } = await import("@/lib/db"));
  ({ findDuplicate } = await import("./duplicates"));
});

afterAll(async () => {
  await db?.$disconnect();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

let n = 0;
async function user(handle: string) {
  n++;
  return db.user.create({
    data: {
      handle: `${handle}${n}`,
      displayName: handle,
      email: `${handle}${n}@example.com`,
      passwordHash: "x",
    },
  });
}

/** Creates an idea + chapter + one attachment, and returns the chapter id. */
async function post(opts: {
  authorId: string;
  status: string;
  sha256: string;
  phash?: string | null;
}) {
  const idea = await db.post.create({
    data: {
      authorId: opts.authorId,
      title: "clip",
      visibility: "PUBLIC",
      moderationStatus: opts.status,
    },
  });
  const chapter = await db.entry.create({
    data: { postId: idea.id, body: "", ordinal: 1 },
  });
  await db.attachment.create({
    data: {
      entryId: chapter.id,
      kind: "VIDEO",
      filename: "clip.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1,
      storageKey: `k-${chapter.id}`,
      sha256: opts.sha256,
      phash: opts.phash ?? null,
    },
  });
  return chapter.id;
}

/**
 * Each test gets its own hash family, because these cases share one database. Two
 * families differ in every hex digit (≥32 bits apart), far outside the match threshold,
 * so one test's fixtures can never be mistaken for another's.
 */
let family = 0;
function hashes() {
  family++;
  const digit = family.toString(16).padStart(1, "0");
  const base = digit.repeat(16);
  // Flip a single bit in the last nibble: within the threshold, so it counts as a match.
  const near = base.slice(0, 15) + (parseInt(digit, 16) ^ 1).toString(16);
  return { base, near, sha: digit.repeat(64) };
}

describe("re-posting your own work is never a duplicate", () => {
  it("ignores an exact match by the same author", async () => {
    const { sha } = hashes();
    const maya = await user("maya");
    await post({ authorId: maya.id, status: "LIVE", sha256: sha });
    const second = await post({ authorId: maya.id, status: "PENDING", sha256: sha });

    expect(
      await findDuplicate({ authorId: maya.id, entryId: second, sha256: sha, phash: null }),
    ).toBeNull();
  });

  it("ignores a perceptual match by the same author", async () => {
    const { base, near, sha } = hashes();
    const maya = await user("maya");
    await post({ authorId: maya.id, status: "LIVE", sha256: sha, phash: base });
    const second = await post({
      authorId: maya.id,
      status: "PENDING",
      sha256: sha.replace(/^./, "0"),
      phash: near,
    });

    expect(
      await findDuplicate({
        authorId: maya.id,
        entryId: second,
        sha256: sha.replace(/^./, "0"),
        phash: near,
      }),
    ).toBeNull();
  });
});

describe("someone else re-posting published work IS a duplicate", () => {
  it("catches a byte-identical re-upload of a live idea", async () => {
    const { sha } = hashes();
    const maya = await user("maya");
    const rosa = await user("rosa");

    await post({ authorId: maya.id, status: "LIVE", sha256: sha });
    const theirs = await post({ authorId: rosa.id, status: "PENDING", sha256: sha });

    expect(
      await findDuplicate({ authorId: rosa.id, entryId: theirs, sha256: sha, phash: null }),
    ).toBe("sha256");
  });

  it("catches a perceptual match against a live idea", async () => {
    const { base, near, sha } = hashes();
    const maya = await user("maya");
    const rosa = await user("rosa");

    await post({ authorId: maya.id, status: "LIVE", sha256: sha, phash: base });
    const theirs = await post({
      authorId: rosa.id,
      status: "PENDING",
      sha256: sha.replace(/^./, "0"),
      phash: near,
    });

    expect(
      await findDuplicate({
        authorId: rosa.id,
        entryId: theirs,
        sha256: sha.replace(/^./, "0"),
        phash: near,
      }),
    ).toBe("phash");
  });
});

describe("a blocked upload cannot lock the real creator out", () => {
  // The attack: grab a teenager's video, post it before they do, get blocked for it.
  // If blocked media counted, their own upload would then be refused as "already here".
  it.each(["BLOCKED", "PENDING", "UNDER_REVIEW"])(
    "ignores a %s upload by someone else",
    async (status) => {
      const { base, sha } = hashes();
      const thief = await user("thief");
      const creator = await user("creator");

      await post({ authorId: thief.id, status, sha256: sha, phash: base });
      const theirs = await post({
        authorId: creator.id,
        status: "PENDING",
        sha256: sha,
        phash: base,
      });

      expect(
        await findDuplicate({
          authorId: creator.id,
          entryId: theirs,
          sha256: sha,
          phash: base,
        }),
        `a ${status} upload must not claim ownership`,
      ).toBeNull();
    },
  );
});

describe("unhashable media falls back to the exact check only", () => {
  it("does not perceptually match when the new upload has no usable hash", async () => {
    const { base, sha } = hashes();
    const maya = await user("maya");
    const rosa = await user("rosa");

    await post({ authorId: maya.id, status: "LIVE", sha256: sha, phash: base });
    const theirs = await post({
      authorId: rosa.id,
      status: "PENDING",
      sha256: sha.replace(/^./, "0"),
      phash: null,
    });

    expect(
      await findDuplicate({
        authorId: rosa.id,
        entryId: theirs,
        sha256: sha.replace(/^./, "0"),
        phash: null,
      }),
    ).toBeNull();
  });
});
