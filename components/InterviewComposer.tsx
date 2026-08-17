"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { createInterview, type InterviewState } from "@/lib/actions/interviews";
import { MAX_INTERVIEW_QUESTIONS, VISIBILITY, VISIBILITY_HELP, VISIBILITY_LABEL } from "@/lib/constants";

/**
 * Opening an interview.
 *
 * The question boxes appear one at a time rather than as three empty fields. Three blank
 * boxes read as a form with three things owed; one box with "add another question"
 * underneath reads as permission to ask just the one — which is usually the better
 * interview anyway.
 */
export function InterviewComposer() {
  const [state, action, pending] = useActionState<InterviewState, FormData>(createInterview, {});
  const [count, setCount] = useState(1);
  const [visibility, setVisibility] = useState<string>("PUBLIC");

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="eu-card flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">What are you asking about?</span>
          <input
            name="title"
            required
            maxLength={200}
            placeholder="What did you want to be when you were seven?"
            className="eu-field w-full"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-semibold">Why you&apos;re asking</span>
          <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Optional. A line or two of context, so people know what you&apos;re hoping to hear.
          </span>
          <textarea name="body" rows={3} maxLength={20_000} className="eu-field w-full resize-y" />
        </label>
      </div>

      <div className="eu-card flex flex-col gap-4 p-5">
        <div>
          <p className="font-semibold">Your questions</p>
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            Up to {MAX_INTERVIEW_QUESTIONS}. You can add another round later, and everything
            you ask stays open for answers.
          </p>
        </div>

        {Array.from({ length: count }, (_, i) => (
          <label key={i} className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
              Question {i + 1}
            </span>
            <input
              name={`question${i}`}
              required={i === 0}
              maxLength={300}
              placeholder={
                i === 0 ? "Ask the thing you actually want to know." : "Another question, if you have one."
              }
              className="eu-field w-full"
            />
          </label>
        ))}

        {count < MAX_INTERVIEW_QUESTIONS && (
          <button
            type="button"
            onClick={() => setCount((n) => n + 1)}
            className="self-start text-sm font-semibold"
            style={{ color: "var(--accent)" }}
          >
            + Add another question
          </button>
        )}
      </div>

      <fieldset className="eu-card flex flex-col gap-3 p-5">
        <legend className="font-semibold">Who can answer?</legend>
        {VISIBILITY.map((option) => (
          <label key={option} className="flex items-start gap-2.5">
            <input
              type="radio"
              name="visibility"
              value={option}
              checked={visibility === option}
              onChange={() => setVisibility(option)}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold">{VISIBILITY_LABEL[option]}</span>
              <span className="block text-sm" style={{ color: "var(--ink-muted)" }}>
                {option === "PRIVATE"
                  ? "Nobody can answer an interview only you can see."
                  : VISIBILITY_HELP[option]}
              </span>
            </span>
          </label>
        ))}

        {visibility === "PRIVATE" && (
          <p
            role="status"
            className="rounded-xl p-3 text-sm"
            style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
          >
            An interview kept to yourself can&apos;t be answered by anyone. Choose Everyone or
            My circle if you want replies.
          </p>
        )}
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Opening…" : "Open the interview"}
        </button>
        <Link href="/interviews" className="eu-btn eu-btn-quiet">
          Cancel
        </Link>
      </div>
    </form>
  );
}
