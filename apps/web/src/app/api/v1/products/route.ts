import { listPublishedProducts } from "@glamotion/core";
import { api } from "@/server/api";
export const GET = api((c, req) => {
  const u = new URL(req.url);
  return { data: listPublishedProducts(c, { category: u.searchParams.get("category") ?? undefined, q: u.searchParams.get("q")?.slice(0, 80) ?? undefined }) };
});
