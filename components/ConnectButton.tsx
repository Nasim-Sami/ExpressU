"use client";

import { useState, useTransition } from "react";

import { requestConnection } from "@/lib/actions/connections";

export function ConnectButton({
  targetId,
  status,
  incoming,
}: {
  targetId: string;
  status: string | null;
  incoming: boolean;
}) {
  const [state, setState] = useState(status);
  const [pending, startTransition] = useTransition();

  if (state === "ACCEPTED") {
    return (
      <span className="eu-btn eu-btn-quiet" style={{ cursor: "default" }}>
        In your circle
      </span>
    );
  }

  if (state === "PENDING" && !incoming) {
    return (
      <span className="eu-btn eu-btn-quiet" style={{ cursor: "default" }}>
        Asked
      </span>
    );
  }

  const label = state === "PENDING" && incoming ? "Accept" : "Add to circle";

  return (
    <button
      type="button"
      className="eu-btn eu-btn-primary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await requestConnection(targetId);
          setState(incoming ? "ACCEPTED" : "PENDING");
        })
      }
    >
      {pending ? "…" : label}
    </button>
  );
}
