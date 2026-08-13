"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Small pieces shared by several games, so twenty games don't become twenty slightly
 * different clocks and twenty slightly different grids.
 */

/**
 * Seconds since the game started, ticking while `running`.
 *
 * A clock is a gentler score than a limit: it measures what you did rather than cutting
 * you off, and nothing here ever runs out of time on a child mid-thought.
 */
export function useElapsed(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    if (started.current === null) started.current = Date.now();

    const id = setInterval(() => {
      if (started.current !== null) {
        setSeconds(Math.floor((Date.now() - started.current) / 1000));
      }
    }, 500);

    return () => clearInterval(id);
  }, [running]);

  return seconds;
}

export function Clock({ seconds, extra }: { seconds: number; extra?: string }) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <p className="mb-3 text-sm" style={{ color: "var(--ink-muted)" }} aria-live="off">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
      {extra ? ` · ${extra}` : ""}
    </p>
  );
}

/** A square-celled grid that stays square whatever the board size. */
export function Grid({
  columns,
  children,
  label,
  max = "26rem",
  gap = "0.4rem",
}: {
  columns: number;
  children: React.ReactNode;
  label: string;
  max?: string;
  gap?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="mx-auto grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        maxWidth: max,
        gap,
      }}
    >
      {children}
    </div>
  );
}

/** The standard cell: square, bordered, tappable. */
export function Cell({
  onClick,
  disabled,
  label,
  children,
  background = "var(--surface)",
  border = "var(--line)",
  color = "var(--ink)",
  bold = false,
}: {
  onClick?: () => void;
  disabled?: boolean;
  label: string;
  children?: React.ReactNode;
  background?: string;
  border?: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex aspect-square items-center justify-center rounded-lg border-2 text-lg transition-colors disabled:cursor-default sm:text-xl"
      style={{ background, borderColor: border, color, fontWeight: bold ? 700 : 500 }}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
