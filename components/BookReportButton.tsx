"use client";

import { useState } from "react";

import { reportBook } from "@/lib/actions/books";

/**
 * Reporting a book.
 *
 * Same shape as reporting a post — a short reason list, no public signal, and no way for
 * the uploader to learn who reported them — with one difference: the description isn't
 * optional here. A book is thousands of words, and "explicit content" without "on page
 * 40" leaves a person reading the whole thing to find out what you meant.
 */
const REASONS = [
  { value: "explicit", label: "Sexual or explicit writing" },
  { value: "violence", label: "Violence, or something frightening for the age it's aimed at" },
  { value: "hate", label: "Hateful or cruel about a group of people" },
  { value: "stolen", label: "This is someone else's book, put here without permission" },
  { value: "age", label: "It's on the wrong shelf for the age it says" },
  { value: "spam", label: "Not a book — spam or an advert" },
  { value: "other", label: "Something else" },
];

export function BookReportButton({
  bookId,
  title,
  signedIn,
}: {
  bookId: string;
  title: string;
  signedIn: boolean;
}) {
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
        Thank you — a person will read this. Whoever added the book won&apos;t know it was you.
      </p>
    );
  }

  if (!signedIn) {
    return (
      <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
        Sign in to report a book.
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
        Report this book
      </button>
    );
  }

  async function send() {
    if (!reason) {
      setError("Pick what's wrong so we know what we're looking at.");
      return;
    }
    if (detail.trim().length < 3) {
      setError("Say a bit about what you saw — a page number helps most of all.");
      return;
    }

    setSending(true);
    setError(null);

    const label = REASONS.find((r) => r.value === reason)?.label ?? reason;
    const result = await reportBook(bookId, `${label} — ${detail.trim()}`);

    setSending(false);
    if (result.sent) setSent(true);
    else setError(result.error ?? "That didn't send. Try again in a moment.");
  }

  return (
    <div className="eu-card flex w-full flex-col gap-3 p-4">
      <div>
        <p className="font-semibold">What&apos;s wrong with “{title}”?</p>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          This goes to a person on our team. The book stays where it is until they&apos;ve
          read it themselves.
        </p>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">Reason</legend>
        {REASONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2.5 text-sm">
            <input
              type="radio"
              name="book-report-reason"
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
        rows={3}
        placeholder="What did you see, and roughly where? A page number helps a lot."
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        maxLength={2000}
        aria-label="What did you see, and where"
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
