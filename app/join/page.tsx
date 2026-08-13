"use client";

import Link from "next/link";
import { useActionState } from "react";

import { join, type FormState } from "@/lib/actions/auth";
import { LogoMark } from "@/components/Logo";

const initial: FormState = {};

export default function JoinPage() {
  const [state, action, pending] = useActionState(join, initial);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <LogoMark className="mb-5 h-10 w-10" />

      <h1 className="text-3xl font-semibold">Say the idea.</h1>
      <p className="mt-3 text-[1.05rem]" style={{ color: "var(--ink-muted)" }}>
        ExpressU is for the things you make and the things you wonder about. Nobody scores
        them, nobody comments on them, and nothing here decides whether your idea is
        realistic. You choose who sees each one.
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <Field label="What should we call you?" name="displayName" autoComplete="name" required />

        <Field
          label="Pick a handle"
          name="handle"
          hint="Lowercase letters, numbers and underscores. This is the @name on your ideas."
          autoComplete="username"
          required
        />

        <Field label="Email" name="email" type="email" autoComplete="email" required />

        <Field
          label="Password"
          name="password"
          type="password"
          hint="At least 8 characters."
          autoComplete="new-password"
          required
        />

        <Field
          label="What year were you born?"
          name="birthYear"
          type="number"
          hint="We ask only this — never your full date of birth. It sets how other people are allowed to write to you."
          required
        />

        {state.error && (
          <p
            role="alert"
            className="rounded-xl px-4 py-3 text-sm"
            style={{ background: "var(--love-soft)", color: "var(--love-strong)" }}
          >
            {state.error}
          </p>
        )}

        <button type="submit" className="eu-btn eu-btn-primary mt-2" disabled={pending}>
          {pending ? "Setting things up…" : "Create my account"}
        </button>
      </form>

      <p className="mt-6 text-sm" style={{ color: "var(--ink-muted)" }}>
        Already here?{" "}
        <Link href="/login" className="font-semibold underline" style={{ color: "var(--accent)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  type = "text",
  ...rest
}: {
  label: string;
  name: string;
  hint?: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-sm" style={{ color: "var(--ink-muted)" }}>
          {hint}
        </p>
      )}
      <input id={name} name={name} type={type} className="eu-field" aria-describedby={hintId} {...rest} />
    </div>
  );
}
