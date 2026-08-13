"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug } from "@/lib/games";

/**
 * Pads, and a growing pattern to repeat.
 *
 * Each pad carries a name and a shape as well as a colour: a colour-blind player must be
 * able to tell them apart, and "the green one" is useless if green and red look the same.
 */
const PADS = [
  { name: "Leaf", shape: "▲", color: "#3f8f5f" },
  { name: "Sky", shape: "●", color: "#3a72a8" },
  { name: "Sun", shape: "■", color: "#c07a12" },
  { name: "Rose", shape: "◆", color: "#b04a63" },
  { name: "Plum", shape: "★", color: "#7a5299" },
  { name: "Slate", shape: "⬢", color: "#4a5c68" },
];

/** How many pads are in play, and how long each one lights up for. */
function setup(level: number) {
  return {
    pads: level <= 7 ? 4 : level <= 14 ? 5 : 6,
    // Deliberately unhurried even at the top: this is a memory game, not a reflex test,
    // and a fast strobe is both harder to follow and worse for anyone light-sensitive.
    onDuration: Math.round(420 - (level - 1) * 8),
    target: level + 2,
  };
}

type Phase = "idle" | "showing" | "yours" | "over" | "cleared";

export function Sequence() {
  const meta = gameBySlug("sequence")!;

  return (
    <GameShell meta={meta} goal={(level) => `Repeat ${setup(level).target} in a row to finish it.`}>
      {(api) => <Pads api={api} />}
    </GameShell>
  );
}

function Pads({ api }: { api: GameApi }) {
  const { pads, onDuration, target } = setup(api.level);

  const [pattern, setPattern] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [improved, setImproved] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  /** Plays the pattern back, then hands over. */
  const show = useCallback(
    (sequence: number[]) => {
      clearTimers();
      setPhase("showing");
      setStep(0);

      const gap = 200;

      sequence.forEach((pad, index) => {
        timers.current.push(
          setTimeout(() => setLit(pad), index * (onDuration + gap)),
          setTimeout(() => setLit(null), index * (onDuration + gap) + onDuration),
        );
      });

      timers.current.push(setTimeout(() => setPhase("yours"), sequence.length * (onDuration + gap)));
    },
    [clearTimers, onDuration],
  );

  const extend = useCallback(
    (current: number[]) => {
      const next = [...current, Math.floor(Math.random() * pads)];
      setPattern(next);
      show(next);
    },
    [show, pads],
  );

  const start = useCallback(() => {
    setImproved(false);
    extend([]);
  }, [extend]);

  function press(pad: number) {
    if (phase !== "yours") return;

    // Brief acknowledgement so a press feels like it landed.
    setLit(pad);
    timers.current.push(setTimeout(() => setLit(null), 160));

    if (pattern[step] !== pad) {
      setPhase("over");
      // The score is the length you completed, so getting the 5th wrong scores 4.
      setImproved(api.finish(pattern.length - 1, false).improved);
      return;
    }

    if (step + 1 === pattern.length) {
      if (pattern.length >= target) {
        setPhase("cleared");
        setImproved(api.finish(pattern.length).improved);
        return;
      }
      timers.current.push(setTimeout(() => extend(pattern), 550));
      return;
    }
    setStep(step + 1);
  }

  const status =
    phase === "showing"
      ? "Watch…"
      : phase === "yours"
        ? `Your turn — ${pattern.length} to repeat`
        : phase === "over"
          ? "Not that one."
          : phase === "cleared"
            ? `${pattern.length} in a row.`
            : "Press start when you're ready.";

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {status}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PADS.slice(0, pads).map((pad, index) => {
          const active = lit === index;
          return (
            <button
              key={pad.name}
              type="button"
              onClick={() => press(index)}
              disabled={phase !== "yours"}
              aria-label={pad.name}
              className="flex aspect-[3/2] flex-col items-center justify-center gap-1 rounded-2xl border-2 text-3xl font-semibold transition-all"
              style={{
                background: active ? pad.color : "var(--surface)",
                borderColor: pad.color,
                color: active ? "#fff" : pad.color,
                transform: active ? "scale(0.97)" : "scale(1)",
                cursor: phase === "yours" ? "pointer" : "default",
              }}
            >
              <span aria-hidden="true">{pad.shape}</span>
              <span className="text-xs tracking-wide uppercase">{pad.name}</span>
            </button>
          );
        })}
      </div>

      {phase === "over" ? (
        <Finished
          headline={`You got ${pattern.length - 1} in a row.`}
          detail={`This level asks for ${target}. Most people plateau around six — it's a real limit, not a lack of trying.`}
          improved={improved}
          onAgain={api.again}
        />
      ) : (
        phase === "idle" && (
          <button type="button" onClick={start} className="eu-btn eu-btn-primary mt-4">
            Start
          </button>
        )
      )}
    </>
  );
}
