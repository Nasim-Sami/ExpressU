import "server-only";

import { assess } from "./claude";
import { decide, decideOnFailure } from "./act";
import { processAttachment } from "../media/process";
import { db } from "../db";
import { notify } from "../notify";

/**
 * Checking an interview answer.
 *
 * An answer is somebody else's writing and media arriving on another person's page, so it
 * is checked in its own right rather than inheriting the interview's clean verdict. It
 * runs the same extraction, the same model, and the same verdict table as a post — the
 * only difference is what happens afterwards, because an answer has no strike ledger and
 * no author-facing appeal flow of its own yet.
 *
 * Why answers must be checked at all: ExpressU has no comments precisely because
 * unmoderated replies are where platforms hurt people. An answer box that skipped this
 * would be a comment box wearing a hat.
 */
export async function moderateAnswer(responseId: string): Promise<string> {
  const response = await db.interviewResponse.findUnique({
    where: { id: responseId },
    include: {
      attachments: true,
      author: { select: { id: true, handle: true } },
      question: {
        select: {
          text: true,
          entry: { select: { post: { select: { id: true, title: true } } } },
        },
      },
    },
  });
  if (!response) throw new Error(`No interview response ${responseId}`);

  // 1. Derive frames, transcripts and document text from whatever was attached.
  const frames: Buffer[] = [];
  const transcripts: string[] = [];
  const documentTexts: string[] = [];

  for (const attachment of response.attachments) {
    const processed = await processAttachment(attachment.id);
    frames.push(...processed.frames);
    if (processed.transcript) transcripts.push(processed.transcript);
    if (processed.documentText) documentTexts.push(processed.documentText);
  }

  // 2. Ask the model. The question is passed as the title so the check can judge the
  //    answer in context — "no" is a very different answer to "did you enjoy it?" than
  //    it is to something darker.
  const result = await assess({
    title: response.question.text,
    caption: response.body,
    authorHandle: response.author.handle,
    attachments: response.attachments.map((a) => ({
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

  const outcome = result.ok
    ? decide(result.assessment, null)
    : decideOnFailure(result.failure, result.detail);

  /*
   * Map the verdict onto the answer.
   *
   * Note the deliberate difference from posts: an answer judged merely off-purpose is
   * NOT blocked. "This doesn't fit what ExpressU is for" is a judgement about a person's
   * own post; applied to an answer it would mean deciding somebody answered a question
   * wrongly, which is exactly the kind of verdict this platform refuses to hand out.
   * Only safety and originality actually withhold an answer.
   */
  const status =
    outcome.verdict === "APPROVED" || outcome.verdict === "WARNED_IRRELEVANT"
      ? "LIVE"
      : outcome.verdict === "NEEDS_REVIEW"
        ? "UNDER_REVIEW"
        : "BLOCKED";

  await db.interviewResponse.update({
    where: { id: responseId },
    data: { moderationStatus: status, moderatedAt: new Date() },
  });

  if (status === "BLOCKED" || status === "UNDER_REVIEW") {
    await db.reviewItem.create({
      data: {
        kind: status === "BLOCKED" ? "BLOCK_APPEAL" : "ORIGINALITY_UNSURE",
        subjectId: responseId,
        notes: `Interview answer — ${outcome.rationale ?? outcome.verdict}`,
      },
    });

    if (outcome.authorMessage) {
      await notify(response.author.id, "MODERATION", {
        message: outcome.authorMessage,
        postId: response.question.entry.post.id,
      });
    }
  }

  return outcome.verdict;
}
