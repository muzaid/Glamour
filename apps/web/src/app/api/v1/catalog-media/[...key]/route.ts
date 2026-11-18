import { NextResponse } from "next/server";
import { canReadCatalogMedia } from "@glamotion/core";
import { ctx, runtime } from "@/server/runtime";

const notFound = (requestId: string) => NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found", requestId, details: {} } }, { status: 404 });

/** Catalog images: public once a published product/look uses them, otherwise members only. */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.join("/");
  const c = await ctx();
  if (!/^catalog\/[0-9a-f-]{36}\.(png|jpg|webp)$/.test(key) || !canReadCatalogMedia(c, key)) return notFound(c.requestId);
  const bytes = await runtime().media.get(key);
  const meta = c.store.media.get(key);
  if (!bytes || !meta) return notFound(c.requestId);
  return new NextResponse(Buffer.from(bytes), {
    headers: { "content-type": meta.mime, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'", "access-control-allow-origin": "*" },
  });
}
