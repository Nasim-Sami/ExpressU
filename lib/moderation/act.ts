import type { ModerationAssessment, ModerationOutcome } from "./types";

/**
 * Turning an assessment into a consequence.
 *
 * Deliberately a pure function with no database and no network, so the rules that decide
 * whether a young person's post goes up can be read in one screen and tested exhaustively.
 * See act.test.ts.
 *
 * Precedence is explicit → originality → relevance. Safety outranks attribution, and
 * attribution outranks fit, because that is the order in which the harms differ: the
 * first protects a person, the second protects a creator, the third only tidies a feed.
 */

export type DuplicateHit = "sha256" | "phash" | null;

/**
 * Author-facing copy. This is product text, not error strings — it is very likely the
 * only moment ExpressU ever tells a young person "no", so it says what happened, what
 * they can do, and nothing that sounds like a judgement on them.
 */
const MESSAGES = {
  explicit:
    "We've kept this one off ExpressU. Some things aren't a fit for a space that younger people share. If you think we've got this wrong, tell us — a real person will read it.",

  suspected:
    "Someone from our team is taking a look at this one before it goes up. That's not a mark against you, and we'll come back to you soon.",

  reposted:
    "This looks like it might be someone else's work rather than yours. ExpressU is for the things you make. If this is yours, say so and a person will take another look — we'd rather hear from you than get this wrong.",

  duplicate:
    "This one's already on ExpressU, so we haven't posted it twice. If that's a surprise, tell us and a person will check.",

  irrelevant:
    "This one doesn't quite fit what ExpressU is for — this is a place for the things you make and the things you wonder about. Try sharing something you've been working on, even if it's half-finished.",

  reviewNeeded:
    "We couldn't finish checking this one automatically, so a person is going to look instead. Nothing's wrong — it'll just take a little longer.",
} as const;

export function decide(
  assessment: ModerationAssessment,
  duplicate: DuplicateHit = null,
): ModerationOutcome {
  // A deterministic hash match is the one case we are certain about.
  if (duplicate) {
    return {
      verdict: "BLOCKED_REPOSTED",
      authorMessage: MESSAGES.duplicate,
      review: "BLOCK_APPEAL",
      assessment,
      duplicateOf: duplicate,
      rationale: `Identical media already on ExpressU (${duplicate} match).`,
    };
  }

  // 1. Safety first — the only automatic, human-free block.
  if (assessment.explicit.verdict === "present") {
    return {
      verdict: "BLOCKED_EXPLICIT",
      authorMessage: assessment.gentle_note || MESSAGES.explicit,
      review: "BLOCK_APPEAL",
      assessment,
      rationale: assessment.explicit.rationale,
    };
  }

  // "Suspected" covers both ambiguous content and a possible sign of distress. Neither
  // should be auto-blocked and neither should be published unseen — a person looks.
  if (assessment.explicit.verdict === "suspected") {
    return {
      verdict: "NEEDS_REVIEW",
      authorMessage: MESSAGES.suspected,
      review: "ORIGINALITY_UNSURE",
      assessment,
      rationale: assessment.explicit.rationale,
    };
  }

  // 2. Attribution.
  if (assessment.originality.verdict === "likely_reposted") {
    return {
      verdict: "BLOCKED_REPOSTED",
      authorMessage: assessment.gentle_note || MESSAGES.reposted,
      review: "BLOCK_APPEAL",
      assessment,
      rationale: assessment.originality.rationale,
    };
  }

  // "Unsure" PUBLISHES and quietly asks a human. We never punish on a guess about
  // whether a teenager made the thing they said they made.
  if (assessment.originality.verdict === "unsure") {
    return {
      verdict: "APPROVED",
      authorMessage: null,
      review: "ORIGINALITY_UNSURE",
      assessment,
      rationale: assessment.originality.rationale,
    };
  }

  // 3. Fit. The gentlest consequence: not published, a warm note, one strike.
  if (assessment.relevance.verdict === "not_expressive") {
    return {
      verdict: "WARNED_IRRELEVANT",
      authorMessage: assessment.gentle_note || MESSAGES.irrelevant,
      assessment,
      rationale: assessment.relevance.rationale,
    };
  }

  return { verdict: "APPROVED", authorMessage: null, assessment };
}

/**
 * When we could not get a usable assessment at all.
 *
 * Note the asymmetry: a missing API key publishes the post, while a model refusal holds
 * it for a human. An unconfigured moderator is our failure and a young person shouldn't
 * pay for it; a refusal is a genuine signal that something needs looking at.
 */
export function decideOnFailure(
  failure: "unconfigured" | "refusal" | "malformed" | "error",
  detail?: string,
): ModerationOutcome {
  if (failure === "unconfigured") {
    return {
      verdict: "APPROVED",
      authorMessage: null,
      assessment: null,
      rationale: "Moderation is not configured (no ANTHROPIC_API_KEY); post published unchecked.",
    };
  }

  if (failure === "refusal") {
    return {
      verdict: "NEEDS_REVIEW",
      authorMessage: MESSAGES.suspected,
      review: "ORIGINALITY_UNSURE",
      assessment: null,
      rationale: "The moderation model declined to assess this upload. Needs human eyes.",
    };
  }

  return {
    verdict: "NEEDS_REVIEW",
    authorMessage: MESSAGES.reviewNeeded,
    review: "ORIGINALITY_UNSURE",
    assessment: null,
    rationale: `Moderation could not complete (${failure})${detail ? `: ${detail}` : ""}.`,
  };
}

/** Whether this outcome means the idea becomes visible to others. */
export function publishes(outcome: ModerationOutcome): boolean {
  return outcome.verdict === "APPROVED";
}
