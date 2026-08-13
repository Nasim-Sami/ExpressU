"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ranked } from "@/lib/fuzzy";
import { readCleared, type GameMeta } from "@/lib/games";

/**
 * The games list, with its own search.
 *
 * Filtering happens in the browser rather than on the server: the whole catalogue is a few
 * kilobytes of text that's already on the page, so a round-trip per keystroke would buy
 * nothing. It uses the same matcher as everything else, so "puzle" and "memry" behave here
 * exactly as they do in search.
 */
export function GameGrid({ games }: { games: GameMeta[] }) {
  const [query, setQuery] = useState("");
  const [cleared, setCleared] = useState<Record<string, number>>({});

  // localStorage is browser-only, so this is read after mount rather than during render —
  // otherwise the server and the browser disagree about what to paint.
  useEffect(() => {
    setCleared(Object.fromEntries(games.map((game) => [game.slug, readCleared(game.slug)])));
  }, [games]);

  const shown = useMemo(() => {
    if (query.trim().length < 2) return games;
    return ranked(
      query,
      games,
      (game) => [
        { text: game.name, weight: 1 },
        { text: game.skill, weight: 0.8 },
        { text: game.blurb, weight: 0.5 },
      ],
      games.length,
    );
  }, [query, games]);

  return (
    <>
      <div className="relative mt-5">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--ink-faint)" }}
        >
          <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.8" />
          <path d="m15.8 15.8 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search games — by name, or by what it stretches"
          aria-label="Search games and puzzles"
          autoComplete="off"
          className="eu-field w-full pl-9"
        />
      </div>

      {/* Announced politely so a screen-reader user knows the list changed under them. */}
      <p aria-live="polite" className="sr-only">
        {shown.length} {shown.length === 1 ? "game" : "games"} shown
      </p>

      {shown.length === 0 ? (
        <p className="eu-card mt-4 p-6 text-center" style={{ color: "var(--ink-muted)" }}>
          No game here by that name. Try “memory”, “logic”, or clear the box to see them all.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {shown.map((game) => (
            <li key={game.slug}>
              <Link
                href={`/play/${game.slug}`}
                className="eu-card flex h-full flex-col gap-2 p-5 transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden="true">
                    {game.glyph}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-semibold">{game.name}</span>
                    <span
                      className="block text-xs font-semibold tracking-wide uppercase"
                      style={{ color: "var(--accent)" }}
                    >
                      {game.skill}
                    </span>
                  </span>
                </span>
                <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {game.blurb}
                </span>

                {/* Where you're up to. Only ever your own — there is nobody to compare with. */}
                <span className="mt-auto flex items-center gap-2 pt-2 text-xs" style={{ color: "var(--ink-faint)" }}>
                  <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full"
                    style={{ background: "var(--surface-sunken)" }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${((cleared[game.slug] ?? 0) / game.levels) * 100}%`,
                        background: "var(--growth)",
                      }}
                    />
                  </span>
                  {cleared[game.slug]
                    ? `level ${cleared[game.slug]} of ${game.levels}`
                    : `${game.levels} levels`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
