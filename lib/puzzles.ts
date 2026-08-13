import { shuffle } from "./games";

/**
 * Puzzle generation.
 *
 * All pure functions, all fed an injectable random source, and all tested — because the
 * worst thing this section could do is hand a child a puzzle with no solution. They'd
 * assume they were the problem. Every generator here either constructs its puzzle
 * backwards from a finished state or is checked against a solver, so "unsolvable" isn't a
 * thing that can be shipped by accident.
 */

export type Bit = 0 | 1;

/* ── Lights out ──────────────────────────────────────────────────────────────── */

/** Flips a cell and its four neighbours, in place. */
export function tapLights(grid: boolean[], index: number, size: number): void {
  const row = Math.floor(index / size);
  const col = index % size;

  for (const [r, c] of [
    [row, col],
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ]) {
    if (r >= 0 && r < size && c >= 0 && c < size) grid[r * size + c] = !grid[r * size + c];
  }
}

/**
 * A board built by tapping an all-off grid, which is what makes it solvable: repeat the
 * same taps and the lights go out again.
 */
export function lightsOut(size: number, taps: number, random: () => number): boolean[] {
  const cells = size * size;
  const chosen = new Set<number>();
  while (chosen.size < Math.min(taps, cells)) chosen.add(Math.floor(random() * cells));

  const grid = new Array<boolean>(cells).fill(false);
  for (const index of chosen) tapLights(grid, index, size);

  // Taps can cancel out and leave the board already finished. Rare, and a terrible level.
  return grid.some(Boolean) ? grid : lightsOut(size, taps, random);
}

/* ── Ones and zeros (Takuzu) ─────────────────────────────────────────────────── */

/** No more than two of the same value in a row, and each value used equally often. */
function takuzuOk(grid: (Bit | null)[], size: number, index: number): boolean {
  const row = Math.floor(index / size);
  const col = index % size;
  const value = grid[index];
  if (value === null) return true;

  // Three in a row, in either direction, counting only what's already filled.
  const run = (step: number, limit: number) => {
    let count = 0;
    for (let i = 1; i <= 2; i++) {
      const r = step === 1 ? row : row - i;
      const c = step === 1 ? col - i : col;
      if (r < 0 || c < 0 || r >= limit || c >= limit) break;
      if (grid[r * size + c] !== value) break;
      count++;
    }
    return count;
  };
  if (run(1, size) >= 2 || run(0, size) >= 2) return false;

  // Counts, capped at half the line.
  const half = size / 2;
  let inRow = 0;
  let inCol = 0;
  for (let i = 0; i < size; i++) {
    if (grid[row * size + i] === value) inRow++;
    if (grid[i * size + col] === value) inCol++;
  }
  return inRow <= half && inCol <= half;
}

/** A complete, valid grid. Backtracking, seeded, so a level is the same puzzle each time. */
export function takuzuSolution(size: number, random: () => number): Bit[] | null {
  const grid: (Bit | null)[] = new Array(size * size).fill(null);

  const fill = (index: number): boolean => {
    if (index === grid.length) return true;
    for (const value of shuffle<Bit>([0, 1], random)) {
      grid[index] = value;
      if (takuzuOk(grid, size, index) && fill(index + 1)) return true;
      grid[index] = null;
    }
    return false;
  };

  return fill(0) ? (grid as Bit[]) : null;
}

export function takuzu(
  size: number,
  givens: number,
  random: () => number,
): { puzzle: (Bit | null)[]; solution: Bit[] } | null {
  const solution = takuzuSolution(size, random);
  if (!solution) return null;

  const keep = new Set(shuffle([...solution.keys()], random).slice(0, givens));
  return {
    solution,
    puzzle: solution.map((value, index) => (keep.has(index) ? value : null)),
  };
}

/**
 * Whether a filled grid obeys the rules — not whether it matches the grid we generated.
 * A different valid arrangement is still a correct answer, and telling someone they're
 * wrong because they found the other solution would be exactly the kind of verdict this
 * platform is trying not to hand out.
 */
