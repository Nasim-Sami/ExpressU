"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor, shuffle } from "@/lib/games";
import { wordSearch, type Placement } from "@/lib/puzzles";
import { ALL_WORDS } from "@/lib/words";

function setup(level: number) {
  return {
    size: Math.min(12, 7 + Math.floor(level / 4)),
    count: Math.min(8, 3 + Math.floor(level / 3)),
  };
}

function build(level: number) {
  const { size, count } = setup(level);
  const random = rng(seedFor("wordsearch", level));

  // The generator refuses rather than dropping a word it couldn't fit, so try a few word
  // sets before giving the grid more room.
  for (let attempt = 0; attempt < 12; attempt++) {
    const words = shuffle(ALL_WORDS, random)
      .filter((word) => word.length <= size)
      .slice(0, count);
    const built = wordSearch(words, size, random);
    if (built) return { ...built, size };
  }

  const fallback = wordSearch(["bird", "song", "star"], size + 2, random)!;
  return { ...fallback, size: size + 2 };
}

export function WordSearch() {
  const meta = gameBySlug("wordsearch")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { size, count } = setup(level);
        return `${count} words in a ${size} by ${size} grid.`;
      }}
    >
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const [{ grid, placements, size }] = useState(() => build(api.level));

  const [from, setFrom] = useState<number | null>(null);
  const [found, setFound] = useState<Placement[]>([]);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);
  const foundCells = new Set(found.flatMap((placement) => placement.cells));

  /** Every cell on the straight line between two squares, or null if they aren't in line. */
  function lineBetween(a: number, b: number): number[] | null {
    const ax = a % size;
    const ay = Math.floor(a / size);
    const bx = b % size;
    const by = Math.floor(b / size);

    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));

    // Must be a row, a column, or a true diagonal.
    if (Math.abs(bx - ax) !== 0 && Math.abs(by - ay) !== 0 && Math.abs(bx - ax) !== Math.abs(by - ay)) {
      return null;
    }

    return Array.from({ length: steps + 1 }, (_, i) => (ay + dy * i) * size + (ax + dx * i));
  }

  function tap(index: number) {
    if (done) return;

    if (from === null) {
      setFrom(index);
      return;
    }

    if (from === index) {
      setFrom(null);
      return;
    }

    const line = lineBetween(from, index);
    setFrom(null);
    if (!line) return;

    const forwards = line.join(",");
    const backwards = [...line].reverse().join(",");

    const hit = placements.find(
      (placement) =>
        !found.includes(placement) &&
        (placement.cells.join(",") === forwards || placement.cells.join(",") === backwards),
    );
    if (!hit) return;

    const next = [...found, hit];
    setFound(next);

    if (next.length === placements.length) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    }
  }

  const cell = Math.max(20, Math.min(34, Math.floor(360 / size)));

  return (
    <>
      <Clock seconds={seconds} extra={`${found.length} of ${placements.length} found`} />

      <div
        role="group"
        aria-label="Letter grid"
        className="mx-auto grid w-fit gap-0.5"
        style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)` }}
      >
        {grid.map((letter, index) => {
          const isFound = foundCells.has(index);
          const isStart = from === index;

          return (
            <button
              key={index}
              type="button"
              onClick={() => tap(index)}
              disabled={done}
              aria-label={`${letter}, row ${Math.floor(index / size) + 1}, column ${(index % size) + 1}`}
              className="flex aspect-square items-center justify-center rounded text-sm font-semibold transition-colors"
              style={{
                width: cell,
                height: cell,
                background: isFound
                  ? "var(--growth-soft)"
                  : isStart
                    ? "var(--accent)"
                    : "var(--surface-sunken)",
                color: isFound ? "var(--growth)" : isStart ? "var(--on-accent)" : "var(--ink)",
              }}
            >
              <span aria-hidden="true">{letter}</span>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {placements.map((placement) => {
          const got = found.includes(placement);
          return (
            <li
              key={placement.word}
              className="rounded-full px-3 py-1 text-sm font-semibold"
              style={{
                background: got ? "var(--growth-soft)" : "var(--surface-sunken)",
                color: got ? "var(--growth)" : "var(--ink-muted)",
                textDecoration: got ? "line-through" : undefined,
              }}
            >
              {placement.word.toLowerCase()}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Tap the first letter, then the last. Words run across, down, and diagonally — some
        of them backwards.
      </p>

      {done && (
        <Finished
          headline={`All ${placements.length} found in ${seconds} seconds.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
