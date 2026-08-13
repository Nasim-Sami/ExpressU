/**
 * Turning a wall of text into pages.
 *
 * A PDF arrives already paginated and keeps its own page numbers. Everything else — a
 * .docx, a .txt, a story typed straight into the box — arrives as one long string, and a
 * child reading on a phone needs it broken up. Breaks are placed at paragraph ends where
 * possible and sentence ends otherwise, because a page that stops mid-sentence reads as a
 * bug even when it isn't.
 */

/** Roughly a comfortable phone screen of text. */
export const TARGET_CHARS = 900;

/** Never leave a page this short unless it's genuinely the end. */
const MIN_CHARS = 200;

export function paginate(text: string, target = TARGET_CHARS): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  if (cleaned.length <= target) return [cleaned];

  const pages: string[] = [];
  let current = "";

  for (const block of splitBlocks(cleaned, target)) {
    const joined = current ? `${current}\n\n${block}` : block;

    if (joined.length <= target) {
      current = joined;
      continue;
    }

    // Adding this block overflows. Keep it as the start of the next page — unless what
    // we have so far is too short to be a page of its own.
    if (current.length >= MIN_CHARS) {
      pages.push(current);
      current = block;
    } else {
      current = joined;
    }
  }

  if (current.trim()) pages.push(current.trim());
  return pages;
}

/**
 * Paragraphs, with any single paragraph longer than a page split further at sentence
 * ends. Handles Bengali's daṛi (।) alongside the Latin full stop.
 */
function splitBlocks(text: string, target: number): string[] {
  const out: string[] = [];

  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    if (trimmed.length <= target) {
      out.push(trimmed);
      continue;
    }

    let chunk = "";
    for (const sentence of splitSentences(trimmed)) {
      if (chunk && chunk.length + sentence.length > target) {
        out.push(chunk.trim());
        chunk = sentence;
      } else {
        chunk += sentence;
      }
    }
    if (chunk.trim()) out.push(chunk.trim());
  }

  return out;
}

/** Keeps the terminator attached to its sentence. */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^.!?।]+[.!?।]+[\s]*|[^.!?।]+$/g);
  return parts ?? [text];
}

/**
 * Finds which page a search term is on, with the matching line for context.
 *
 * Used by "search inside this book" — a reader who remembers a phrase but not a page
 * number is the normal case, not an edge one.
 */
export interface PageHit {
  number: number;
  excerpt: string;
}

export function findInPages(
  pages: Array<{ number: number; text: string }>,
  query: string,
  limit = 20,
): PageHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  const hits: PageHit[] = [];

  for (const page of pages) {
    const at = page.text.toLowerCase().indexOf(needle);
    if (at === -1) continue;

    // A window around the match, snapped outwards to whole words.
    const from = Math.max(0, at - 60);
    const to = Math.min(page.text.length, at + needle.length + 60);
    const excerpt =
      (from > 0 ? "…" : "") + page.text.slice(from, to).trim() + (to < page.text.length ? "…" : "");

    hits.push({ number: page.number, excerpt });
    if (hits.length >= limit) break;
  }

  return hits;
}
