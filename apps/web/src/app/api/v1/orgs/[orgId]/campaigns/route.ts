import { startProductCampaign, listCampaigns } from "@glamotion/agents";
import { api, json } from "@/server/api";
import { runtime } from "@/server/runtime";
export const GET = api<{ orgId: string }>((c, _r, p) => ({ data: listCampaigns(c, p.orgId) }));
export const POST = api<{ orgId: string }>(async (c, req, p) => {
  const { campaign, workflow } = await startProductCampaign(c, { llm: runtime().llm }, p.orgId, await json(req));
  return { data: { campaignId: campaign.id, workflowId: workflow.id, status: workflow.status } };
}, { status: 201 });
