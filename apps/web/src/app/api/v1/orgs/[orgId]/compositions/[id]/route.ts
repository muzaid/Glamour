import { getComposition, saveCompositionRevision } from "@glamotion/core";
import { api, json } from "@/server/api";
export const GET = api<{ orgId: string; id: string }>((c, _r, p) => ({ data: getComposition(c, p.orgId, p.id) }));
export const PUT = api<{ orgId: string; id: string }>(async (c, req, p) => ({ data: saveCompositionRevision(c, p.orgId, p.id, await json(req)) }));
