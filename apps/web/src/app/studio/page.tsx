import { redirect } from "next/navigation";
import { activeRoles } from "@glamotion/core";
import { ctx } from "@/server/runtime";

export default async function StudioIndex() {
  const c = await ctx();
  if (!c.actor) redirect("/sign-in?next=/studio");
  const org = [...c.store.organizations.values()].find((o) => activeRoles(c, o.id, c.actor!.userId).length > 0);
  if (!org) redirect("/");
  redirect(`/studio/${org.slug}/overview`);
}
