import "server-only";
import { notFound, redirect } from "next/navigation";
import { activeRoles, orgBySlugForMember, isAppError, ROLE_CAPABILITIES, type Capability } from "@glamotion/core";
import { ctx } from "./runtime";

/** Resolve the workspace for the signed-in member; non-members get a 404 (no existence disclosure). */
export async function studio(orgSlug: string) {
  const c = await ctx();
  if (!c.actor) redirect(`/sign-in?next=/studio/${orgSlug}/overview`);
  let org;
  try { org = orgBySlugForMember(c, orgSlug); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  const roles = activeRoles(c, org.id, c.actor.userId);
  const can = (cap: Capability) => roles.some((r) => ROLE_CAPABILITIES[r].includes(cap));
  return { c, org, roles, can };
}
