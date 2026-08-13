"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { uploadBook, type BookFormState } from "@/lib/actions/books";

/**
 * Putting a book on the shelf.
 *
 * Two ways in, side by side and equally weighted: upload a file, or type the story
 * straight in. The second matters more than it looks — a child who has written a story in
 * a notebook has no PDF, and making "upload a file" the only door would quietly turn this
 * into a shelf for adults with computers.
 */
export function BookUploader() {
  const [state, action, pending] = useActionState<BookFormState, FormData>(uploadBook, {});
  const [mode, setMode] = useState<"file" | "type">("file");
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="eu-card flex flex-col gap-4 p-5">
        <Field label="What's it called?" htmlFor="title">
          <input id="title" name="title" required maxLength={200} className="eu-field w-full" />
        </Field>

        <Field label="Who wrote it?" htmlFor="author" hint="Your own name, if it's yours.">
          <input id="author" name="author" required maxLength={200} className="eu-field w-full" />
        </Field>

        <Field
          label="What's it about?"
          htmlFor="blurb"
          hint="A line or two, so someone browsing knows what they're picking up."
        >
          <textarea id="blurb" name="blurb" rows={2} maxLength={600} className="eu-field w-full resize-y" />
        </Field>

        <div className="flex flex-wrap gap-4">
          <Field label="Language" htmlFor="language">
            <select id="language" name="language" defaultValue="bn" className="eu-field">
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </Field>

          <Field label="Youngest reader" htmlFor="minAge">
            <input
              id="minAge"
              name="minAge"
              type="number"
              min={0}
              max={18}
              defaultValue={5}
              className="eu-field w-24"
            />
          </Field>

          <Field label="Oldest reader" htmlFor="maxAge">
            <input
              id="maxAge"
              name="maxAge"
              type="number"
              min={0}
              max={18}
              defaultValue={12}
              className="eu-field w-24"
            />
          </Field>
        </div>

        <Field label="Cover picture" htmlFor="cover" hint="Optional — we'll draw one if you don't.">
          <input id="cover" name="cover" type="file" accept="image/*" className="text-sm" />
        </Field>
      </div>

      <div className="eu-card flex flex-col gap-4 p-5">
        <div className="flex gap-2">
          <Toggle active={mode === "file"} onClick={() => setMode("file")}>
            Upload a file
          </Toggle>
          <Toggle active={mode === "type"} onClick={() => setMode("type")}>
            Type it in
          </Toggle>
        </div>

        {/* Both stay mounted: switching tabs must not throw away what someone typed. */}
        <div hidden={mode !== "file"}>
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="text-3xl" aria-hidden="true">
              📖
            </span>
            <span className="font-semibold">{fileName ?? "Choose a PDF, Word or text file"}</span>
            <span className="text-sm" style={{ color: "var(--ink-muted)" }}>
              We read the words out of it and lay it out as pages. A PDF that&apos;s a photo of
              printed pages won&apos;t work — there are no words in it for us to find.
            </span>
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,application/pdf,text/plain"
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </div>

        <div hidden={mode !== "type"}>
          <label htmlFor="text" className="mb-2 block font-semibold">
            The story
          </label>
          <textarea
            id="text"
            name="text"
            rows={14}
            className="eu-field w-full resize-y"
            placeholder={"Type or paste the whole story here.\n\nLeave a blank line between paragraphs — we use those to work out where the pages break."}
          />
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--love-strong)" }}>
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="eu-btn eu-btn-primary" disabled={pending}>
          {pending ? "Putting it on the shelf…" : "Add this book"}
        </button>
        <Link href="/read" className="eu-btn eu-btn-quiet">
          Cancel
        </Link>
      </div>

      <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
        Someone reads every book before it goes on the shelf, because children read them.
        You&apos;ll be able to read yours straight away, and we&apos;ll tell you when everyone
        else can too. Only add books you wrote, or ones old enough that anybody may share
        them.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-semibold">
        {label}
      </label>
      {hint && (
        <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full border px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        background: active ? "var(--accent)" : "transparent",
        color: active ? "var(--on-accent)" : "var(--ink-muted)",
        borderColor: active ? "var(--accent)" : "var(--line)",
      }}
    >
      {children}
    </button>
  );
}
