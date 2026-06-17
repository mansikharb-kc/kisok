import { readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Serves files saved by /api/upload from <app>/public/uploads.
// Needed because `next start` (production) does NOT serve files written to
// public/ at runtime — only those present at build time. This route reads
// from disk at request time, so uploaded logos/PDFs work on the server too.
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(_req: Request, { params }: { params: { name: string } }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const safe = basename(params.name);
  if (!/^[A-Za-z0-9._-]+$/.test(safe)) return new Response("Bad request", { status: 400 });
  const mime = MIME[extname(safe).toLowerCase()];
  if (!mime) return new Response("Unsupported file type", { status: 400 });

  try {
    const buf = await readFile(join(process.cwd(), "public", "uploads", safe));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": mime, "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
