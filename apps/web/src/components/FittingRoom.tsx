"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { compareSizes, type ApparelCategory } from "@glamotion/contracts";
import { BUILTIN_ASSETS, GARMENT_ASSET } from "@glamotion/motion";
import { outfitSvg, SKIN_TONES, type SkinTone } from "@glamotion/tryon";
import type { GarmentProduct } from "./ApparelStudio";
import { apiFetch, money } from "./client";

type Tab = "all" | ApparelCategory;
type Worn = { productId: string; colour: string };
const TABS: [Tab, string][] = [["all", "All"], ["top", "Tops"], ["outerwear", "Outerwear"], ["dress", "Dresses"]];
const SUBTITLE: Record<ApparelCategory, string> = { top: "Fluid, easy layer", outerwear: "Structured shoulder", dress: "Bias-cut drape" };

function thumb(category: ApparelCategory, hex: string, size = 110) {
  const a = BUILTIN_ASSETS[GARMENT_ASSET[category]]!;
  const [w, h] = a.viewBox;
  const s = size / Math.max(w, h);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${Math.round(w * s)}" height="${Math.round(h * s)}" aria-hidden="true">${a.svg(hex).replace(/gm-/g, `gm-t${category}${hex.slice(1)}-`)}</svg>`;
}

/**
 * Spatial fitting room: the illustrated figure wears the selected outfit while
 * garment cards orbit left and right. Uses the same anchor-based fit as the
 * camera mirror; "Try on me" hands the selection to the on-device mirror.
 */
