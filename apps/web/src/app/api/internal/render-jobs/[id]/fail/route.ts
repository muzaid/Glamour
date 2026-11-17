import { z } from "zod";
import { failRenderJob } from "@glamotion/core";
import { api, json } from "@/server/api";
import { requireWorker } from "../../../auth";
export const POST = api<{ id: string }>(async (c, req, p) => {
  const w = requireWorker(req);
  const b = z.object({ message: z.string().max(500), retryable: z.boolean() }).parse(await json(req));
  return { status: failRenderJob(c, p.id, w, b.message, b.retryable).status };
});
