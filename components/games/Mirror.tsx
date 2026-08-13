"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor } from "@/lib/games";

/**
 * Half a pattern and a line down the middle: fill in the other half so the whole thing is
 * symmetrical. Mirroring is a spatial skill quite separate from logic — plenty of people
 * who find sudoku easy have to think hard about this one.
 */
function setup(level: number) {
  const size = level <= 6 ? 4 : level <= 13 ? 6 : 8;
  // How much of the left half is filled in.
  const density = 0.35 + Math.min(0.2, level * 0.01);
  return { size, density };
}

function buildLeft(size: number, density: number, random: () => number): boolean[] {
  const half = size / 2;
  const left = Array.from({ length: size * half }, () => random() < density);
  // An empty half is not a puzzle.
  return left.some(Boolean) ? left : buildLeft(size, density, random);
}

export function Mirror() {
  const meta = gameBySlug("mirror")!;

  return (
    <GameShell meta={meta} goal={(level) => `${setup(level).size} squares across.`}>
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { size, density } = setup(api.level);
  const half = size / 2;

  const [left] = useState(() => buildLeft(size, density, rng(seedFor("mirror", api.level))));
  const [right, setRight] = useState<boolean[]>(() => new Array(size * half).fill(false));
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);

  /** The mirror of left cell (row, col) is right cell (row, half-1-col). */
  const wanted = (row: number, col: number) => left[row * half + (half - 1 - col)];

  function toggle(row: number, col: number) {
    if (done) return;

    const next = [...right];
    const index = row * half + col;
    next[index] = !next[index];
    setRight(next);

    const complete = next.every((filled, i) => {
      const r = Math.floor(i / half);
      const c = i % half;
      return filled === wanted(r, c);
    });

    if (complete) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    }
  }

  const remaining = right.filter((filled, i) => filled !== wanted(Math.floor(i / half), i % half)).length;
  const cell = Math.max(22, Math.min(38, Math.floor(340 / size)));

  return (
    <>
      <Clock seconds={seconds} extra={done ? "matched" : `${remaining} not matching yet`} />

      <div
        role="group"
        aria-label="Mirror the pattern"
        className="mx-auto grid w-fit gap-0.5"
        style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}
      >
        {Array.from({ length: size * size }, (_, index) => {
          const row = Math.floor(index / size);
          const col = index % size;
          const isLeft = col < half;

          if (isLeft) {
            const filled = left[row * half + col];
            return (
              <span
                key={index}
                aria-hidden="true"
                style={{
                  width: cell,
                  height: cell,
                  background: filled ? "var(--ink-muted)" : "var(--surface-sunken)",
                  // The mirror line.
                  borderRight: col === half - 1 ? "3px dashed var(--accent)" : undefined,
                  borderRadius: 3,
                }}
              />
            );
          }

          const rightCol = col - half;
          const filled = right[row * half + rightCol];

          return (
            <button
              key={index}
              type="button"
              onClick={() => toggle(row, rightCol)}
              disabled={done}
              aria-label={`Row ${row + 1}, column ${col + 1}: ${filled ? "filled" : "empty"}`}
              style={{
                width: cell,
                height: cell,
                background: filled ? "var(--accent)" : "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 3,
              }}
            />
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        The dashed line is a mirror. Tap the right-hand squares so the two halves match.
      </p>

      {done && (
        <Finished
          headline={`Mirrored in ${seconds} seconds.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
