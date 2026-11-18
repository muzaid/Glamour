import { setProductImage } from "@glamotion/core";
import { api, imageUpload } from "@/server/api";
type P = { orgId: string; id: string };
export const POST = api<P>(async (c, req, p) => ({ data: await setProductImage(c, p.orgId, p.id, { bytes: await imageUpload(req) }) }));
export const DELETE = api<P>(async (c, _r, p) => ({ data: await setProductImage(c, p.orgId, p.id, null) }));
