import Link from "next/link";
import { Suspense } from "react";

import { Wordmark } from "./Logo";
import { AccountMenu } from "./AccountMenu";
import { SearchBar } from "./SearchBar";
import { ShareMenu } from "./ShareMenu";
import { ThemeToggle } from "./ThemeToggle";
import type { SessionUser } from "@/lib/auth";

/**
 * LinkedIn's persistent top bar, because the familiarity is genuinely useful — a young
 * person already knows how to read this shape, and it signals that ideas belong somewhere
 * serious. What's missing is the whole apparatus of assessment: no "who viewed you",
 * no connection count, no notification badge tallying your popularity.
 */
export function TopNav({ user }: { user: SessionUser | null }) {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ background: "color-mix(in srgb, var(--surface) 88%, transparent)" }}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center gap-0 px-2 sm:gap-3 sm:px-4"
      >
        <Link href="/" className="shrink-0" aria-label="ExpressU home">
          <Wordmark />
        </Link>

        {user ? (
          <>
            {/* The search field needs real width to be usable, and on a phone there isn't
                any next to five nav icons — so below md it collapses to its own icon that
                opens the full search page. */}
            <div className="hidden min-w-0 flex-1 md:flex md:max-w-xs">
              {/* Suspense because the box reads the query string to stay in step with the
                  results page, and this bar renders on every route including static ones. */}
              <Suspense fallback={<div className="eu-field flex-1" aria-hidden="true" />}>
                <SearchBar compact placeholder="Search ExpressU" live={false} />
              </Suspense>
            </div>
            <div className="flex-1 md:hidden" />
            <NavLink href="/search" label="Search" icon={<SearchIcon />} className="md:hidden" />

            {/* Icons stay on every screen size — on a phone this is the only way to reach
                Circle, Heard and News, and a young person's private notes shouldn't be
                unreachable on the device they actually use. Labels drop away below sm. */}
            <NavLink href="/" label="Home" icon={<HomeIcon />} />
            <NavLink href="/read" label="Read" icon={<BookIcon />} />
            <NavLink href="/play" label="Play" icon={<PlayIcon />} />
            <ThemeToggle />
            <ShareMenu />
            <AccountMenu user={user} />
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link href="/login" className="eu-btn eu-btn-quiet">
              Sign in
            </Link>
            <Link href="/join" className="eu-btn eu-btn-primary">
              Join
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  icon,
  className = "",
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      /*
       * Seven destinations plus the theme, share and avatar controls have to fit inside
       * 375px, so below sm the horizontal padding goes to nothing and the width drops to
       * 32px. The vertical padding grows to compensate: a 32×40 target is still
       * comfortably tappable, and height is the dimension that actually matters here.
       */
      className={`flex min-w-8 flex-col items-center justify-center rounded-lg px-0 py-2.5 text-[0.7rem] transition-colors sm:min-w-16 sm:px-2 sm:py-1 ${className}`}
      style={{ color: "var(--ink-muted)" }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

const iconProps = {
  viewBox: "0 0 24 24",
  className: "h-5 w-5",
  fill: "none",
  "aria-hidden": true,
} as const;

function SearchIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="6.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="m15.8 15.8 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M3.6 10.4 12 3.8l8.4 6.6V20a1 1 0 0 1-1 1h-4.6v-6h-5.6v6H4.6a1 1 0 0 1-1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A question mark — open interviews. */
function AskIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M9 8.6a3 3 0 1 1 4 2.8c-.9.3-1.4 1-1.4 1.9v.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="11.6" cy="18" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** An open book — the reading room. */
function BookIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M12 6.6C10.4 5.2 8.4 4.6 4.4 4.6v12.6c4 0 6 .6 7.6 2 1.6-1.4 3.6-2 7.6-2V4.6c-4 0-6 .6-7.6 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 6.6v12.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A puzzle piece — games and puzzles, not a media "play" triangle. */
function PlayIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M4 4.6h5.2a2.2 2.2 0 0 1 4.4 0H19v5.2a2.2 2.2 0 0 0 0 4.4V19.4h-5.4a2.2 2.2 0 0 0-4.4 0H4v-5.2a2.2 2.2 0 0 0 0-4.4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="9" cy="9.5" r="3.3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.4 19.4c.4-3 2.8-5 5.6-5s5.2 2 5.6 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 7.2a3 3 0 0 1 0 5.9M17.6 19.4c-.2-1.7-.9-3.1-2-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Private encouragements: an open envelope, not a speech bubble. Nobody speaks back publicly. */
function HeardIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M3.6 10.6 12 4.4l8.4 6.2V19a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="m3.8 10.8 8.2 5.6 8.2-5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M6.4 10a5.6 5.6 0 1 1 11.2 0c0 4 1.4 5.4 1.4 5.4H5s1.4-1.4 1.4-5.4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10.4 18.6a1.9 1.9 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
