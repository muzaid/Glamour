import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError } from "@glamotion/core";
import { api, json } from "@/server/api";
import { runtime, sandboxSession, DEMO_MODE } from "@/server/runtime";

const Body = z.object({ session: z.string().regex(/^sbx_cs_[a-f0-9]{32}$/), outcome: z.enum(["success", "cancel"]) });

/** Simulates the processor: signs an event and delivers it to our webhook over HTTP, like a real provider would. */
export const POST = api(async (_c, req) => {
  if (!DEMO_MODE) throw new AppError("NOT_FOUND", "Not found");
  const { session, outcome } = Body.parse(await json(req));
  const rt = runtime();
  const s = await sandboxSession(session);
  if (!s) throw new AppError("NOT_FOUND", "Unknown session");
  const evt = rt.payments.buildSignedEvent({ eventId: `evt_${randomUUID().replace(/-/g, "")}`, type: outcome === "success" ? "checkout.completed" : "checkout.expired", providerSessionId: session, amountMinor: s.amountMinor, currency: s.currency });
  const res = await fetch(new URL("/api/v1/webhooks/payments", req.url), { method: "POST", headers: { "content-type": "application/json", "x-sandbox-signature": evt.signature }, body: evt.body });
  if (!res.ok) throw new AppError("INTERNAL", "Webhook delivery failed");
  return { delivered: true };
});
