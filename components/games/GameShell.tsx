"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  forgetGame,
  markCleared,
  readBest,
  readCleared,
  readOpenAll,
  writeBest,
  writeOpenAll,
  type GameMeta,
} from "@/lib/games";

export interface GameApi {
  /** The level being played, 1-based. */
  level: number;
  /**
   * Report a finished attempt: records the score for this level, and unless you say
   * otherwise, counts the level as done and offers the next one.
   */
  finish: (score: number, cleared?: boolean) => { improved: boolean };
  /** Move on, for games that want their own "next" button. */
  next: () => void;
  /** Restart this level from scratch. Remounts the game, so no state survives. */
  again: () => void;
}

/**
 * The frame around every game: which level, your own best on it, and a way to start again.
 *
 * Note what a game screen does NOT have — no rank, no comparison to anyone, no "you beat
 * 62% of players". Your best is yours and is shown only to you, which is the same promise
 * the rest of the platform makes about love counts.
 */
export function GameShell({
  meta,
  children,
  /** Optional per-level line explaining what finishing this level means. */
  goal,
}: {
  meta: GameMeta;
  children: (api: GameApi) => React.ReactNode;
  goal?: (level: number) => string;
}) {
  const [level, setLevel] = useState(1);
  const [cleared, setCleared] = useState(0);
  const [openAll, setOpenAll] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  // Bumped to remount the game, which is how "Again" resets it without every game
  // having to implement its own teardown.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const done = readCleared(meta.slug);
    setCleared(done);
    setOpenAll(readOpenAll(meta.slug));
    // Drop you where you got to, rather than making you click through what you've
    // already finished.
    setLevel(Math.min(done + 1, meta.levels));
    setLoaded(true);
  }, [meta.slug, meta.levels]);

  useEffect(() => {
    setBest(readBest(meta.slug, level));
    setJustCleared(false);
  }, [meta.slug, level, attempt]);

  const highestOpen = openAll ? meta.levels : Math.min(cleared + 1, meta.levels);

  const finish = useCallback<GameApi["finish"]>(
    (score, didClear = true) => {
      const improved = writeBest(meta.slug, level, score, meta.direction);
      if (improved) setBest(score);
      if (didClear) {
        if (markCleared(meta.slug, level)) setCleared(level);
        setJustCleared(true);
      }
      return { improved };
    },
    [meta.slug, meta.direction, level],
  );

  const next = useCallback(() => {
    setLevel((current) => Math.min(current + 1, meta.levels));
    setAttempt((n) => n + 1);
  }, [meta.levels]);

  const again = useCallback(() => setAttempt((n) => n + 1), []);

  const api: GameApi = { level, finish, next, again };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-4">
        <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--accent)" }}>
          {meta.skill}
        </p>
        <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold">
          <span aria-hidden="true">{meta.glyph}</span>
          {meta.name}
        </h1>
        <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
          {meta.blurb}
        </p>
      </header>

      {loaded && (
        <LevelStrip
          levels={meta.levels}
          level={level}
          cleared={cleared}
          highestOpen={highestOpen}
          onPick={(next) => {
            setLevel(next);
            setAttempt((n) => n + 1);
          }}
        />
      )}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-display text-lg font-semibold">Level {level}</p>
        {goal && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {goal(level)}
          </p>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-faint)" }}
        >
          Start this one again
        </button>
      </div>

      {/* Remounting on level or attempt change means a game never has to clean up after
          itself — it simply starts fresh. */}
      <div key={`${level}-${attempt}`} className="mt-4">
        {children(api)}
      </div>

      {justCleared && level < meta.levels && (
        <div
          role="status"
          className="mt-4 flex flex-wrap items-center gap-3 rounded-xl p-4"
          style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
        >
          <p className="min-w-0 flex-1 font-semibold">Level {level} done.</p>
          <button type="button" onClick={next} className="eu-btn eu-btn-primary">
            Level {level + 1} →
          </button>
        </div>
      )}

      {justCleared && level === meta.levels && (
        <div
          role="status"
          className="mt-4 rounded-xl p-4"
          style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
        >
          <p className="font-semibold">That&apos;s all twenty — or as far as this one goes.</p>
          <p className="text-sm">
            You can play any of them again, and there&apos;s nobody to tell about it.{" "}
            <Link href="/play" className="font-semibold underline">
              Try a different game
            </Link>
            .
          </p>
        </div>
      )}

      <section
        className="eu-card mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm"
        aria-live="polite"
      >
        <span className="font-semibold">Your best on level {level}</span>
        <span style={{ color: "var(--ink-muted)" }}>
          {!loaded ? "…" : best === null ? "Nothing yet — have a go." : `${best} ${meta.unit}`}
        </span>

        <span className="flex-1" />

        <label className="flex items-center gap-2" style={{ color: "var(--ink-muted)" }}>
          <input
            type="checkbox"
            checked={openAll}
            onChange={(event) => {
              setOpenAll(event.target.checked);
              writeOpenAll(meta.slug, event.target.checked);
            }}
          />
          Open every level
        </label>

        {(best !== null || cleared > 0) && (
          <button
            type="button"
            onClick={() => {
              forgetGame(meta.slug, meta.levels);
              setBest(null);
              setCleared(0);
              setOpenAll(false);
              setLevel(1);
              setAttempt((n) => n + 1);
            }}
            className="font-semibold"
            style={{ color: "var(--ink-faint)" }}
          >
            Forget it all
          </button>
        )}

        <p className="w-full text-xs" style={{ color: "var(--ink-faint)" }}>
          Kept on this device only. Nobody else can see it, and there is no scoreboard to
          be on.
        </p>
      </section>
    </div>
  );
}

function LevelStrip({
  levels,
  level,
  cleared,
  highestOpen,
  onPick,
}: {
  levels: number;
  level: number;
  cleared: number;
  highestOpen: number;
  onPick: (level: number) => void;
}) {
  return (
    <nav aria-label="Levels" className="flex flex-wrap gap-1.5">
      {Array.from({ length: levels }, (_, index) => index + 1).map((n) => {
        const done = n <= cleared;
        const open = n <= highestOpen;
        const active = n === level;

        return (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            disabled={!open}
            aria-current={active ? "true" : undefined}
            aria-label={`Level ${n}${done ? ", finished" : open ? "" : ", not open yet"}`}
            className="h-8 w-8 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed"
            style={{
              background: active ? "var(--accent)" : done ? "var(--growth-soft)" : "var(--surface-sunken)",
              color: active ? "var(--on-accent)" : done ? "var(--growth)" : "var(--ink-faint)",
              opacity: open ? 1 : 0.4,
            }}
          >
            {n}
          </button>
        );
      })}
    </nav>
  );
}

/** Shared "you finished" panel, so every game announces a result the same way. */
export function Finished({
  headline,
  detail,
  improved,
  onAgain,
}: {
  headline: string;
  detail?: string;
  improved: boolean;
  onAgain: () => void;
}) {
  return (
    <div
      role="status"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-xl p-4"
      style={{ background: "var(--surface-sunken)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{headline}</p>
        {detail && (
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            {detail}
          </p>
        )}
        {improved && (
          <p className="text-sm" style={{ color: "var(--growth)" }}>
            That&apos;s your best yet on this level.
          </p>
        )}
      </div>
      <button type="button" onClick={onAgain} className="eu-btn eu-btn-quiet">
        Again
      </button>
    </div>
  );
}
