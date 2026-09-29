import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  hashPassword,
  sessionCookieOptions,
  sessionExpiry,
} from "@/lib/auth";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

const LANGUAGES: readonly string[] = SUPPORTED_LANGUAGES;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      password?: string;
      preferredLanguage?: string;
    };

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const preferredLanguage = LANGUAGES.includes(body.preferredLanguage || "")
      ? body.preferredLanguage!
      : "English";

    // --- validation ---
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Please enter your full name (2–80 characters)." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (password.length < 8 || password.length > 100) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try logging in instead." },
        { status: 409 }
      );
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        preferredLanguage,
        role: "USER",
      },
    });

    const token = await createSessionToken(user.id);
    const res = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          preferredLanguage: user.preferredLanguage,
        },
      },
      { status: 201 }
    );
    res.cookies.set({ ...sessionCookieOptions(sessionExpiry()), value: token });
    return res;
  } catch (err) {
    console.error("[/api/auth/signup] error:", err);
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 500 });
  }
}
