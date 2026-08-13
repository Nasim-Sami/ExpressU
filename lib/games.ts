/**
 * The games and puzzles.
 *
 * Each one leans on a different way of thinking, so "I'm bad at games" doesn't survive
 * contact with twenty of them: remembering, holding attention, planning ahead, reasoning
 * from evidence, seeing shapes and playing with words are genuinely separate skills, and
 * most people are better at one than they expect.
 *
 * ── Why your best score is in localStorage and not the database ──────────────────
 *
 * Everything else on ExpressU is stored server-side. Scores deliberately are not.
 *
 * A score in a table is one `orderBy` away from being a leaderboard, and a leaderboard is
 * the exact thing this platform exists to not have. Kept on the device, a best score
 * cannot be ranked, compared, or accidentally exposed by a future feature — the same
 * reasoning that keeps a `loveCount` column out of the schema.
 *
 * The cost is real and worth stating: your best doesn't follow you to another device.
 * That is the intended trade.
 *
 * ── Levels ───────────────────────────────────────────────────────────────────────
 *
 * Levels go up to twenty and unlock one at a time, because getting further is the part
 * that feels like progress. But every game also has "Open every level", offered plainly
 * and without a warning — being told *no, not yet* is a verdict, and a child who wants to
 * see what level 14 looks like is allowed to just go and look.
 */

export type ScoreDirection = "lower" | "higher";

export type Family = "memory" | "attention" | "planning" | "logic" | "words" | "numbers" | "space";

export interface GameMeta {
  slug: string;
  name: string;
  /** The thinking it actually exercises. */
  skill: string;
  family: Family;
  blurb: string;
  /** How a score reads, e.g. "moves" or "in a row". */
  unit: string;
  direction: ScoreDirection;
  /** Emoji used as the card face on the hub. */
  glyph: string;
  /** How many levels this game has. Twenty is the ceiling. */
  levels: number;
}

export const MAX_LEVELS = 20;

export const GAMES: GameMeta[] = [
  {
    slug: "pairs",
    name: "Pairs",
    skill: "Memory",
    family: "memory",
    blurb: "Turn over two at a time and remember what you saw.",
    unit: "moves",
    direction: "lower",
    glyph: "🎴",
    levels: 20,
  },
  {
    slug: "sequence",
    name: "Sequence",
    skill: "Attention",
    family: "attention",
    blurb: "Watch the pattern, then repeat it. It gets one longer every time you get it right.",
    unit: "in a row",
    direction: "higher",
    glyph: "🎯",
    levels: 20,
  },
  {
    slug: "slide",
    name: "Slide",
    skill: "Planning",
    family: "planning",
    blurb: "Push the tiles back into order. Easy to fiddle with, harder to actually plan.",
    unit: "moves",
    direction: "lower",
    glyph: "🧩",
    levels: 20,
  },
  {
    slug: "code",
    name: "Crack the code",
    skill: "Deduction",
    family: "logic",
    blurb: "Hidden colours. Each guess tells you how close you are — work out the rest.",
    unit: "guesses",
    direction: "lower",
    glyph: "🔐",
    levels: 20,
  },
  {
    slug: "lights",
    name: "Lights out",
    skill: "Logic",
    family: "logic",
    blurb: "Every tap flips a light and its neighbours. Turn the whole board off.",
    unit: "moves",
    direction: "lower",
    glyph: "💡",
    levels: 20,
  },
  {
    slug: "hanoi",
    name: "The three poles",
    skill: "Planning",
    family: "planning",
    blurb: "Move the stack across. Never a bigger disc on a smaller one.",
    unit: "moves",
    direction: "lower",
    glyph: "🗼",
    levels: 18,
  },
  {
    slug: "maze",
    name: "Maze",
    skill: "Pathfinding",
    family: "space",
    blurb: "Find the way out. Every maze is different, and every one has an answer.",
    unit: "steps",
    direction: "lower",
    glyph: "🌀",
    levels: 20,
  },
  {
    slug: "binary",
    name: "Ones and zeros",
    skill: "Logic",
    family: "logic",
    blurb: "Fill the grid. Never three the same in a row, and equal numbers of each.",
    unit: "seconds",
    direction: "lower",
    glyph: "⬛",
    levels: 20,
  },
  {
    slug: "sudoku",
    name: "Little sudoku",
    skill: "Logic",
    family: "logic",
    blurb: "Every row, every column, every box — each digit exactly once.",
    unit: "seconds",
    direction: "lower",
    glyph: "🔢",
    levels: 20,
  },
  {
    slug: "unjumble",
    name: "Unjumble",
    skill: "Words",
    family: "words",
    blurb: "The letters are all there, in the wrong order. Put the word back together.",
    unit: "seconds",
    direction: "lower",
    glyph: "🔤",
    levels: 20,
  },
  {
    slug: "wordsearch",
    name: "Word search",
    skill: "Words",
    family: "words",
    blurb: "Words hidden in a grid, across, down and slanted. Find them all.",
    unit: "seconds",
    direction: "lower",
    glyph: "🔎",
    levels: 20,
  },
  {
    slug: "target",
    name: "Hit the number",
    skill: "Arithmetic",
    family: "numbers",
    blurb: "Use the numbers you're given, and the four signs, to land exactly on the target.",
    unit: "seconds",
    direction: "lower",
    glyph: "🎲",
    levels: 20,
  },
  {
    slug: "nextnumber",
    name: "What comes next",
    skill: "Reasoning",
    family: "numbers",
    blurb: "A run of numbers with a rule behind it. Work out the rule, then the next one.",
    unit: "in a row",
    direction: "higher",
    glyph: "➡️",
    levels: 20,
  },
  {
    slug: "oddone",
    name: "Odd one out",
    skill: "Noticing",
    family: "attention",
    blurb: "One of these is not like the others. It gets less obvious.",
    unit: "in a row",
    direction: "higher",
    glyph: "👀",
    levels: 20,
  },
  {
    slug: "span",
    name: "Hold the number",
    skill: "Memory",
    family: "memory",
    blurb: "A number appears, then it's gone. Type it back.",
    unit: "digits",
    direction: "higher",
    glyph: "🧠",
    levels: 20,
  },
  {
    slug: "colours",
    name: "Say the colour",
    skill: "Attention",
    family: "attention",
    blurb: "The word says one colour and is written in another. Go by the colour.",
    unit: "in a row",
    direction: "higher",
    glyph: "🎨",
    levels: 20,
  },
  {
    slug: "mirror",
    name: "Mirror it",
    skill: "Space",
    family: "space",
    blurb: "Half a pattern, and a line down the middle. Fill in the other half.",
    unit: "seconds",
    direction: "lower",
    glyph: "🪞",
    levels: 20,
  },
  {
    slug: "jugs",
    name: "Two jugs",
    skill: "Planning",
    family: "planning",
    blurb: "Two jugs, no markings, and an amount to measure out exactly.",
    unit: "pours",
    direction: "lower",
    glyph: "🫗",
    levels: 16,
  },
  {
    slug: "solitaire",
    name: "Last one standing",
    skill: "Planning",
    family: "planning",
    blurb: "Jump a peg over its neighbour to take it. Try to finish with one.",
    unit: "left",
    direction: "lower",
    glyph: "🕹️",
    levels: 12,
  },
  {
    slug: "knight",
    name: "The knight's walk",
    skill: "Space",
    family: "space",
    blurb: "A knight moves in an L. Visit every square without landing twice.",
    unit: "squares",
    direction: "higher",
    glyph: "♞",
    levels: 16,
  },
];

