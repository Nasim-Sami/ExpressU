import { describe, expect, it } from "vitest";

import { decide, decideOnFailure, publishes } from "./act";
import type {
  ExplicitVerdict,
  ModerationAssessment,
  OriginalityVerdict,
  RelevanceVerdict,
} from "./types";

function assessment(
  explicit: ExplicitVerdict,
  originality: OriginalityVerdict,
  relevance: RelevanceVerdict,
  gentleNote = "",
): ModerationAssessment {
  return {
    explicit: { verdict: explicit, categories: [], rationale: "r" },
    originality: { verdict: originality, signals: [], rationale: "r" },
    relevance: { verdict: relevance, rationale: "r" },
    gentle_note: gentleNote,
  };
}

const clean = assessment("none", "own_work", "expressive");

describe("the ordinary case", () => {
  it("publishes a clean post and says nothing to the author", () => {
    const outcome = decide(clean);
    expect(outcome.verdict).toBe("APPROVED");
    expect(outcome.authorMessage).toBeNull();
    expect(outcome.review).toBeUndefined();
    expect(publishes(outcome)).toBe(true);
  });
});

describe("explicit content is the only automatic block", () => {
  it("blocks immediately when explicit content is present", () => {
    const outcome = decide(assessment("present", "own_work", "expressive"));
    expect(outcome.verdict).toBe("BLOCKED_EXPLICIT");
    expect(publishes(outcome)).toBe(false);
    // Always appealable — nothing disappears without a route to a person.
    expect(outcome.review).toBe("BLOCK_APPEAL");
    expect(outcome.authorMessage).toBeTruthy();
  });

  it("holds 'suspected' for a human instead of blocking or publishing", () => {
    const outcome = decide(assessment("suspected", "own_work", "expressive"));
    expect(outcome.verdict).toBe("NEEDS_REVIEW");
    expect(publishes(outcome)).toBe(false);
    expect(outcome.review).toBe("ORIGINALITY_UNSURE");
  });

  it("outranks every other finding", () => {
    // Explicit wins even when the post would also fail relevance and originality.
    const outcome = decide(assessment("present", "likely_reposted", "not_expressive"));
    expect(outcome.verdict).toBe("BLOCKED_EXPLICIT");
  });
});

describe("originality — never punish on a guess", () => {
  it("blocks a confident repost, with an appeal", () => {
    const outcome = decide(assessment("none", "likely_reposted", "expressive"));
    expect(outcome.verdict).toBe("BLOCKED_REPOSTED");
    expect(outcome.review).toBe("BLOCK_APPEAL");
  });

  it("PUBLISHES when unsure, and only quietly flags it for review", () => {
    // This is the single most important rule in the file: an uncertain originality
    // call must never cost a young person their post.
    const outcome = decide(assessment("none", "unsure", "expressive"));
    expect(outcome.verdict).toBe("APPROVED");
    expect(publishes(outcome)).toBe(true);
    expect(outcome.review).toBe("ORIGINALITY_UNSURE");
    // ...and the author is told nothing, because nothing happened to them.
    expect(outcome.authorMessage).toBeNull();
  });

  it("still publishes when unsure even if relevance is also borderline-failing", () => {
    // Originality is evaluated before relevance, so an "unsure" short-circuits the
    // relevance strike. A young person shouldn't collect a strike on a maybe.
    const outcome = decide(assessment("none", "unsure", "not_expressive"));
    expect(outcome.verdict).toBe("APPROVED");
  });
});

describe("relevance is the gentlest consequence", () => {
  it("warns without blocking permanently and carries a message", () => {
    const outcome = decide(assessment("none", "own_work", "not_expressive"));
    expect(outcome.verdict).toBe("WARNED_IRRELEVANT");
    expect(publishes(outcome)).toBe(false);
    expect(outcome.authorMessage).toBeTruthy();
    // A warning is not an appeal-worthy block; it's a nudge.
    expect(outcome.review).toBeUndefined();
  });

  it("prefers the model's warm note over the generic fallback when given one", () => {
    const note = "This one looks like an advert — tell us about something you made instead.";
    const outcome = decide(assessment("none", "own_work", "not_expressive", note));
    expect(outcome.authorMessage).toBe(note);
  });
});

describe("author-facing copy never carries a verdict", () => {
  const forbidden = [
    "irrelevant",
    "violation",
    "rejected",
    "inappropriate",
    "failed",
    "invalid",
  ];

  const outcomes = [
    decide(assessment("present", "own_work", "expressive")),
    decide(assessment("suspected", "own_work", "expressive")),
    decide(assessment("none", "likely_reposted", "expressive")),
    decide(assessment("none", "own_work", "not_expressive")),
    decide(clean, "sha256"),
    decideOnFailure("refusal"),
    decideOnFailure("error"),
  ];

  for (const outcome of outcomes) {
    it(`${outcome.verdict} message avoids judgement words`, () => {
      const message = (outcome.authorMessage ?? "").toLowerCase();
      for (const word of forbidden) expect(message).not.toContain(word);
    });
  }
});

describe("deterministic duplicate checks", () => {
  it("blocks an exact re-upload regardless of what the model thought", () => {
    const outcome = decide(clean, "sha256");
    expect(outcome.verdict).toBe("BLOCKED_REPOSTED");
    expect(outcome.duplicateOf).toBe("sha256");
    expect(outcome.review).toBe("BLOCK_APPEAL");
  });

  it("blocks a perceptual match too", () => {
    expect(decide(clean, "phash").verdict).toBe("BLOCKED_REPOSTED");
  });
});

describe("what happens when moderation itself fails", () => {
  it("publishes when moderation is simply not configured", () => {
    // Our missing API key is not a young person's problem.
    const outcome = decideOnFailure("unconfigured");
    expect(outcome.verdict).toBe("APPROVED");
    expect(publishes(outcome)).toBe(true);
    expect(outcome.authorMessage).toBeNull();
  });

  it("routes a model refusal to a human rather than guessing either way", () => {
    const outcome = decideOnFailure("refusal");
    expect(outcome.verdict).toBe("NEEDS_REVIEW");
    expect(publishes(outcome)).toBe(false);
  });

  it("routes transport and parsing failures to a human", () => {
    for (const failure of ["malformed", "error"] as const) {
      expect(decideOnFailure(failure).verdict).toBe("NEEDS_REVIEW");
    }
  });
});

describe("no path both blocks a post and leaves the author without recourse", () => {
  const blocking = [
    decide(assessment("present", "own_work", "expressive")),
    decide(assessment("none", "likely_reposted", "expressive")),
    decide(clean, "sha256"),
    decide(clean, "phash"),
  ];

  for (const outcome of blocking) {
    it(`${outcome.verdict} offers an appeal and an explanation`, () => {
      expect(outcome.review).toBe("BLOCK_APPEAL");
      expect(outcome.authorMessage).toBeTruthy();
    });
  }
});
