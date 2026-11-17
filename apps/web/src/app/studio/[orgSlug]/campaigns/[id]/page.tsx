import { notFound } from "next/navigation";
import { getWorkflowView } from "@glamotion/agents";
import { getComposition, isAppError } from "@glamotion/core";
import { studio } from "@/server/studio";
import { WorkflowRoom } from "@/components/studio/WorkflowRoom";

export const dynamic = "force-dynamic";

export default async function WorkflowPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org, can } = await studio(orgSlug);
  let view;
  try { view = getWorkflowView(c, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  if (view.campaign.organizationId !== org.id) notFound();
  const previewDoc = view.compositionId ? getComposition(c, org.id, view.compositionId).doc : null;
  return <WorkflowRoom initial={JSON.parse(JSON.stringify(view))} orgSlug={org.slug} canApprove={can("workflow.approve")} previewDoc={previewDoc} />;
}