export function gameBySlug(slug: string): GameMeta | undefined {
  return GAMES.find((game) => game.slug === slug);
}

/* ── Deterministic puzzles ────────────────────────────────────────────────────────
 *
 * Level 7 of a puzzle has to be the same puzzle every time you open it, or coming back
 * to something you were stuck on is impossible and the level number means nothing. So the
 * generators are fed a seeded generator rather than Math.random.
 */

/** mulberry32 — small, fast, and good enough for shuffling a puzzle. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed for one level of one game. */
export function seedFor(slug: string, level: number, salt = 0): number {
  let hash = 2166136261;
  for (const char of `${slug}:${level}:${salt}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fisher–Yates, with an injectable source so a level shuffles the same way each time. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/* ── What's kept on the device ────────────────────────────────────────────────── */

const BEST_PREFIX = "expressu-best-";
const CLEARED_PREFIX = "expressu-cleared-";
const OPEN_PREFIX = "expressu-open-";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Private browsing, storage disabled, quota — none of which should break a game.
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Losing a personal best is a shame, not a failure worth showing an error for.
  }
}

const bestKey = (slug: string, level: number) => `${BEST_PREFIX}${slug}-${level}`;

export function readBest(slug: string, level: number): number | null {
  const raw = read(bestKey(slug, level));
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Stores `value` if it beats what's there. Returns whether it was an improvement. */
export function writeBest(
  slug: string,
  level: number,
  value: number,
  direction: ScoreDirection,
): boolean {
  const current = readBest(slug, level);
  const better = current === null || (direction === "lower" ? value < current : value > current);
  if (!better) return false;
  write(bestKey(slug, level), String(value));
  return true;
}

export function clearBest(slug: string, level: number): void {
  try {
    window.localStorage.removeItem(bestKey(slug, level));
  } catch {
    /* nothing to do */
  }
}

/** The highest level finished, or 0 for a game not started. */
export function readCleared(slug: string): number {
  const value = Number(read(CLEARED_PREFIX + slug));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Records a finished level. Returns true when it was new ground. */
export function markCleared(slug: string, level: number): boolean {
  if (level <= readCleared(slug)) return false;
  write(CLEARED_PREFIX + slug, String(level));
  return true;
}

export function readOpenAll(slug: string): boolean {
  return read(OPEN_PREFIX + slug) === "1";
}

export function writeOpenAll(slug: string, open: boolean): void {
  write(OPEN_PREFIX + slug, open ? "1" : "0");
}

/** Everything about this game on this device, forgotten. */
export function forgetGame(slug: string, levels: number): void {
  try {
    for (let level = 1; level <= levels; level++) {
      window.localStorage.removeItem(bestKey(slug, level));
    }
    window.localStorage.removeItem(CLEARED_PREFIX + slug);
    window.localStorage.removeItem(OPEN_PREFIX + slug);
  } catch {
    /* nothing to do */
  }
}
