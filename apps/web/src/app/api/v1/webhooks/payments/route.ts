import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { handlePaymentWebhook, toErrorBody } from "@glamotion/core";
import { serviceCtx } from "@/server/runtime";

/** Processor webhook: raw body signature verification + event de-duplication. */
export async function POST(req: Request) {
  const requestId = randomUUID();
  const raw = await req.text();
  if (raw.length > 64 * 1024) return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "Too large", requestId, details: {} } }, { status: 413 });
  try {
    const result = handlePaymentWebhook(serviceCtx(requestId), raw, req.headers.get("x-sandbox-signature"));
    return NextResponse.json({ received: true, ...result });
  } catch (e) {
    const { status, body } = toErrorBody(e, requestId);
    return NextResponse.json(body, { status });
  }
}
