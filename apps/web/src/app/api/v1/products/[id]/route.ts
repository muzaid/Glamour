import { getPublishedProduct } from "@glamotion/core";
import { api } from "@/server/api";
export const GET = api<{ id: string }>((c, _r, p) => ({ data: getPublishedProduct(c, p.id) }));
