/**
 * The word list behind Unjumble and Word search.
 *
 * Chosen rather than scraped: every word is one a child of roughly eight upwards would
 * recognise, and they lean towards making, noticing and imagining — the same things the
 * rest of ExpressU is about. Grouped by length so a level can ask for words of a size,
 * rather than handing a seven-year-old a fifteen-letter word.
 */
export const WORDS: Record<number, string[]> = {
  3: ["sky", "art", "cat", "dog", "sun", "cup", "map", "key", "toy", "bee", "owl", "ink"],
  4: [
    "bird", "song", "star", "moon", "tree", "book", "kite", "boat", "hope", "wish",
    "clay", "note", "seed", "wing", "rain", "leaf", "drum", "fire", "gift", "path",
  ],
  5: [
    "dream", "paper", "music", "story", "brush", "chalk", "cloud", "river", "stone", "plant",
    "smile", "light", "shell", "voice", "watch", "green", "grain", "float", "sound", "north",
  ],
  6: [
    "garden", "pencil", "friend", "candle", "flight", "poetry", "puzzle", "silver", "spring", "island",
    "guitar", "rocket", "shadow", "wonder", "listen", "orange", "insect", "bridge", "castle", "wooden",
  ],
  7: [
    "picture", "journey", "balloon", "curious", "drawing", "harvest", "library", "morning", "painter", "rainbow",
    "science", "singing", "thunder", "village", "whisper", "compass", "feather", "kitchen", "pattern", "protect",
  ],
  8: [
    "birthday", "creature", "daylight", "elephant", "festival", "gardener", "hospital", "invented",
    "keyboard", "language", "mountain", "notebook", "painting", "question", "sandwich", "treasure",
  ],
};

/** Every word of a given length, or of the nearest length the list has. */
export function wordsOfLength(length: number): string[] {
  const lengths = Object.keys(WORDS).map(Number);
  const closest = lengths.reduce((best, current) =>
    Math.abs(current - length) < Math.abs(best - length) ? current : best,
  );
  return WORDS[closest];
}

/** Everything, flattened — for puzzles that just need a pile of words. */
export const ALL_WORDS: string[] = Object.values(WORDS).flat();
