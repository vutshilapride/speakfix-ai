import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "speakfix_session";
const SESSION_TTL_DAYS = 30;
const RESET_TOKEN_TTL_MINUTES = 30;

/* ------------------------------ Passwords ------------------------------ */

/** scrypt password hashing — format: "salt:hash" (hex) */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(hash, "hex");
  return candidate.length === original.length && timingSafeEqual(candidate, original);
}

/* ------------------------------- Sessions ------------------------------- */

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  role: string;
  createdAt: Date;
};

function toSessionUser(user: {
  id: string;
  name: string;
  email: string;
  preferredLanguage: string;
  role: string;
  createdAt: Date;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    preferredLanguage: user.preferredLanguage,
    role: user.role,
    createdAt: user.createdAt,
  };
}

/** Create a DB session row and return the opaque token (callers set the cookie). */
export async function createSessionToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { token, userId, expiresAt } });
  return token;
}

export function sessionCookieOptions(expires: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return toSessionUser(session.user);
}

/** Read the current user inside a server component (RSC). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return resolveSession(store.get(SESSION_COOKIE)?.value);
}

/** Read the current user inside a route handler / middleware. */
export async function getUserFromRequest(req: NextRequest): Promise<SessionUser | null> {
  return resolveSession(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function destroySessionByToken(token: string | undefined | null) {
  if (!token) return;
  await db.session.deleteMany({ where: { token } }).catch(() => {});
}

/* ---------------------------- Reset tokens ----------------------------- */

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  await db.passwordResetToken.create({ data: { token, userId, expiresAt } });
  return token;
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const record = await db.passwordResetToken.findUnique({ where: { token } });
  if (!record) return null;
  if (record.usedAt || record.expiresAt < new Date()) return null;
  // mark used immediately (single-use)
  await db.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
