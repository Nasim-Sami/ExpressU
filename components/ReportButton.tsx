"use client";

import { useState } from "react";

import { reportPost } from "@/lib/actions/appeals";

/**
 * Telling us something is wrong.
 *
 * This is the one place where a young person can act against someone else's post, and it
 * is built to be low-drama on purpose: a short menu of reasons, no free-text requirement,
 * no public signal, and no way for the author to learn who reported them. Reporting
 * someone shouldn't feel like starting a fight.
 *
 * It also can't be used as a weapon: a report hides nothing on its own. It opens an item
 * in the admin queue for a person to look at. Nobody is silenced by being disliked.
 */
const REASONS = [
  { value: "explicit", label: "Sexual or explicit content" },
  { value: "violence", label: "Violence or something frightening" },
  { value: "bullying", label: "Bullying, or aimed at hurting someone" },
  { value: "danger", label: "Someone might be in danger" },
  { value: "stolen", label: "This isn't theirs — it's someone else's work" },
  { value: "spam", label: "Spam or an advert" },
  { value: "other", label: "Something else" },
];

export function ReportButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p
        role="status"
        className="rounded-xl px-3 py-2 text-sm"
        style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
      >
        Thank you — a person will look at this. You won&apos;t hear anything back publicly,
        and the author won&apos;t know it was you.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-2 text-sm font-semibold"
        style={{ color: "var(--ink-faint)" }}
      >
        Report
      </button>
    );
  }

  async function send() {
    if (!reason) {
      setError("Pick what's wrong so we know what we're looking at.");
      return;
    }
    setSending(true);
    setError(null);

    const label = REASONS.find((r) => r.value === reason)?.label ?? reason;
    const result = await reportPost(postId, detail.trim() ? `${label} — ${detail.trim()}` : label);

    setSending(false);
    if (result.sent) setSent(true);
    else setError(result.error ?? "That didn't send. Try again in a moment.");
  }

  return (
    <div className="eu-card flex flex-col gap-3 p-4">
      <div>
        <p className="font-semibold">What&apos;s wrong with this?</p>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          This goes to a person on our team, not to the author. Nothing happens to their
          post automatically.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Reason</legend>
        {REASONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2.5 text-sm">
            <input
              type="radio"
              name="report-reason"
              value={option.value}
              checked={reason === option.value}
              onChange={() => setReason(option.value)}
              className="mt-1"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>

      <textarea
        className="eu-field resize-y text-sm"
        rows={2}
        placeholder="Anything else we should know? (optional)"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={1000}
        aria-label="Anything else we should know"
      />

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={send} className="eu-btn eu-btn-primary" disabled={sending}>
          {sending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
