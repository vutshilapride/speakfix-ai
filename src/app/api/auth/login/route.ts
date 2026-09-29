import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  createSessionToken,
  sessionCookieOptions,
  sessionExpiry,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Please enter your email and password." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Incorrect email or password. Please try again." },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.id);
    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
      },
    });
    res.cookies.set({ ...sessionCookieOptions(sessionExpiry()), value: token });
    return res;
  } catch (err) {
    console.error("[/api/auth/login] error:", err);
    return NextResponse.json({ error: "Could not log you in. Please try again." }, { status: 500 });
  }
}
