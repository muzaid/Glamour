import Link from "next/link";
import { formatMoney } from "@glamotion/core";
import { KpiCard, StatusChip } from "@glamotion/ui";
import { studio } from "@/server/studio";

export const dynamic = "force-dynamic";

export default async function Overview({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const s = c.store;
  const products = [...s.products.values()].filter((p) => p.organizationId === org.id);
  const paidOrderIds = new Set([...s.orders.values()].filter((o) => ["paid", "fulfilling", "fulfilled"].includes(o.status)).map((o) => o.id));
  const items = s.orderItems.filter((i) => i.organizationId === org.id && paidOrderIds.has(i.orderId));
  const gmv = items.reduce((n, i) => n + i.unitPriceMinor * i.quantity, 0);
  const renders = [...s.renderJobs.values()].filter((j) => j.organizationId === org.id);
  const projects = [...s.projects.values()].filter((p) => p.organizationId === org.id);
  const pendingGates = s.humanApprovals.filter((h) => h.organizationId === org.id && h.status === "pending");
  const views = s.analytics.filter((a) => a.name === "product_view" && a.organizationId === org.id).length;
  const tokens = s.usage.filter((u) => u.organizationId === org.id && u.kind === "llm_tokens").reduce((n, u) => n + u.quantity, 0);
  return (
    <div className="gm-stack">
      <h1>{org.name}</h1>
      <div className="gm-grid">
        <KpiCard label="Published products" value={products.filter((p) => p.status === "published").length} hint={`${products.filter((p) => p.status === "draft").length} drafts`} />
        {can("finance.read") && <KpiCard label="Paid GMV" value={formatMoney(gmv, "USD")} hint={`${new Set(items.map((i) => i.orderId)).size} orders`} />}
        <KpiCard label="Product views" value={views} hint="First-party, no personal data" />
        <KpiCard label="Renders" value={`${renders.filter((r) => r.status === "completed").length} / ${renders.length}`} hint={`${renders.filter((r) => r.status === "failed").length} failed`} />
        <KpiCard label="Awaiting your approval" value={pendingGates.length} hint="AI workflow gates" />
        {can("finance.read") && <KpiCard label="AI tokens used" value={tokens.toLocaleString()} hint="Usage ledger" />}
      </div>
      <div className="gm-grid-2">
        <section className="gm-card">
          <h2>Projects</h2>
          {projects.length === 0 ? <p className="gm-muted">No projects yet. <Link href={`/studio/${org.slug}/projects`}>Create a brief</Link></p> :
            <ul>{projects.map((p) => <li key={p.id}><Link href={`/studio/${org.slug}/projects/${p.id}`}>{p.name}</Link> <StatusChip status={p.status} /></li>)}</ul>}
        </section>
        <section className="gm-card">
          <h2>Recent activity</h2>
          <ul className="gm-small">{s.audit.filter((a) => a.organizationId === org.id).slice(-8).reverse().map((a) => <li key={a.id}>{a.action} · <span className="gm-muted">{new Date(a.createdAt).toLocaleTimeString()}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
