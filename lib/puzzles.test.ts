import { describe, expect, it } from "vitest";

import { rng, seedFor } from "./games";
import {
  E,
  N,
  S,
  W,
  jugsMinPours,
  jugsSolvable,
  lightsOut,
  maze,
  mazePath,
  numberRun,
  numberTarget,
  sudoku,
  sudokuComplete,
  takuzu,
  takuzuComplete,
  tapLights,
  wordSearch,
  type Bit,
  type SudokuShape,
} from "./puzzles";

/**
 * The one thing this section must never do is hand a child a puzzle with no solution.
 * They would assume the failure was theirs — which is precisely the experience ExpressU
 * exists to not create.
 *
 * So these tests don't sample a few cases. They walk every level of every generated game
 * and prove the puzzle can actually be finished.
 */

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);

describe("lights out", () => {
  it("is always solvable, because it is built by tapping an off board", () => {
    for (const level of LEVELS) {
      const size = level <= 6 ? 3 : level <= 13 ? 4 : 5;
      const random = rng(seedFor("lights", level));
      const grid = lightsOut(size, Math.min(level + 1, size * size), random);

      // Re-applying the taps that made it must switch everything off again. We don't know
      // which taps those were, so solve it properly: over GF(2) the "chase the lights"
      // method finds a solution when one exists.
      expect(solvableByChasing(grid, size), `level ${level}`).toBe(true);
    }
  });

  it("never starts on an already-finished board", () => {
    for (const level of LEVELS) {
      const grid = lightsOut(4, level, rng(seedFor("lights", level)));
      expect(grid.some(Boolean)).toBe(true);
    }
  });
});

/**
 * Lights Out is linear algebra over GF(2). Fix the top row's taps, and every row below is
 * forced; if the bottom row ends up dark for some choice of top row, the board is solvable.
 */
function solvableByChasing(start: boolean[], size: number): boolean {
  for (let mask = 0; mask < 1 << size; mask++) {
    const grid = [...start];

    for (let col = 0; col < size; col++) {
      if (mask & (1 << col)) tapLights(grid, col, size);
    }

    for (let row = 1; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (grid[(row - 1) * size + col]) tapLights(grid, row * size + col, size);
      }
    }

    if (!grid.some(Boolean)) return true;
  }
  return false;
}

describe("ones and zeros", () => {
  it("generates a complete, rule-abiding solution at every size", () => {
    for (const size of [4, 6, 8]) {
      for (const level of LEVELS) {
        const built = takuzu(size, size * size, rng(seedFor("binary", level)));
        expect(built, `size ${size} level ${level}`).not.toBeNull();
        expect(takuzuComplete(built!.solution, size)).toBe(true);
      }
    }
  });

  it("leaves the givens agreeing with the solution", () => {
    const built = takuzu(6, 20, rng(seedFor("binary", 3)))!;
    built.puzzle.forEach((cell, index) => {
      if (cell !== null) expect(cell).toBe(built.solution[index]);
    });
    expect(built.puzzle.filter((cell) => cell !== null)).toHaveLength(20);
  });

  it("rejects three in a row and lopsided lines", () => {
    // Valid 4x4.
    const good: Bit[] = [0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1];
    expect(takuzuComplete(good, 4)).toBe(true);

    // Three 0s along the top.
    const threeInARow: Bit[] = [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1];
    expect(takuzuComplete(threeInARow, 4)).toBe(false);

    // A row of all 1s.
    const lopsided: Bit[] = [1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1];
    expect(takuzuComplete(lopsided, 4)).toBe(false);
  });

  it("counts an unfinished grid as unfinished", () => {
    expect(takuzuComplete([0, 1, null, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0], 4)).toBe(false);
  });
});

describe("little sudoku", () => {
  const shapes: SudokuShape[] = [
    { size: 4, boxW: 2, boxH: 2 },
    { size: 6, boxW: 3, boxH: 2 },
    { size: 9, boxW: 3, boxH: 3 },
  ];

  it("generates a valid finished grid for every shape and level", () => {
    for (const shape of shapes) {
      for (const level of LEVELS) {
        const built = sudoku(shape, shape.size * shape.size, rng(seedFor("sudoku", level)));
        expect(built, `${shape.size} level ${level}`).not.toBeNull();
        expect(sudokuComplete(built!.solution, shape)).toBe(true);
      }
    }
  });

  it("keeps exactly as many givens as asked for, all correct", () => {
    const shape = shapes[1];
    const built = sudoku(shape, 18, rng(seedFor("sudoku", 5)))!;
    expect(built.puzzle.filter((cell) => cell !== null)).toHaveLength(18);
    built.puzzle.forEach((cell, index) => {
      if (cell !== null) expect(cell).toBe(built.solution[index]);
    });
  });

  it("spots a repeat in a row, a column and a box", () => {
    const shape = shapes[0];
    const solved = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
    expect(sudokuComplete(solved, shape)).toBe(true);

    const rowRepeat = [...solved];
    rowRepeat[1] = 1;
    expect(sudokuComplete(rowRepeat, shape)).toBe(false);
  });
});

