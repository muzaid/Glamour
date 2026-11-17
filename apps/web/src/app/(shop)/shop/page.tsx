import Link from "next/link";
import { listPublishedProducts, formatMoney } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { ProductArt } from "@/components/ProductArt";

export const metadata = { title: "Shop" };
const CATS = [["", "All"], ["lipstick", "Lipstick"], ["blush", "Blush"], ["eyeshadow", "Eyeshadow"]] as const;

export default async function Shop({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const sp = await searchParams;
  const products = listPublishedProducts(await ctx(), { category: sp.category || undefined, q: sp.q?.slice(0, 80) || undefined });
  return (
    <div className="gm-container gm-section">
      <h1>Shop</h1>
      <form className="gm-row" role="search" style={{ marginBottom: 24 }}>
        <label htmlFor="q" className="gm-skip">Search products</label>
        <input id="q" name="q" className="gm-input" style={{ maxWidth: 320 }} placeholder="Search lipstick, blush…" defaultValue={sp.q ?? ""} />
        {sp.category && <input type="hidden" name="category" value={sp.category} />}
        <button className="gm-btn gm-btn-sm" type="submit">Search</button>
        <nav className="gm-row" aria-label="Categories">
          {CATS.map(([v, l]) => <Link key={v} className={`gm-btn gm-btn-sm ${sp.category === v || (!sp.category && !v) ? "" : "gm-btn-ghost"}`} href={v ? `/shop?category=${v}` : "/shop"}>{l}</Link>)}
        </nav>
      </form>
      {products.length === 0 ? <p className="gm-muted">No products match. Try another search.</p> : (
        <div className="gm-grid">
          {products.map((p) => (
            <Link key={p.id} href={`/shop/${p.slug}`} className="gm-card gm-product-card" data-testid="product-card">
              <div className="gm-product-art"><ProductArt category={p.category} hex={p.variants[0]?.shade.hex ?? "#E6A7B0"} label={p.imageAlt} /></div>
              <div className="gm-product-body">
                <div className="gm-eyebrow">{p.brandName}</div>
                <div style={{ fontWeight: 600 }}>{p.title}</div>
                <div className="gm-row" style={{ gap: 6, margin: "8px 0" }} aria-hidden="true">
                  {p.variants.map((v) => <span key={v.id} style={{ width: 16, height: 16, borderRadius: "50%", background: v.shade.hex, display: "inline-block", boxShadow: "0 0 0 1px var(--gm-border)" }} />)}
                </div>
                <div className="gm-price">{p.variants[0] ? formatMoney(p.variants[0].price.amountMinor, p.variants[0].price.currency) : ""}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