export function FittingRoom({ products, signedIn }: { products: GarmentProduct[]; signedIn: boolean }) {
  const [tab, setTab] = useState<Tab>("all");
  const list = useMemo(() => products.filter((p) => tab === "all" || p.category === tab), [products, tab]);
  const starter = products.find((p) => p.category === "top") ?? products.find((p) => p.category !== "outerwear") ?? products[0];
  const [focusId, setFocusId] = useState(starter?.productId ?? "");
  const [colourBy, setColourBy] = useState<Record<string, string>>(() => Object.fromEntries(products.map((p) => [p.productId, p.variants[0]!.colour])));
  const [sizeBy, setSizeBy] = useState<Record<string, string | null>>({});
  const [worn, setWorn] = useState<{ base?: Worn; outer?: Worn }>(() => {
    return starter && starter.category !== "outerwear" ? { base: { productId: starter.productId, colour: starter.variants[0]!.colour } } : {};
  });
  const [skin, setSkin] = useState<SkinTone>("honey");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: React.ReactNode } | null>(null);
  const byId = useMemo(() => new Map(products.map((p) => [p.productId, p])), [products]);

  // One card per product colour, like a rail of hangers.
  const cards = useMemo(() => list.flatMap((p) => [...new Map(p.variants.map((v) => [v.colour, v.hex])).entries()].map(([colour, hex]) => ({ p, colour, hex, key: `${p.productId}:${colour}` }))), [list]);
  const focusIndex = Math.max(0, cards.findIndex((c) => c.p.productId === focusId && c.colour === colourBy[focusId]));
  const focus = cards[focusIndex]?.p ?? list[0];

  function wear(p: GarmentProduct, colour = colourBy[p.productId]!) {
    setFocusId(p.productId);
    setMsg(null);
    setWorn((w) => p.category === "outerwear" ? { ...w, outer: w.outer?.productId === p.productId && w.outer.colour === colour ? undefined : { productId: p.productId, colour } }
      : p.category === "dress" ? { base: { productId: p.productId, colour } } : { ...w, base: { productId: p.productId, colour } });
    void apiFetch("/api/v1/analytics", { method: "POST", body: { name: "tryon_effect_applied", props: { region: "garment", productId: p.productId, surface: "fitting_room" } } });
  }
  function step(d: number) {
    if (!cards.length) return;
    const next = cards[(focusIndex + d + cards.length) % cards.length]!;
    setColourBy((m) => ({ ...m, [next.p.productId]: next.colour }));
    wear(next.p, next.colour);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,select,textarea")) return;
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const layers = (["base", "outer"] as const).flatMap((slot) => {
    const w = worn[slot]; const p = w && byId.get(w.productId);
    const hex = p?.variants.find((v) => v.colour === w!.colour)?.hex;
    return p && hex ? [{ category: p.category, hex }] : [];
  });
  const svg = useMemo(() => outfitSvg(layers, { skin, background: false, label: `Illustrated figure wearing ${layers.length} selected item${layers.length === 1 ? "" : "s"}` }), [JSON.stringify(layers), skin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!focus) return <p className="gm-muted">No clothing is published yet.</p>;
  const colours = [...new Map(focus.variants.map((v) => [v.colour, v.hex])).entries()];
  const sizes = [...new Set(focus.variants.map((v) => v.size))].sort(compareSizes);
  const colour = colourBy[focus.productId]!;
  const size = sizeBy[focus.productId] ?? null;
  const variant = focus.variants.find((v) => v.colour === colour && v.size === size) ?? null;

  async function addToBag() {
    if (!signedIn) return setMsg({ tone: "error", text: <>Sign in to add to your bag. <Link href="/sign-in?next=/fitting-room">Sign in</Link></> });
    if (!variant) return setMsg({ tone: "error", text: "Choose a size first." });
    const r = await apiFetch("/api/v1/cart/items", { method: "POST", body: { productVariantId: variant.variantId, quantity: 1 } });
    setMsg(r.ok ? { tone: "ok", text: <>Added {focus!.title} · {colour} · {size}. <Link href="/cart">View bag</Link></> } : { tone: "error", text: r.error.message });
  }

  // Cards orbit the figure: up to three on each side of the focused item.
  const n = cards.length;
  const half = Math.floor((n - 1) / 2);
  const slots: number[] = [];
  for (let k = Math.min(3, half); k >= 1; k--) slots.push(-k);
  for (let k = 1; k <= Math.min(3, n - 1 - half); k++) slots.push(k);
  const wornKeys = new Set([worn.base && `${worn.base.productId}:${worn.base.colour}`, worn.outer && `${worn.outer.productId}:${worn.outer.colour}`]);

  return (
    <div className="gm-fit">
      <nav className="gm-fit-rail" aria-label="Fitting room">
        <Link href="/shop?category=apparel" title="Shop clothing" aria-label="Shop clothing">👕</Link>
        <Link href="/cart" title="Bag" aria-label="Bag">👜</Link>
        <Link href="/saved-looks" title="Saved looks" aria-label="Saved looks">♡</Link>
        <Link href="/account" title="Account" aria-label="Account">◎</Link>
      </nav>
      <div className="gm-fit-tabs" role="tablist" aria-label="Category">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className="gm-fit-tab" onClick={() => { setTab(t); const first = products.find((p) => t === "all" || p.category === t); if (first) setFocusId(first.productId); }} data-testid={`fit-tab-${t}`}>{label}</button>
        ))}
      </div>
      <div className="gm-fit-word" aria-hidden="true">FIT</div>
      <div className="gm-fit-stage">
        <div className="gm-fit-figure" key={`${worn.base?.productId}${worn.base?.colour}${worn.outer?.productId}${worn.outer?.colour}${skin}`} dangerouslySetInnerHTML={{ __html: svg }} data-testid="fit-figure" />
        {slots.map((o) => {
          const card = cards[(focusIndex + o + n * 3) % n]!;
          const d = Math.abs(o), sign = Math.sign(o);
          const style = {
            ["--x" as string]: `${sign * (110 + d * 140)}px`, ["--xm" as string]: `${sign * (60 + d * 90)}px`,
            ["--s" as string]: String(1 - (d - 1) * 0.16), ["--a" as string]: String(1 - (d - 1) * 0.3), zIndex: 10 - d,
          } as React.CSSProperties;
          return (
            <button key={card.key} className="gm-fit-card" data-depth={d} data-worn={wornKeys.has(card.key) || undefined} style={style}
              onClick={() => { setColourBy((m) => ({ ...m, [card.p.productId]: card.colour })); wear(card.p, card.colour); }}
              aria-label={`Wear ${card.p.title} in ${card.colour}`} data-testid={`fit-card-${card.p.slug}-${card.colour}`}>
              <span className="gm-fit-card-art" dangerouslySetInnerHTML={{ __html: thumb(card.p.category, card.hex, d === 1 ? 120 : 90) }} />
              <span className="gm-fit-card-title">{card.p.title}</span>
              <span className="gm-fit-card-sub">{card.colour} · {SUBTITLE[card.p.category]}</span>
            </button>
          );
        })}
      </div>
      <div className="gm-fit-tones">
        <button className="gm-fit-arrow" onClick={() => step(-1)} aria-label="Previous item">‹</button>
        <span role="radiogroup" aria-label="Figure skin tone" className="gm-row" style={{ gap: 8 }}>
          {(Object.keys(SKIN_TONES) as SkinTone[]).map((t) => (
            <button key={t} role="radio" aria-checked={skin === t} aria-label={`${t} tone`} className="gm-fit-tone" style={{ background: SKIN_TONES[t][0] }} onClick={() => setSkin(t)} />
          ))}
        </span>
        <button className="gm-fit-arrow" onClick={() => step(1)} aria-label="Next item">›</button>
      </div>
      <section className="gm-fit-bar" aria-label="Selected item">
        <span className="gm-fit-bar-art" dangerouslySetInnerHTML={{ __html: thumb(focus.category, colours.find(([c]) => c === colour)![1], 48) }} />
        <div className="gm-fit-bar-info">
          <strong data-testid="fit-title">{focus.title}</strong>
          <span>{SUBTITLE[focus.category]} · {money(focus.variants[0]!.priceMinor, focus.variants[0]!.currency)}</span>
        </div>
        <div className="gm-fit-bar-group" role="group" aria-label="Size">
          <span className="gm-fit-bar-label">Size</span>
          {sizes.map((z) => {
            const sv = focus.variants.find((v) => v.colour === colour && v.size === z);
            return <button key={z} className="gm-fit-size" aria-pressed={size === z} disabled={!sv || sv.available <= 0} onClick={() => setSizeBy((s) => ({ ...s, [focus.productId]: z }))} data-testid={`fit-size-${z}`}>{z}</button>;
          })}
        </div>
        <div className="gm-fit-bar-group" role="radiogroup" aria-label="Colour">
          <span className="gm-fit-bar-label">Colour · {colour}</span>
          {colours.map(([c, hex]) => (
            <button key={c} role="radio" aria-checked={c === colour} aria-label={c} className="gm-fit-dot" style={{ background: hex }}
              onClick={() => { setColourBy((m) => ({ ...m, [focus.productId]: c })); wear(focus, c); }} data-testid={`fit-colour-${c}`} />
          ))}
        </div>
        <div className="gm-fit-bar-actions">
          <button className="gm-btn gm-btn-sm" onClick={addToBag} data-testid="fit-add">Add to bag</button>
          <Link className="gm-btn gm-btn-ghost gm-btn-sm" href={`/try-on?mode=clothes${variant ? `&variant=${variant.variantId}` : ""}`}>Try on me</Link>
        </div>
      </section>
      {msg && <div className={`gm-alert gm-alert-${msg.tone} gm-fit-msg`} role="status">{msg.text}</div>}
      <p className="gm-fit-note">Illustrated figure · 2D preview, not a fit prediction</p>
    </div>
  );
}
