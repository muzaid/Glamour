import { decideWorkflowGate, getWorkflowView } from "@glamotion/agents";
import { api, json } from "@/server/api";
import { runtime } from "@/server/runtime";
export const POST = api<{ id: string }>(async (c, req, p) => {
  await decideWorkflowGate(c, { llm: runtime().llm }, p.id, await json(req));
  return { data: getWorkflowView(c, p.id) };
});
