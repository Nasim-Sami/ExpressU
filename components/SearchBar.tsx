"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The search box, used in the top bar, on `/search`, and inside each section.
 *
 * It is a real `<form method="get">` first and a live search second: typing navigates after
 * a pause, but pressing Enter works identically if the JavaScript hasn't loaded or has
 * failed. Search is how someone finds their way back to a thing they remember, and it
 * shouldn't be the part of the page that breaks on a slow phone.
 */
export function SearchBar({
  action = "/search",
  placeholder = "Search",
  defaultValue = "",
  hidden = {},
  live = true,
  autoFocus = false,
  compact = false,
  label = "Search",
}: {
  action?: string;
  placeholder?: string;
  defaultValue?: string;
  /** Extra query parameters to preserve, e.g. the section being searched. */
  hidden?: Record<string, string | undefined>;
  live?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  /*
   * Whenever this box points at the page you're already on, the URL wins over whatever is
   * sitting in React state. Without this the search field in the top bar keeps the last
   * thing typed into it while the results page shows something else entirely — two boxes
   * on screen disagreeing about what you searched for.
   */
  const current = pathname === action ? (params.get("q") ?? "") : defaultValue;

  const [value, setValue] = useState(current);
  const submitted = useRef(current);

  // Also covers going Back, and clicking a section tab: both change the URL without
  // remounting, and the box has to follow.
  useEffect(() => {
    setValue(current);
    submitted.current = current;
  }, [current]);

  const href = (query: string) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(hidden)) if (val) params.set(key, val);
    if (query.trim()) params.set("q", query.trim());
    const qs = params.toString();
    return qs ? `${action}?${qs}` : action;
  };

  useEffect(() => {
    if (!live) return;

    // Long enough that a child typing slowly isn't fighting the page reloading under
    // them, short enough that results feel like they're following along.
    const timer = setTimeout(() => {
      const next = value.trim();
      if (next === submitted.current.trim()) return;
      // Below two characters there are no results to fetch — but an emptied box must
      // still navigate, otherwise clearing it leaves the old results on screen.
      if (next.length === 1) return;
      submitted.current = next;
      router.replace(href(next), { scroll: false });
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, live]);

  return (
    <form
      action={action}
      method="get"
      role="search"
      className="relative flex-1"
      onSubmit={(event) => {
        // Handled client-side so a submit doesn't discard the React tree; the plain
        // form action still applies when this handler never runs.
        event.preventDefault();
        submitted.current = value.trim();
        router.push(href(value));
      }}
    >
      {Object.entries(hidden).map(([key, val]) =>
        val ? <input key={key} type="hidden" name={key} value={val} /> : null,
      )}

      <SearchIcon />

      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        autoComplete="off"
        className="eu-field w-full pl-9"
        style={compact ? { paddingTop: "0.45rem", paddingBottom: "0.45rem" } : undefined}
      />
    </form>
  );
}

function SearchIcon() {
  return (
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
  );
}
