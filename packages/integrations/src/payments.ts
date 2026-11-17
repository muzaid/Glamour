import { AppError, hmac, safeEqualHex, newId, type PaymentProvider, type VerifiedPaymentEvent } from "@glamotion/core";

/**
 * Sandbox payment provider. Mirrors the shape of real processors: hosted
 * checkout session + signed webhooks (`t=<unix>,v1=<hmac-sha256(t.body)>`).
 * It never moves money. Real processors implement the same port (ticket CC-012).
 */
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = "sandbox";
  private sessions = new Map<string, { orderId: string; amountMinor: number; currency: string }>();
  private byIdempotency = new Map<string, string>();
  constructor(private readonly webhookSecret: string, private readonly toleranceSeconds = 300) {
    if (webhookSecret.length < 16) throw new Error("Sandbox webhook secret too short");
  }

  async createCheckout(input: { orderId: string; amountMinor: number; currency: string; idempotencyKey: string }) {
    const existing = this.byIdempotency.get(input.idempotencyKey);
    const id = existing ?? `sbx_cs_${newId().replace(/-/g, "")}`;
    if (!existing) {
      this.byIdempotency.set(input.idempotencyKey, id);
      this.sessions.set(id, { orderId: input.orderId, amountMinor: input.amountMinor, currency: input.currency });
    }
    return { providerSessionId: id, redirectUrl: `/checkout/sandbox?session=${id}` };
  }

  session(id: string) {
    return this.sessions.get(id) ?? null;
  }

  /** Simulates the processor calling our webhook. Used by the sandbox page and tests. */
  buildSignedEvent(evt: VerifiedPaymentEvent, timestamp = Math.floor(Date.now() / 1000)) {
    const body = JSON.stringify({ id: evt.eventId, type: evt.type, data: { session: evt.providerSessionId, amount: evt.amountMinor, currency: evt.currency } });
    return { body, signature: `t=${timestamp},v1=${hmac(this.webhookSecret, `${timestamp}.${body}`)}` };
  }

  verifyWebhook(rawBody: string, signatureHeader: string | null): VerifiedPaymentEvent {
    const fail = () => new AppError("WEBHOOK_SIGNATURE_INVALID", "Invalid webhook signature");
    if (!signatureHeader) throw fail();
    const parts = Object.fromEntries(signatureHeader.split(",").map((kv) => kv.split("=", 2) as [string, string]));
    const t = Number(parts.t);
    if (!Number.isFinite(t) || !parts.v1) throw fail();
    if (Math.abs(Date.now() / 1000 - t) > this.toleranceSeconds) throw fail();
    if (!safeEqualHex(hmac(this.webhookSecret, `${t}.${rawBody}`), parts.v1)) throw fail();
    let parsed: { id?: unknown; type?: unknown; data?: { session?: unknown; amount?: unknown; currency?: unknown } };
    try { parsed = JSON.parse(rawBody); } catch { throw fail(); }
    const type = parsed.type;
    if (typeof parsed.id !== "string" || (type !== "checkout.completed" && type !== "checkout.expired" && type !== "payment.failed")) throw new AppError("VALIDATION_FAILED", "Unsupported event");
    return { eventId: parsed.id, type, providerSessionId: String(parsed.data?.session ?? ""), amountMinor: Number(parsed.data?.amount ?? -1), currency: String(parsed.data?.currency ?? "") };
  }

  async refund(): Promise<{ refundId: string }> {
    // Refund decisions require business rules + human approval (spec §08). Not automated in P0.
    throw new AppError("NOT_IMPLEMENTED", "Refunds are a P1 workflow (ticket CC-011)");
  }
}
