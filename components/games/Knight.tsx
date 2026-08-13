"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor } from "@/lib/games";

/**
 * The knight's tour, on a small board.
 *
 * It is a genuinely hard problem — but a 5×5 board from a corner always has a full tour,
 * and the game never asks for more than "get as far as you can", so a partial run is a
 * result rather than a failure.
 */
function setup(level: number) {
  const size = level <= 6 ? 4 : level <= 12 ? 5 : 6;
  // Finishing means visiting this many squares; a full tour clears it outright.
  const target = Math.round(size * size * (0.55 + Math.min(0.45, level * 0.03)));
  return { size, target: Math.min(size * size, target) };
}

const MOVES: Array<[number, number]> = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export function Knight() {
  const meta = gameBySlug("knight")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { size, target } = setup(level);
        return `${size} by ${size} — reach ${target} squares.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { size, target } = setup(api.level);

  // Where the knight starts is fixed per level, so the puzzle is the same each visit.
  const [start] = useState(() => {
    const random = rng(seedFor("knight", api.level));
    return Math.floor(random() * size * size);
  });

  const [visited, setVisited] = useState<number[]>([start]);
  const [improved, setImproved] = useState(false);
  const [ended, setEnded] = useState(false);

  const at = visited[visited.length - 1];

  function reachable(from: number): number[] {
    const x = from % size;
    const y = Math.floor(from / size);
    return MOVES.map(([dx, dy]) => [x + dx, y + dy])
      .filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size)
      .map(([nx, ny]) => ny * size + nx)
      .filter((cell) => !visited.includes(cell));
  }

  const options = ended ? [] : reachable(at);

  function go(cell: number) {
    if (ended || !options.includes(cell)) return;

    const next = [...visited, cell];
    setVisited(next);

    const stuck =
      next.length === size * size ||
      MOVES.map(([dx, dy]) => [(cell % size) + dx, Math.floor(cell / size) + dy])
        .filter(([nx, ny]) => nx >= 0 && nx < size && ny >= 0 && ny < size)
        .every(([nx, ny]) => next.includes(ny * size + nx));

    if (stuck) {
      setEnded(true);
      setImproved(api.finish(next.length, next.length >= target).improved);
    }
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {visited.length} of {size * size} squares · {target} finishes this level
      </p>

      <div
        role="group"
        aria-label="Chessboard"
        className="mx-auto grid w-fit gap-0.5"
        style={{ gridTemplateColumns: `repeat(${size}, 3rem)` }}
      >
        {Array.from({ length: size * size }, (_, index) => {
          const order = visited.indexOf(index);
          const here = index === at;
          const open = options.includes(index);
          const dark = (Math.floor(index / size) + (index % size)) % 2 === 1;

          return (
            <button
              key={index}
              type="button"
              onClick={() => go(index)}
              disabled={!open}
              aria-label={`Row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}: ${
                here ? "the knight" : order >= 0 ? `visited, step ${order + 1}` : open ? "you can move here" : "empty"
              }`}
              className="flex aspect-square items-center justify-center text-sm font-semibold transition-colors"
              style={{
                background: here
                  ? "var(--accent)"
                  : open
                    ? "var(--growth-soft)"
                    : order >= 0
                      ? "var(--accent-soft)"
                      : dark
                        ? "var(--surface-sunken)"
                        : "var(--surface)",
                color: here ? "var(--on-accent)" : open ? "var(--growth)" : "var(--ink-muted)",
                border: "1px solid var(--line)",
              }}
            >
              <span aria-hidden="true">{here ? "♞" : order >= 0 ? order + 1 : open ? "•" : ""}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        A knight moves two one way and one the other. Green squares are where it can go
        next. Landing on a square twice isn&apos;t allowed.
      </p>

      {ended && (
        <Finished
          headline={
            visited.length === size * size
              ? "Every square, exactly once."
              : `Stuck after ${visited.length} squares.`
          }
          detail={
            visited.length === size * size
              ? "That's a full knight's tour. Mathematicians have been writing about this since the ninth century."
              : `This level asks for ${target}. Getting boxed in is the normal way it ends.`
          }
          improved={improved}
          onAgain={api.again}
        />
      )}

      {!ended && (
        <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-4 w-full">
          Start the walk again
        </button>
      )}
    </>
  );
}
