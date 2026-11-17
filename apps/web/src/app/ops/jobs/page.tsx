import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { ctx } from "@/server/runtime";
import { Header } from "@/components/Header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ops · jobs" };

/** Internal platform view: queue health only — no tenant content, no customer media. */
export default async function OpsJobs() {
  const c = await ctx();
  if (!isPlatformAdmin(c)) notFound();
  const jobs = [...c.store.renderJobs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const byStatus = jobs.reduce<Record<string, number>>((m, j) => ({ ...m, [j.status]: (m[j.status] ?? 0) + 1 }), {});
  const outbox = c.store.outbox.reduce<Record<string, number>>((m, e) => ({ ...m, [e.topic]: (m[e.topic] ?? 0) + 1 }), {});
  return (
    <>
      <Header />
      <main id="main" className="gm-container gm-section gm-stack">
        <h1>Render queue & events</h1>
        <div className="gm-row">{Object.entries(byStatus).map(([s, n]) => <span key={s}><StatusChip status={s} /> {n}</span>)}</div>
        <div className="gm-table-wrap"><table className="gm-table"><thead><tr><th>Job</th><th>Org</th><th>Status</th><th>Attempts</th><th>Progress</th><th>Error</th><th>Created</th></tr></thead><tbody>
          {jobs.slice(0, 50).map((j) => <tr key={j.id}><td>{j.id.slice(0, 8)}</td><td>{j.organizationId.slice(0, 8)}</td><td><StatusChip status={j.status} /></td><td>{j.attempts}/{j.maxAttempts}</td><td>{Math.round(j.progress * 100)}%</td><td className="gm-small">{j.error ?? ""}</td><td className="gm-small">{new Date(j.createdAt).toLocaleString()}</td></tr>)}
        </tbody></table></div>
        <h2>Domain events (outbox)</h2>
        <ul>{Object.entries(outbox).map(([t, n]) => <li key={t}><code>{t}</code> × {n}</li>)}</ul>
        <h2>Security-relevant audit (last 20)</h2>
        <ul className="gm-small">{c.store.audit.slice(-20).reverse().map((a) => <li key={a.id}>{a.createdAt} · {a.action} · {a.entity}</li>)}</ul>
      </main>
    </>
  );
}
