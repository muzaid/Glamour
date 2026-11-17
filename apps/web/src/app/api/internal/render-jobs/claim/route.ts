import { claimRenderJob } from "@glamotion/core";
import { api } from "@/server/api";
import { requireWorker } from "../../auth";
export const POST = api((c, req) => { const w = requireWorker(req); return { job: claimRenderJob(c, w) }; });
