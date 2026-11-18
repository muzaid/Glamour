import { createRunwayLook, listOrgRunwayLooks } from "@glamotion/core";
import { api, json } from "@/server/api";
export const GET = api<{ orgId: string }>((c, _r, p) => ({ data: listOrgRunwayLooks(c, p.orgId) }));
export const POST = api<{ orgId: string }>(async (c, req, p) => ({ data: createRunwayLook(c, p.orgId, await json(req)) }), { status: 201 });
