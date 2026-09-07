import { NextResponse } from "next/server";
import { requireAuthAndSociety } from "@/lib/api-helpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isValidImageSignature(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 12) return false;

  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    const isRiff =
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46; // "RIFF"
    const isWebp =
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50; // "WEBP"
    return isRiff && isWebp;
  }

  return false;
}

export async function POST(req: Request) {
  const auth = await requireAuthAndSociety("visitor:read");
  if ("error" in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)` },
        { status: 400 }
      );
    }

    const MIME_TO_EXT: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };

    const buffer = Buffer.from(await file.arrayBuffer());

    if (!isValidImageSignature(buffer, file.type)) {
      return NextResponse.json(
        { error: "File content does not match allowed image format (corrupted or spoofed file)" },
        { status: 400 }
      );
    }

    const ext = MIME_TO_EXT[file.type] || "jpg";
    const filename = `${randomUUID()}.${ext}`;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, filename);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      mimeType: file.type,
    }, { status: 201 });
  } catch (err: any) {
    console.error("[UPLOAD ERROR]", err);
    return NextResponse.json({ error: err.message || "Failed to upload file" }, { status: 500 });
  }
}
