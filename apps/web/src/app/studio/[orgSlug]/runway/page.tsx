import Link from "next/link";
import { listOrgRunwayLooks } from "@glamotion/core";
import { studio } from "@/server/studio";
import { NewRunwayLook } from "@/components/studio/RunwayLookEditor";

export const dynamic = "force-dynamic";

export default async function RunwayLooks({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const looks = listOrgRunwayLooks(c, org.id);
  const products = new Map([...c.store.products.values()].map((p) => [p.id, p]));
  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div>
          <h1>Runway</h1>
          <p className="gm-muted">Looks shown on the <Link href="/runway">Try the Look runway</Link>. Each look is a model photo with pins on your products. Published looks appear in this order; prices, sizes and stock always come from Products.</p>
        </div>
        {can("catalog.write") && <NewRunwayLook orgId={org.id} orgSlug={org.slug} />}
      </div>
      {looks.length === 0 ? <p className="gm-muted">No looks yet.</p> : (
        <div className="gm-table-wrap"><table className="gm-table">
          <thead><tr><th>#</th><th>Look</th><th>Pieces</th><th>Status</th></tr></thead>
          <tbody>{looks.map((l) => (
            <tr key={l.id}>
              <td>{l.position + 1}</td>
              <td className="gm-row" style={{ gap: 12 }}>
                {l.imageUrl ? <img src={l.imageUrl} alt="" width={36} height={64} style={{ objectFit: "contain", background: "var(--gm-surface-2)" }} /> : <span style={{ width: 36, height: 64, background: "var(--gm-surface-2)", display: "inline-block" }} />}
                <span><Link href={`/studio/${org.slug}/runway/${l.id}`} data-testid="runway-look-link">{l.name}</Link><div className="gm-muted gm-small">{l.description}</div></span>
              </td>
              <td className="gm-small">{l.pins.map((p) => products.get(p.productId)?.title ?? "—").join(", ") || "—"}</td>
              <td><span className="gm-chip">{l.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
