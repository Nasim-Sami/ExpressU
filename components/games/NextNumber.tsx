"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { numberRun, type NumberRun } from "@/lib/puzzles";

/** How many you have to get right in a row to finish the level. */
function targetFor(level: number): number {
  return Math.min(8, 3 + Math.floor(level / 4));
}

export function NextNumber() {
  const meta = gameBySlug("nextnumber")!;

  return (
    <GameShell meta={meta} goal={(level) => `${targetFor(level)} in a row finishes it.`}>
      {(api) => <Play api={api} />}
    </GameShell>
  );
}

function Play({ api }: { api: GameApi }) {
  const target = targetFor(api.level);

  const [round, setRound] = useState(0);
  const [puzzle, setPuzzle] = useState<NumberRun>(() =>
    numberRun(api.level, rng(seedFor("nextnumber", api.level, 0))),
  );
  const [answer, setAnswer] = useState("");
  const [streak, setStreak] = useState(0);
  const [shown, setShown] = useState<"none" | "right" | "wrong">("none");
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (done || shown !== "none") return;

    const value = Number(answer.trim());
    if (!Number.isFinite(value) || answer.trim() === "") return;

    if (value === puzzle.answer) {
      const next = streak + 1;
      setStreak(next);
      setShown("right");

      if (next >= target) {
        setDone(true);
        setImproved(api.finish(next).improved);
      }
      return;
    }

    // A wrong answer ends the run but still records how far you got. The rule is always
    // shown afterwards — a puzzle you got wrong and were never told why teaches nothing.
    setShown("wrong");
    setImproved(api.finish(streak, false).improved);
  }

  function nextRound() {
    const index = round + 1;
    setRound(index);
    setPuzzle(numberRun(api.level, rng(seedFor("nextnumber", api.level, index))));
    setAnswer("");
    setShown("none");
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {streak} in a row · {target} finishes this level
      </p>

      <div className="eu-card p-6 text-center">
        <p className="font-display flex flex-wrap items-center justify-center gap-3 text-3xl font-semibold">
          {puzzle.run.map((number, index) => (
            <span key={index}>{number}</span>
          ))}
          <span
            className="rounded-lg px-3"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            ?
          </span>
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-wrap justify-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={shown !== "none" || done}
          aria-label="What comes next"
          placeholder="The next number"
          className="eu-field w-48 text-center"
          autoFocus
        />
        <button
          type="submit"
          disabled={shown !== "none" || done || answer.trim() === ""}
          className="eu-btn eu-btn-primary"
        >
          That one
        </button>
      </form>

      {shown !== "none" && (
        <div
          role="status"
          className="mt-4 rounded-xl p-4 text-center"
          style={{
            background: shown === "right" ? "var(--growth-soft)" : "var(--surface-sunken)",
          }}
        >
          <p className="font-semibold" style={{ color: shown === "right" ? "var(--growth)" : "var(--ink)" }}>
            {shown === "right" ? `Yes — ${puzzle.answer}.` : `It was ${puzzle.answer}.`}
          </p>
          <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
            {puzzle.rule}
          </p>

          {!done && (
            <button
              type="button"
              onClick={shown === "right" ? nextRound : api.again}
              className="eu-btn eu-btn-quiet mt-3"
            >
              {shown === "right" ? "Next one" : "Start again"}
            </button>
          )}
        </div>
      )}

      {done && (
        <Finished
          headline={`${streak} in a row.`}
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
