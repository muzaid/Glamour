import { track } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api(async (c, req) => { track(c, await json(req)); return { ok: true }; }, { status: 202 });
