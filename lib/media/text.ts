import "server-only";

import mammoth from "mammoth";

/**
 * Pull readable text out of document uploads so moderation can look at what a PDF or
 * Word file actually says, not just its filename.
 *
 * This text is never rendered publicly — it exists so the safety check can read a
 * document the same way a person would.
 */

/** Documents can be long; moderation only needs enough to judge intent. */
const MAX_CHARS = 40_000;

function clamp(text: string): string {
  const collapsed = text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  return collapsed.length > MAX_CHARS ? collapsed.slice(0, MAX_CHARS) + "\n…" : collapsed;
}

export async function extractPdfText(
  data: Buffer,
): Promise<{ text: string; pageCount: number | null }> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return {
      text: clamp(Array.isArray(text) ? text.join("\n") : text),
      pageCount: totalPages ?? null,
    };
  } catch {
    // A PDF we can't parse is not a reason to reject someone's work — moderation just
    // proceeds without the text layer.
    return { text: "", pageCount: null };
  }
}

/**
 * The same PDF, but keeping its own page breaks.
 *
 * The reading room needs these: "go to page 12" has to mean the page the book itself
 * calls 12, not the twelfth slice of a wall of text. Falls back to an empty array so the
 * caller can paginate the merged text instead.
 */
export async function extractPdfPages(data: Buffer): Promise<string[]> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: false });
    if (!Array.isArray(text)) return [];
    return text.map((page) => page.replace(/[ \t]{2,}/g, " ").trim());
  } catch {
    return [];
  }
}

export async function extractDocxText(data: Buffer): Promise<string> {
  try {
    const { value } = await mammoth.extractRawText({ buffer: data });
    return clamp(value);
  } catch {
    return "";
  }
}

export function extractPlainText(data: Buffer): string {
  return clamp(data.toString("utf8"));
}
