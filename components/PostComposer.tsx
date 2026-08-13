"use client";

import { useActionState, useState } from "react";

import { FilePicker } from "./FilePicker";
import { createPost, type ComposeState } from "@/lib/actions/posts";
import {
  HOBBY_OPTIONS,
  KIND_COPY,
  LETTER_RECIPIENTS,
  OTHER_HOBBY,
  VISIBILITY,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  type PostKind,
  type Visibility,
} from "@/lib/constants";

const initial: ComposeState = {};

/**
 * One composer for all four kinds.
 *
 * The shape is identical everywhere — a title, some words, whatever you've made, and who
 * gets to see it — because the four kinds really are the same act. Only the labels and a
 * couple of extra fields change, and those come from KIND_COPY rather than being
 * hard-coded here, so the wording stays in one place.
 */
export function PostComposer({ kind }: { kind: PostKind }) {
  const [state, action, pending] = useActionState(createPost, initial);
  const [visibility, setVisibility] = useState<Visibility>("PUBLIC");
  const [hobby, setHobby] = useState<string>("");

  const copy = KIND_COPY[kind];
  const isLetter = kind === "LETTER";
  const isHobby = kind === "HOBBY";

  return (
    <form action={action} className="eu-card flex flex-col gap-5 p-6">
      <input type="hidden" name="kind" value={kind} />

      {isHobby && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="hobbyName" className="font-semibold">
            Which hobby?
          </label>
          <select
            id="hobbyName"
            name="hobbyName"
            className="eu-field"
            value={hobby}
            onChange={(e) => setHobby(e.target.value)}
            required
          >
            <option value="" disabled>
              Choose one…
            </option>
            {HOBBY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          {/* A list that misses your hobby quietly says it doesn't count. */}
          {hobby === OTHER_HOBBY && (
            <input
              name="hobbyCustom"
              className="eu-field mt-2"
              placeholder="What's it called?"
              maxLength={60}
              required
            />
          )}
        </div>
      )}

      {isLetter && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="recipientType" className="font-semibold">
            Who is this going to?
          </label>
          <select id="recipientType" name="recipientType" className="eu-field" required defaultValue="">
            <option value="" disabled>
              Choose one…
            </option>
            {LETTER_RECIPIENTS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="font-semibold">
          {copy.titleLabel}
        </label>
        <input
          id="title"
          name="title"
          className="eu-field font-display text-lg"
          placeholder={copy.titlePlaceholder}
          maxLength={200}
          required
        />
      </div>

      {isLetter && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="letterTo" className="font-semibold">
              To
            </label>
            <input
              id="letterTo"
              name="letterTo"
              className="eu-field"
              placeholder="The Minister for Education"
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="letterSubject" className="font-semibold">
              Subject
            </label>
            <input
              id="letterSubject"
              name="letterSubject"
              className="eu-field"
              placeholder="The school library's opening hours"
              maxLength={200}
              required
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="font-semibold">
          {copy.bodyLabel}
        </label>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {copy.bodyHelp}
        </p>
        <textarea
          id="body"
          name="body"
          rows={isLetter ? 10 : 6}
          className="eu-field resize-y"
          placeholder={copy.bodyPlaceholder}
          maxLength={20_000}
        />
      </div>

      <FilePicker
        label={isLetter ? "Attachments" : "Add anything you've made"}
        help={
          isLetter
            ? "Anything that backs up what you're saying — photos, a recording, a document."
            : "Video, audio, images, PDFs, documents, text files. Up to 10 files."
        }
      />

      {/* Visibility — the promise, in plain words. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">Who can see this?</legend>
        <input type="hidden" name="visibility" value={visibility} />
        <div className="flex flex-col gap-2 sm:flex-row">
          {VISIBILITY.map((option) => {
            const active = visibility === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setVisibility(option)}
                aria-pressed={active}
                className="flex-1 rounded-xl border-2 p-3 text-left transition-colors"
                style={{
                  borderColor: active ? "var(--accent)" : "var(--line)",
                  background: active ? "var(--accent-soft)" : "transparent",
                }}
              >
                <span className="block font-semibold">{VISIBILITY_LABEL[option]}</span>
                <span className="block text-xs" style={{ color: "var(--ink-muted)" }}>
                  {VISIBILITY_HELP[option]}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          You can change this whenever you like, in either direction.
        </p>
      </fieldset>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
        >
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Sharing…" : "Share it"}
        </button>
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          No comments. No ranking. One heart, and only you see the count.
        </p>
      </div>
    </form>
  );
}
