import { getReview } from "@glamotion/core";
import { api } from "@/server/api";
export const GET = api<{ token: string }>((c, _r, p) => ({ data: getReview(c, p.token) }));
