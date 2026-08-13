"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { KindIcon } from "./KindIcon";
import { KIND_COPY, POST_KIND } from "@/lib/constants";

/**
 * The "Share" button in the top bar, opening onto all four kinds.
 *
 * A plain `<details>` would be simpler, but this needs to close on Escape and on an
 * outside click for the keyboard and touch cases to feel right, so it's a small amount of
 * state rather than a hack.
 */
export function ShareMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative ml-1" ref={ref}>
      {/* On a phone this collapses to a round "+" — the full label plus five nav icons
          and an avatar does not fit in 375px, and what gets pushed off the edge is the
          way back to your own profile. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Share something"
        className="eu-btn eu-btn-primary aspect-square w-11 whitespace-nowrap px-0 sm:aspect-auto sm:w-auto sm:px-5"
      >
        <span className="hidden sm:inline">Share</span>
        <svg viewBox="0 0 24 24" className="hidden h-4 w-4 sm:block" fill="none" aria-hidden="true">
          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:hidden" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="What would you like to share?"
          className="eu-card absolute right-0 z-50 mt-2 w-64 overflow-hidden p-1.5"
        >
          {POST_KIND.map((kind) => {
            const copy = KIND_COPY[kind];
            return (
              <Link
                key={kind}
                role="menuitem"
                href={`/compose/${copy.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <KindIcon kind={kind} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{copy.action}</span>
                  <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                    {copy.entryPlural} build up over time
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
