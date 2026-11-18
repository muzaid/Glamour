import { NextResponse } from "next/server";
import { getPublishedDrop, isAppError } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { renderDropPage } from "@/server/drop-page";

export const dynamic = "force-dynamic";

/** A specific published drop post. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx();
  try {
    return new Response(renderDropPage(getPublishedDrop(c, id)), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (err) {
    if (isAppError(err)) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Drop not found", requestId: c.requestId, details: {} } }, { status: 404 });
    throw err;
  }
}
