import type { MemoryStore } from "./store";
import type { PaymentProvider, MediaStorage } from "./ports";
import { AppError, notFound } from "./errors";
import { roleHas, type Capability } from "./permissions";
import type { Role } from "@glamotion/contracts";

export interface AppConfig {
  checkoutMode: "disabled" | "sandbox" | "live";
  taxRateBps: number;
  maxActiveRendersPerOrg: number;
  monthlyRenderSecondsPerOrg: number;
  reviewLinkTtlHours: number;
  signedUrlTtlSeconds: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  checkoutMode: "sandbox",
  taxRateBps: 0,
  maxActiveRendersPerOrg: 3,
  monthlyRenderSecondsPerOrg: 600,
  reviewLinkTtlHours: 72,
  signedUrlTtlSeconds: 300,
};

export interface Actor { userId: string }

export interface Ctx {
  store: MemoryStore;
  actor: Actor | null;
  requestId: string;
  config: AppConfig;
  payments?: PaymentProvider;
  media?: MediaStorage;
}

export function requireActor(ctx: Ctx): Actor {
  if (!ctx.actor) throw new AppError("UNAUTHENTICATED", "Sign in required");
  const p = ctx.store.profiles.get(ctx.actor.userId);
  if (!p || p.deletedAt) throw new AppError("UNAUTHENTICATED", "Sign in required");
  return ctx.actor;
}

export function activeRoles(ctx: Ctx, organizationId: string, userId: string): Role[] {
  const roles: Role[] = [];
  for (const m of ctx.store.memberships.values()) {
    if (m.organizationId === organizationId && m.userId === userId && m.status === "active") roles.push(m.role);
  }
  return roles;
}

/**
 * Tenant guard. Non-members get NOT_FOUND (no existence disclosure);
 * members lacking the capability get FORBIDDEN.
 */
export function requireOrgCap(ctx: Ctx, organizationId: string, cap: Capability): Actor {
  const actor = requireActor(ctx);
  const org = ctx.store.organizations.get(organizationId);
  if (!org || org.status !== "active") throw notFound("Organization");
  const roles = activeRoles(ctx, organizationId, actor.userId);
  if (roles.length === 0) throw notFound("Organization");
  if (!roles.some((r) => roleHas(r, cap))) throw new AppError("FORBIDDEN", "You do not have permission for this action");
  return actor;
}

export function orgBySlugForMember(ctx: Ctx, slug: string) {
  const actor = requireActor(ctx);
  const org = [...ctx.store.organizations.values()].find((o) => o.slug === slug);
  if (!org || activeRoles(ctx, org.id, actor.userId).length === 0) throw notFound("Organization");
  return org;
}

export function isPlatformAdmin(ctx: Ctx): boolean {
  if (!ctx.actor) return false;
  return ctx.store.profiles.get(ctx.actor.userId)?.isPlatformAdmin === true;
}
