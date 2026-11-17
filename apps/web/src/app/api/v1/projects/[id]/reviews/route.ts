import { z } from "zod";
import { requestReview, notFound, activeRoles, requireActor } from "@glamotion/core";
import { api, json } from "@/server/api";

const Body = z.object({ compositionId: z.string().uuid(), reviewerName: z.string().min(1).max(80), canApprove: z.boolean().default(false) });
export const POST = api<{ id: string }>(async (c, req, p) => {
  const actor = requireActor(c);
  const project = c.store.projects.get(p.id);
  if (!project || activeRoles(c, project.organizationId, actor.userId).length === 0) throw notFound("Project");
  const b = Body.parse(await json(req));
  const comp = c.store.compositions.get(b.compositionId);
  if (!comp || comp.projectId !== project.id) throw notFound("Composition");
  return { data: requestReview(c, project.organizationId, comp.id, b) };
}, { status: 201 });
