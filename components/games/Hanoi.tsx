"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug } from "@/lib/games";

/** Three discs at level 1, up to eight. The fewest possible moves is 2ⁿ − 1. */
function discsFor(level: number): number {
  return Math.min(8, 2 + Math.ceil(level / 3));
}

export function Hanoi() {
  const meta = gameBySlug("hanoi")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const discs = discsFor(level);
        return `${discs} discs — ${2 ** discs - 1} moves if you get it perfect.`;
      }}
    >
      {(api) => <Poles api={api} />}
    </GameShell>
  );
}

function Poles({ api }: { api: GameApi }) {
  const discs = discsFor(api.level);

  // Each pole is a stack, biggest at the bottom.
  const [poles, setPoles] = useState<number[][]>(() => [
    Array.from({ length: discs }, (_, i) => discs - i),
    [],
    [],
  ]);
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [improved, setImproved] = useState(false);

  const done = poles[2].length === discs;
  const best = 2 ** discs - 1;

  function tap(pole: number) {
    if (done) return;

    // Nothing in hand: pick up the top disc, if there is one.
    if (held === null) {
      if (poles[pole].length > 0) setHeld(pole);
      return;
    }

    if (held === pole) {
      setHeld(null);
      return;
    }

    const disc = poles[held][poles[held].length - 1];
    const target = poles[pole][poles[pole].length - 1];

    // The one rule.
    if (target !== undefined && target < disc) {
      setHeld(null);
      return;
    }

    const next = poles.map((stack) => [...stack]);
    next[held].pop();
    next[pole].push(disc);

    const count = moves + 1;
    setPoles(next);
    setHeld(null);
    setMoves(count);

    if (next[2].length === discs) setImproved(api.finish(count).improved);
  }

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {moves} {moves === 1 ? "move" : "moves"}
        {held !== null && " · carrying a disc"}
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {poles.map((stack, index) => (
          <button
            key={index}
            type="button"
            onClick={() => tap(index)}
            disabled={done}
            aria-label={`Pole ${index + 1}${index === 2 ? " (the one to fill)" : ""}: ${
              stack.length === 0 ? "empty" : `${stack.length} discs, smallest is ${stack[stack.length - 1]}`
            }`}
            className="flex flex-col-reverse items-center gap-1 rounded-xl border-2 p-2 pb-3 transition-colors"
            style={{
              minHeight: `${discs * 26 + 40}px`,
              borderColor: held === index ? "var(--accent)" : "var(--line)",
              background: index === 2 ? "var(--growth-soft)" : "var(--surface-sunken)",
            }}
          >
            {stack.map((disc, position) => {
              const lifted = held === index && position === stack.length - 1;
              return (
                <span
                  key={disc}
                  className="flex h-5 items-center justify-center rounded-md text-xs font-semibold"
                  style={{
                    width: `${30 + (disc / discs) * 65}%`,
                    background: lifted ? "var(--accent)" : "var(--accent-soft)",
                    color: lifted ? "var(--on-accent)" : "var(--accent)",
                    transform: lifted ? "translateY(-4px)" : undefined,
                  }}
                >
                  {disc}
                </span>
              );
            })}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--ink-faint)" }}>
        Tap a pole to pick up its top disc, then tap where it goes. The green pole on the
        right is the one to fill. A bigger disc never sits on a smaller one.
      </p>

      {done && (
        <Finished
          headline={`Moved in ${moves}.`}
          detail={
            moves === best
              ? "That's the fewest possible. There is no better."
              : `The fewest possible is ${best}. Every extra disc doubles it.`
          }
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}
