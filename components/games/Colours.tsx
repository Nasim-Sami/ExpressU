"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor, shuffle } from "@/lib/games";

/**
 * The Stroop task: the word says one colour and is painted in another, and you have to go
 * by the paint. Reading is so automatic that it fights you, which is the whole point.
 *
 * The buttons are labelled with words, not swatches — a colour-blind player can play this
 * by ink name, and the ink names are distinct enough to not depend on hue alone.
 */
const INKS = [
  { name: "red", value: "#c0392b" },
  { name: "blue", value: "#2b6cb0" },
  { name: "green", value: "#2f7a4d" },
  { name: "orange", value: "#c07a12" },
  { name: "purple", value: "#7a5195" },
];

function setup(level: number) {
  return {
    colours: level <= 5 ? 3 : level <= 12 ? 4 : 5,
    target: Math.min(15, 4 + Math.floor(level / 2)),
  };
}

interface Round {
  word: string;
  ink: (typeof INKS)[number];
  options: typeof INKS;
}

function build(level: number, round: number): Round {
  const { colours } = setup(level);
  const random = rng(seedFor("colours", level, round));
  const pool = INKS.slice(0, colours);

  const ink = pool[Math.floor(random() * pool.length)];
  // Early levels sometimes agree, which is the gentle version; later they never do.
  const conflict = level > 3 || random() < 0.7;
  const others = pool.filter((colour) => colour.name !== ink.name);
  const word = conflict ? others[Math.floor(random() * others.length)].name : ink.name;

  return { word, ink, options: shuffle(pool, random) };
}

export function Colours() {
  const meta = gameBySlug("colours")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { colours, target } = setup(level);
        return `${colours} colours · ${target} in a row finishes it.`;
      }}
    >
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const { target } = setup(api.level);

  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<Round>(() => build(api.level, 0));
  const [streak, setStreak] = useState(0);
  const [missed, setMissed] = useState(false);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  function answer(name: string) {
    if (done || missed) return;

    if (name !== puzzle.ink.name) {
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

      <div className="eu-card flex min-h-32 items-center justify-center p-6">
        <p
          className="font-display text-5xl font-bold uppercase"
          style={{ color: puzzle.ink.value }}
        >
          {puzzle.word}
          <span className="sr-only"> — written in {puzzle.ink.name}</span>
        </p>
      </div>

      <p className="mt-3 text-center text-sm font-semibold">
        What colour is it <em>written</em> in?
      </p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {puzzle.options.map((option) => (
          <button
            key={option.name}
            type="button"
            onClick={() => answer(option.name)}
            disabled={done || missed}
            className="rounded-xl border-2 px-4 py-2 font-semibold capitalize"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {option.name}
          </button>
        ))}
      </div>

      {missed && !done && (
        <div className="mt-4 rounded-xl p-4 text-center" style={{ background: "var(--surface-sunken)" }}>
          <p className="font-semibold">
            It was written in {puzzle.ink.name}, though it said &ldquo;{puzzle.word}&rdquo;.
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            You got {streak}. Reading is automatic — it takes real effort to override it, and
            everybody slips.
          </p>
          <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-3">
            Start again
          </button>
        </div>
      )}

      {done && <Finished headline={`${streak} in a row.`} improved={improved} onAgain={api.again} />}
    </>
  );
}
