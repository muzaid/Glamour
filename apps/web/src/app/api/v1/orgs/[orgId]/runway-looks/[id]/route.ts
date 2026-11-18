import { deleteRunwayLook, getOrgRunwayLook, updateRunwayLook } from "@glamotion/core";
import { api, json } from "@/server/api";
type P = { orgId: string; id: string };
export const GET = api<P>((c, _r, p) => ({ data: getOrgRunwayLook(c, p.orgId, p.id) }));
export const PATCH = api<P>(async (c, req, p) => ({ data: updateRunwayLook(c, p.orgId, p.id, await json(req)) }));
export const DELETE = api<P>(async (c, _r, p) => { await deleteRunwayLook(c, p.orgId, p.id); return { ok: true }; });
