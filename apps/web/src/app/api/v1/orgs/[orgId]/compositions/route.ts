import { z } from "zod";
import { AspectRatio } from "@glamotion/contracts";
import { PRESETS, type PresetId } from "@glamotion/motion";
import { createCompositionFromProduct } from "@glamotion/core";
import { api, json } from "@/server/api";

const Body = z.object({
  productId: z.string().uuid(),
  preset: z.enum(PRESETS.map((p) => p.id) as [PresetId, ...PresetId[]]),
  aspectRatio: AspectRatio.default("9:16"),
  projectId: z.string().uuid().nullable().optional(),
});
export const POST = api<{ orgId: string }>(async (c, req, p) => {
  const b = Body.parse(await json(req));
  const { composition } = createCompositionFromProduct(c, p.orgId, b);
  return { data: composition };
}, { status: 201 });
