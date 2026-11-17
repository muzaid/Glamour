import { checkout } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api(async (c, req) => checkout(c, await json(req), req.headers.get("idempotency-key")), { status: 201 });
