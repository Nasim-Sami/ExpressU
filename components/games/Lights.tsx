"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Cell, Grid } from "./bits";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { lightsOut, tapLights } from "@/lib/puzzles";

/** A bigger board, and further from off, as the levels climb. */
function setup(level: number) {
  const size = level <= 6 ? 3 : level <= 13 ? 4 : 5;
  return { size, taps: Math.min(level + 1, size * size - 1) };
}

export function Lights() {
  const meta = gameBySlug("lights")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { size } = setup(level);
        return `${size} by ${size}. Every tap flips five lights.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { size, taps } = setup(api.level);

  // Seeded by level, so level 12 is the same board every time you come back to it — being
  // stuck on a puzzle only means something if it's still there tomorrow.
  const [grid, setGrid] = useState<boolean[]>(() =>
    lightsOut(size, taps, rng(seedFor("lights", api.level))),
  );
  const [moves, setMoves] = useState(0);
  const [improved, setImproved] = useState(false);

  const done = !grid.some(Boolean);
  const lit = grid.filter(Boolean).length;

  function tap(index: number) {
    if (done) return;

    const next = [...grid];
    tapLights(next, index, size);
    const count = moves + 1;

    setGrid(next);
    setMoves(count);
    if (!next.some(Boolean)) setImproved(api.finish(count).improved);
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {lit} still on · {moves} {moves === 1 ? "move" : "moves"}
      </p>

      <Grid columns={size} label="Lights" max={size > 4 ? "24rem" : "18rem"}>
        {grid.map((on, index) => (
          <Cell
            key={index}
            onClick={() => tap(index)}
            disabled={done}
            label={`Row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}: ${on ? "on" : "off"}`}
            background={on ? "var(--accent)" : "var(--surface-sunken)"}
            border={on ? "var(--accent)" : "var(--line)"}
            color={on ? "var(--on-accent)" : "var(--ink-faint)"}
          >
            {on ? "☀" : "·"}
          </Cell>
        ))}
      </Grid>

      {done && (
        <Finished
          headline={`All out in ${moves} moves.`}
          detail="Tapping the same square twice undoes it — so the order never matters, only which squares."
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
