import "server-only";

import { db } from "@/lib/db";
import { processAttachment } from "@/lib/media/process";
import { notify } from "@/lib/notify";
import { assess } from "./claude";
import { decide, decideOnFailure, publishes, type DuplicateHit } from "./act";
import { findDuplicate } from "./duplicates";
import { clearStrikes, maybeOpenBanReview, recordStrike } from "./strikes";
import type { ModerationOutcome } from "./types";

/**
 * The whole safety pass for one entry: derive media → check for re-uploads →
 * ask the model → act.
 *
 * Every decision it can reach is recorded in a ModerationRun, including the model's own
 * rationale, so the admin queue shows a human what was actually seen rather than a bare
 * label to rubber-stamp.
 */
export async function moderateEntry(entryId: string): Promise<ModerationOutcome> {
  const entry = await db.entry.findUnique({
    where: { id: entryId },
    include: {
      attachments: true,
      post: { include: { author: { select: { id: true, handle: true } } } },
    },
  });
  if (!entry) throw new Error(`No entry ${entryId}`);

  const { post } = entry;

  // 1. Derive frames, hashes, transcripts, document text.
  const frames: Buffer[] = [];
  const transcripts: string[] = [];
  const documentTexts: string[] = [];

  for (const attachment of entry.attachments) {
    const processed = await processAttachment(attachment.id);
    frames.push(...processed.frames);
    if (processed.transcript) transcripts.push(processed.transcript);
    if (processed.documentText) documentTexts.push(processed.documentText);
  }

  // 2. Deterministic re-upload check, on freshly written hashes.
  let duplicate: DuplicateHit = null;
  const hashed = await db.attachment.findMany({
    where: { entryId },
    select: { sha256: true, phash: true },
  });
  for (const attachment of hashed) {
    duplicate = await findDuplicate({
      authorId: post.authorId,
      entryId,
      sha256: attachment.sha256,
      phash: attachment.phash,
    });
    if (duplicate) break;
  }

  // 3. Ask the model — unless a hash already settled it.
  let outcome: ModerationOutcome;
  let modelId: string | null = null;

  if (duplicate) {
    outcome = decide(
      {
        explicit: { verdict: "none", categories: [], rationale: "not assessed" },
        originality: {
          verdict: "likely_reposted",
          signals: [`${duplicate}_match`],
          rationale: "Identical media already exists on ExpressU.",
        },
        relevance: { verdict: "expressive", rationale: "not assessed" },
        gentle_note: "",
      },
      duplicate,
    );
  } else {
    const result = await assess({
      title: post.title,
      caption: entry.body,
      authorHandle: post.author.handle,
      attachments: entry.attachments.map((a) => ({
        kind: a.kind,
        filename: a.filename,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        durationSec: a.durationSec,
      })),
      frames,
      transcript: transcripts.join("\n\n") || null,
      documentText: documentTexts.join("\n\n") || null,
    });

    if (result.ok) {
      outcome = decide(result.assessment, null);
      modelId = result.modelId;
    } else {
      outcome = decideOnFailure(result.failure, result.detail);
    }
  }

  await recordRun(entryId, outcome, modelId);

  // Stamp the entry as checked at its current content. The worker uses this against
  // `updatedAt` to decide what still needs looking at, so it must be written whatever
  // the verdict was — including a block, which otherwise gets re-checked forever.
  await db.entry.update({
    where: { id: entryId },
    data: { moderatedAt: new Date() },
  });

  await applyOutcome({
    entryId,
    postId: post.id,
    authorId: post.authorId,
    outcome,
  });

  return outcome;
}

async function recordRun(
  entryId: string,
  outcome: ModerationOutcome,
  modelId: string | null,
) {
  await db.moderationRun.create({
    data: {
      entryId,
      verdict: outcome.verdict,
      explicitVerdict: outcome.assessment?.explicit.verdict ?? null,
      originalityVerdict: outcome.assessment?.originality.verdict ?? null,
      relevanceVerdict: outcome.assessment?.relevance.verdict ?? null,
      signals: outcome.assessment
        ? JSON.stringify(outcome.assessment.originality.signals)
        : null,
      rationale: outcome.rationale ?? outcome.assessment?.explicit.rationale ?? null,
      gentleNote: outcome.authorMessage,
      duplicateOf: outcome.duplicateOf ?? null,
      modelId,
    },
  });
}

async function applyOutcome(input: {
  entryId: string;
  postId: string;
  authorId: string;
  outcome: ModerationOutcome;
}) {
  const { entryId, postId, authorId, outcome } = input;

  const status = publishes(outcome)
    ? "LIVE"
    : outcome.verdict === "NEEDS_REVIEW"
      ? "UNDER_REVIEW"
      : outcome.verdict === "WARNED_IRRELEVANT"
        ? "BLOCKED"
        : "BLOCKED";

  await db.post.update({ where: { id: postId }, data: { moderationStatus: status } });

  // A young person who gets it right clears their record. Forgiveness is automatic.
  if (publishes(outcome)) {
    await clearStrikes(authorId);
  }

  if (outcome.verdict === "WARNED_IRRELEVANT") {
    await recordStrike(authorId, entryId);
    // Opens a review item at the threshold. Does NOT suspend anyone — see strikes.ts.
    await maybeOpenBanReview(authorId);
  }

  if (outcome.review === "ORIGINALITY_UNSURE") {
    await db.reviewItem.create({
      data: {
        kind: "ORIGINALITY_UNSURE",
        subjectId: entryId,
        notes: outcome.rationale ?? null,
      },
    });
  }

  if (outcome.authorMessage) {
    await notify(authorId, "MODERATION", {
      postId,
      message: outcome.authorMessage,
      appealable: outcome.review === "BLOCK_APPEAL",
    });
  }
}
