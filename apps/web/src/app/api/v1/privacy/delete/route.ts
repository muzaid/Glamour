import { z } from "zod";
import { deleteMyData } from "@glamotion/core";
import { api, json } from "@/server/api";
export const POST = api(async (c, req) => { z.object({ confirm: z.literal(true) }).parse(await json(req)); return deleteMyData(c); });
