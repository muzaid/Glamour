import type { Role } from "@glamotion/contracts";

export type Capability =
  | "org.read"
  | "members.manage"
  | "catalog.write"
  | "catalog.publish"
  | "project.write"
  | "creative.write"
  | "review.request"
  | "review.comment"
  | "review.approve"
  | "render.create"
  | "campaign.write"
  | "workflow.approve"
  | "finance.read"
  | "analytics.read";

const ALL: Capability[] = [
  "org.read", "members.manage", "catalog.write", "catalog.publish", "project.write", "creative.write",
  "review.request", "review.comment", "review.approve", "render.create", "campaign.write", "workflow.approve",
  "finance.read", "analytics.read",
];

/**
 * Role → capability matrix (spec §03). Evaluated server-side from membership
 * rows; client-provided role names are never trusted. Mirrored in SQL by
 * `app.has_org_role()` in 0002_rls.sql — keep both in sync (see tests).
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  platform_admin: [],
  organization_owner: ALL,
  organization_admin: ALL,
  brand_manager: ["org.read", "catalog.write", "catalog.publish", "campaign.write", "workflow.approve", "render.create", "review.request", "analytics.read"],
  creative_director: ["org.read", "project.write", "creative.write", "review.request", "render.create", "campaign.write", "workflow.approve", "analytics.read"],
  designer: ["org.read", "project.write", "creative.write", "review.request", "render.create"],
  motion_designer: ["org.read", "project.write", "creative.write", "review.request", "render.create"],
  analyst: ["org.read", "analytics.read"],
  client_reviewer: ["review.comment", "review.approve"],
  shopper: [],
  creator: [],
};

export function roleHas(role: Role, cap: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(cap);
}
