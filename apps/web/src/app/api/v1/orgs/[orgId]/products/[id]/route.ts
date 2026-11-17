import { z } from "zod";
import { ProductStatus } from "@glamotion/contracts";
import { getOrgProduct, transitionProduct, updateVariantPrice, adjustStock } from "@glamotion/core";
import { api, json } from "@/server/api";

const Patch = z.object({
  status: ProductStatus.optional(),
  variantPrice: z.object({ variantId: z.string().uuid(), priceMinor: z.number().int().positive() }).optional(),
  stock: z.object({ variantId: z.string().uuid(), delta: z.number().int().min(-100000).max(100000) }).optional(),
});
export const GET = api<{ orgId: string; id: string }>((c, _r, p) => ({ data: getOrgProduct(c, p.orgId, p.id) }));
export const PATCH = api<{ orgId: string; id: string }>(async (c, req, p) => {
  const body = Patch.parse(await json(req));
  if (body.variantPrice) updateVariantPrice(c, p.orgId, body.variantPrice.variantId, body.variantPrice.priceMinor);
  if (body.stock) adjustStock(c, p.orgId, body.stock.variantId, body.stock.delta, "manual_adjustment");
  if (body.status) transitionProduct(c, p.orgId, p.id, body.status);
  return { data: getOrgProduct(c, p.orgId, p.id) };
});
