"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug } from "@/lib/games";

const BLANK = 0;

/** A bigger board, and a longer way from home, as the levels go up. */
function setup(level: number) {
  const size = level <= 8 ? 3 : level <= 15 ? 4 : 5;
  // How many legal moves the scramble walks away from solved. Early levels are genuinely
  // a few moves from done, which is the point of a level 1.
  const depth = 6 + level * 6;
  return { size, depth };
}

function solvedBoard(size: number): number[] {
  return Array.from({ length: size * size }, (_, i) => (i === size * size - 1 ? BLANK : i + 1));
}

function neighbours(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const out: number[] = [];
  if (row > 0) out.push(index - size);
  if (row < size - 1) out.push(index + size);
  if (col > 0) out.push(index - 1);
  if (col < size - 1) out.push(index + 1);
  return out;
}

/**
 * Shuffle by making random legal moves from the solved state.
 *
 * Randomly permuting the tiles instead would leave half of all arrangements unsolvable —
 * a puzzle that cannot be finished, handed to a child with no way of knowing that. Walking
 * backwards from solved guarantees a route home exists.
 */
function scramble(size: number, depth: number): number[] {
  const solved = solvedBoard(size);
  const board = [...solved];
  let blank = board.indexOf(BLANK);
  let previous = -1;

  for (let i = 0; i < depth; i++) {
    const options = neighbours(blank, size).filter((n) => n !== previous);
    const pick = options[Math.floor(Math.random() * options.length)];
    [board[blank], board[pick]] = [board[pick], board[blank]];
    previous = blank;
    blank = pick;
  }

  // A shuffle that lands back on solved is technically valid and deeply anticlimactic.
  return board.every((value, i) => value === solved[i]) ? scramble(size, depth) : board;
}

export function Slide() {
  const meta = gameBySlug("slide")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { size } = setup(level);
        return `${size} by ${size}.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const { size, depth } = setup(api.level);
  const solved = solvedBoard(size);

  const [board, setBoard] = useState<number[]>(() => scramble(size, depth));
  const [moves, setMoves] = useState(0);
  const [improved, setImproved] = useState(false);

  const done = board.every((value, i) => value === solved[i]);

  function move(index: number) {
    if (done) return;

    const blank = board.indexOf(BLANK);
    if (!neighbours(blank, size).includes(index)) return;

    const next = [...board];
    [next[blank], next[index]] = [next[index], next[blank]];

    const count = moves + 1;
    setBoard(next);
    setMoves(count);

    if (next.every((value, i) => value === solved[i])) {
      setImproved(api.finish(count).improved);
    }
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {moves} {moves === 1 ? "move" : "moves"}
      </p>

      <div
        className="mx-auto grid max-w-sm gap-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Sliding puzzle"
      >
        {board.map((value, index) => {
          if (value === BLANK) {
            return <div key={`blank-${index}`} aria-hidden="true" />;
          }
          const movable = neighbours(board.indexOf(BLANK), size).includes(index);
          return (
            <button
              key={value}
              type="button"
              onClick={() => move(index)}
              disabled={!movable || done}
              aria-label={movable ? `Move tile ${value}` : `Tile ${value}, can't move`}
              className="font-display flex aspect-square items-center justify-center rounded-xl border-2 text-2xl font-semibold transition-colors"
              style={{
                background: movable ? "var(--surface)" : "var(--surface-sunken)",
                borderColor: movable ? "var(--accent)" : "var(--line)",
                color: "var(--ink)",
                cursor: movable && !done ? "pointer" : "default",
              }}
            >
              {value}
            </button>
          );
        })}
      </div>

      {done ? (
        <Finished
          headline={`Back in order in ${moves} moves.`}
          detail="The shortest possible route is usually far shorter than it feels."
          improved={improved}
          onAgain={api.again}
        />
      ) : (
        <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-4">
          Shuffle again
        </button>
      )}
    </>
  );
}
