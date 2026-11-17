/** Provider adapter ports (spec §19). Fakes live in @glamotion/integrations. */
export interface PaymentCheckout { providerSessionId: string; redirectUrl: string }
export interface VerifiedPaymentEvent { eventId: string; type: "checkout.completed" | "checkout.expired" | "payment.failed"; providerSessionId: string; amountMinor: number; currency: string }
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: { orderId: string; amountMinor: number; currency: string; idempotencyKey: string; requestId: string }): Promise<PaymentCheckout>;
  /** Must verify signature over the raw body; throws WEBHOOK_SIGNATURE_INVALID. */
  verifyWebhook(rawBody: string, signatureHeader: string | null): VerifiedPaymentEvent;
  refund(input: { orderId: string; amountMinor: number; idempotencyKey: string }): Promise<{ refundId: string }>;
}

export interface MediaStorage {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
  signDownload(key: string, ttlSeconds: number): string;
  verifyDownload(key: string, exp: string, sig: string): boolean;
}

export interface LanguageModelRequest { promptId: string; promptVersion: number; system: string; input: unknown; jsonSchemaHint: string; requestId: string; organizationId: string; maxTokens: number }
export interface LanguageModelResult { output: unknown; inputTokens: number; outputTokens: number; model: string }
export interface LanguageModelProvider {
  readonly name: string;
  complete(req: LanguageModelRequest): Promise<LanguageModelResult>;
}

export interface EmailProvider { send(input: { to: string; template: string; idempotencyKey: string; vars: Record<string, string> }): Promise<void> }
