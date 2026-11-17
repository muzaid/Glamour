import { createProject, listProjects } from "@glamotion/core";
import { api, json } from "@/server/api";
export const GET = api<{ orgId: string }>((c, _r, p) => ({ data: listProjects(c, p.orgId) }));
export const POST = api<{ orgId: string }>(async (c, req, p) => ({ data: createProject(c, p.orgId, await json(req)) }), { status: 201 });
