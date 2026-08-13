import { VISIBILITY_LABEL, type Visibility } from "@/lib/constants";

/**
 * Shown to the author only, so they can see at a glance who each idea is reaching.
 * Plain words rather than icons — "Just me" is unambiguous in a way a padlock isn't.
 */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const tone: Record<Visibility, { bg: string; fg: string }> = {
    PUBLIC: { bg: "var(--growth-soft)", fg: "var(--growth)" },
    CIRCLE: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    PRIVATE: { bg: "var(--surface-sunken)", fg: "var(--ink-muted)" },
  };

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: tone[visibility].bg, color: tone[visibility].fg }}
    >
      {visibility === "PRIVATE" && <LockIcon />}
      {VISIBILITY_LABEL[visibility]}
    </span>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
