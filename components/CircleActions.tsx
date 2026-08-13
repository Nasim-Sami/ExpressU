"use client";

import { useState, useTransition } from "react";

import {
  acceptConnection,
  removeConnection,
  requestConnection,
} from "@/lib/actions/connections";

export function CircleActions({
  targetId,
  connectionId,
  mode,
}: {
  targetId: string;
  connectionId?: string;
  mode: "accept" | "remove" | "pending" | "add";
}) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Done
      </span>
    );
  }

  if (mode === "pending") {
    return (
      <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Asked
      </span>
    );
  }

  const handlers = {
    accept: () => connectionId && acceptConnection(connectionId),
    remove: () => connectionId && removeConnection(connectionId),
    add: () => requestConnection(targetId),
  } as const;

  const labels = { accept: "Accept", remove: "Leave circle", add: "Add" } as const;
  const primary = mode !== "remove";

  return (
    <button
      type="button"
      disabled={pending}
      className={primary ? "eu-btn eu-btn-primary" : "eu-btn eu-btn-quiet"}
      style={{ minHeight: "2.25rem", fontSize: "0.875rem" }}
      onClick={() =>
        startTransition(async () => {
          await handlers[mode]();
          setDone(true);
        })
      }
    >
      {pending ? "…" : labels[mode]}
    </button>
  );
}
