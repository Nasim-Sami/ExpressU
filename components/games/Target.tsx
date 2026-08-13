"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { Clock, useElapsed } from "./bits";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { numberTarget } from "@/lib/puzzles";

function countFor(level: number): number {
  return Math.min(6, 3 + Math.floor(level / 6));
}

type Op = "+" | "−" | "×" | "÷";

const OPS: Op[] = ["+", "−", "×", "÷"];

function apply(a: number, op: Op, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "−":
      return a - b;
    case "×":
      return a * b;
    case "÷":
      // Whole numbers only — a puzzle that hands a child 7 ÷ 3 has stopped being arithmetic
      // and started being a spelling test for decimals.
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

export function Target() {
  const meta = gameBySlug("target")!;

  return (
    <GameShell meta={meta} goal={(level) => `${countFor(level)} numbers to work with.`}>
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const [puzzle] = useState(() => numberTarget(countFor(api.level), rng(seedFor("target", api.level))));

  // Numbers still on the table. Combining two takes both away and puts the answer back.
  const [pool, setPool] = useState<Array<{ id: number; value: number }>>(() =>
    puzzle.numbers.map((value, id) => ({ id, value })),
  );
  const [first, setFirst] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [nextId, setNextId] = useState(puzzle.numbers.length);
  const [steps, setSteps] = useState<string[]>([]);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const seconds = useElapsed(!done);

  function pick(id: number) {
    if (done) return;

    if (first === null) {
      setFirst(id);
      return;
    }
    if (first === id) {
      setFirst(null);
      return;
    }
    if (op === null) {
      setFirst(id);
      return;
    }

    const a = pool.find((n) => n.id === first)!;
    const b = pool.find((n) => n.id === id)!;
    const result = apply(a.value, op, b.value);

    if (result === null || result < 0) {
      // Not allowed: no negatives, no fractions. Say so by simply not doing it.
      setFirst(null);
      setOp(null);
      return;
    }

    const combined = { id: nextId, value: result };
    setPool([...pool.filter((n) => n.id !== a.id && n.id !== b.id), combined]);
    setNextId(nextId + 1);
    setSteps([...steps, `${a.value} ${op} ${b.value} = ${result}`]);
    setFirst(null);
    setOp(null);

    if (result === puzzle.target) {
      setDone(true);
      setImproved(api.finish(seconds).improved);
    }
  }

  return (
    <>
      <Clock seconds={seconds} />

      <div className="eu-card p-5 text-center">
        <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
          Land on
        </p>
        <p className="font-display text-5xl font-semibold" style={{ color: "var(--accent)" }}>
          {puzzle.target}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {pool.map((number) => (
          <button
            key={number.id}
            type="button"
            onClick={() => pick(number.id)}
            disabled={done}
            aria-label={`The number ${number.value}`}
            className="font-display h-14 min-w-14 rounded-xl border-2 px-3 text-2xl font-semibold transition-colors"
            style={{
              borderColor: first === number.id ? "var(--accent)" : "var(--line)",
              background: first === number.id ? "var(--accent-soft)" : "var(--surface)",
            }}
          >
            {number.value}
          </button>
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-2">
        {OPS.map((symbol) => (
          <button
            key={symbol}
            type="button"
            onClick={() => setOp(op === symbol ? null : symbol)}
            disabled={done}
            aria-label={`Use ${symbol}`}
            aria-pressed={op === symbol}
            className="h-12 w-12 rounded-xl border-2 text-xl font-semibold"
            style={{
              borderColor: op === symbol ? "var(--accent)" : "var(--line)",
              background: op === symbol ? "var(--accent)" : "var(--surface)",
              color: op === symbol ? "var(--on-accent)" : "var(--ink)",
            }}
          >
            {symbol}
          </button>
        ))}
      </div>

      {steps.length > 0 && (
        <ol className="mt-4 flex flex-col items-center gap-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Tap a number, a sign, then another number. They join into one. No fractions and
        nothing below zero — if a step isn&apos;t allowed, nothing happens.
      </p>

      <button type="button" onClick={api.again} className="eu-btn eu-btn-quiet mt-4 w-full">
        Put the numbers back
      </button>

      {done && (
        <Finished
          headline={`${puzzle.target}, in ${seconds} seconds.`}
          detail="There is always at least one way through — the target was built from these numbers."
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
