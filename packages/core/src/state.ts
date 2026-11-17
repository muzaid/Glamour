import { AppError } from "./errors";

type Machine<S extends string> = Record<S, readonly S[]>;

export const productMachine = {
  draft: ["in_review", "published", "archived"],
  in_review: ["draft", "published", "archived"],
  published: ["archived", "draft"],
  archived: ["draft"],
} as const satisfies Machine<"draft" | "in_review" | "published" | "archived">;

export const projectMachine = {
  intake: ["active", "archived"],
  active: ["review", "archived"],
  review: ["active", "approved", "archived"],
  approved: ["delivered", "active", "archived"],
  delivered: ["archived"],
  archived: [],
} as const satisfies Machine<"intake" | "active" | "review" | "approved" | "delivered" | "archived">;

export const renderMachine = {
  queued: ["running", "cancelled", "failed"],
  running: ["completed", "failed", "cancelled", "queued"],
  completed: [],
  failed: [],
  cancelled: [],
} as const satisfies Machine<"queued" | "running" | "completed" | "failed" | "cancelled">;

export const orderMachine = {
  created: ["pending_payment", "cancelled"],
  pending_payment: ["paid", "cancelled"],
  paid: ["fulfilling", "refunded"],
  fulfilling: ["fulfilled", "refunded"],
  fulfilled: ["refunded"],
  cancelled: [],
  refunded: [],
} as const satisfies Machine<"created" | "pending_payment" | "paid" | "fulfilling" | "fulfilled" | "cancelled" | "refunded">;

export const campaignMachine = {
  brief: ["proposals", "archived"],
  proposals: ["editing", "archived"],
  editing: ["compliance_check", "archived"],
  compliance_check: ["editing", "human_approval", "archived"],
  human_approval: ["editing", "approved", "archived"],
  approved: ["scheduled", "published", "archived"],
  scheduled: ["published", "archived"],
  published: ["archived"],
  archived: [],
} as const satisfies Machine<"brief" | "proposals" | "editing" | "compliance_check" | "human_approval" | "approved" | "scheduled" | "published" | "archived">;

export const workflowMachine = {
  proposed: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["awaiting_human", "completed", "failed", "cancelled", "queued"],
  awaiting_human: ["running", "cancelled", "failed"],
  completed: [],
  failed: [],
  cancelled: [],
} as const satisfies Machine<"proposed" | "queued" | "running" | "awaiting_human" | "completed" | "failed" | "cancelled">;

export function canTransition<S extends string>(machine: Machine<S>, from: S, to: S): boolean {
  return (machine[from] as readonly S[]).includes(to);
}

/** Server-side transition guard; invalid transitions are rejected, never coerced. */
export function assertTransition<S extends string>(machine: Machine<S>, from: S, to: S, entity = "entity"): S {
  if (!canTransition(machine, from, to)) {
    throw new AppError("INVALID_TRANSITION", `Cannot move ${entity} from ${from} to ${to}`, { from, to });
  }
  return to;
}
