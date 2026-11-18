import { setRunwayLookImage } from "@glamotion/core";
import { api, imageUpload } from "@/server/api";
export const POST = api<{ orgId: string; id: string }>(async (c, req, p) => ({ data: await setRunwayLookImage(c, p.orgId, p.id, await imageUpload(req)) }));
