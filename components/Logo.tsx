/**
 * The ExpressU mark: a sprout breaking out of a seed.
 *
 * LinkedIn's "in" square is a credential — a badge saying you belong to a profession.
 * This is the opposite claim: something small that has only just started, and is allowed
 * to be unfinished. The seed stays visible under the stem on purpose, because the first
 * idea matters as much as what it grows into.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label="ExpressU"
      fill="none"
    >
      {/* the seed it came from */}
      <ellipse cx="12" cy="20.4" rx="3.6" ry="2.1" fill="currentColor" opacity="0.28" />
      {/* stem */}
      <path
        d="M12 20.6V10.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      {/* left leaf, still unfurling */}
      <path
        d="M12 15.6c-3.5-.1-6.2-2.7-6.4-6.1 3.5-.4 6.2 2.2 6.4 6.1z"
        fill="currentColor"
        opacity="0.62"
      />
      {/* right leaf, open to the light */}
      <path
        d="M12 12.1c.2-4.2 3.2-7.4 7.1-7.5.2 4.2-2.9 7.4-7.1 7.5z"
        fill="currentColor"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7 shrink-0" />
      {/* On a phone the mark carries the identity on its own — the name would crowd out
          the navigation, and reaching your own ideas matters more than branding. */}
      <span
        className="hidden font-display text-[1.35rem] font-semibold tracking-tight sm:inline"
        style={{ color: "var(--ink)" }}
      >
        Express<span style={{ color: "var(--accent)" }}>U</span>
      </span>
    </span>
  );
}
