import Link from "next/link";
import { runtime, currentUserId, DEMO_MODE } from "@/server/runtime";
import { activeRoles } from "@glamotion/core";

export async function Header() {
  const uid = await currentUserId();
  const rt = runtime();
  const profile = uid ? rt.store.profiles.get(uid) : null;
  const orgs = uid ? [...rt.store.organizations.values()].filter((o) => activeRoles({ store: rt.store } as never, o.id, uid).length > 0) : [];
  const cartCount = uid ? [...rt.store.cartItems.values()].filter((i) => rt.store.carts.get(i.cartId)?.userId === uid).reduce((n, i) => n + i.quantity, 0) : 0;
  return (
    <>
      {DEMO_MODE && (
        <div className="gm-demo-banner">Demo environment · fictional brands · sandbox payments only · <Link href="/sign-in">switch demo user</Link></div>
      )}
      <header className="gm-header">
        <div className="gm-container gm-header-inner">
          <Link href="/" className="gm-logo">GLAM<span>O</span>TION</Link>
          <nav className="gm-nav" aria-label="Shop">
            <Link href="/shop">Shop</Link>
            <Link href="/try-on">Beauty Mirror</Link>
            {uid && <Link href="/saved-looks">Saved looks</Link>}
            {uid && <Link href="/orders">Orders</Link>}
            {orgs.length > 0 && <Link href={`/studio/${orgs[0]!.slug}/overview`}>Studio</Link>}
            {profile?.isPlatformAdmin && <Link href="/ops/jobs">Ops</Link>}
          </nav>
          <div className="gm-row">
            <Link className="gm-btn gm-btn-ghost gm-btn-sm" href="/cart" aria-label={`Cart, ${cartCount} items`}>Cart · {cartCount}</Link>
            {profile ? <Link className="gm-btn gm-btn-ghost gm-btn-sm" href="/account">{profile.displayName.split(" ")[0]}</Link> : <Link className="gm-btn gm-btn-sm" href="/sign-in">Sign in</Link>}
          </div>
        </div>
      </header>
    </>
  );
}
