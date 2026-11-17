import { z } from "zod";
import { heartbeatRenderJob } from "@glamotion/core";
import { api, json } from "@/server/api";
import { requireWorker } from "../../../auth";
export const POST = api<{ id: string }>(async (c, req, p) => { const w = requireWorker(req); const { progress } = z.object({ progress: z.number().min(0).max(1) }).parse(await json(req)); return heartbeatRenderJob(c, p.id, w, progress); });
