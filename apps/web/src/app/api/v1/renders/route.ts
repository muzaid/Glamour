import { CreateRenderInput } from "@glamotion/contracts";
import { createRenderJob, notFound, activeRoles, requireActor } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api(async (c, req) => {
  const actor = requireActor(c);
  const body = await json(req);
  const input = CreateRenderInput.parse(body);
  const comp = c.store.compositions.get(input.compositionId);
  if (!comp || activeRoles(c, comp.organizationId, actor.userId).length === 0) throw notFound("Composition");
  const { job, replayed } = createRenderJob(c, comp.organizationId, input, req.headers.get("idempotency-key"));
  return { data: { id: job.id, status: job.status, replayed } };
}, { status: 202 });
