"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login, type FormState } from "@/lib/actions/auth";
import { LogoMark } from "@/components/Logo";

const initial: FormState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <LogoMark className="mb-5 h-10 w-10" />
      <h1 className="text-3xl font-semibold">Welcome back.</h1>
      <p className="mt-2" style={{ color: "var(--ink-muted)" }}>
        Your ideas are where you left them.
      </p>

      <form action={action} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-semibold">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className="eu-field" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="eu-field"
            required
          />
        </div>

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
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm" style={{ color: "var(--ink-muted)" }}>
        New here?{" "}
        <Link href="/join" className="font-semibold underline" style={{ color: "var(--accent)" }}>
          Make an account
        </Link>
      </p>
    </div>
  );
}