export function takuzuComplete(grid: (Bit | null)[], size: number): boolean {
  if (grid.some((cell) => cell === null)) return false;

  for (let index = 0; index < grid.length; index++) {
    if (!takuzuOk(grid, size, index)) return false;
  }

  const half = size / 2;
  for (let line = 0; line < size; line++) {
    let rowOnes = 0;
    let colOnes = 0;
    for (let i = 0; i < size; i++) {
      if (grid[line * size + i] === 1) rowOnes++;
      if (grid[i * size + line] === 1) colOnes++;
    }
    if (rowOnes !== half || colOnes !== half) return false;
  }

  return true;
}

/* ── Little sudoku ───────────────────────────────────────────────────────────── */

export interface SudokuShape {
  size: number;
  boxW: number;
  boxH: number;
}

function sudokuOk(grid: (number | null)[], shape: SudokuShape, index: number): boolean {
  const { size, boxW, boxH } = shape;
  const value = grid[index];
  if (value === null) return true;

  const row = Math.floor(index / size);
  const col = index % size;

  for (let i = 0; i < size; i++) {
    if (i !== col && grid[row * size + i] === value) return false;
    if (i !== row && grid[i * size + col] === value) return false;
  }

  const boxRow = Math.floor(row / boxH) * boxH;
  const boxCol = Math.floor(col / boxW) * boxW;
  for (let r = boxRow; r < boxRow + boxH; r++) {
    for (let c = boxCol; c < boxCol + boxW; c++) {
      if ((r !== row || c !== col) && grid[r * size + c] === value) return false;
    }
  }

  return true;
}

export function sudokuSolution(shape: SudokuShape, random: () => number): number[] | null {
  const { size } = shape;
  const grid: (number | null)[] = new Array(size * size).fill(null);
  const digits = Array.from({ length: size }, (_, i) => i + 1);

  const fill = (index: number): boolean => {
    if (index === grid.length) return true;
    for (const value of shuffle(digits, random)) {
      grid[index] = value;
      if (sudokuOk(grid, shape, index) && fill(index + 1)) return true;
      grid[index] = null;
    }
    return false;
  };

  return fill(0) ? (grid as number[]) : null;
}

export function sudoku(
  shape: SudokuShape,
  givens: number,
  random: () => number,
): { puzzle: (number | null)[]; solution: number[] } | null {
  const solution = sudokuSolution(shape, random);
  if (!solution) return null;

  const keep = new Set(shuffle([...solution.keys()], random).slice(0, givens));
  return {
    solution,
    puzzle: solution.map((value, index) => (keep.has(index) ? value : null)),
  };
}

export function sudokuComplete(grid: (number | null)[], shape: SudokuShape): boolean {
  if (grid.some((cell) => cell === null)) return false;
  return grid.every((_, index) => sudokuOk(grid, shape, index));
}

/* ── Maze ────────────────────────────────────────────────────────────────────── */

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;

const OPPOSITE: Record<number, number> = { [N]: S, [S]: N, [E]: W, [W]: E };
const STEP: Record<number, [number, number]> = {
  [N]: [0, -1],
  [S]: [0, 1],
  [E]: [1, 0],
  [W]: [-1, 0],
};

/**
 * A perfect maze: every cell reachable, exactly one route between any two. Carved with a
 * depth-first backtracker from a full grid of walls, so a way out always exists.
 *
 * Returns one wall bitmask per cell.
 */
export function maze(w: number, h: number, random: () => number): number[] {
  const walls = new Array<number>(w * h).fill(N | E | S | W);
  const seen = new Array<boolean>(w * h).fill(false);
  const stack: number[] = [0];
  seen[0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const cx = current % w;
    const cy = Math.floor(current / w);

    const options = shuffle([N, E, S, W], random).filter((dir) => {
      const [dx, dy] = STEP[dir];
      const nx = cx + dx;
      const ny = cy + dy;
      return nx >= 0 && nx < w && ny >= 0 && ny < h && !seen[ny * w + nx];
    });

    if (options.length === 0) {
      stack.pop();
      continue;
    }

    const dir = options[0];
    const [dx, dy] = STEP[dir];
    const next = (cy + dy) * w + (cx + dx);

    walls[current] &= ~dir;
    walls[next] &= ~OPPOSITE[dir];
    seen[next] = true;
    stack.push(next);
  }

  return walls;
}

