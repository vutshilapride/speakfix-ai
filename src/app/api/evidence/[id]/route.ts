import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

/**
 * GET /api/evidence/[id] — serve an evidence file (photo, audio, PDF).
 *
 * Access is checked against the ticket it belongs to (once linked): the
 * reporter, the assigned technician and admins may view it. Before it is
 * linked to a ticket (draft), only the uploader and admins can fetch it.
 *
 * ?download=1 forces a download instead of inline display.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const { id } = await params;
    const file = await db.evidenceFile.findUnique({
      where: { id },
      include: { ticket: { select: { userId: true, assignedTechnicianId: true } } },
    });
    if (!file) {
      // 404 — never reveal which ids exist
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Access: uploader or admin always; otherwise the ticket's reporter or
    // assigned technician (once the file has been linked to a ticket).
    let allowed = file.uploadedBy === user.id || user.role === "ADMIN";
    if (!allowed && file.ticket) {
      allowed =
        file.ticket.userId === user.id ||
        (user.role === "TECHNICIAN" && file.ticket.assignedTechnicianId === user.id);
    }
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const bytes = Buffer.from(file.data);
    const download = req.nextUrl.searchParams.get("download") === "1";
    const disposition = `${download ? "attachment" : "inline"}; filename="${file.fileName.replace(/"/g, "")}"`;

    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": disposition,
        // ids are opaque cuids and file content never changes — safe to cache
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[/api/evidence/[id] GET] error:", err);
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 });
  }
}
