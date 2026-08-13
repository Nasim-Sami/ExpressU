"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "./Avatar";
import { logout } from "@/lib/actions/auth";
import type { SessionUser } from "@/lib/auth";

/**
 * The avatar in the top bar, opened onto an account menu.
 *
 * Signing out has to live somewhere a signed-in person will actually find it, and it has
 * to be a real action — not a link, because ending a session is a write, not a navigation.
 * Same open/close behaviour as ShareMenu, so the two dropdowns in this bar act alike.
 */
export function AccountMenu({ user }: { user: SessionUser }) {
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
    <div className="relative ml-0.5 shrink-0 sm:ml-1" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.displayName}`}
        className="block rounded-full"
      >
        <Avatar user={user} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="eu-card absolute right-0 z-50 mt-2 w-56 overflow-hidden p-1.5"
        >
          <div className="px-3 py-2">
            <p className="truncate font-semibold">{user.displayName}</p>
            <p className="truncate text-sm" style={{ color: "var(--ink-muted)" }}>
              @{user.handle}
            </p>
          </div>

          <div className="my-1 border-t" style={{ borderColor: "var(--line)" }} />

          <Link
            role="menuitem"
            href={`/u/${user.handle}`}
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-sunken)]"
          >
            Your profile
          </Link>
          <Link
            role="menuitem"
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-sunken)]"
          >
            Edit profile
          </Link>
          {user.role === "ADMIN" && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2 text-sm font-semibold transition-colors hover:bg-[var(--surface-sunken)]"
            >
              Review queue
            </Link>
          )}

          <div className="my-1 border-t" style={{ borderColor: "var(--line)" }} />

          <form action={logout}>
            <button
              role="menuitem"
              type="submit"
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-sunken)]"
              style={{ color: "var(--love-strong)" }}
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
