"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShadeSwatch, Disclaimer } from "@glamotion/ui";
import { compareSizes, type Product } from "@glamotion/contracts";
import { apiFetch, money } from "./client";

export function ShadePicker({ product, signedIn, tryOnCapable }: { product: Product; signedIn: boolean; tryOnCapable: boolean }) {
  const first = product.variants.find((v) => v.available > 0) ?? product.variants[0];
  const [selected, setSelected] = useState(first?.id);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const v = product.variants.find((x) => x.id === selected);
  const sized = product.variants.some((x) => !!x.sizeLabel);
  const colours = [...new Map(product.variants.map((x) => [x.shadeName, x])).values()];
  const sizes = sized ? [...new Set(product.variants.map((x) => x.sizeLabel!))].sort(compareSizes) : [];
  const pickColour = (name: string) => {
    const same = product.variants.find((x) => x.shadeName === name && x.sizeLabel === v?.sizeLabel && x.available > 0)
      ?? product.variants.find((x) => x.shadeName === name && x.available > 0) ?? product.variants.find((x) => x.shadeName === name);
    if (same) setSelected(same.id);
  };
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
        <div className="gm-row gm-between"><strong>{sized ? "Colour" : "Shade"}: {v?.shadeName}</strong><span className="gm-muted gm-small">{sized ? (v?.sizeLabel ? `Size ${v.sizeLabel}` : "") : v?.shade.finish}</span></div>
        <div className="gm-swatch-rail" role="group" aria-label={sized ? "Choose a colour" : "Choose a shade"}>
          {(sized ? colours : product.variants).map((x) => (
            <ShadeSwatch key={x.id} hex={x.shade.hex} name={x.shadeName} selected={sized ? x.shadeName === v?.shadeName : x.id === selected} disabled={sized ? !product.variants.some((y) => y.shadeName === x.shadeName && y.available > 0) : x.available <= 0}
              onSelect={() => { if (sized) pickColour(x.shadeName); else setSelected(x.id); void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "shade_selected", props: { variantId: x.id } } }); }} />
          ))}
        </div>
        {sized && (
          <div className="gm-row" role="group" aria-label="Choose a size" style={{ marginTop: 8 }}>
            {sizes.map((z) => {
              const sv = product.variants.find((y) => y.shadeName === v?.shadeName && y.sizeLabel === z);
              return <button key={z} type="button" className={`gm-btn gm-btn-sm ${v?.sizeLabel === z ? "" : "gm-btn-ghost"}`} aria-pressed={v?.sizeLabel === z} disabled={!sv || sv.available <= 0} onClick={() => sv && setSelected(sv.id)} data-testid={`pdp-size-${z}`}>{z}</button>;
            })}
          </div>
        )}
      </div>
      {v && <div className="gm-row gm-between"><span className="gm-price" style={{ fontSize: 24 }}>{money(v.price.amountMinor, v.price.currency)}</span>
        <span className={v.available > 0 ? "gm-muted" : ""} style={{ color: v.available > 0 ? undefined : "var(--gm-danger)" }}>{v.available > 0 ? (v.available < 10 ? `Only ${v.available} left` : "In stock") : "Out of stock"}</span></div>}
      <div className="gm-row">
        <label htmlFor="qty" className="gm-skip">Quantity</label>
        <select id="qty" className="gm-input" style={{ width: 90 }} value={qty} onChange={(e) => setQty(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
        <button className="gm-btn" onClick={add} disabled={!v || v.available <= 0 || busy} data-testid="add-to-cart">{busy ? "Adding…" : "Add to cart"}</button>
        {tryOnCapable && v && <Link className="gm-btn gm-btn-accent" href={sized ? `/try-on?mode=clothes&variant=${v.id}` : `/try-on?variant=${v.id}`} data-testid="try-on-cta">Try it on</Link>}
      </div>
      {msg && <div className={`gm-alert gm-alert-${msg.tone}`} role="status">{msg.text} {msg.tone === "ok" && <Link href="/cart">View cart</Link>}</div>}
      {sized ? <Disclaimer>The clothes mirror is a 2D illustration and does not predict fit. Check the size guide before ordering.</Disclaimer> : <Disclaimer />}
    </div>
  );
}
