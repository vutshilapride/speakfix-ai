import { NextRequest, NextResponse } from "next/server";
import { destroySessionByToken, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await destroySessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.json({ success: true });
  res.cookies.set({ name: SESSION_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}
