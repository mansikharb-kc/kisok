import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, fail, handler } from "@/lib/api";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
};

// POST multipart/form-data { file } → saves to /public/uploads, creates a media row.
// Local FS today; swap to S3 in production (the media row + URL contract stays the same).
export const POST = handler(async (req: Request) => {
  const session = await requireRole(); // any authenticated user
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file provided", 422);
  if (!EXT[file.type]) return fail("Only PNG, JPG, WEBP, GIF, SVG images, PDF documents, and MP4/WEBM/OGG/MOV videos are allowed", 422);
  if (file.size > MAX_BYTES) return fail("File too large (max 50 MB)", 422);

  const bytes = Buffer.from(await file.arrayBuffer());
  const name = `${crypto.randomUUID()}.${EXT[file.type]}`;
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), bytes);

  // Served via the API route (next start does not serve runtime-written public files).
  const url = `/api/uploads/${name}`;
  const fileType = file.type.startsWith("video/")
    ? "video"
    : file.type === "application/pdf"
    ? "pdf"
    : "logo";

  const media = await prisma.media.create({
    data: {
      type: fileType,
      url,
      mime: file.type,
      sizeBytes: BigInt(bytes.length),
      uploadedBy: BigInt(session.uid),
    },
  });

  return ok({ mediaId: media.id.toString(), url }, { status: 201 });
});
