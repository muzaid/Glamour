import { NextResponse } from "next/server";
import { runtime } from "@/server/runtime";

/** Short-lived signed download for private media (render outputs). */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.join("/");
  const u = new URL(req.url);
  const rt = runtime();
  if (!rt.media.verifyDownload(key, u.searchParams.get("exp") ?? "", u.searchParams.get("sig") ?? "")) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Link expired or invalid", requestId: "", details: {} } }, { status: 404 });
  }
  const bytes = await rt.media.get(key);
  if (!bytes) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found", requestId: "", details: {} } }, { status: 404 });
  const meta = rt.store.media.get(key);
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": meta?.mime ?? "application/octet-stream", "cache-control": "private, max-age=60", "content-disposition": `inline; filename="${key.split("/").pop()}"` } });
}