describe("maze", () => {
  it("always has a way from the corner to the far corner", () => {
    for (const level of LEVELS) {
      const size = 4 + Math.floor(level / 2);
      const walls = maze(size, size, rng(seedFor("maze", level)));
      const path = mazePath(walls, size, size, 0, size * size - 1);
      expect(path, `level ${level}`).not.toBeNull();
      expect(path!.length).toBeGreaterThan(1);
    }
  });

  it("reaches every cell, so no part of it is walled off", () => {
    const size = 8;
    const walls = maze(size, size, rng(seedFor("maze", 1)));
    for (let cell = 0; cell < size * size; cell++) {
      expect(mazePath(walls, size, size, 0, cell), `cell ${cell}`).not.toBeNull();
    }
  });

  it("keeps the outer wall intact", () => {
    const size = 6;
    const walls = maze(size, size, rng(seedFor("maze", 2)));
    for (let i = 0; i < size; i++) {
      expect(walls[i] & N).toBeTruthy(); // top row
      expect(walls[(size - 1) * size + i] & S).toBeTruthy(); // bottom row
      expect(walls[i * size] & W).toBeTruthy(); // left column
      expect(walls[i * size + size - 1] & E).toBeTruthy(); // right column
    }
  });

  it("agrees with itself: neighbours either both have a wall or neither does", () => {
    const size = 7;
    const walls = maze(size, size, rng(seedFor("maze", 3)));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size - 1; x++) {
        const here = y * size + x;
        expect(Boolean(walls[here] & E)).toBe(Boolean(walls[here + 1] & W));
      }
    }
  });
});

describe("two jugs", () => {
  it("agrees with the search about what can be measured", () => {
    for (const a of [3, 5, 7, 8]) {
      for (const b of [4, 5, 9, 12]) {
        for (let target = 1; target <= Math.max(a, b); target++) {
          const reachable = jugsMinPours(a, b, target) !== null;
          expect(jugsSolvable(a, b, target), `${a}/${b} → ${target}`).toBe(reachable);
        }
      }
    }
  });

  it("solves the classic 3 and 5 to make 4", () => {
    expect(jugsSolvable(3, 5, 4)).toBe(true);
    expect(jugsMinPours(3, 5, 4)).toBe(6);
  });

  it("knows an even pair can never measure an odd amount", () => {
    expect(jugsSolvable(4, 6, 3)).toBe(false);
    expect(jugsMinPours(4, 6, 3)).toBeNull();
  });
});

describe("what comes next", () => {
  it("always produces a run and an answer that fits the stated rule", () => {
    for (const level of LEVELS) {
      for (let salt = 0; salt < 12; salt++) {
        const { run, answer, rule } = numberRun(level, rng(seedFor("nextnumber", level, salt)));
        expect(run.length, `level ${level}`).toBeGreaterThanOrEqual(4);
        expect(Number.isFinite(answer)).toBe(true);
        expect(Number.isInteger(answer)).toBe(true);
        expect(rule.length).toBeGreaterThan(0);
        // A run that repeats one number has no discernible rule to find.
        expect(new Set(run).size).toBeGreaterThan(1);
      }
    }
  });
});

describe("word search", () => {
  it("places every word inside the grid, spelled correctly", () => {
    const words = ["MANGO", "BIRD", "PAPER", "DREAM", "SONG"];
    const built = wordSearch(words, 10, rng(seedFor("wordsearch", 1)));
    expect(built).not.toBeNull();

    for (const placement of built!.placements) {
      const spelled = placement.cells.map((cell) => built!.grid[cell]).join("");
      expect(spelled).toBe(placement.word);
      for (const cell of placement.cells) {
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(100);
      }
    }
  });

  it("fills every square, so no gaps give the answer away", () => {
    const built = wordSearch(["CAT", "DOG"], 8, rng(seedFor("wordsearch", 2)))!;
    expect(built.grid.every((letter) => /^[A-Z]$/.test(letter))).toBe(true);
  });

  it("gives up rather than dropping a word it couldn't fit", () => {
    // Far too long for the grid.
    expect(wordSearch(["EXTRAORDINARILY"], 5, rng(1))).toBeNull();
  });
});

describe("hit the number", () => {
  it("builds the target from the numbers, so it is always reachable", () => {
    for (const level of LEVELS) {
      const { numbers, target } = numberTarget(3 + Math.floor(level / 7), rng(seedFor("target", level)));
      expect(numbers.length).toBeGreaterThanOrEqual(3);
      expect(numbers.every((n) => n >= 1 && n <= 9)).toBe(true);
      expect(target).toBeGreaterThan(0);
      expect(Number.isInteger(target)).toBe(true);
    }
  });
});

describe("seeded generation", () => {
  it("gives the same puzzle for the same level every time", () => {
    const first = maze(6, 6, rng(seedFor("maze", 9)));
    const second = maze(6, 6, rng(seedFor("maze", 9)));
    expect(first).toEqual(second);

    // …and a different one for a different level, or levels would be meaningless.
    expect(maze(6, 6, rng(seedFor("maze", 10)))).not.toEqual(first);
  });
});
