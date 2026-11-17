import Link from "next/link";
import { activeRoles } from "@glamotion/core";
import { studio } from "@/server/studio";

export default async function StudioLayout({ children, params }: { children: React.ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, roles } = await studio(orgSlug);
  const myOrgs = [...c.store.organizations.values()].filter((o) => activeRoles(c, o.id, c.actor!.userId).length > 0);
  const base = `/studio/${org.slug}`;
  return (
    <div className="gm-studio gm-studio-shell">
      <header className="gm-header" style={{ background: "var(--gm-surface)" }}>
        <div className="gm-container gm-header-inner" style={{ maxWidth: "none" }}>
          <Link href="/" className="gm-logo">GLAM<span>O</span>TION</Link>
          <span className="gm-eyebrow">Studio</span>
          <nav aria-label="Workspace switcher" className="gm-row" style={{ flex: 1 }}>
            {myOrgs.map((o) => <Link key={o.id} href={`/studio/${o.slug}/overview`} className={`gm-btn gm-btn-sm ${o.id === org.id ? "" : "gm-btn-ghost"}`} aria-current={o.id === org.id ? "page" : undefined}>{o.name}</Link>)}
          </nav>
          <span className="gm-muted gm-small">{roles.map((r) => r.replace(/_/g, " ")).join(", ")}</span>
          <Link className="gm-btn gm-btn-ghost gm-btn-sm" href="/shop">Storefront</Link>
        </div>
      </header>
      <nav className="gm-studio-nav" aria-label="Workspace">
        <Link href={`${base}/overview`}>Overview</Link>
        <Link href={`${base}/products`}>Products</Link>
        <Link href={`${base}/projects`}>Projects</Link>
        <Link href={`${base}/campaigns`}>Campaigns & agents</Link>
      </nav>
      <main id="main" className="gm-container" style={{ maxWidth: 1400, paddingTop: 24, paddingBottom: 48 }}>{children}</main>
    </div>
  );
}
