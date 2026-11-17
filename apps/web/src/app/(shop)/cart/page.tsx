import { redirect } from "next/navigation";
import { getCart } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { CartView } from "@/components/CartView";

export const metadata = { title: "Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const c = await ctx();
  if (!c.actor) redirect("/sign-in?next=/cart");
  return <div className="gm-container gm-section"><h1>Your cart</h1><CartView initial={getCart(c)} /></div>;
}
