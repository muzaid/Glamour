import { listMyLooks, saveLook } from "@glamotion/core";
import { api, json } from "@/server/api";
export const GET = api((c) => ({ data: listMyLooks(c) }));
export const POST = api(async (c, req) => ({ data: saveLook(c, await json(req)) }), { status: 201 });
