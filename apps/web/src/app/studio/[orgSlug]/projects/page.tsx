import Link from "next/link";
import { listProjects } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { studio } from "@/server/studio";
import { BriefForm } from "@/components/studio/BriefForm";

export const dynamic = "force-dynamic";

export default async function Projects({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const projects = listProjects(c, org.id);
  const products = [...c.store.products.values()].filter((p) => p.organizationId === org.id).map((p) => ({ id: p.id, title: p.title }));
  return (
    <div className="gm-grid-2">
      <div className="gm-stack">
        <h1>Projects</h1>
        {projects.length === 0 ? <p className="gm-muted">No projects yet.</p> : (
          <div className="gm-table-wrap"><table className="gm-table"><thead><tr><th>Project</th><th>Client</th><th>Status</th></tr></thead><tbody>
            {projects.map((p) => <tr key={p.id}><td><Link href={`/studio/${org.slug}/projects/${p.id}`}>{p.name}</Link></td><td>{p.clientName}</td><td><StatusChip status={p.status} /></td></tr>)}
          </tbody></table></div>
        )}
      </div>
      {can("project.write") ? <BriefForm orgId={org.id} orgSlug={org.slug} products={products} /> : <p className="gm-muted">Your role can view projects but not create them.</p>}
    </div>
  );
}
