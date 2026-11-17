import { addVariant, getOrgProduct } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api<{ orgId: string; id: string }>(async (c, req, p) => { addVariant(c, p.orgId, p.id, await json(req)); return { data: getOrgProduct(c, p.orgId, p.id) }; }, { status: 201 });
