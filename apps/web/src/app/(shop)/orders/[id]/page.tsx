import { notFound, redirect } from "next/navigation";
import { getMyOrder, formatMoney, isAppError } from "@glamotion/core";
import { StatusChip } from "@glamotion/ui";
import { ctx } from "@/server/runtime";
import { AutoRefresh } from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await ctx();
  if (!c.actor) redirect(`/sign-in?next=/orders/${id}`);
  let o;
  try { o = getMyOrder(c, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  return (
    <div className="gm-container gm-section" style={{ maxWidth: 760 }}>
      {o.status === "pending_payment" && <AutoRefresh ms={1500} />}
      <div className="gm-eyebrow">Order {o.id.slice(0, 8)}</div>
      <h1>{o.status === "paid" ? "Thank you — your order is confirmed" : o.status === "cancelled" ? "Payment cancelled" : "Waiting for payment confirmation…"}</h1>
      <p><StatusChip status={o.status} /> <span className="gm-muted gm-small" data-testid="order-status">{o.status}</span></p>
      <div className="gm-card">
        <table className="gm-table"><tbody>
          {o.items.map((i) => <tr key={i.id}><td>{i.productTitle} — {i.shadeName}<div className="gm-muted gm-small">SKU {i.sku}</div></td><td>× {i.quantity}</td><td>{formatMoney(i.unitPriceMinor * i.quantity, i.currency)}</td></tr>)}
          <tr><th colSpan={2}>Total</th><th>{formatMoney(o.totalMinor, o.currency)}</th></tr>
        </tbody></table>
      </div>
      <p className="gm-muted gm-small">Order lines are immutable snapshots of the price you paid. Payment status changes only after a verified processor webhook.</p>
    </div>
  );
}
