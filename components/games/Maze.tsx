"use client";

import { useCallback, useEffect, useState } from "react";

import { Finished, GameShell, type GameApi } from "./GameShell";
import { gameBySlug, rng, seedFor } from "@/lib/games";
import { E, N, S, W, maze, mazePath } from "@/lib/puzzles";

/** From a gentle 5×5 up to 14×14. */
function sizeFor(level: number): number {
  return 4 + Math.floor(level / 2) + (level > 10 ? 2 : 0);
}

export function Maze() {
  const meta = gameBySlug("maze")!;

  return (
    <GameShell meta={meta} goal={(level) => `${sizeFor(level)} by ${sizeFor(level)}.`}>
      {(api) => <Board api={api} />}
    </GameShell>
  );
}

function Board({ api }: { api: GameApi }) {
  const size = sizeFor(api.level);
  const finish = size * size - 1;

  const [walls] = useState(() => maze(size, size, rng(seedFor("maze", api.level))));
  const [at, setAt] = useState(0);
  const [steps, setSteps] = useState(0);
  const [trail, setTrail] = useState<Set<number>>(() => new Set([0]));
  const [improved, setImproved] = useState(false);
  const [done, setDone] = useState(false);

  const shortest = mazePath(walls, size, size, 0, finish)?.length ?? 0;

  const move = useCallback(
    (dir: number) => {
      if (done) return;
      if (walls[at] & dir) return;

      const x = at % size;
      const y = Math.floor(at / size);
      const next =
        dir === N ? at - size : dir === S ? at + size : dir === E ? at + 1 : at - 1;

      if (dir === E && x === size - 1) return;
      if (dir === W && x === 0) return;
      if (dir === N && y === 0) return;
      if (dir === S && y === size - 1) return;

      setAt(next);
      setSteps((n) => n + 1);
      setTrail((current) => new Set(current).add(next));

      if (next === finish) {
        setDone(true);
        setImproved(api.finish(steps + 1).improved);
      }
    },
    [at, walls, size, done, finish, api, steps],
  );

  // Arrow keys and WASD, because a maze played only by tapping tiny squares on a phone is
  // fine but on a keyboard this is how everyone expects to move.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const dir =
        event.key === "ArrowUp" || event.key === "w"
          ? N
          : event.key === "ArrowDown" || event.key === "s"
            ? S
            : event.key === "ArrowLeft" || event.key === "a"
              ? W
              : event.key === "ArrowRight" || event.key === "d"
                ? E
                : null;
      if (dir === null) return;
      event.preventDefault();
      move(dir);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move]);

  const cellSize = Math.max(16, Math.min(34, Math.floor(340 / size)));

  return (
    <>
      <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="polite">
        {steps} {steps === 1 ? "step" : "steps"}
        {done && shortest > 0 && ` · shortest is ${shortest - 1}`}
      </p>

      <div
        className="mx-auto w-fit"
        role="img"
        aria-label={`Maze, ${size} by ${size}. You are ${Math.floor(at / size) + 1} down and ${(at % size) + 1} across.`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${size}, ${cellSize}px)`,
          background: "var(--surface)",
        }}
      >
        {walls.map((wall, index) => {
          const here = index === at;
          const end = index === finish;
          const walked = trail.has(index);

          return (
            <div
              key={index}
              style={{
                width: cellSize,
                height: cellSize,
                borderTop: wall & N ? "2px solid var(--ink)" : "2px solid transparent",
                borderRight: wall & E ? "2px solid var(--ink)" : "2px solid transparent",
                borderBottom: wall & S ? "2px solid var(--ink)" : "2px solid transparent",
                borderLeft: wall & W ? "2px solid var(--ink)" : "2px solid transparent",
                background: here
                  ? "var(--accent)"
                  : end
                    ? "var(--growth-soft)"
                    : walked
                      ? "var(--accent-soft)"
                      : "transparent",
              }}
            />
          );
        })}
      </div>

      {/* A d-pad, so this works on a phone as well as it does on a keyboard. */}
      <div className="mx-auto mt-4 grid w-40 grid-cols-3 gap-1">
        <span />
        <Pad label="Up" onPress={() => move(N)} blocked={Boolean(walls[at] & N)}>
          ↑
        </Pad>
        <span />
        <Pad label="Left" onPress={() => move(W)} blocked={Boolean(walls[at] & W)}>
          ←
        </Pad>
        <span />
        <Pad label="Right" onPress={() => move(E)} blocked={Boolean(walls[at] & E)}>
          →
        </Pad>
        <span />
        <Pad label="Down" onPress={() => move(S)} blocked={Boolean(walls[at] & S)}>
          ↓
        </Pad>
        <span />
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--ink-faint)" }}>
        Arrow keys, WASD, or the buttons. The green square is the way out.
      </p>

      {done && (
        <Finished
          headline={`Out in ${steps} steps.`}
          detail={
            shortest > 0 && steps === shortest - 1
              ? "Not a single wasted step."
              : "Every one of these has exactly one route between any two squares."
          }
          improved={improved}
          onAgain={api.again}
        />
      )}
    </>
  );
}

function Pad({
  label,
  onPress,
  blocked,
  children,
}: {
  label: string;
  onPress: () => void;
  blocked: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={blocked}
      aria-label={label}
      className="flex aspect-square items-center justify-center rounded-lg border-2 text-lg disabled:opacity-30"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
