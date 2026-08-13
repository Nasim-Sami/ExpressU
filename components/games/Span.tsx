"use client";

import { useEffect, useRef, useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug } from "@/lib/games";

/**
 * A number appears, then it's gone. Type it back.
 *
 * The level sets where you start rather than where you finish — everyone hits their own
 * ceiling here somewhere around seven, and the game says so plainly afterwards rather than
 * letting a child conclude they're bad at remembering.
 */
function startingDigits(level: number): number {
  return 3 + Math.floor((level - 1) / 2);
}

/** How long it's shown: generous early, brisk later. */
function showFor(level: number, digits: number): number {
  return Math.max(700, digits * (900 - level * 22));
}

type Phase = "ready" | "showing" | "typing" | "wrong" | "cleared";

export function Span() {
  const meta = gameBySlug("span")!;

  return (
    <GameShell meta={meta} goal={(level) => `Starts at ${startingDigits(level)} digits.`}>
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const start = startingDigits(api.level);

  const [digits, setDigits] = useState(start);
  const [number, setNumber] = useState("");
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [improved, setImproved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function show(count: number) {
    // No leading zero, so a 5-digit number is always visibly 5 digits.
    const value =
      String(1 + Math.floor(Math.random() * 9)) +
      Array.from({ length: count - 1 }, () => Math.floor(Math.random() * 10)).join("");

    setNumber(value);
    setTyped("");
    setPhase("showing");

    timer.current = setTimeout(() => setPhase("typing"), showFor(api.level, count));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (phase !== "typing") return;

    if (typed.trim() !== number) {
      setPhase("wrong");
      // The score is the longest you actually held, which is one below what you just missed.
      setImproved(api.finish(digits - 1, digits > start).improved);
      return;
    }

    // Clearing the level means holding the number the level asked for; after that it just
    // keeps growing for as long as you can follow it.
    const next = digits + 1;
    setDigits(next);
    setImproved(api.finish(digits).improved);
    setPhase("cleared");
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {digits} digits
      </p>

      <div
        className="eu-card flex min-h-28 items-center justify-center p-6"
        aria-live={phase === "showing" ? "off" : "polite"}
      >
        {phase === "showing" ? (
          <p className="font-display text-4xl font-semibold tracking-[0.3em]">{number}</p>
        ) : phase === "ready" ? (
          <button type="button" onClick={() => show(digits)} className="eu-btn eu-btn-primary">
            Show me {digits} digits
          </button>
        ) : phase === "typing" ? (
          <form onSubmit={submit} className="flex flex-wrap justify-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={typed}
              onChange={(event) => setTyped(event.target.value.replace(/\D/g, ""))}
              aria-label="Type the number you saw"
              placeholder="What was it?"
              className="eu-field w-56 text-center text-xl tracking-widest"
              autoFocus
            />
            <button type="submit" disabled={typed === ""} className="eu-btn eu-btn-primary">
              That was it
            </button>
          </form>
        ) : phase === "cleared" ? (
          <div className="text-center">
            <p className="font-semibold" style={{ color: "var(--growth)" }}>
              Right. Now {digits}.
            </p>
            <button type="button" onClick={() => show(digits)} className="eu-btn eu-btn-primary mt-3">
              Keep going
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="font-semibold">It was {number}.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
              You held {digits - 1}. Almost everyone stops somewhere around seven — it&apos;s a
              real limit of how memory works, not a lack of effort.
            </p>
          </div>
        )}
      </div>

      {phase === "wrong" && (
        <Finished
          headline={`${digits - 1} digits held.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
