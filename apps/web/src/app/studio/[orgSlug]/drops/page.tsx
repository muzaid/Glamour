import Link from "next/link";
import { listOrgDrops } from "@glamotion/core";
import { studio } from "@/server/studio";
import { NewDrop, Swatches } from "@/components/studio/DropEditor";

export const dynamic = "force-dynamic";

export default async function Drops({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  const drops = listOrgDrops(c, org.id);
  return (
    <div className="gm-stack">
      <div className="gm-row gm-between">
        <div>
          <h1>Drops</h1>
          <p className="gm-muted">Square “mix-and-match” teaser posts. Each drop has a top and a bottom garment photo (white, cut out) and a list of colourways; every colour is generated from the white photo. The first published drop is shown at <Link href="/drop">/drop</Link>.</p>
        </div>
        {can("catalog.write") && <NewDrop orgId={org.id} orgSlug={org.slug} />}
      </div>
      {drops.length === 0 ? <p className="gm-muted">No drops yet.</p> : (
        <div className="gm-table-wrap"><table className="gm-table">
          <thead><tr><th>#</th><th>Drop</th><th>Top colours</th><th>Bottom colours</th><th>Status</th></tr></thead>
          <tbody>{drops.map((d) => (
            <tr key={d.id}>
              <td>{d.position + 1}</td>
              <td><Link href={`/studio/${org.slug}/drops/${d.id}`} data-testid="drop-link">{d.title}</Link></td>
              <td><Swatches colours={d.top.colours} /></td>
              <td><Swatches colours={d.bottom.colours} /></td>
              <td><span className="gm-chip">{d.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
