"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor, shuffle } from "@/lib/games";

/**
 * Peg solitaire on a 7×7 cross.
 *
 * Levels don't change the board — they change how many pegs start missing, and therefore
 * how tangled the endgame is. Level 1 opens with several gaps and is genuinely easy;
 * level 12 is the classic single-hole board, which almost nobody finishes on one peg.
 */
const CROSS: boolean[] = (() => {
  const board: boolean[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const corner = (row < 2 || row > 4) && (col < 2 || col > 4);
      board.push(!corner);
    }
  }
  return board;
})();

const SIZE = 7;
const CENTRE = 3 * SIZE + 3;

function startingBoard(level: number): (boolean | null)[] {
  // null = not part of the board, false = empty hole, true = a peg
  const board: (boolean | null)[] = CROSS.map((playable) => (playable ? true : null));
  board[CENTRE] = false;

  // Extra holes at the easy end, none by level 12.
  const extra = Math.max(0, 12 - level);
  const playable = board
    .map((cell, index) => (cell === true ? index : -1))
    .filter((index) => index >= 0);

  for (const index of shuffle(playable, rng(seedFor("solitaire", level))).slice(0, extra)) {
    board[index] = false;
  }

  return board;
}

export function Solitaire() {
  const meta = gameBySlug("solitaire")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) =>
        level >= 12
          ? "One hole in the middle — the classic. Finishing on one peg is rare."
          : `${12 - level} extra holes to start you off.`
      }
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const [board, setBoard] = useState<(boolean | null)[]>(() => startingBoard(api.level));
  const [picked, setPicked] = useState<number | null>(null);
  const [improved, setImproved] = useState(false);
  const [ended, setEnded] = useState(false);

  const left = board.filter((cell) => cell === true).length;

  /** Where this peg could jump to: two along, over a peg, into a hole. */
  function jumps(from: number): Array<{ to: number; over: number }> {
    const row = Math.floor(from / SIZE);
    const col = from % SIZE;
    const out: Array<{ to: number; over: number }> = [];

    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const midRow = row + dr;
      const midCol = col + dc;
      const toRow = row + dr * 2;
      const toCol = col + dc * 2;
      if (toRow < 0 || toRow >= SIZE || toCol < 0 || toCol >= SIZE) continue;

      const over = midRow * SIZE + midCol;
      const to = toRow * SIZE + toCol;
      if (board[over] === true && board[to] === false) out.push({ to, over });
    }

    return out;
  }

  const anyMoveLeft = board.some((cell, index) => cell === true && jumps(index).length > 0);

  function tap(index: number) {
    if (ended) return;

    if (picked === null) {
      if (board[index] === true && jumps(index).length > 0) setPicked(index);
      return;
    }

    if (index === picked) {
      setPicked(null);
      return;
    }

    const move = jumps(picked).find((option) => option.to === index);
    if (!move) {
      // Tapping another peg picks that one up instead of doing nothing.
      if (board[index] === true && jumps(index).length > 0) setPicked(index);
      else setPicked(null);
      return;
    }

    const next = [...board];
    next[picked] = false;
    next[move.over] = false;
    next[index] = true;
    setBoard(next);
    setPicked(null);

    const remaining = next.filter((cell) => cell === true).length;
    const stuck = !next.some((cell, i) => cell === true && jumpsIn(next, i).length > 0);

    if (remaining === 1 || stuck) {
      setEnded(true);
      // Finishing on one peg clears the level; getting stuck still records how close.
      setImproved(api.finish(remaining, remaining === 1).improved);
    }
  }

  const targets = picked === null ? [] : jumps(picked).map((option) => option.to);

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {left} {left === 1 ? "peg" : "pegs"} left
        {!anyMoveLeft && !ended && " · no moves left"}
      </p>

      <div
        role="group"
        aria-label="Peg board"
        className="mx-auto grid w-fit gap-1"
        style={{ gridTemplateColumns: `repeat(${SIZE}, 2.4rem)` }}
      >
        {board.map((cell, index) => {
          if (cell === null) return <span key={index} />;

          const isPicked = picked === index;
          const isTarget = targets.includes(index);

          return (
            <button
              key={index}
              type="button"
              onClick={() => tap(index)}
              disabled={ended}
              aria-label={`Row ${Math.floor(index / SIZE) + 1}, column ${(index % SIZE) + 1}: ${
                cell ? "peg" : "hole"
              }${isTarget ? ", can jump here" : ""}`}
              className="flex aspect-square items-center justify-center rounded-full border-2 transition-colors"
              style={{
                background: cell
                  ? isPicked
                    ? "var(--accent)"
                    : "var(--accent-soft)"
                  : isTarget
                    ? "var(--growth-soft)"
                    : "var(--surface-sunken)",
                borderColor: isTarget ? "var(--growth)" : "var(--line)",
              }}
            >
              <span aria-hidden="true" className="text-lg">
                {cell ? "●" : ""}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Tap a peg, then tap where it lands. It jumps over its neighbour, and that neighbour
        is taken off.
      </p>

      {ended && (
        <Finished
          headline={left === 1 ? "Down to one." : `Stuck with ${left} left.`}
          detail={
            left === 1
              ? "That's the best anyone can do."
              : "Getting stuck is the normal outcome — the classic board defeats most people."
          }
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}

/** The same jump rule, against an arbitrary board — used to spot a dead end. */
function jumpsIn(board: (boolean | null)[], from: number): Array<{ to: number; over: number }> {
  if (board[from] !== true) return [];

  const row = Math.floor(from / SIZE);
  const col = from % SIZE;
  const out: Array<{ to: number; over: number }> = [];

  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const toRow = row + dr * 2;
    const toCol = col + dc * 2;
    if (toRow < 0 || toRow >= SIZE || toCol < 0 || toCol >= SIZE) continue;

    const over = (row + dr) * SIZE + (col + dc);
    const to = toRow * SIZE + toCol;
    if (board[over] === true && board[to] === false) out.push({ to, over });
  }

  return out;
}
