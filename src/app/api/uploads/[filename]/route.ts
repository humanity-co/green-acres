import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireAuthAndSociety } from "@/lib/api-helpers";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_: Request, { params }: { params: Promise<{ filename: string }> }) {
  const auth = await requireAuthAndSociety("visitor:read");
  if ("error" in auth) return auth.error;

  const { filename } = await params;
  const { societyId } = auth as { societyId: string };
  const safeName = filename.match(/^([0-9a-f-]{36})_([0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/i);
  if (!safeName || safeName[1] !== societyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const file = await readFile(path.join(process.cwd(), ".private", "uploads", filename));
    const extension = safeName[3].toLowerCase();
    return new NextResponse(file, {
      headers: {
        "Content-Type": contentTypes[extension],
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}