"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor } from "@/lib/games";

/**
 * One of these is not like the others.
 *
 * The difference starts obvious — a different shape entirely — and narrows to a small
 * rotation or a slightly different shade, which is a genuinely different kind of noticing.
 */
const SHAPES = ["●", "▲", "■", "◆", "★", "⬟", "♥", "✚"];

interface Round {
  cells: Array<{ glyph: string; rotate: number; shade: number }>;
  odd: number;
  columns: number;
}

function build(level: number, round: number): Round {
  const random = rng(seedFor("oddone", level, round));

  const columns = level <= 5 ? 3 : level <= 12 ? 4 : 5;
  const count = columns * columns;

  const glyph = SHAPES[Math.floor(random() * SHAPES.length)];
  const odd = Math.floor(random() * count);

  // What makes the odd one odd, and by how much — the whole difficulty curve is here.
  const kind = level <= 4 ? "shape" : level <= 10 ? "rotate" : random() < 0.5 ? "rotate" : "shade";

  const otherGlyph = SHAPES.filter((s) => s !== glyph)[Math.floor(random() * (SHAPES.length - 1))];
  // 40 degrees at level 5 down to about 8 at level 20; likewise for the shade.
  const rotation = Math.max(8, 46 - level * 2);
  const shade = Math.max(0.06, 0.34 - level * 0.014);

  return {
    columns,
    odd,
    cells: Array.from({ length: count }, (_, index) => {
      const isOdd = index === odd;
      return {
        glyph: isOdd && kind === "shape" ? otherGlyph : glyph,
        rotate: isOdd && kind === "rotate" ? rotation : 0,
        shade: isOdd && kind === "shade" ? shade : 0,
      };
    }),
  };
}

function targetFor(level: number): number {
  return Math.min(10, 3 + Math.floor(level / 3));
}

export function OddOne() {
  const meta = gameBySlug("oddone")!;

  return (
    <GameShell meta={meta} goal={(level) => `${targetFor(level)} in a row finishes it.`}>
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const target = targetFor(api.level);

  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<Round>(() => build(api.level, 0));
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState(false);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  function tap(index: number) {
    if (done || missed) return;

    if (index !== puzzle.odd) {
      setMissed(true);
      setImproved(api.finish(streak, false).improved);
      return;
    }

    const next = streak + 1;
    setStreak(next);

    if (next >= target) {
      setDone(true);
      setImproved(api.finish(next).improved);
      return;
    }

    setRound(round + 1);
    setPuzzle(build(api.level, round + 1));
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {streak} in a row · {target} finishes this level
      </p>

      <div
        role="group"
        aria-label="Find the one that is different"
        className="mx-auto grid w-fit gap-2"
        style={{ gridTemplateColumns: `repeat(${puzzle.columns}, 3.4rem)` }}
      >
        {puzzle.cells.map((cell, index) => (
          <button
            key={index}
            type="button"
            onClick={() => tap(index)}
            disabled={done || missed}
            aria-label={`Shape ${index + 1}`}
            className="flex aspect-square items-center justify-center rounded-xl border-2 text-2xl"
            style={{
              borderColor: missed && index === puzzle.odd ? "var(--growth)" : "var(--line)",
              background:
                missed && index === puzzle.odd ? "var(--growth-soft)" : "var(--surface-sunken)",
              color: `color-mix(in srgb, var(--accent) ${100 - cell.shade * 100}%, var(--surface))`,
              transform: `rotate(${cell.rotate}deg)`,
            }}
          >
            <span aria-hidden="true">{cell.glyph}</span>
          </button>
        ))}
      </div>

      {missed && !done && (
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: "var(--surface-sunken)" }}>
          <p className="font-semibold">That wasn&apos;t it — the green one was.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            You got {streak} before this one.
          </p>
          <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-3">
            Start again
          </button>
        </div>
      )}

      {done && (
        <Finished headline={`${streak} in a row.`} improved={improved} onAgain={api.again} />
      )}
    </>
  );
}
