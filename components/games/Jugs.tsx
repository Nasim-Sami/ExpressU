"use client";

import { useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { jugsMinPours, jugsSolvable } from "@/lib/puzzles";

/**
 * Picks a pair of jugs and an amount that is definitely measurable — checked against the
 * solver before it's ever shown, so no level here is a trick.
 */
function setup(level: number): { a: number; b: number; target: number; best: number } {
  const random = rng(seedFor("jugs", level));

  for (let attempt = 0; attempt < 400; attempt++) {
    const a = 3 + Math.floor(random() * (4 + level));
    const b = 3 + Math.floor(random() * (5 + level));
    if (a === b) continue;

    const target = 1 + Math.floor(random() * Math.max(a, b));
    if (!jugsSolvable(a, b, target)) continue;
    if (target === a || target === b) continue; // filling one jug isn't a puzzle

    const best = jugsMinPours(a, b, target)!;
    // Harder levels want a longer route; early ones should be short and winnable.
    const wanted = Math.min(3 + Math.floor(level / 2), 10);
    if (best < 3 || best > wanted) continue;

    return { a, b, target, best };
  }

  // The classic, as a guaranteed fallback.
  return { a: 3, b: 5, target: 4, best: jugsMinPours(3, 5, 4)! };
}

export function Jugs() {
  const meta = gameBySlug("jugs")!;

  return (
    <GameShell
      meta={meta}
      goal={(level) => {
        const { a, b, target } = setup(level);
        return `${a} and ${b} — measure exactly ${target}.`;
      }}
    >
      {(api) => <Table api={api} />}
    </GameShell>
  );
}

function Table({ api }: { api: GameApi }) {
  const { a, b, target, best } = setup(api.level);

  const [left, setLeft] = useState(0);
  const [right, setRight] = useState(0);
  const [pours, setPours] = useState(0);
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  function act(nextLeft: number, nextRight: number) {
    if (done) return;
    if (nextLeft === left && nextRight === right) return;

    const count = pours + 1;
    setLeft(nextLeft);
    setRight(nextRight);
    setPours(count);

    if (nextLeft === target || nextRight === target) {
      setDone(true);
      setImproved(api.finish(count).improved);
    }
  }

  const intoRight = Math.min(left, b - right);
  const intoLeft = Math.min(right, a - left);

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {pours} {pours === 1 ? "pour" : "pours"} · you need exactly {target}
      </p>

      <div className="flex items-end justify-center gap-8">
        <Jug size={a} amount={left} name="left" />
        <Jug size={b} amount={right} name="right" />
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Action onPress={() => act(a, right)} disabled={left === a}>
          Fill the {a}
        </Action>
        <Action onPress={() => act(left, b)} disabled={right === b}>
          Fill the {b}
        </Action>
        <Action onPress={() => act(0, right)} disabled={left === 0}>
          Empty the {a}
        </Action>
        <Action onPress={() => act(left, 0)} disabled={right === 0}>
          Empty the {b}
        </Action>
        <Action onPress={() => act(left - intoRight, right + intoRight)} disabled={intoRight === 0}>
          Pour {a} → {b}
        </Action>
        <Action onPress={() => act(left + intoLeft, right - intoLeft)} disabled={intoLeft === 0}>
          Pour {b} → {a}
        </Action>
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Neither jug has any markings. The only measurements you get are full, empty, and
        pouring one into the other until it stops.
      </p>

      {done && (
        <Finished
          headline={`Exactly ${target}, in ${pours} pours.`}
          detail={
            pours === best
              ? "The shortest way there. Nothing wasted."
              : `It can be done in ${best}.`
          }
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}

function Jug({ size, amount, name }: { size: number; amount: number; name: string }) {
  const height = 60 + size * 12;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label={`The ${name} jug holds ${size} and has ${amount} in it`}
        className="relative w-20 overflow-hidden rounded-b-xl border-2 border-t-0"
        style={{ height, borderColor: "var(--ink-muted)" }}
      >
        <div
          className="absolute inset-x-0 bottom-0 transition-all"
          style={{ height: `${(amount / size) * 100}%`, background: "var(--accent-soft)" }}
        />
        <span className="font-display absolute inset-x-0 bottom-2 text-center text-xl font-semibold">
          {amount}
        </span>
      </div>
      <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
        holds {size}
      </span>
    </div>
  );
}

function Action({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className="rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-35"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      {children}
    </button>
  );
}
