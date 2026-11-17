import { removeCartItem } from "@glamotion/core";
import { api } from "@/server/api";
export const DELETE = api<{ id: string }>((c, _r, p) => removeCartItem(c, p.id));
