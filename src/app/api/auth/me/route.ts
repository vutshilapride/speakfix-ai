import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest, hashPassword, verifyPassword } from "@/lib/auth";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

const LANGUAGES: readonly string[] = SUPPORTED_LANGUAGES;

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ user });
}

/**
 * PATCH /api/auth/me — update your own profile.
 * Body (all optional):
 *   { name?, email?, preferredLanguage?, currentPassword?, newPassword? }
 *
 * Password change requires the current password. Email must stay unique.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    const body = (await req.json()) as {
      name?: string;
      email?: string;
      preferredLanguage?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const data: Record<string, string> = {};

    // ---- name ----
    if (body.name !== undefined) {
      const name = body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json(
          { error: "Name must be between 2 and 80 characters." },
          { status: 400 }
        );
      }
      data.name = name;
    }

    // ---- email ----
    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      }
      if (email !== user.email) {
        const taken = await db.user.findUnique({ where: { email } });
        if (taken) {
          return NextResponse.json(
            { error: "That email is already used by another account." },
            { status: 409 }
          );
        }
      }
      data.email = email;
    }

    // ---- preferred language ----
    if (body.preferredLanguage !== undefined) {
      if (!LANGUAGES.includes(body.preferredLanguage)) {
        return NextResponse.json({ error: "Unsupported language." }, { status: 400 });
      }
      data.preferredLanguage = body.preferredLanguage;
    }

    // ---- password ----
    if (body.newPassword !== undefined && body.newPassword !== "") {
      const currentPassword = body.currentPassword || "";
      const stored = await db.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      if (!stored || !verifyPassword(currentPassword, stored.passwordHash)) {
        return NextResponse.json(
          { error: "Your current password is incorrect." },
          { status: 403 }
        );
      }
      if (body.newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 }
        );
      }
      data.passwordHash = hashPassword(body.newPassword);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const updated = await db.user.update({
      where: { id: user.id },
      data,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        preferredLanguage: updated.preferredLanguage,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
  } catch (err) {
    console.error("[/api/auth/me PATCH] error:", err);
    return NextResponse.json(
      { error: "Could not save your profile. Please try again." },
      { status: 500 }
    );
  }
}
