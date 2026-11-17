import { redirect } from "next/navigation";
import { listMyLooks } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { SavedLooks } from "@/components/SavedLooks";

export const metadata = { title: "Saved looks" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const c = await ctx();
  if (!c.actor) redirect("/sign-in?next=/saved-looks");
  return <div className="gm-container gm-section"><h1>Saved looks</h1><p className="gm-muted">Looks are saved as recipes (shades + settings). No photos are stored.</p><SavedLooks initial={listMyLooks(c)} /></div>;
}
