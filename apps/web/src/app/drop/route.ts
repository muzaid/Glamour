import { listPublishedDrops } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { renderDropPage } from "@/server/drop-page";

export const dynamic = "force-dynamic";

/** The current drop post (first published drop in workspace order). */
export async function GET() {
  const c = await ctx();
  return new Response(renderDropPage(listPublishedDrops(c)[0] ?? null), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