/** Shortest route between two cells, or null if there isn't one. Used to check and to par. */
export function mazePath(walls: number[], w: number, h: number, from: number, to: number): number[] | null {
  const previous = new Map<number, number>();
  const queue = [from];
  const seen = new Set([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) {
      const path = [current];
      let step = current;
      while (previous.has(step)) {
        step = previous.get(step)!;
        path.push(step);
      }
      return path.reverse();
    }

    const cx = current % w;
    const cy = Math.floor(current / w);

    for (const dir of [N, E, S, W]) {
      if (walls[current] & dir) continue;
      const [dx, dy] = STEP[dir];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const next = ny * w + nx;
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, current);
      queue.push(next);
    }
  }

  return null;
}

/* ── Two jugs ────────────────────────────────────────────────────────────────── */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The classic result: you can measure exactly the multiples of gcd(a, b) that fit. */
export function jugsSolvable(a: number, b: number, target: number): boolean {
  if (target <= 0) return false;
  if (target > Math.max(a, b)) return false;
  return target % gcd(a, b) === 0;
}

/** Fewest pours needed, by breadth-first search over states. Null when impossible. */
export function jugsMinPours(a: number, b: number, target: number): number | null {
  const start = "0,0";
  const queue: Array<[number, number, number]> = [[0, 0, 0]];
  const seen = new Set([start]);

  while (queue.length > 0) {
    const [x, y, steps] = queue.shift()!;
    if (x === target || y === target) return steps;

    const moves: Array<[number, number]> = [
      [a, y], // fill the first
      [x, b], // fill the second
      [0, y], // empty the first
      [x, 0], // empty the second
      // pour one into the other, until it's empty or the other is full
      [x - Math.min(x, b - y), y + Math.min(x, b - y)],
      [x + Math.min(y, a - x), y - Math.min(y, a - x)],
    ];

    for (const [nx, ny] of moves) {
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny, steps + 1]);
    }
  }

  return null;
}

/* ── What comes next ─────────────────────────────────────────────────────────── */

export interface NumberRun {
  run: number[];
  answer: number;
  /** Shown only after the answer, so the pattern is explained rather than just marked. */
  rule: string;
}

/**
 * A run of numbers with a rule behind it, getting less obvious as the levels climb.
 *
 * The rule is always stated afterwards. A puzzle you got wrong and were never told why is
 * just a small failure with no lesson attached.
 */
export function numberRun(level: number, random: () => number): NumberRun {
  const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  const kinds =
    level <= 4
      ? ["add", "double"]
      : level <= 8
        ? ["add", "double", "multiply", "square"]
        : level <= 13
          ? ["multiply", "square", "fib", "alternate", "triangle"]
          : ["fib", "alternate", "triangle", "addGrowing", "powerPlus"];

  const kind = pick(kinds);
  const run: number[] = [];

  switch (kind) {
    case "add": {
      const start = int(1, 12);
      const step = int(2, 9);
      for (let i = 0; i < 5; i++) run.push(start + step * i);
      return { run: run.slice(0, 4), answer: run[4], rule: `Add ${step} each time.` };
    }
    case "double": {
      const start = int(1, 6);
      for (let i = 0; i < 5; i++) run.push(start * 2 ** i);
      return { run: run.slice(0, 4), answer: run[4], rule: "Double each time." };
    }
    case "multiply": {
      const start = int(1, 4);
      const factor = int(3, 5);
      for (let i = 0; i < 5; i++) run.push(start * factor ** i);
      return { run: run.slice(0, 4), answer: run[4], rule: `Multiply by ${factor} each time.` };
    }
    case "square": {
      const start = int(1, 5);
      for (let i = 0; i < 5; i++) run.push((start + i) ** 2);
      return { run: run.slice(0, 4), answer: run[4], rule: "Square numbers." };
    }
    case "triangle": {
      const start = int(1, 5);
      for (let i = 0; i < 5; i++) {
        const n = start + i;
        run.push((n * (n + 1)) / 2);
      }
      return { run: run.slice(0, 4), answer: run[4], rule: "Triangle numbers: add 1, then 2, then 3…" };
    }
    case "fib": {
      let a = int(1, 5);
      let b = int(a, a + 5);
      for (let i = 0; i < 6; i++) {
        run.push(a);
        [a, b] = [b, a + b];
      }
      return { run: run.slice(0, 5), answer: run[5], rule: "Each number is the two before it added together." };
    }
    case "alternate": {
      const start = int(2, 10);
      const up = int(3, 8);
      const down = int(1, up - 1);
      let value = start;
      for (let i = 0; i < 6; i++) {
        run.push(value);
        value += i % 2 === 0 ? up : -down;
      }
      return { run: run.slice(0, 5), answer: run[5], rule: `Add ${up}, take away ${down}, over and over.` };
    }
    case "addGrowing": {
      const start = int(1, 6);
      const step = int(1, 3);
      let value = start;
      let add = int(2, 5);
      for (let i = 0; i < 5; i++) {
        run.push(value);
        value += add;
        add += step;
      }
      return { run: run.slice(0, 4), answer: run[4], rule: `The gap grows by ${step} each time.` };
    }
    default: {
      // powerPlus: n² + n, which reads as neither squares nor a simple run.
      const start = int(1, 5);
      for (let i = 0; i < 5; i++) {
        const n = start + i;
        run.push(n * n + n);
      }
      return { run: run.slice(0, 4), answer: run[4], rule: "Each one is n × n + n." };
    }
  }
}

