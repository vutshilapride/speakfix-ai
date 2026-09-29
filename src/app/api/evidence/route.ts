import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

/**
 * POST /api/evidence — upload a real evidence file (photo of the fix, part
 * invoice, voice note…).
 *
 * Accepts multipart/form-data:
 *   file  — the attachment (images, audio or PDF, max 8 MB)
 *   type  — optional evidence type ("photo" | "part" | "voice" | …) used to
 *           sanity-check the mime against what that type should carry.
 *
 * Returns { id, fileName, mimeType, size }. The stored row is a DRAFT
 * (ticketId null) until it is submitted with a ticket via the
 * submit_resolution / add_evidence ticket actions, which link it to the
 * ticket. Serving happens at GET /api/evidence/[id].
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
  "audio/m4a",
]);
const DOC_MIMES = new Set(["application/pdf"]);

function allowedMime(mime: string) {
  return IMAGE_MIMES.has(mime) || AUDIO_MIMES.has(mime) || DOC_MIMES.has(mime);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was received." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That file is empty." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is too big — 8 MB maximum." },
        { status: 413 }
      );
    }

    const mime = (file.type || "application/octet-stream").toLowerCase();
    if (!allowedMime(mime)) {
      return NextResponse.json(
        { error: "Only photos, audio clips or PDF files can be attached." },
        { status: 415 }
      );
    }
    // The declared evidence type should match the file (photo/part → image or
    // pdf for part invoices, voice → audio). Anything else stays allowed —
    // e.g. a note with a photo — we just don't block it.
    if (type === "voice" && !AUDIO_MIMES.has(mime)) {
      return NextResponse.json(
        { error: "Voice evidence needs an audio file." },
        { status: 415 }
      );
    }

    // Clean display name: strip paths, cap length, keep extension.
    const rawName = (file.name || "evidence").split(/[\\/]/).pop() || "evidence";
    const fileName = rawName.replace(/[^\w\s.\-()]/g, "_").slice(0, 180);

    const bytes = Buffer.from(await file.arrayBuffer());

    const saved = await db.evidenceFile.create({
      data: {
        fileName,
        mimeType: mime,
        size: bytes.byteLength,
        data: bytes,
        uploadedBy: user.id,
      },
    });

    return NextResponse.json({
      id: saved.id,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      size: saved.size,
    });
  } catch (err) {
    console.error("[/api/evidence POST] error:", err);
    return NextResponse.json(
      { error: "The file could not be uploaded. Please try again." },
      { status: 500 }
    );
  }
}
