import { z } from "zod";
import { randomUUID } from "node:crypto";
import { recordPhotoConsent } from "@glamotion/core";
import { api, json } from "@/server/api";

const Body = z.object({ source: z.enum(["demo", "upload", "camera"]), consentVersion: z.string().max(40) });
/**
 * Initialise an ephemeral try-on session. Carries metadata only — no image,
 * landmarks or skin data are ever sent to this endpoint.
 */
export const POST = api(async (c, req) => {
  const body = Body.parse(await json(req));
  if (c.actor && body.source !== "demo") recordPhotoConsent(c, "camera_session", true, body.consentVersion);
  return { data: { sessionId: randomUUID(), persistence: "none", engine: "glamotion-overlay@1" } };
}, { status: 201 });
