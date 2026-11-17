import { findRenderJobForActor, requireActor } from "@glamotion/core";
import { api } from "@/server/api";
export const GET = api<{ id: string }>((c, _r, p) => { requireActor(c); return { data: findRenderJobForActor(c, p.id) }; });
