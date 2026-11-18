import { ctx } from "@/server/runtime";
import { maisonConfig, renderMaisonPage } from "@/server/maison-page";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = await ctx();
  return new Response(renderMaisonPage(maisonConfig(c)), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
