import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/auth";

/**
 * POST /api/auth/forgot-password
 * MVP behaviour: there is no email provider wired up, so when the account
 * exists we return the reset link directly in the response (and the UI shows
 * it with a clear note). In production this would be emailed instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const email = (body.email || "").trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      // Respond generically so we don't leak which emails have accounts
      return NextResponse.json({
        success: true,
        message: "If an account exists for this email, a reset link has been generated.",
        resetUrl: null,
      });
    }

    const token = await createPasswordResetToken(user.id);
    // Build the link from forwarded headers so it matches the host the user
    // is actually browsing (works behind proxies like the preview host and
    // on Vercel). The client also gets resetPath and can rebuild the link
    // from window.location.origin as a bulletproof fallback.
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
    const proto =
      req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
    const origin = `${proto}://${host}`;
    const resetPath = `/reset-password?token=${token}`;
    const resetUrl = `${origin}${resetPath}`;

    return NextResponse.json({
      success: true,
      message: "Reset link generated. It expires in 30 minutes.",
      resetUrl,
      resetPath,
    });
  } catch (err) {
    console.error("[/api/auth/forgot-password] error:", err);
    return NextResponse.json({ error: "Could not process the request. Please try again." }, { status: 500 });
  }
}
