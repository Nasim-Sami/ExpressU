import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

import { db } from "./db";
import type { Viewer } from "./visibility";
import type { UserRole } from "./constants";

const COOKIE = "expressu_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set — check your .env");
  return new TextEncoder().encode(value);
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function startSession(userId: string): Promise<void> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Expired or tampered-with token — treat as logged out.
    return null;
  }
}

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  avatarKey: string | null;
  coverKey: string | null;
  avatarOriginalKey: string | null;
  coverOriginalKey: string | null;
  bio: string | null;
  links: string | null;
  birthYear: number | null;
  role: UserRole;
  status: string;
  suspendedUntil: Date | null;
}

/** The signed-in user, or null. Does not include connection ids — use `getViewer` for access checks. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const id = await currentUserId();
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      handle: true,
      displayName: true,
      email: true,
      avatarKey: true,
      coverKey: true,
      avatarOriginalKey: true,
      coverOriginalKey: true,
      bio: true,
      links: true,
      birthYear: true,
      role: true,
      status: true,
      suspendedUntil: true,
    },
  });

  return user ? (user as SessionUser) : null;
}

/** Every user this person has an ACCEPTED connection with, in either direction. */
export async function connectionIdsFor(userId: string): Promise<Set<string>> {
  const rows = await db.connection.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.requesterId === userId ? row.addresseeId : row.requesterId);
  }
  return ids;
}

/**
 * Everyone this person can no longer see, in either direction.
 *
 * Both sides of the relationship are collapsed into one set: people they blocked, and
 * people who blocked them. Callers never need to know which — and can't accidentally
 * enforce only one half, which would leave the blocked person still able to watch.
 */
export async function blockedIdsFor(userId: string): Promise<Set<string>> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }
  return ids;
}

/**
 * The access-control subject passed to `canView` / `visibleIdeaWhere`.
 * Returns null for logged-out visitors, who see public live ideas only.
 */
export async function getViewer(): Promise<Viewer | null> {
  const id = await currentUserId();
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user) return null;

  const [connectionIds, blockedIds] = await Promise.all([
    connectionIdsFor(user.id),
    blockedIdsFor(user.id),
  ]);

  return {
    id: user.id,
    role: user.role as UserRole,
    connectionIds,
    blockedIds,
  };
}

/** True when a suspension is currently in force. Suspension blocks posting, not existing work. */
export function isSuspended(user: {
  status: string;
  suspendedUntil: Date | null;
}): boolean {
  if (user.status !== "SUSPENDED") return false;
  if (!user.suspendedUntil) return true;
  return user.suspendedUntil.getTime() > Date.now();
}
