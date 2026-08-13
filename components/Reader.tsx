"use client";

import { useEffect, useState } from "react";

/**
 * The page itself, and the controls that change how it reads.
 *
 * Type size and line width are kept on the device and applied to every book. A child who
 * needs bigger text needs it in every book, not once; asking again each time is the kind
 * of small friction that quietly decides who keeps reading.
 */
const SIZES = [
  { label: "Small", value: 1 },
  { label: "Medium", value: 1.25 },
  { label: "Large", value: 1.5 },
  { label: "Largest", value: 1.9 },
];

const KEY = "expressu-reader-size";

export function Reader({ text, language }: { text: string; language: string }) {
  const [size, setSize] = useState(1.25);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(KEY));
      if (Number.isFinite(stored) && stored > 0) setSize(stored);
    } catch {
      /* storage unavailable — the default is fine */
    }
    setLoaded(true);
  }, []);

  function choose(value: number) {
    setSize(value);
    try {
      window.localStorage.setItem(KEY, String(value));
    } catch {
      /* nothing to do */
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--ink-faint)" }}>
          Text size
        </span>
        {SIZES.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => choose(option.value)}
            aria-pressed={size === option.value}
            className="rounded-full border px-3 py-1 text-sm font-semibold transition-colors"
            style={{
              background: size === option.value ? "var(--accent)" : "transparent",
              color: size === option.value ? "var(--on-accent)" : "var(--ink-muted)",
              borderColor: size === option.value ? "var(--accent)" : "var(--line)",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <article
        lang={language}
        className="whitespace-pre-wrap"
        style={{
          // Applied only once the stored size is known, so the text doesn't visibly jump
          // from the default to the reader's own setting on every page turn.
          fontSize: loaded ? `${size}rem` : undefined,
          lineHeight: 1.85,
          // Bengali conjuncts need more vertical room than Latin text at the same size.
          fontFamily: language === "bn" ? "var(--font-bengali, inherit)" : "inherit",
        }}
      >
        {text}
      </article>
    </>
  );
}
