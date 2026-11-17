import { decideReview } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api<{ token: string }>(async (c, req, p) => ({ data: decideReview(c, p.token, await json(req)) }), { status: 201 });
