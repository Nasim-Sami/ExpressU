"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor, shuffle } from "@/lib/games";
import { wordsOfLength } from "@/lib/words";

/** Short words early, longer ones later; more of them to get through as you go up. */
function setup(level: number) {
  return {
    length: Math.min(8, 3 + Math.floor(level / 3)),
    rounds: Math.min(6, 2 + Math.floor(level / 4)),
  };
}

interface Round {
  word: string;
  letters: string[];
}

function build(level: number): Round[] {
  const { length, rounds } = setup(level);
  const random = rng(seedFor("unjumble", level));
  const pool = shuffle(wordsOfLength(length), random).slice(0, rounds);

  return pool.map((word) => {
    // Reshuffle until the jumble isn't just the word again — a level that solves itself
    // is a level nobody learns anything from.
    let letters = shuffle(word.split(""), random);
    for (let i = 0; i < 8 && letters.join("") === word; i++) {
      letters = shuffle(word.split(""), random);
    }
    return { word, letters };
  });
}

export function Unjumble() {
  const meta = gameBySlug("unjumble")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { length, rounds } = setup(level);
        return `${rounds} words, ${length} letters each.`;
      }}
    >
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const [rounds] = useState(() => build(api.level));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number[]>([]);
  const [wrong, setWrong] = useState(false);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);
  const round = rounds[index];
  const attempt = picked.map((i) => round.letters[i]).join("");

  function choose(letterIndex: number) {
    if (done || picked.includes(letterIndex)) return;

    const next = [...picked, letterIndex];
    setPicked(next);
    setWrong(false);

    if (next.length < round.letters.length) return;

    const word = next.map((i) => round.letters[i]).join("");
    if (word !== round.word) {
      // Wrong, and that's all — no penalty, no counter, just try again.
      setWrong(true);
      return;
    }

    if (index + 1 === rounds.length) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    } else {
      setIndex(index + 1);
      setPicked([]);
    }
  }

  return (
    <>
      <Clock seconds={seconds} extra={`word ${Math.min(index + 1, rounds.length)} of ${rounds.length}`} />

      <div
        className="eu-card flex min-h-16 flex-wrap items-center justify-center gap-1 p-4 text-2xl font-semibold tracking-widest"
        aria-live="polite"
        style={{ color: wrong ? "var(--love)" : "var(--ink)" }}
      >
        {attempt || <span style={{ color: "var(--ink-faint)" }}>·</span>}
      </div>

      {wrong && (
        <p className="mt-2 text-center text-sm" style={{ color: "var(--ink-muted)" }}>
          Not a word. Take some letters back and try another order.
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {round.letters.map((letter, letterIndex) => (
          <button
            key={letterIndex}
            type="button"
            onClick={() => choose(letterIndex)}
            disabled={picked.includes(letterIndex) || done}
            aria-label={`Letter ${letter}`}
            className="font-display h-14 w-12 rounded-xl border-2 text-2xl font-semibold uppercase transition-opacity disabled:opacity-25"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPicked(picked.slice(0, -1));
            setWrong(false);
          }}
          disabled={picked.length === 0 || done}
          className="eu-btn eu-btn-quiet"
        >
          Take one back
        </button>
        <button
          type="button"
          onClick={() => {
            setPicked([]);
            setWrong(false);
          }}
          disabled={picked.length === 0 || done}
          className="eu-btn eu-btn-quiet"
        >
          Start the word again
        </button>
      </div>

      {done && (
        <Finished
          headline={`All ${rounds.length} in ${seconds} seconds.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
