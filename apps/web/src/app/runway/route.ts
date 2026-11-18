import { getCart, runwayFeed } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { renderRunwayPage } from "@/server/runway-page";

export const dynamic = "force-dynamic";

/** "Try the Look." runway, rendered from the live catalog on every request. */
export async function GET() {
  const c = await ctx();
  const bagCount = c.actor ? getCart(c).lines.reduce((n, l) => n + l.quantity, 0) : 0;
  return new Response(renderRunwayPage(runwayFeed(c), { signedIn: !!c.actor, bagCount }), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-request-id": c.requestId },
  });
}
