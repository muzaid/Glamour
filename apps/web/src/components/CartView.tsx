"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartView as Cart } from "@glamotion/core";
import { apiFetch, money, newKey } from "./client";

export function CartView({ initial }: { initial: Cart }) {
  const [cart, setCart] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [idemKey] = useState(newKey);
  const router = useRouter();
  async function remove(id: string) {
    const r = await apiFetch<Cart>(`/api/v1/cart/items/${id}`, { method: "DELETE" });
    if (r.ok) { setCart(r.data); router.refresh(); } else setErr(r.error.message);
  }
  async function checkout() {
    setBusy(true); setErr(null);
    const r = await apiFetch<{ redirectUrl: string; orderId: string }>("/api/v1/checkout", { method: "POST", idempotencyKey: idemKey, body: { expectedTotalMinor: cart.totalMinor, currency: cart.currency } });
    if (r.ok) { window.location.assign(r.data.redirectUrl); return; }
    setBusy(false);
    setErr(r.error.message);
    if (r.error.code === "PRICE_CHANGED" || r.error.code === "PRODUCT_UNAVAILABLE" || r.error.code === "OUT_OF_STOCK") {
      const fresh = await apiFetch<Cart>("/api/v1/cart");
      if (fresh.ok) setCart(fresh.data);
    }
  }
  if (cart.lines.length === 0) return <div className="gm-card"><p>Your cart is empty.</p><Link className="gm-btn" href="/shop">Shop products</Link></div>;
  return (
    <div className="gm-grid-2">
      <div className="gm-stack">
        {cart.lines.map((l) => (
          <div key={l.itemId} className="gm-card gm-card-tight gm-row gm-between" data-testid="cart-line">
            <div className="gm-row">
              <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: "50%", background: l.hex, display: "inline-block" }} />
              <div>
                <Link href={`/shop/${l.productSlug}`} style={{ fontWeight: 600 }}>{l.productTitle}</Link>
                <div className="gm-muted gm-small">{l.brandName} · {l.shadeName} · SKU {l.sku} · Qty {l.quantity}</div>
                {l.issue && <div style={{ color: "var(--gm-danger)" }} className="gm-small">{l.issue === "UNAVAILABLE" ? "No longer available" : `Only ${l.available} left`}</div>}
              </div>
            </div>
            <div className="gm-row"><strong>{money(l.lineTotalMinor, l.currency)}</strong><button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => remove(l.itemId)} aria-label={`Remove ${l.productTitle} ${l.shadeName}`}>Remove</button></div>
          </div>
        ))}
      </div>
      <aside className="gm-card gm-stack" aria-label="Order summary">
        <h2>Summary</h2>
        <div className="gm-row gm-between"><span>Subtotal</span><span>{money(cart.subtotalMinor, cart.currency ?? "USD")}</span></div>
        <div className="gm-row gm-between"><span>Tax</span><span>{money(cart.taxMinor, cart.currency ?? "USD")}</span></div>
        <div className="gm-row gm-between" style={{ fontSize: 20 }}><strong>Total</strong><strong data-testid="cart-total">{money(cart.totalMinor, cart.currency ?? "USD")}</strong></div>
        <p className="gm-muted gm-small">Prices and stock are re-verified on the server when you check out. Sandbox mode — no card is charged.</p>
        {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
        <button className="gm-btn" onClick={checkout} disabled={!cart.checkoutReady || busy} data-testid="checkout">{busy ? "Starting checkout…" : "Checkout (sandbox)"}</button>
      </aside>
    </div>
  );
}
