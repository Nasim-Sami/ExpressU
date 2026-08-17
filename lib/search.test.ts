import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { search } from "./search";
import { canView, type Viewer } from "./visibility";
import type { ModerationStatus, Visibility } from "./constants";

/**
 * The question this file exists to answer: can search show you something you aren't
 * allowed to see?
 *
 * Search is the classic place a visibility promise quietly breaks. The feed and the
 * profile are obviously access-controlled and get written carefully; search feels like a
 * different feature — "just matching words" — and ends up with its own query that forgot
 * the rules. So these tests do not check the matcher (fuzzy.test.ts does that). They check
 * that every row search hands back would also survive `canView`, one viewer at a time.
 */

const db = new PrismaClient();
const TAG = "searchtest";

const viewerFor = (id: string, connections: string[] = [], blocked: string[] = []): Viewer => ({
  id,
  role: "MEMBER",
  connectionIds: new Set(connections),
  blockedIds: new Set(blocked),
});

async function makeUser(suffix: string, displayName: string, bio?: string) {
  return db.user.create({
    data: {
      handle: `${TAG}_${suffix}`,
      displayName,
      email: `${TAG}_${suffix}@example.test`,
      passwordHash: "x",
      bio,
    },
  });
}

async function makePost(
  authorId: string,
  title: string,
  body: string,
  visibility: Visibility,
  moderationStatus: ModerationStatus = "LIVE",
  kind = "IDEA",
) {
  const post = await db.post.create({
    data: { authorId, kind, title, visibility, moderationStatus },
  });
  await db.entry.create({ data: { postId: post.id, body, ordinal: 1 } });
  return post;
}

let alice: { id: string };
let bob: { id: string };
let carol: { id: string };
let publicPost: { id: string };
let circlePost: { id: string };
let privatePost: { id: string };
let pendingPost: { id: string };
let hobbyPost: { id: string };

async function wipe() {
  await db.user.deleteMany({ where: { handle: { startsWith: TAG } } });
}

beforeAll(async () => {
  await wipe();

  // Alice writes about mangoes at all three visibilities. Bob is in her circle; Carol
  // is a stranger.
  alice = await makeUser("alice", "Alice Mango", "I grow mango trees on a balcony.");
  bob = await makeUser("bob", "Bob Barnes");
  carol = await makeUser("carol", "Carol Stone");

  publicPost = await makePost(alice.id, "Mango tree in a bucket", "Planted a mango seed.", "PUBLIC");
  circlePost = await makePost(alice.id, "Mango notes for friends", "Only my circle.", "CIRCLE");
  privatePost = await makePost(alice.id, "Mango diary", "Just for me.", "PRIVATE");
  pendingPost = await makePost(alice.id, "Mango film", "Waiting on a check.", "PUBLIC", "PENDING");
  hobbyPost = await makePost(alice.id, "Drawing mangoes", "Sketching fruit.", "PUBLIC", "LIVE", "HOBBY");
});

afterAll(async () => {
  await wipe();
  await db.$disconnect();
});

/** The results, as ids, restricted to the posts this file created. */
async function ids(viewer: Viewer | null, query: string, options = {}) {
  const { posts } = await search(viewer, query, options);
  const mine = new Set([publicPost.id, circlePost.id, privatePost.id, pendingPost.id, hobbyPost.id]);
  return posts.filter((post) => mine.has(post.id)).map((post) => post.id);
}

