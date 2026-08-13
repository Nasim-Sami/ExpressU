"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { endSession, hashPassword, startSession, verifyPassword } from "@/lib/auth";
import { liftExpiredSuspension } from "@/lib/moderation/strikes";

export interface FormState {
  error?: string;
}

const HANDLE = /^[a-z0-9_]{3,20}$/;

const joinSchema = z.object({
  displayName: z.string().trim().min(1, "Tell us what to call you.").max(60),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE, "Handles use 3–20 lowercase letters, numbers or underscores."),
  email: z.email("That doesn't look like an email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters — it keeps your ideas yours."),
  birthYear: z.coerce
    .number()
    .int()
    .min(1900)
    .max(new Date().getUTCFullYear(), "Check the year."),
});

export async function join(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Something in the form needs a look." };
  }

  const { displayName, handle, email, password, birthYear } = parsed.data;

  const clash = await db.user.findFirst({
    where: { OR: [{ handle }, { email }] },
    select: { handle: true, email: true },
  });
  if (clash) {
    return {
      error:
        clash.handle === handle
          ? "Someone already has that handle. Try another?"
          : "There's already an account with that email. Sign in instead?",
    };
  }

  const user = await db.user.create({
    data: {
      displayName,
      handle,
      email,
      birthYear,
      passwordHash: await hashPassword(password),
    },
  });

  await startSession(user.id);
  redirect("/");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });

  // Same message either way, so this form can't be used to discover who has an account.
  const wrong = { error: "That email and password don't match." };
  if (!user) return wrong;
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return wrong;

  // A finished suspension shouldn't need an admin to undo it.
  await liftExpiredSuspension(user.id);

  await startSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}
