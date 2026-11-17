import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject, isAppError } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { studio } from "@/server/studio";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org } = await studio(orgSlug);
  let data;
  try { data = getProject(c, org.id, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  const { project, brief, compositions } = data;
  const reviews = [...c.store.reviewSessions.values()].filter((r) => r.projectId === project.id);
  const approvals = c.store.approvals.filter((a) => compositions.some((x) => x.id === a.compositionId));
  const deliveries = c.store.deliveries.filter((d) => compositions.some((x) => x.id === d.compositionId));
  return (
    <div className="gm-stack">
      <div className="gm-eyebrow">{project.clientName}</div>
      <h1>{project.name} <StatusChip status={project.status} /></h1>
      <div className="gm-grid-2">
        <section className="gm-card">
          <h2>Brief</h2>
          {brief ? <dl className="gm-small">
            <dt><strong>Objective</strong></dt><dd>{brief.objective}</dd>
            <dt><strong>Channels</strong></dt><dd>{brief.channels.join(", ")}</dd>
            <dt><strong>Aspect ratios</strong></dt><dd>{brief.aspectRatios.join(", ")}</dd>
            {brief.legalClaims.length > 0 && <><dt><strong>Claims (client must confirm)</strong></dt><dd>{brief.legalClaims.join("; ")}</dd></>}
          </dl> : <p className="gm-muted">No brief.</p>}
          <p className="gm-muted gm-small">To start a deliverable, open a product and choose “Turn into motion”, selecting this project.</p>
        </section>
        <section className="gm-card">
          <h2>Deliverables</h2>
          {compositions.length === 0 ? <p className="gm-muted">No compositions yet. <Link href={`/studio/${org.slug}/products`}>Pick a product</Link></p> :
            <ul>{compositions.map((x) => <li key={x.id}><Link href={`/studio/${org.slug}/motion/${x.id}`}>{x.title}</Link> · rev {x.headRevision}</li>)}</ul>}
          <h3>Reviews</h3>
          <ul className="gm-small">{reviews.map((r) => <li key={r.id}>{r.reviewerName} · rev {r.revision} · {r.canApprove ? "approver" : "commenter"} · {r.revokedAt ? "revoked" : `expires ${new Date(r.expiresAt).toLocaleDateString()}`}</li>)}</ul>
          <h3>Decisions</h3>
          <ul className="gm-small">{approvals.map((a) => <li key={a.id}><StatusChip status={a.decision} /> rev {a.revision} by {a.actorLabel} · {new Date(a.createdAt).toLocaleString()}</li>)}</ul>
          {deliveries.length > 0 && <><h3>Delivered</h3><ul className="gm-small">{deliveries.map((d) => <li key={d.id}>rev {d.revision} · sha256 {d.checksum.slice(0, 12)}…</li>)}</ul></>}
        </section>
      </div>
    </div>
  );
}
