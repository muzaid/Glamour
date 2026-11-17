import { getWorkflowView } from "@glamotion/agents";
import { api } from "@/server/api";
export const GET = api<{ id: string }>((c, _r, p) => ({ data: getWorkflowView(c, p.id) }));
