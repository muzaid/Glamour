import { cancelRenderJob, findRenderJobForActor, requireActor } from "@glamotion/core";
import { api } from "@/server/api";
export const POST = api<{ id: string }>((c, _r, p) => { requireActor(c); const j = findRenderJobForActor(c, p.id); return { data: cancelRenderJob(c, j.organizationId, p.id).status }; });
