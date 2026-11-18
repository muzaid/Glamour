import { setDropImage } from "@glamotion/core";
import { api, imageUpload } from "@/server/api";
/** POST ?row=top|bottom with a white garment cut-out (transparent PNG works best). */
export const POST = api<{ orgId: string; id: string }>(async (c, req, p) =>
  ({ data: await setDropImage(c, p.orgId, p.id, new URL(req.url).searchParams.get("row"), await imageUpload(req)) }));
