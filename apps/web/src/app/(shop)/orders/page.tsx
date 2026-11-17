import Link from "next/link";
import { redirect } from "next/navigation";
import { listMyOrders, formatMoney } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { ctx } from "@/server/runtime";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function Orders() {
  const c = await ctx();
  if (!c.actor) redirect("/sign-in?next=/orders");
  const orders = listMyOrders(c);
  return (
    <div className="gm-container gm-section">
      <h1>Orders</h1>
      {orders.length === 0 ? <p className="gm-muted">No orders yet.</p> : (
        <div className="gm-table-wrap"><table className="gm-table"><thead><tr><th>Order</th><th>Placed</th><th>Status</th><th>Total</th></tr></thead><tbody>
          {orders.map((o) => <tr key={o.id}><td><Link href={`/orders/${o.id}`}>{o.id.slice(0, 8)}</Link></td><td>{new Date(o.createdAt).toLocaleString()}</td><td><StatusChip status={o.status} /></td><td>{formatMoney(o.totalMinor, o.currency)}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  );
}
