import Link from "next/link";
import { listCampaigns } from "@glamotion/agents";
import { StatusChip } from "@glamotion/ui";
import { studio } from "@/server/studio";
import { runtime } from "@/server/runtime";
import { CampaignWizard } from "@/components/studio/CampaignWizard";

export const dynamic = "force-dynamic";

export default async function Campaigns({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const campaigns = listCampaigns(c, org.id);
  const products = [...c.store.products.values()].filter((p) => p.organizationId === org.id && p.status === "published").map((p) => ({ id: p.id, title: p.title }));
  return (
    <div className="gm-grid-2">
      <div className="gm-stack">
        <h1>Campaigns & agents</h1>
        <p className="gm-muted gm-small">AI provider: <strong>{runtime().llm.name === "deterministic-demo" ? "Demo AI (deterministic, offline)" : "Claude"}</strong></p>
        {campaigns.length === 0 ? <p className="gm-muted">No campaigns yet.</p> : (
          <div className="gm-table-wrap"><table className="gm-table"><thead><tr><th>Campaign</th><th>Status</th><th>Workflow</th></tr></thead><tbody>
            {campaigns.map((x) => { const wf = x.workflowId ? c.store.workflows.get(x.workflowId) : null; return <tr key={x.id}><td>{wf ? <Link href={`/studio/${org.slug}/campaigns/${wf.id}`}>{x.name}</Link> : x.name}</td><td><StatusChip status={x.status} /></td><td>{wf && <StatusChip status={wf.status} />}</td></tr>; })}
          </tbody></table></div>
        )}
      </div>
      {can("campaign.write") ? <CampaignWizard orgId={org.id} orgSlug={org.slug} products={products} /> : <p className="gm-muted">Your role cannot start campaigns.</p>}
    </div>
  );
}
