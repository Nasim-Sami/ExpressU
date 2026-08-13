"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { sudoku, sudokuComplete, type SudokuShape } from "@/lib/puzzles";

function setup(level: number): { shape: SudokuShape; givens: number } {
  const shape: SudokuShape =
    level <= 5
      ? { size: 4, boxW: 2, boxH: 2 }
      : level <= 12
        ? { size: 6, boxW: 3, boxH: 2 }
        : { size: 9, boxW: 3, boxH: 3 };

  const cells = shape.size * shape.size;
  return { shape, givens: Math.round(cells * (0.62 - (level - 1) * 0.009)) };
}

export function Sudoku() {
  const meta = gameBySlug("sudoku")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { shape } = setup(level);
        return `${shape.size} by ${shape.size}, in boxes of ${shape.boxW} by ${shape.boxH}.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { shape, givens } = setup(api.level);
  const { size, boxW, boxH } = shape;

  const [built] = useState(() => sudoku(shape, givens, rng(seedFor("sudoku", api.level))));
  const [grid, setGrid] = useState<(number | null)[]>(() => built?.puzzle ?? []);
  const [selected, setSelected] = useState<number | null>(null);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);
  const fixed = new Set(
    (built?.puzzle ?? []).map((cell, index) => (cell === null ? -1 : index)).filter((i) => i >= 0),
  );

  if (!built) return <p style={{ color: "var(--ink-muted)" }}>Couldn&apos;t build this one.</p>;

  function place(value: number | null) {
    if (selected === null || done || fixed.has(selected)) return;

    const next = [...grid];
    next[selected] = value;
    setGrid(next);

    if (sudokuComplete(next, shape)) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    }
  }

  /** Whether this cell clashes with another — shown as you go, never as a score. */
  function clashes(index: number): boolean {
    const value = grid[index];
    if (value === null) return false;

    const row = Math.floor(index / size);
    const col = index % size;

    for (let i = 0; i < size; i++) {
      if (i !== col && grid[row * size + i] === value) return true;
      if (i !== row && grid[i * size + col] === value) return true;
    }

    const boxRow = Math.floor(row / boxH) * boxH;
    const boxCol = Math.floor(col / boxW) * boxW;
    for (let r = boxRow; r < boxRow + boxH; r++) {
      for (let c = boxCol; c < boxCol + boxW; c++) {
        if ((r !== row || c !== col) && grid[r * size + c] === value) return true;
      }
    }

    return false;
  }

  const empty = grid.filter((cell) => cell === null).length;

  return (
    <>
      <Clock seconds={seconds} extra={done ? "finished" : `${empty} to fill`} />

      <div
        role="group"
        aria-label="Sudoku"
        className="mx-auto grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
          maxWidth: size > 6 ? "26rem" : "20rem",
        }}
      >
        {grid.map((cell, index) => {
          const given = fixed.has(index);
          const row = Math.floor(index / size);
          const col = index % size;
          const bad = clashes(index);
          const active = selected === index;

          return (
            <button
              key={index}
              type="button"
              onClick={() => setSelected(given ? null : index)}
              disabled={done}
              aria-label={`Row ${row + 1}, column ${col + 1}: ${cell ?? "empty"}${given ? ", given" : ""}`}
              className="font-display flex aspect-square items-center justify-center text-lg font-semibold transition-colors sm:text-xl"
              style={{
                background: active
                  ? "var(--accent-soft)"
                  : given
                    ? "var(--surface-sunken)"
                    : "var(--surface)",
                color: bad ? "var(--love)" : given ? "var(--ink)" : "var(--accent)",
                // Thicker edges mark the boxes, which is the only way to read the grid.
                borderTop: `${row % boxH === 0 ? 2 : 1}px solid var(--line)`,
                borderLeft: `${col % boxW === 0 ? 2 : 1}px solid var(--line)`,
                borderRight: `${col === size - 1 ? 2 : 0}px solid var(--line)`,
                borderBottom: `${row === size - 1 ? 2 : 0}px solid var(--line)`,
                outline: active ? "2px solid var(--accent)" : undefined,
              }}
            >
              <span aria-hidden="true">{cell ?? ""}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {Array.from({ length: size }, (_, i) => i + 1).map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => place(digit)}
            disabled={selected === null || done}
            className="font-display h-11 w-11 rounded-xl border-2 text-lg font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => place(null)}
          disabled={selected === null || done}
          className="h-11 rounded-xl border-2 px-3 text-sm font-semibold disabled:opacity-40"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Clear
        </button>
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Tap a square, then a number. A number that clashes turns red — that&apos;s a nudge, not
        a mark.
      </p>

      {done && (
        <Finished
          headline={`Finished in ${seconds} seconds.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
