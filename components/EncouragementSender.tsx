"use client";

import { useState, useTransition } from "react";

import { sendEncouragement } from "@/lib/actions/reactions";

/**
 * What replaces the comment box.
 *
 * The note goes to the author and nobody else — it never appears on the idea, so it can't
 * become a thread, a pile-on, or a performance for other readers. For authors under 16 the
 * free-text box isn't rendered at all and only the phrase bank is available, so no stranger
 * can write anything unvetted to a child.
 */
export function EncouragementSender({
  postId,
  presets,
  allowFreeText,
}: {
  postId: string;
  presets: Array<{ id: string; text: string }>;
  allowFreeText: boolean;
}) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function send(input: { presetId?: string; body?: string }) {
    setError(null);
    startTransition(async () => {
      const result = await sendEncouragement(postId, input);
      if (result.sent) setSent(true);
      else setError(result.error ?? "That didn't send.");
    });
  }

  if (sent) {
    return (
      <div
        className="rounded-xl px-4 py-4 text-sm"
        style={{ background: "var(--growth-soft)", color: "var(--growth)" }}
      >
        Sent. Only they will see it.
      </div>
    );
  }

  return (
    <div className="eu-card p-5">
      <h2 className="font-display text-lg font-semibold">Send them a note</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
        Only the person who made this will see it. It won&apos;t appear on the idea.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {presets.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => send({ presetId: preset.id })}
              className="rounded-full border px-3 py-2 text-sm transition-colors"
              style={{ background: "var(--surface-sunken)" }}
            >
              {preset.text}
            </button>
          </li>
        ))}
      </ul>

      {allowFreeText && (
        <div className="mt-4 flex flex-col gap-2">
          <label htmlFor="note" className="text-sm font-semibold">
            Or write your own
          </label>
          <textarea
            id="note"
            rows={3}
            maxLength={500}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="eu-field resize-y"
            placeholder="Say what this made you think…"
          />
          <button
            type="button"
            className="eu-btn eu-btn-quiet self-start"
            disabled={pending || body.trim().length === 0}
            onClick={() => send({ body })}
          >
            Send privately
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm" style={{ color: "var(--love-strong)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
