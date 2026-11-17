import Link from "next/link";
import { listOrgProducts, formatMoney } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { studio } from "@/server/studio";

export const dynamic = "force-dynamic";

export default async function Products({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const products = listOrgProducts(c, org.id);
  return (
    <div className="gm-stack">
      <div className="gm-row gm-between"><h1>Products</h1>{can("catalog.write") && <Link className="gm-btn gm-btn-accent" href={`/studio/${org.slug}/products/new`}>New product</Link>}</div>
      <div className="gm-table-wrap"><table className="gm-table">
        <thead><tr><th>Product</th><th>Category</th><th>Shades</th><th>Price</th><th>Stock</th><th>Status</th></tr></thead>
        <tbody>{products.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/studio/${org.slug}/products/${p.id}`}>{p.title}</Link><div className="gm-muted gm-small">{p.brandName}</div></td>
            <td>{p.category}</td>
            <td><div className="gm-row" style={{ gap: 4 }}>{p.variants.map((v) => <span key={v.id} title={v.shadeName} style={{ width: 16, height: 16, borderRadius: "50%", background: v.shade.hex, display: "inline-block" }} />)}</div></td>
            <td>{p.variants[0] ? formatMoney(p.variants[0].price.amountMinor, p.variants[0].price.currency) : "—"}</td>
            <td>{p.variants.reduce((n, v) => n + v.available, 0)}</td>
            <td><StatusChip status={p.status} /></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
