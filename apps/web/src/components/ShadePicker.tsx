"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShadeSwatch, Disclaimer } from "@glamotion/ui";
import type { Product } from "@glamotion/contracts";
import { apiFetch, money } from "./client";

export function ShadePicker({ product, signedIn, tryOnCapable }: { product: Product; signedIn: boolean; tryOnCapable: boolean }) {
  const first = product.variants.find((v) => v.available > 0) ?? product.variants[0];
  const [selected, setSelected] = useState(first?.id);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const v = product.variants.find((x) => x.id === selected);
  async function add() {
    if (!v) return;
    if (!signedIn) { router.push(`/sign-in?next=/shop/${product.slug}`); return; }
    setBusy(true); setMsg(null);
    const r = await apiFetch("/api/v1/cart/items", { method: "POST", body: { productVariantId: v.id, quantity: qty } });
    setBusy(false);
    if (r.ok) { setMsg({ tone: "ok", text: `Added ${v.shadeName} to your cart.` }); void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "cart_added", props: { productId: product.id, variantId: v.id } } }); router.refresh(); }
    else setMsg({ tone: "error", text: r.error.message });
  }
  return (
    <div className="gm-stack">
      <div>
        <div className="gm-row gm-between"><strong>Shade: {v?.shadeName}</strong><span className="gm-muted gm-small">{v?.shade.finish}</span></div>
        <div className="gm-swatch-rail" role="group" aria-label="Choose a shade">
          {product.variants.map((x) => (
            <ShadeSwatch key={x.id} hex={x.shade.hex} name={x.shadeName} selected={x.id === selected} disabled={x.available <= 0}
              onSelect={() => { setSelected(x.id); void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "shade_selected", props: { variantId: x.id } } }); }} />
          ))}
        </div>
      </div>
      {v && <div className="gm-row gm-between"><span className="gm-price" style={{ fontSize: 24 }}>{money(v.price.amountMinor, v.price.currency)}</span>
        <span className={v.available > 0 ? "gm-muted" : ""} style={{ color: v.available > 0 ? undefined : "var(--gm-danger)" }}>{v.available > 0 ? (v.available < 10 ? `Only ${v.available} left` : "In stock") : "Out of stock"}</span></div>}
      <div className="gm-row">
        <label htmlFor="qty" className="gm-skip">Quantity</label>
        <select id="qty" className="gm-input" style={{ width: 90 }} value={qty} onChange={(e) => setQty(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
        <button className="gm-btn" onClick={add} disabled={!v || v.available <= 0 || busy} data-testid="add-to-cart">{busy ? "Adding…" : "Add to cart"}</button>
        {tryOnCapable && v && <Link className="gm-btn gm-btn-accent" href={`/try-on?variant=${v.id}`} data-testid="try-on-cta">Try it on</Link>}
      </div>
      {msg && <div className={`gm-alert gm-alert-${msg.tone}`} role="status">{msg.text} {msg.tone === "ok" && <Link href="/cart">View cart</Link>}</div>}
      <Disclaimer />
    </div>
  );
}