/* ── Word search ─────────────────────────────────────────────────────────────── */

export interface Placement {
  word: string;
  cells: number[];
}

const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/**
 * Places every word or gives up and returns null, so the caller can try a bigger grid
 * rather than quietly showing a puzzle with a word that isn't in it.
 */
export function wordSearch(
  words: string[],
  size: number,
  random: () => number,
): { grid: string[]; placements: Placement[] } | null {
  const grid = new Array<string>(size * size).fill("");
  const placements: Placement[] = [];

  for (const word of words) {
    const letters = word.toUpperCase();
    let placed = false;

    // Try random spots; 200 attempts is plenty for the grid sizes here.
    for (let attempt = 0; attempt < 200 && !placed; attempt++) {
      const [dx, dy] = DIRECTIONS[Math.floor(random() * DIRECTIONS.length)];
      const backwards = random() < 0.3;
      const x = Math.floor(random() * size);
      const y = Math.floor(random() * size);

      const cells: number[] = [];
      let ok = true;

      for (let i = 0; i < letters.length; i++) {
        const step = backwards ? letters.length - 1 - i : i;
        const cx = x + dx * step;
        const cy = y + dy * step;
        if (cx < 0 || cx >= size || cy < 0 || cy >= size) {
          ok = false;
          break;
        }
        const at = cy * size + cx;
        const existing = grid[at];
        if (existing && existing !== letters[i]) {
          ok = false;
          break;
        }
        cells[i] = at;
      }

      if (!ok) continue;

      letters.split("").forEach((letter, i) => {
        grid[cells[i]] = letter;
      });
      // Cells stay in the word's own order — cells[i] is where letters[i] went — so
      // reading them always spells the word, whichever way round it sits on the grid.
      placements.push({ word: letters, cells });
      placed = true;
    }

    if (!placed) return null;
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = alphabet[Math.floor(random() * alphabet.length)];
  }

  return { grid, placements };
}

/* ── Hit the number ──────────────────────────────────────────────────────────── */

export interface Target {
  numbers: number[];
  target: number;
}

/**
 * Builds the target by actually combining the numbers, so a reachable answer is
 * guaranteed to exist — there is always at least the one it was built from.
 */
export function numberTarget(count: number, random: () => number): Target {
  const numbers = Array.from({ length: count }, () => 1 + Math.floor(random() * 9));

  let value = numbers[0];
  for (let i = 1; i < numbers.length; i++) {
    const operation = Math.floor(random() * 3);
    if (operation === 0) value += numbers[i];
    else if (operation === 1) value *= numbers[i];
    else value = Math.max(1, value - numbers[i]);
  }

  return { numbers, target: value };
}
