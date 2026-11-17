import { addCartItem } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api(async (c, req) => addCartItem(c, await json(req)));
