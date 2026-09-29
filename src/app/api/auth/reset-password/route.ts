import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { consumePasswordResetToken, hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; password?: string };
    const token = (body.token || "").trim();
    const password = body.password || "";

    if (!token) {
      return NextResponse.json({ error: "Reset token is missing." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 100) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const userId = await consumePasswordResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(password) },
    });

    // Invalidate all existing sessions for this user (security best practice)
    await db.session.deleteMany({ where: { userId } }).catch(() => {});

    return NextResponse.json({ success: true, message: "Your password has been reset. You can now log in." });
  } catch (err) {
    console.error("[/api/auth/reset-password] error:", err);
    return NextResponse.json({ error: "Could not reset your password. Please try again." }, { status: 500 });
  }
}
