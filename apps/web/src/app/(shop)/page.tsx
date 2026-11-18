import Link from "next/link";
import { listPublishedProducts, formatMoney } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { HeroStage } from "@/components/HeroStage";
import { ProductArt } from "@/components/ProductArt";

export default async function Home() {
  const products = listPublishedProducts(await ctx());
  const swatches = [...new Map(products.flatMap((p) => p.variants.map((v) => [v.shade.hex, { hex: v.shade.hex, name: v.shadeName }] as const))).values()].slice(0, 12);
  return (
    <>
      <section className="gm-hero">
        <div className="gm-hero-orb" style={{ width: 420, height: 420, background: "#E6A7B0", top: -160, right: -80 }} />
        <div className="gm-hero-orb" style={{ width: 360, height: 360, background: "#9C86EA", bottom: -200, left: -120, opacity: 0.3 }} />
        <div className="gm-container gm-hero-inner">
          <div>
            <div className="gm-eyebrow">Cosmetics · Virtual try-on · Motion studio</div>
            <h1>See it on you before you choose it.</h1>
            <p style={{ fontSize: 18, color: "#D9D2DB", maxWidth: 520 }}>Preview makeup shades and clothing on your own photo or camera — processed privately on your device — then shop the exact colour and size.</p>
            <div className="gm-row" style={{ marginTop: 24 }}>
              <Link className="gm-btn" href="/try-on">Try makeup</Link>
              <Link className="gm-btn" href="/try-on?mode=clothes">Try clothes</Link>
              <Link className="gm-btn gm-btn-ghost" href="/shop">Shop the edit</Link>
            </div>
          </div>
          <HeroStage swatches={swatches} />
        </div>
      </section>
      <section className="gm-section gm-container">
        <div className="gm-row gm-between"><h2>New this season</h2><Link href="/shop">View all</Link></div>
        <div className="gm-grid">
          {products.slice(0, 4).map((p) => (
            <Link key={p.id} href={`/shop/${p.slug}`} className="gm-card gm-product-card">
              <div className="gm-product-art"><ProductArt category={p.category} hex={p.variants[0]?.shade.hex ?? "#E6A7B0"} label={p.imageAlt} imageUrl={p.imageUrl} /></div>
              <div className="gm-product-body">
                <div className="gm-eyebrow">{p.brandName}</div>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div className="gm-muted gm-small">{new Set(p.variants.map((v) => v.shadeName)).size} {p.variants.some((v) => v.sizeLabel) ? "colours" : "shades"} · <span className="gm-price">{p.variants[0] ? formatMoney(p.variants[0].price.amountMinor, p.variants[0].price.currency) : ""}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="gm-section gm-container gm-grid">
        {[
          ["On-device by default", "Camera frames and photos never leave your device unless you explicitly choose to save one."],
          ["Honest previews", "Try-on is illustrative. We never claim an exact shade match or analyse your skin."],
          ["For brands & agencies", "Turn the same product into an approved, on-brand motion campaign — humans approve every release."],
        ].map(([t, d]) => (
          <div key={t} className="gm-card"><h3>{t}</h3><p className="gm-muted">{d}</p></div>
        ))}
      </section>
    </>
  );
}
