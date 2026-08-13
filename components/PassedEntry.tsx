"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { removeFromPassed } from "@/lib/actions/reactions";

/**
 * Wraps one card on someone's own "Passed" shelf with a way to take it off again.
 *
 * Only ever rendered by the profile page when the viewer IS the shelf's owner — a visitor
 * to someone else's profile gets the plain post card from PostCard with no wrapper at
 * all, so there is no button here for them to find or force. The server action this calls
 * is scoped the same way regardless, but the control not existing on the page is the
 * first line of "visiting isn't the same as being let in."
 */
export function PassedEntry({ postId, children }: { postId: string; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);

  if (removed) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {children}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // Gone from the list immediately — there's nothing to confirm here, since
          // passing it on again later is one tap away on the post itself. The refresh
          // after it lands is just for the tab's count badge, which otherwise stays
          // stale until the next full navigation.
          setRemoved(true);
          startTransition(async () => {
            await removeFromPassed(postId);
            router.refresh();
          });
        }}
        className="self-start px-2 text-xs font-semibold"
        style={{ color: "var(--ink-faint)" }}
      >
        Take this off your Passed shelf
      </button>
    </div>
  );
}
