"use client";
import { useState } from "react";
import Link from "next/link";
import type { listMyLooks } from "@glamotion/core";
import { apiFetch } from "./client";

type Look = ReturnType<typeof listMyLooks>[number];

export function SavedLooks({ initial }: { initial: Look[] }) {
  const [looks, setLooks] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  async function del(id: string) {
    const r = await apiFetch(`/api/v1/looks/${id}`, { method: "DELETE" });
    if (r.ok) setLooks((l) => l.filter((x) => x.id !== id)); else setMsg(r.error.message);
  }
  async function addAll(look: Look) {
    for (const i of look.items.filter((x) => x.live && x.available > 0)) {
      const r = await apiFetch("/api/v1/cart/items", { method: "POST", body: { productVariantId: i.productVariantId, quantity: 1 } });
      if (!r.ok) { setMsg(r.error.message); return; }
    }
    setMsg("Available shades added to your cart.");
  }
  if (looks.length === 0) return <div className="gm-card"><p>No saved looks yet.</p><Link className="gm-btn" href="/try-on">Open Beauty Mirror</Link></div>;
  return (
    <div className="gm-stack">
      {msg && <div className="gm-alert" role="status">{msg}</div>}
      <div className="gm-grid">
        {looks.map((l) => (
          <div key={l.id} className="gm-card gm-stack" data-testid="saved-look">
            <h3>{l.name}</h3>
            {l.items.map((i) => (
              <div key={i.productVariantId} className="gm-row">
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: "50%", background: i.hex, display: "inline-block" }} />
                <span>{i.cosmeticRegion}: {i.productTitle} — {i.shadeName} · {Math.round(i.opacity * 100)}%</span>
                {!i.live ? <span className="gm-chip gm-chip-bad">unavailable</span> : i.available <= 0 ? <span className="gm-chip gm-chip-warn">out of stock</span> : null}
              </div>
            ))}
            <div className="gm-row">
              <Link className="gm-btn gm-btn-sm" href={`/try-on?look=${l.id}`}>Open in mirror</Link>
              <button className="gm-btn gm-btn-ghost gm-btn-sm" onClick={() => addAll(l)}>Add to cart</button>
              <button className="gm-btn gm-btn-danger gm-btn-sm" onClick={() => del(l.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
