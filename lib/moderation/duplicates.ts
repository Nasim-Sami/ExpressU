import "server-only";

import { db } from "@/lib/db";
import { isPerceptualMatch } from "@/lib/media/hash";
import type { DuplicateHit } from "./act";

/**
 * Deterministic re-upload detection, against media already on ExpressU.
 *
 * This is the only part of the originality system that is certain rather than inferred,
 * which is why it is allowed to block on its own. It answers exactly one question: "has
 * this exact media been posted here before, by someone else?" It cannot and does not
 * claim to know whether something came from YouTube.
 *
 * Two exclusions, both load-bearing:
 *
 *   1. Matches against the SAME author are ignored. Re-posting your own earlier upload
 *      isn't theft — a young person revisiting their own work in a new chapter is the
 *      whole point of the Growth Journal.
 *
 *   2. Only media on LIVE ideas counts as "already here". A blocked upload must never
 *      become a claim of ownership: otherwise anyone could poison this index by grabbing
 *      someone's video, uploading it first, getting blocked — and thereby locking the
 *      real creator out of posting their own work. The person that would hurt is exactly
 *      the person this platform exists for.
 */
const publishedByAnotherAuthor = (authorId: string) => ({
  post: { authorId: { not: authorId }, moderationStatus: "LIVE" },
});

export async function findDuplicate(input: {
  authorId: string;
  entryId: string;
  sha256: string;
  phash: string | null;
}): Promise<DuplicateHit> {
  // 1. Byte-identical.
  const exact = await db.attachment.findFirst({
    where: {
      sha256: input.sha256,
      entryId: { not: input.entryId },
      entry: publishedByAnotherAuthor(input.authorId),
    },
    select: { id: true },
  });
  if (exact) return "sha256";

  if (!input.phash) return null;

  // 2. Perceptually the same — re-encoded, resized, or trimmed.
  //
  // pHash can't be compared in SQL, so candidates are pulled and compared in memory.
  // Bounded to the most recent 5,000 hashed attachments: at ExpressU's scale that is
  // effectively everything, and it keeps a pathological case from stalling the worker.
  const candidates = await db.attachment.findMany({
    where: {
      phash: { not: null },
      entryId: { not: input.entryId },
      entry: publishedByAnotherAuthor(input.authorId),
    },
    select: { phash: true },
    orderBy: { createdAt: "desc" },
    take: 5_000,
  });

  for (const candidate of candidates) {
    if (candidate.phash && isPerceptualMatch(input.phash, candidate.phash)) {
      return "phash";
    }
  }

  return null;
}
