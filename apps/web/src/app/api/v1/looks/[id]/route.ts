import { deleteLook } from "@glamotion/core";
import { api } from "@/server/api";
export const DELETE = api<{ id: string }>((c, _r, p) => { deleteLook(c, p.id); return { ok: true }; });