describe("search never returns a post the viewer cannot see", () => {
  it("shows a stranger only the public, live post", async () => {
    const found = await ids(viewerFor(carol.id), "mango");
    expect(found).toContain(publicPost.id);
    expect(found).not.toContain(circlePost.id);
    expect(found).not.toContain(privatePost.id);
    // Pending isn't a secret, but it isn't published either — nobody but the author
    // should meet it while a check is still running.
    expect(found).not.toContain(pendingPost.id);
  });

  it("shows a signed-out visitor only the public, live posts", async () => {
    const found = await ids(null, "mango");
    expect(found.sort()).toEqual([publicPost.id, hobbyPost.id].sort());
  });

  it("shows someone in the circle the circle post too, but never the private one", async () => {
    const found = await ids(viewerFor(bob.id, [alice.id]), "mango");
    expect(found).toContain(publicPost.id);
    expect(found).toContain(circlePost.id);
    expect(found).not.toContain(privatePost.id);
  });

  it("shows the author everything of their own, including what is still pending", async () => {
    const found = await ids(viewerFor(alice.id), "mango");
    for (const post of [publicPost, circlePost, privatePost, pendingPost]) {
      expect(found).toContain(post.id);
    }
  });

  it("agrees with canView for every viewer and every result", async () => {
    // The general form of the rule, rather than four hand-picked cases: whatever search
    // returns, canView must independently allow.
    const viewers = [null, viewerFor(alice.id), viewerFor(bob.id, [alice.id]), viewerFor(carol.id)];

    for (const viewer of viewers) {
      const { posts } = await search(viewer, "mango");
      for (const post of posts) {
        expect(
          canView(viewer, {
            authorId: post.author.id,
            visibility: post.visibility,
            moderationStatus: post.moderationStatus,
          }),
          `${viewer?.id ?? "signed out"} was shown ${post.title}`,
        ).toBe(true);
      }
    }
  });

  it("keeps the same rules when the search is scoped to one person's profile", async () => {
    const found = await ids(viewerFor(carol.id), "mango", { authorId: alice.id });
    expect(found.sort()).toEqual([publicPost.id, hobbyPost.id].sort());
  });
});

describe("what search finds", () => {
  it("finds a post through a misspelling", async () => {
    expect(await ids(viewerFor(carol.id), "mnago")).toContain(publicPost.id);
  });

  it("finds a post through a half-typed word", async () => {
    expect(await ids(viewerFor(carol.id), "mang")).toContain(publicPost.id);
  });

  it("finds a post by its body, not only its title", async () => {
    expect(await ids(viewerFor(carol.id), "bucket")).toContain(publicPost.id);
  });

  it("finds a post by its author's name", async () => {
    expect(await ids(viewerFor(carol.id), "alice")).toContain(publicPost.id);
  });

  it("narrows to one kind when a section is being searched", async () => {
    const found = await ids(viewerFor(carol.id), "mango", { kind: "HOBBY" });
    expect(found).toEqual([hobbyPost.id]);
  });

  it("finds people by name and by what they wrote about themselves", async () => {
    const byName = await search(viewerFor(carol.id), "alice");
    expect(byName.people.map((p) => p.id)).toContain(alice.id);

    const byBio = await search(viewerFor(carol.id), "balcony");
    expect(byBio.people.map((p) => p.id)).toContain(alice.id);
  });

  it("does not search people from inside a section", async () => {
    const { people } = await search(viewerFor(carol.id), "alice", { kind: "IDEA" });
    expect(people).toEqual([]);
  });

  it("hides a blocked person from search entirely — profile and posts", async () => {
    // The requirement in the user's own words: searching a blocked person's name must not
    // turn up their profile. It has to hold in both directions, so the same assertion is
    // made from a viewer who blocked Alice and from one Alice blocked — which are the
    // same Viewer shape, since blockedIds merges both.
    const blocked = viewerFor(carol.id, [], [alice.id]);

    const { people, posts } = await search(blocked, "alice");
    expect(people.map((p) => p.id)).not.toContain(alice.id);
    expect(posts.map((p) => p.author.id)).not.toContain(alice.id);

    // And her work is gone from a topic search too, not just a search for her name.
    const byTopic = await search(blocked, "mango");
    expect(byTopic.posts.map((p) => p.author.id)).not.toContain(alice.id);
  });

  it("still finds a blocked person for everyone else", async () => {
    const unaffected = await search(viewerFor(bob.id), "alice");
    expect(unaffected.people.map((p) => p.id)).toContain(alice.id);
  });

  it("returns nothing at all for a single letter", async () => {
    const { posts, people } = await search(viewerFor(carol.id), "m");
    expect(posts).toEqual([]);
    expect(people).toEqual([]);
  });
});
