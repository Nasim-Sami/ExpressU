"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "expressu-theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem(STORAGE_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.dataset.theme = next;
    }
  }

  const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label =
    theme === "light" ? "Light theme" : theme === "dark" ? "Dark theme" : "System theme";

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      title={`${label} — click to change`}
      aria-label={`${label}. Switch to ${next} theme.`}
      className="flex h-10 w-10 items-center justify-center rounded-full transition-colors"
      style={{ color: "var(--ink-muted)" }}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      ) : theme === "light" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.8v2M12 19.2v2M21.2 12h-2M4.8 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" />
          <path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
