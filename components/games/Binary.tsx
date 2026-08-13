"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, Grid, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { takuzu, takuzuComplete, type Bit } from "@/lib/puzzles";

function setup(level: number) {
  const size = level <= 6 ? 4 : level <= 14 ? 6 : 8;
  const cells = size * size;
  // Fewer given away as you go up: about 61% at level 1, about 47% at level 20.
  const givens = Math.round(cells * (0.62 - (level - 1) * 0.008));
  return { size, givens };
}

export function Binary() {
  const meta = gameBySlug("binary")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { size } = setup(level);
        return `${size} by ${size}. Never three the same together; ${size / 2} of each per line.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { size, givens } = setup(api.level);

  const [built] = useState(() => takuzu(size, givens, rng(seedFor("binary", api.level))));
  const [grid, setGrid] = useState<(Bit | null)[]>(() => built?.puzzle ?? []);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);
  const fixed = new Set(
    (built?.puzzle ?? []).map((cell, index) => (cell === null ? -1 : index)).filter((i) => i >= 0),
  );

  if (!built) return <p style={{ color: "var(--ink-muted)" }}>Couldn&apos;t build this one.</p>;

  function cycle(index: number) {
    if (done || fixed.has(index)) return;

    const next = [...grid];
    // null → 0 → 1 → null, so a mistake is always one more tap away from gone.
    next[index] = next[index] === null ? 0 : next[index] === 0 ? 1 : null;
    setGrid(next);

    if (takuzuComplete(next, size)) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    }
  }

  const empty = grid.filter((cell) => cell === null).length;

  return (
    <>
      <Clock seconds={seconds} extra={done ? "finished" : `${empty} to fill`} />

      <Grid columns={size} label="Ones and zeros" max={size > 6 ? "26rem" : "20rem"} gap="0.3rem">
        {grid.map((cell, index) => {
          const given = fixed.has(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => cycle(index)}
              disabled={given || done}
              aria-label={`Row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}: ${
                cell === null ? "empty" : cell
              }${given ? ", given" : ""}`}
              className="font-display flex aspect-square items-center justify-center rounded-lg border-2 text-lg font-semibold transition-colors disabled:cursor-default sm:text-xl"
              style={{
                background:
                  cell === null
                    ? "var(--surface)"
                    : cell === 1
                      ? "var(--accent-soft)"
                      : "var(--surface-sunken)",
                borderColor: given ? "var(--ink-faint)" : "var(--line)",
                color: given ? "var(--ink)" : "var(--accent)",
                opacity: given ? 1 : 0.95,
              }}
            >
              <span aria-hidden="true">{cell === null ? "" : cell}</span>
            </button>
          );
        })}
      </Grid>

      <p className="mt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
        Darker squares were given to you. Tap the others to put a 0, then a 1, then clear it
        again.
      </p>

      {done && (
        <Finished
          headline={`Finished in ${seconds} seconds.`}
          detail="Any arrangement that follows both rules counts — there's more than one right answer."
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
