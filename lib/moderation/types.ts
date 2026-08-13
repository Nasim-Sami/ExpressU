/**
 * The shape of a moderation decision.
 *
 * Three independent judgements, deliberately kept apart so one can never quietly
 * contaminate another. "This looks like a repost" must not become "this is explicit",
 * and neither may leak into "this isn't a real idea". Each is acted on by its own rule
 * in lib/moderation/act.ts.
 */

export type ExplicitVerdict = "none" | "suspected" | "present";
export type OriginalityVerdict = "own_work" | "unsure" | "likely_reposted";
export type RelevanceVerdict = "expressive" | "not_expressive";

export interface ModerationAssessment {
  explicit: {
    verdict: ExplicitVerdict;
    categories: string[];
    rationale: string;
  };
  originality: {
    verdict: OriginalityVerdict;
    signals: string[];
    rationale: string;
  };
  relevance: {
    verdict: RelevanceVerdict;
    rationale: string;
  };
  /** One warm sentence for the author, used only when we act. Empty when nothing happens. */
  gentle_note: string;
}

/** The JSON Schema handed to the API, so the reply is validated rather than parsed from prose. */
export const ASSESSMENT_SCHEMA = {
  type: "object",
  properties: {
    explicit: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["none", "suspected", "present"] },
        categories: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
      required: ["verdict", "categories", "rationale"],
      additionalProperties: false,
    },
    originality: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["own_work", "unsure", "likely_reposted"] },
        signals: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
      required: ["verdict", "signals", "rationale"],
      additionalProperties: false,
    },
    relevance: {
      type: "object",
      properties: {
        verdict: { type: "string", enum: ["expressive", "not_expressive"] },
        rationale: { type: "string" },
      },
      required: ["verdict", "rationale"],
      additionalProperties: false,
    },
    gentle_note: { type: "string" },
  },
  required: ["explicit", "originality", "relevance", "gentle_note"],
  additionalProperties: false,
} as const;

/** What the pipeline decided to do, after combining the assessment with the hash checks. */
export interface ModerationOutcome {
  verdict:
    | "APPROVED"
    | "BLOCKED_EXPLICIT"
    | "BLOCKED_REPOSTED"
    | "WARNED_IRRELEVANT"
    | "NEEDS_REVIEW"
    | "ERROR";
  /** What the author is told. Always written for a young person, never as an error string. */
  authorMessage: string | null;
  /** Set when a human needs to look: which queue it lands in. */
  review?: "ORIGINALITY_UNSURE" | "BAN_CONFIRM" | "BLOCK_APPEAL";
  assessment: ModerationAssessment | null;
  duplicateOf?: "sha256" | "phash";
  rationale?: string;
}
