"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { unblockUser } from "@/lib/actions/blocks";

/**
 * Undoing a block. No confirmation — unblocking restores nothing automatically (the
 * connection you had is not brought back), so there is nothing here to do by accident
 * that can't be redone in one tap.
 */
export function UnblockButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="eu-btn eu-btn-quiet"
      onClick={() =>
        startTransition(async () => {
          await unblockUser(targetId);
          router.refresh();
        })
      }
    >
      {pending ? "Unblocking…" : "Unblock"}
    </button>
  );
}
