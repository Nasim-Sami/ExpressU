import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { MODERATION_SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import { ASSESSMENT_SCHEMA, type ModerationAssessment } from "./types";

const MODEL = "claude-opus-5";

export type AssessmentFailure =
  | "unconfigured" // no API key — the platform runs, moderation is skipped, humans review
  | "refusal" // the model's own safety classifiers declined; a human must look
  | "malformed"
  | "error";

export type AssessmentResult =
  | { ok: true; assessment: ModerationAssessment; modelId: string }
  | { ok: false; failure: AssessmentFailure; detail?: string };

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic();
  return client;
}

export interface AssessInput {
  title: string;
  caption: string;
  authorHandle: string;
  attachments: Array<{
    kind: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    durationSec?: number | null;
  }>;
  /** JPEG frames sampled across a video, or a still image. */
  frames: Buffer[];
  transcript?: string | null;
  documentText?: string | null;
}

export async function assess(input: AssessInput): Promise<AssessmentResult> {
  const anthropic = getClient();
  if (!anthropic) return { ok: false, failure: "unconfigured" };

  const content: Anthropic.ContentBlockParam[] = [];

  // Images first, then the text that explains them.
  for (const frame of input.frames.slice(0, 8)) {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: frame.toString("base64"),
      },
    });
  }

  content.push({
    type: "text",
    text: buildUserPrompt({
      title: input.title,
      caption: input.caption,
      authorHandle: input.authorHandle,
      attachments: input.attachments,
      transcript: input.transcript,
      documentText: input.documentText,
      frameCount: input.frames.length,
    }),
  });

  const params = {
    model: MODEL,
    // Room for adaptive thinking (on by default for Opus 5) plus the JSON verdict.
    max_tokens: 16_000,
    system: MODERATION_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content }],
    output_config: {
      // A decision about a child's post is worth thinking about properly.
      effort: "high" as const,
      format: { type: "json_schema" as const, schema: ASSESSMENT_SCHEMA },
    },
  };

  try {
    const response = await callWithFallback(anthropic, params);

    // The model's own safety classifiers can decline to analyse a borderline upload.
    // That is not a verdict on the post — route it to a human rather than guessing.
    if (response.stop_reason === "refusal") {
      return { ok: false, failure: "refusal" };
    }

    const text = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    )?.text;

    if (!text) return { ok: false, failure: "malformed", detail: "no text block" };

    const parsed = JSON.parse(text) as ModerationAssessment;
    if (!parsed?.explicit || !parsed?.originality || !parsed?.relevance) {
      return { ok: false, failure: "malformed", detail: "missing fields" };
    }

    return { ok: true, assessment: parsed, modelId: response.model ?? MODEL };
  } catch (error) {
    return {
      ok: false,
      failure: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Prefer the server-side refusal fallback, which re-runs a declined request on another
 * model inside the same call. If this account doesn't have the beta, fall back to the
 * plain endpoint rather than failing the whole moderation pass.
 */
async function callWithFallback(
  anthropic: Anthropic,
  params: Record<string, unknown>,
): Promise<Anthropic.Message> {
  try {
    return (await anthropic.beta.messages.create({
      ...params,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    } as never)) as unknown as Anthropic.Message;
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const betaUnavailable =
      message.includes("fallback") ||
      message.includes("beta") ||
      message.includes("unsupported");
    if (!betaUnavailable) throw error;

    return anthropic.messages.create(params as never) as Promise<Anthropic.Message>;
  }
}
