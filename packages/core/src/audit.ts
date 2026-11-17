import type { DomainEventType } from "@glamotion/contracts";
import type { Ctx } from "./context";
import { newId, nowIso } from "./ids";

type Meta = Record<string, string | number | boolean | null>;
const FORBIDDEN_META = /(pixel|landmark|image|photo_bytes|card|secret|token|prompt|password)/i;

/** Append-only audit. Never stores photo bytes, card data, secrets or raw prompts. */
export function audit(ctx: Ctx, action: string, entity: string, entityId: string | null, organizationId: string | null, meta: Meta = {}) {
  const clean: Meta = {};
  for (const [k, v] of Object.entries(meta)) if (!FORBIDDEN_META.test(k)) clean[k] = v;
  ctx.store.audit.push({ id: newId(), organizationId, actorId: ctx.actor?.userId ?? null, action, entity, entityId, meta: clean, createdAt: nowIso() });
}

/** Transactional-outbox style domain event (same "transaction" as the state change in MemoryStore). */
export function emit(ctx: Ctx, type: DomainEventType, organizationId: string | null, entityIds: Record<string, string>) {
  ctx.store.outbox.push({
    id: newId(),
    topic: type,
    organizationId,
    payload: { eventId: newId(), type, timestamp: nowIso(), actorId: ctx.actor?.userId ?? null, organizationId, entityIds, correlationId: ctx.requestId },
    createdAt: nowIso(),
    dispatchedAt: null,
  });
}
