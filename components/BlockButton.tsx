"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { blockUser } from "@/lib/actions/blocks";

/**
 * Blocking someone, from their profile.
 *
 * Deliberately quiet and secondary — it sits below the connect button in plain text, not
 * as a red button competing for attention. It also asks once before acting, because the
 * effect is broad (their posts vanish, yours vanish for them, any connection between you
 * is severed) and a mis-tap shouldn't do all that silently.
 */
export function BlockButton({
  targetId,
  displayName,
}: {
  targetId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm font-semibold"
        style={{ color: "var(--ink-faint)" }}
      >
        Block {displayName}
      </button>
    );
  }

  return (
    <div className="eu-card w-full max-w-md p-4">
      <p className="font-semibold">Block {displayName}?</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        <li>You won&apos;t see anything of theirs, and they won&apos;t see anything of yours.</li>
        <li>Neither of you will find the other by searching.</li>
        <li>If you&apos;re in each other&apos;s circle, that ends.</li>
        <li>They aren&apos;t told. You can undo this whenever you like.</li>
      </ul>

      {error && (
        <p role="alert" className="mt-2 text-sm" style={{ color: "var(--love-strong)" }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          className="eu-btn"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
          onClick={() =>
            startTransition(async () => {
              const result = await blockUser(targetId);
              if (!result.ok) {
                setError(result.error ?? "That didn't work. Try again in a moment.");
                return;
              }
              // Their profile is now a 404 for us, so there is nowhere to stay.
              router.push("/");
              router.refresh();
            })
          }
        >
          {pending ? "Blocking…" : "Block them"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
