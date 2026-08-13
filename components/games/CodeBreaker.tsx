"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug } from "@/lib/games";

/** Named and shaped as well as coloured, so the game is playable without colour vision. */
const COLOURS = [
  { name: "Leaf", shape: "▲", value: "#3f8f5f" },
  { name: "Sky", shape: "●", value: "#3a72a8" },
  { name: "Sun", shape: "■", value: "#c07a12" },
  { name: "Rose", shape: "◆", value: "#b04a63" },
  { name: "Plum", shape: "★", value: "#7a5195" },
  { name: "Stone", shape: "⬟", value: "#6b7480" },
];

/** Longer codes, more colours, and fewer goes, as the levels climb. */
function setup(level: number) {
  return {
    slots: level <= 6 ? 3 : level <= 14 ? 4 : 5,
    colours: level <= 3 ? 4 : level <= 10 ? 5 : 6,
    maxGuesses: 12 - Math.floor(level / 5),
  };
}

interface Scored {
  guess: number[];
  exact: number;
  partial: number;
}

/**
 * Standard Mastermind scoring.
 *
 * The two passes matter: every exact hit is removed from both tallies before near-misses
 * are counted, otherwise one secret peg can be credited twice and the feedback becomes
 * quietly impossible to reason from.
 */
function score(guess: number[], secret: number[]): { exact: number; partial: number } {
  let exact = 0;
  const secretLeft: number[] = [];
  const guessLeft: number[] = [];

  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) exact++;
    else {
      secretLeft.push(secret[i]);
      guessLeft.push(guess[i]);
    }
  }

  let partial = 0;
  for (const colour of guessLeft) {
    const at = secretLeft.indexOf(colour);
    if (at !== -1) {
      partial++;
      secretLeft.splice(at, 1);
    }
  }

  return { exact, partial };
}

export function CodeBreaker() {
  const meta = gameBySlug("code")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { slots, colours, maxGuesses } = setup(level);
        return `${slots} hidden, ${colours} colours, ${maxGuesses} guesses.`;
      }}
    >
      {(api) => <Game api={api} />}
    </GameShell>
  );
}

function Game({ api }: { api: GameApi }) {
  const { slots, colours, maxGuesses } = setup(api.level);

  const [secret] = useState<number[]>(() =>
    Array.from({ length: slots }, () => Math.floor(Math.random() * colours)),
  );
  const [draft, setDraft] = useState<number[]>(() => Array(slots).fill(0));
  const [history, setHistory] = useState<Scored[]>([]);
  const [improved, setImproved] = useState(false);

  const won = history.some((row) => row.exact === slots);
  const out = !won && history.length >= maxGuesses;
  const over = won || out;

  function cycle(slot: number) {
    if (over) return;
    setDraft((current) => current.map((value, i) => (i === slot ? (value + 1) % colours : value)));
  }

  function submit() {
    if (over) return;

    const result = score(draft, secret);
    const next = [...history, { guess: [...draft], ...result }];
    setHistory(next);

    // Running out of guesses records how many you used but doesn't finish the level.
    if (result.exact === slots) setImproved(api.finish(next.length).improved);
  }

  const possibilities = colours ** slots;

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {over
          ? won
            ? "Cracked it."
            : "Out of guesses."
          : `Guess ${history.length + 1} of ${maxGuesses}`}
      </p>

      {/* Past guesses, oldest first — the whole game is reading this table. */}
      {history.length > 0 && (
        <ol className="mb-4 flex flex-col gap-2">
          {history.map((row, index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-xl px-3 py-2"
              style={{ background: "var(--surface-sunken)" }}
            >
              <span className="w-5 text-sm" style={{ color: "var(--ink-faint)" }}>
                {index + 1}
              </span>
              <span className="flex gap-2">
                {row.guess.map((colour, slot) => (
                  <Peg key={slot} colour={colour} size={30} />
                ))}
              </span>
              <span className="ml-auto text-sm" style={{ color: "var(--ink-muted)" }}>
                <strong style={{ color: "var(--growth)" }}>{row.exact}</strong> exact
                {" · "}
                <strong>{row.partial}</strong> misplaced
              </span>
            </li>
          ))}
        </ol>
      )}

      {!over && (
        <div className="eu-card flex flex-wrap items-center gap-3 p-4">
          <span className="flex gap-2">
            {draft.map((colour, slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => cycle(slot)}
                aria-label={`Slot ${slot + 1}: ${COLOURS[colour].name}. Tap to change.`}
                className="rounded-full"
              >
                <Peg colour={colour} size={44} />
              </button>
            ))}
          </span>
          <button type="button" onClick={submit} className="eu-btn eu-btn-primary ml-auto">
            Guess
          </button>
          <p className="w-full text-xs" style={{ color: "var(--ink-faint)" }}>
            Tap a shape to change it. &ldquo;Exact&rdquo; means right colour, right place;
            &ldquo;misplaced&rdquo; means right colour, wrong place.
          </p>
        </div>
      )}

      {over && (
        <>
          <div
            className="flex items-center gap-3 rounded-xl p-4"
            style={{ background: "var(--surface-sunken)" }}
          >
            <span className="text-sm font-semibold">The code was</span>
            <span className="flex gap-2">
              {secret.map((colour, slot) => (
                <Peg key={slot} colour={colour} size={34} />
              ))}
            </span>
          </div>
          <Finished
            headline={won ? `Cracked in ${history.length} guesses.` : "Not this time."}
            detail={
              won
                ? undefined
                : `${slots} slots and ${colours} colours is ${possibilities.toLocaleString()} possibilities. ${maxGuesses} guesses is genuinely tight.`
            }
            improved={improved}
            onAgain={api.again}
          />
        </>
      )}
    </>
  );
}

function Peg({ colour, size }: { colour: number; size: number }) {
  const spec = COLOURS[colour];
  return (
    <span
      title={spec.name}
      className="inline-flex items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: spec.value, fontSize: size * 0.45 }}
    >
      <span aria-hidden="true">{spec.shape}</span>
      <span className="sr-only">{spec.name}</span>
    </span>
  );
}
