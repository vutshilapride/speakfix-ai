import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import type { LearnedPhraseRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/learned-phrases
 * Iris's shared language notebook — phrases taught by the SpeakFix community,
 * newest first (max 60). Any signed-in user can read it; phrases are added
 * through the chat agent (validated + deduped server-side).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    const rows = await db.learnedPhrase.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
    });

    const phrases: LearnedPhraseRecord[] = rows.map((r) => ({
      id: r.id,
      language: r.language,
      phrase: r.phrase,
      meaning: r.meaning,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ phrases });
  } catch (err) {
    console.error("[/api/learned-phrases] error:", err);
    return NextResponse.json({ error: "Could not load the notebook." }, { status: 500 });
  }
}
