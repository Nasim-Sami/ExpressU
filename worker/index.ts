import { db } from "@/lib/db";
import { pickNext } from "@/lib/moderation/claim";
import { moderateEntry } from "@/lib/moderation/pipeline";
import { moderateAnswer } from "@/lib/moderation/answers";
import { maybeMilestone } from "@/lib/notify";

/**
 * The background moderation worker.
 *
 * Deliberately dumb: poll for chapters whose idea is still PENDING, process them one at
 * a time, sleep. No queue server, no cron, nothing to operate. At ExpressU's scale the
 * simplest thing that works is the right thing, and it can be swapped for a real queue
 * the day that stops being true.
 *
 *   npm run worker
 *
 * If it isn't running, posts sit in PENDING and stay visible to their author with a
 * "we're having a quick look" banner. Nothing breaks and nothing is lost.
 */

const POLL_MS = 3_000;
let running = true;

async function claimNext() {
  const candidates = await db.entry.findMany({
    where: { post: { moderationStatus: "PENDING" } },
    orderBy: { createdAt: "asc" },
    include: { post: { select: { id: true, authorId: true } } },
  });

  // The rule itself lives in lib/moderation/claim.ts, with tests — it's what stops an
  // edit from being a way around the check.
  return pickNext(candidates);
}

/**
 * The next interview answer needing a check.
 *
 * Answers are claimed by the same rule as entries — never checked, or edited since the
 * last check — so an answer can't be rewritten past its approval any more than a post
 * can. They are handled after entries only because a person waiting on their own post is
 * the more visible wait; neither queue can starve the other, since each tick tries both.
 */
async function claimNextAnswer() {
  const candidates = await db.interviewResponse.findMany({
    where: { moderationStatus: { in: ["PENDING", "UNDER_REVIEW"] } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      contentUpdatedAt: true,
      moderatedAt: true,
      authorId: true,
    },
  });
  return pickNext(candidates);
}

async function tick(): Promise<boolean> {
  const entry = await claimNext();
  if (!entry) return tickAnswer();

  const started = Date.now();
  console.log(`[worker] moderating entry ${entry.id} (idea ${entry.post.id})`);

  try {
    const outcome = await moderateEntry(entry.id);
    console.log(
      `[worker] → ${outcome.verdict} in ${Date.now() - started}ms` +
        (outcome.review ? ` (review: ${outcome.review})` : ""),
    );

    if (outcome.verdict === "APPROVED") {
      await maybeMilestone(entry.post.authorId);
    }
  } catch (error) {
    console.error(`[worker] entry ${entry.id} failed:`, error);
    // Park it for a human rather than retrying forever against a broken upload.
    await db.post.update({
      where: { id: entry.post.id },
      data: { moderationStatus: "UNDER_REVIEW" },
    });
    await db.reviewItem.create({
      data: {
        kind: "ORIGINALITY_UNSURE",
        subjectId: entry.id,
        notes: `Worker error: ${error instanceof Error ? error.message : String(error)}`,
      },
    });
  }

  return true;
}

/** One interview answer, checked the same way a post is. */
async function tickAnswer(): Promise<boolean> {
  const answer = await claimNextAnswer();
  if (!answer) return false;

  const started = Date.now();
  console.log(`[worker] moderating interview answer ${answer.id}`);

  try {
    const verdict = await moderateAnswer(answer.id);
    console.log(`[worker] → ${verdict} in ${Date.now() - started}ms`);
  } catch (error) {
    console.error(`[worker] answer ${answer.id} failed:`, error);
    // Park it for a human rather than retrying forever against a broken upload. Note it
    // is NOT published on failure: an unchecked answer staying invisible is the safe
    // direction to fail in.
    await db.interviewResponse.update({
      where: { id: answer.id },
      data: { moderationStatus: "UNDER_REVIEW", moderatedAt: new Date() },
    });
    await db.reviewItem.create({
      data: {
        kind: "ORIGINALITY_UNSURE",
        subjectId: answer.id,
        notes: `Interview answer worker error: ${error instanceof Error ? error.message : String(error)}`,
      },
    });
  }

  return true;
}

async function main() {
  console.log("[worker] watching for new ideas. Ctrl-C to stop.");

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      "[worker] ANTHROPIC_API_KEY is not set — posts will publish without an automated check.",
    );
  }

  while (running) {
    let didWork = false;
    try {
      didWork = await tick();
    } catch (error) {
      console.error("[worker] poll failed:", error);
    }
    // Only pause when there was nothing to do, so a backlog drains at full speed.
    if (!didWork) await sleep(POLL_MS);
  }

  await db.$disconnect();
  console.log("[worker] stopped.");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`\n[worker] ${signal} — finishing the current item…`);
    running = false;
  });
}

main().catch((error) => {
  console.error("[worker] fatal:", error);
  process.exit(1);
});
