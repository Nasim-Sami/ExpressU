import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

/**
 * Seed data — enough to see the whole platform working immediately, and to exercise the
 * visibility rules by hand.
 *
 * Every account uses the password `expressu` so you can sign in as anyone and check what
 * they can and can't see.
 */

/**
 * The encouragement phrase bank.
 *
 * These are what a viewer can send instead of a comment. Every one of them is warm and
 * none of them evaluates: no "great job", no "this is good", nothing that implies a
 * scale the next idea could fall short on. They say "I saw this" and "keep going".
 */
const PRESETS = [
  "This made me think.",
  "I'd love to see where this goes.",
  "I've wondered about this too.",
  "Thank you for sharing this.",
  "This stayed with me.",
  "I'm glad you made this.",
  "More of this, please.",
  "You've noticed something real here.",
  "This is braver than it looks.",
  "I hope you keep going with it.",
];

async function main() {
  console.log("Seeding ExpressU…");

  await db.preset.deleteMany();
  for (const [i, text] of PRESETS.entries()) {
    await db.preset.create({ data: { text, ordinal: i } });
  }
  console.log(`  ${PRESETS.length} encouragement phrases`);

  const passwordHash = await bcrypt.hash("expressu", 12);
  const year = new Date().getUTCFullYear();

  const people = [
    {
      handle: "maya",
      displayName: "Maya Okonkwo",
      email: "maya@example.com",
      birthYear: year - 14,
      bio: "14. I draw things that don't exist yet.",
      role: "MEMBER",
    },
    {
      handle: "idris",
      displayName: "Idris Bello",
      email: "idris@example.com",
      birthYear: year - 17,
      bio: "17. Making a game about my grandmother's village.",
      role: "MEMBER",
    },
    {
      handle: "rosa",
      displayName: "Rosa Lindqvist",
      email: "rosa@example.com",
      birthYear: year - 20,
      bio: "20. Sound, mostly. Sometimes words.",
      role: "MEMBER",
    },
    {
      handle: "sam",
      displayName: "Sam Ferrier",
      email: "sam@example.com",
      birthYear: year - 34,
      bio: "Keeping an eye on things here.",
      role: "ADMIN",
    },
  ];

  const users: Record<string, string> = {};
  for (const person of people) {
    const user = await db.user.upsert({
      where: { handle: person.handle },
      update: {},
      create: { ...person, passwordHash },
    });
    users[person.handle] = user.id;
  }
  console.log(`  ${people.length} people (password: expressu)`);

  // Maya and Idris are connected; Rosa is not connected to anyone. That combination is
  // what makes the CIRCLE visibility rule testable by hand.
  await db.connection.upsert({
    where: {
      requesterId_addresseeId: { requesterId: users.maya, addresseeId: users.idris },
    },
    update: { status: "ACCEPTED" },
    create: {
      requesterId: users.maya,
      addresseeId: users.idris,
      status: "ACCEPTED",
    },
  });
  console.log("  maya ↔ idris connected; rosa deliberately unconnected");

  const ideas: {
    author: string;
    kind?: "IDEA" | "HOBBY" | "LEARNING" | "LETTER";
    title: string;
    visibility: string;
    hobbyName?: string;
    recipientType?: string;
    entries: (string | { body: string; letterTo: string; letterSubject: string })[];
  }[] = [
    {
      author: "maya",
      title: "A library where you borrow tools instead of books",
      visibility: "PUBLIC",
      entries: [
        "There's a library on my road and nobody uses it much. What if you could borrow a drill, or a sewing machine, or a tent? Most people need a drill about twice in their whole life.",
        "Update: I asked my neighbour and she said she'd lend her ladder if there was somewhere to put it. So that's one ladder. It's a start.",
        "I drew a floor plan. The tools go where the DVDs used to be, because nobody borrows DVDs.",
      ],
    },
    {
      author: "maya",
      title: "Bird that carries seeds to places that burned",
      visibility: "PUBLIC",
      entries: [
        "A drawing I did of a bird with seed pods in its feathers. It flies to places after a fire and the seeds fall out when it lands. It isn't real but I think about it a lot.",
      ],
    },
    {
      author: "maya",
      title: "Things I'm scared to be bad at",
      visibility: "PRIVATE",
      entries: [
        "A list. Not showing anyone this one yet. Singing. Talking to new people. Maths. Being funny on purpose.",
      ],
    },
    {
      author: "idris",
      title: "The village game — first walkthrough",
      visibility: "CIRCLE",
      entries: [
        "You walk through my grandmother's village and every house tells you one story. No points, no winning. I've built three houses so far and the walking feels right.",
        "Added the sound of the generator at night. It's the thing I remember most and I couldn't get it right for weeks.",
      ],
    },
    {
      author: "idris",
      title: "Why do maps stop at the edge of what someone owns?",
      visibility: "PUBLIC",
      entries: [
        "Something I noticed doing history homework. Every old map ends where somebody's land ended. Nobody drew the bit in between because nobody owned it. I don't have a point yet, I just think that's strange.",
      ],
    },
    {
      author: "rosa",
      title: "Recording of the launderette at 6am",
      visibility: "PUBLIC",
      entries: [
        "Six minutes of machines and one man humming. I've listened to it about forty times. There's a bit at 4:12 where the humming and the spin cycle land on the same note and I promise I didn't arrange that.",
      ],
    },

    // --- hobbies: memories that accumulate rather than a project that progresses ---
    {
      author: "maya",
      kind: "HOBBY",
      title: "The paper birds on my windowsill",
      visibility: "PUBLIC",
      hobbyName: "Origami",
      entries: [
        "I started folding these when I was eleven because my hands needed something to do. There are about forty now. The first ones are terrible and I'm keeping them.",
        "Worked out that if you fold the wings twice instead of once, it actually glides instead of dropping. Took me most of a Saturday.",
        "My little brother asked me to teach him. He made one and it was worse than my first one and he was so pleased with it. Best day of this hobby so far.",
      ],
    },
    {
      author: "idris",
      kind: "HOBBY",
      title: "Cooking my grandmother's food from memory",
      visibility: "CIRCLE",
      hobbyName: "Cooking & baking",
      entries: [
        "She never wrote anything down. I'm trying to rebuild the rice dish by taste, one attempt at a time. Attempt four was edible. Attempt one was not.",
        "Called my aunt. She said the thing I was missing was that the onions go in twice. Twice! Nobody tells you these things.",
      ],
    },

    // --- learnings: half-learned counts ---
    {
      author: "rosa",
      kind: "LEARNING",
      title: "Teaching myself to read music",
      visibility: "PUBLIC",
      entries: [
        "I can play by ear but I can't read a note, and it's starting to be a problem. Starting from actual zero here.",
        "Lesson two of me: the lines and spaces aren't a code you memorise, they're a picture of the piano. Nobody said this. It would have saved me a fortnight.",
      ],
    },
    {
      author: "maya",
      kind: "LEARNING",
      title: "Why my drawings looked flat, and what fixed it",
      visibility: "PUBLIC",
      entries: [
        "For about a year everything I drew looked like a sticker. I thought I was bad at shading. I was actually bad at deciding where the light was coming from before I started.",
      ],
    },

    // --- open letters: something said out loud, to someone who could act ---
    {
      author: "idris",
      kind: "LETTER",
      title: "Please keep the library open on Sundays",
      visibility: "PUBLIC",
      recipientType: "Council",
      entries: [
        {
          body: "I'm writing about the plan to close the branch library on Sundays.\n\nSunday is the only day my family is all home, and it's the only day I can get there. There are about fifteen of us who use the study room that day. Most of us don't have a quiet desk at home.\n\nI understand it costs money to stay open. I'd like to know what the cost actually is, and whether anyone asked the people who use it on Sundays before deciding.",
          letterTo: "The Borough Library Committee",
          letterSubject: "Sunday closure of the branch library",
        },
        {
          body: "Following my letter last month, which I haven't had a reply to.\n\nSince then I've spoken to eleven other people who use the library on Sundays. Nine of them didn't know about the closure at all. That's my actual point now — not just the closure, but that it was decided without telling the people it affects.",
          letterTo: "The Borough Library Committee",
          letterSubject: "Following up — still no reply",
        },
      ],
    },
    {
      author: "rosa",
      kind: "LETTER",
      title: "The bus that doesn't come",
      visibility: "PRIVATE",
      recipientType: "Agency",
      entries: [
        {
          body: "Drafting this before I send it anywhere. The 47 is scheduled every twenty minutes and it comes every forty. I've been writing down the times for six weeks. I have the data. I just haven't worked out who to send it to yet.",
          letterTo: "The regional transport authority",
          letterSubject: "Six weeks of timings for the 47 route",
        },
      ],
    },
  ];

  for (const spec of ideas) {
    const existing = await db.post.findFirst({
      where: { title: spec.title, authorId: users[spec.author] },
    });
    if (existing) continue;

    const idea = await db.post.create({
      data: {
        authorId: users[spec.author],
        kind: spec.kind ?? "IDEA",
        title: spec.title,
        hobbyName: spec.hobbyName ?? null,
        recipientType: spec.recipientType ?? null,
        visibility: spec.visibility,
        // Seeded posts skip the queue so the platform has something in it on first run.
        moderationStatus: "LIVE",
        lastEntryAt: new Date(),
      },
    });

    for (const [i, entry] of spec.entries.entries()) {
      const isLetter = typeof entry !== "string";
      // Space the entries out so the journal timeline reads as a history.
      const createdAt = new Date(Date.now() - (spec.entries.length - i) * 86_400_000 * 3);

      await db.entry.create({
        data: {
          postId: idea.id,
          body: isLetter ? entry.body : entry,
          letterTo: isLetter ? entry.letterTo : null,
          letterSubject: isLetter ? entry.letterSubject : null,
          ordinal: i + 1,
          originalityAttested: true,
          createdAt,
          // Seeded content is treated as already checked, so the worker doesn't spend
          // API calls re-moderating the sample data on every fresh database.
          moderatedAt: createdAt,
        },
      });
    }
  }
  console.log(`  ${ideas.length} posts across ideas, hobbies, learnings and letters`);

  // A little warmth already in the system: loves the authors can see, notes only they read.
  const mayaLibrary = await db.post.findFirst({
    where: { authorId: users.maya, title: { contains: "library" } },
  });
  const rosaLaunderette = await db.post.findFirst({
    where: { authorId: users.rosa },
  });

  if (mayaLibrary) {
    for (const handle of ["idris", "rosa"]) {
      await db.love.upsert({
        where: { postId_userId: { postId: mayaLibrary.id, userId: users[handle] } },
        update: {},
        create: { postId: mayaLibrary.id, userId: users[handle] },
      });
    }

    const preset = await db.preset.findFirst({ where: { ordinal: 1 } });
    const already = await db.encouragement.findFirst({
      where: { postId: mayaLibrary.id, fromUserId: users.rosa },
    });
    if (preset && !already) {
      await db.encouragement.create({
        data: { postId: mayaLibrary.id, fromUserId: users.rosa, presetId: preset.id },
      });
    }
  }

  if (rosaLaunderette) {
    await db.love.upsert({
      where: { postId_userId: { postId: rosaLaunderette.id, userId: users.maya } },
      update: {},
      create: { postId: rosaLaunderette.id, userId: users.maya },
    });
  }

  await seedBooks();

  console.log("\nDone. Sign in at /login with any handle's email and the password `expressu`.");
  console.log("  maya@example.com   — 14, has a private idea and a 3-chapter journal");
  console.log("  idris@example.com  — 17, has a CIRCLE idea only maya should see");
  console.log("  rosa@example.com   — 20, connected to nobody");
  console.log("  sam@example.com    — admin, can reach /admin");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

/**
 * The books the reading room opens with.
 *
 * Idempotent on (title, author) so re-running the seed doesn't stack duplicate copies of
 * the shelf. They go straight to LIVE: these are the platform's own, written for it, and
 * there is nothing for the moderation queue to decide about them.
 */
async function seedBooks() {
  const { DEFAULT_BOOKS } = await import("./default-books");

  let added = 0;

  for (const book of DEFAULT_BOOKS) {
    const existing = await db.book.findFirst({
      where: { title: book.title, author: book.author },
      select: { id: true },
    });
    if (existing) continue;

    await db.book.create({
      data: {
        title: book.title,
        author: book.author,
        blurb: book.blurb,
        language: book.language,
        minAge: book.minAge,
        maxAge: book.maxAge,
        uploaderId: null,
        moderationStatus: "LIVE",
        moderatedAt: new Date(),
        pages: { create: book.pages.map((text, index) => ({ number: index + 1, text })) },
      },
    });
    added++;
  }

  console.log(`  ${added} books added to the reading room (${DEFAULT_BOOKS.length} on the shelf)`);
}
