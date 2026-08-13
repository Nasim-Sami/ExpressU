/**
 * Matching what someone meant, not what they typed.
 *
 * A child searching this platform is often eight, typing on a phone, and half-remembering
 * a word. "mago", "MANGO", "mangoe" and "man" all have to find the mango idea, or search
 * silently teaches them there's nothing here — and a young person who concludes the
 * platform is empty stops coming back.
 *
 * Deliberately a pure function over strings rather than a database feature. SQLite's FTS
 * would be faster at scale but matches tokens, not near-misses, and at ExpressU's size the
 * cost of scoring in memory is nothing next to being able to test the behaviour that
 * matters — see fuzzy.test.ts.
 */

/** Lower-case, strip accents and punctuation, collapse whitespace. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    // Drop combining marks, so "café" matches "cafe".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenise(text: string): string[] {
  const n = normalise(text);
  return n ? n.split(" ") : [];
}

/**
 * Edit distance, capped, counting a transposition as one edit.
 *
 * Swapped letters ("mnago", "scaerd") are the single most common typing mistake, and plain
 * Levenshtein charges two edits for one slip of the fingers. Counting it once means the
 * tolerance below can stay tight — which is what stops "bird" matching "bad" — without
 * losing the typos people actually make.
 *
 * Bails out as soon as the whole row exceeds `max`, which turns the usual O(n·m) into
 * something cheap for the common case of "these two words are nothing like each other".
 */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let twoBack: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1, // deletion
        current[j - 1] + 1, // insertion
        previous[j - 1] + cost, // substitution
      );

      // Two adjacent letters typed the wrong way round.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1);
      }

      current[j] = value;
      if (value < best) best = value;
    }

    // The smallest value in a row can only rise from one row to the next, so it is a
    // lower bound on the answer — safe to give up on.
    if (best > max) return max + 1;
    twoBack = previous;
    previous = current;
  }

  return previous[b.length];
}

/** How close two single words are, 0–1. */
export function wordScore(query: string, word: string): number {
  if (!query || !word) return 0;
  if (word === query) return 1;

  // "man" should find "mango" — people search before they finish typing.
  if (word.startsWith(query)) return 0.92 - Math.min(0.2, (word.length - query.length) * 0.01);
  if (word.includes(query) && query.length >= 3) return 0.72;

  /*
   * Roughly one typo per four characters.
   *
   * The tight end matters more than it looks: at two edits on a four-letter word, "bird"
   * matches "bad" — half the word replaced — and a search for a drawing of a bird returns
   * a private list of things someone is scared to be bad at. Wrong results aren't just
   * untidy here; they put unrelated writing in front of people.
   */
  const tolerance = query.length <= 4 ? 1 : query.length <= 7 ? 2 : 3;
  const distance = editDistance(query, word, tolerance);
  if (distance > tolerance) return 0;

  return Math.max(0, 0.85 - distance * 0.22);
}

export interface Field {
  text: string;
  /** How much this field counts — a title should beat a mention in the body. */
  weight: number;
}

/**
 * Score a record against a query.
 *
 * Every query word must find *something* (that's the `matched` check), so searching
 * "mango cake" doesn't return every mango post — but each word may match any field, so
 * word order and which field it lands in don't matter.
 */
export function scoreFields(query: string, fields: Field[]): number {
  const queryWords = tokenise(query);
  if (queryWords.length === 0) return 0;

  const prepared = fields
    .filter((field) => field.text)
    .map((field) => ({ weight: field.weight, words: tokenise(field.text) }));
  if (prepared.length === 0) return 0;

  let total = 0;
  // Length of the field that produced the single strongest hit, for the concision
  // adjustment below.
  let bestFieldLength = 1;
  let strongest = 0;

  for (const queryWord of queryWords) {
    let best = 0;

    for (const field of prepared) {
      for (const word of field.words) {
        const score = wordScore(queryWord, word) * field.weight;
        if (score > best) best = score;
        if (score > strongest) {
          strongest = score;
          bestFieldLength = field.words.length;
        }
      }
    }

    // One unmatched word disqualifies the record — otherwise a two-word search returns
    // everything that matched only the common word.
    if (best === 0) return 0;
    total += best;
  }

  const base = total / queryWords.length;

  /*
   * Prefer the tighter match. Searching "mango" should put a post called "Mango" above
   * "How to grow a mango tree in a pot": both contain the word exactly, so without this
   * they tie and the winner is whichever the database happened to return first.
   *
   * Kept to a 10% band so it breaks ties without ever letting a short weak match beat a
   * long strong one.
   */
  const coverage = Math.min(1, queryWords.length / bestFieldLength);
  return base * (0.9 + 0.1 * coverage);
}

/** Below this, a "match" is noise and it's kinder to show nothing. */
export const MIN_SCORE = 0.35;

export function ranked<T>(
  query: string,
  items: T[],
  toFields: (item: T) => Field[],
  limit = 40,
): T[] {
  return items
    .map((item) => ({ item, score: scoreFields(query, toFields(item)) }))
    .filter((row) => row.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}
