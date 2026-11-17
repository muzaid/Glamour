import { describe, expect, it } from "vitest";
import { SandboxPaymentProvider } from "./payments";
import { LocalMediaStorage } from "./media";
import os from "node:os";
import path from "node:path";

describe("SandboxPaymentProvider", () => {
  const p = new SandboxPaymentProvider("test-secret-0123456789abcdef");
  const evt = { eventId: "evt_1", type: "checkout.completed" as const, providerSessionId: "s", amountMinor: 100, currency: "USD" };
  it("accepts a correctly signed event", () => {
    const { body, signature } = p.buildSignedEvent(evt);
    expect(p.verifyWebhook(body, signature).eventId).toBe("evt_1");
  });
  it("rejects tampered body, bad signature, missing header and stale timestamp", () => {
    const { body, signature } = p.buildSignedEvent(evt);
    expect(() => p.verifyWebhook(body.replace("100", "1"), signature)).toThrow(/signature/);
    expect(() => p.verifyWebhook(body, signature.replace(/v1=[0-9a-f]+/, "v1=" + "0".repeat(64)))).toThrow(/signature/);
    expect(() => p.verifyWebhook(body, null)).toThrow(/signature/);
    const old = p.buildSignedEvent(evt, Math.floor(Date.now() / 1000) - 3600);
    expect(() => p.verifyWebhook(old.body, old.signature)).toThrow(/signature/);
  });
  it("createCheckout is idempotent per key", async () => {
    const a = await p.createCheckout({ orderId: "o", amountMinor: 1, currency: "USD", idempotencyKey: "k1" });
    const b = await p.createCheckout({ orderId: "o", amountMinor: 1, currency: "USD", idempotencyKey: "k1" });
    expect(a.providerSessionId).toBe(b.providerSessionId);
  });
});

describe("LocalMediaStorage", () => {
  const m = new LocalMediaStorage(path.join(os.tmpdir(), `gm-media-${process.pid}`), "sign-secret");
  it("signs and verifies expiring links, rejects traversal", async () => {
    await m.put("renders/a.webm", new Uint8Array([1, 2, 3]));
    const url = new URL(m.signDownload("renders/a.webm", 60), "http://x");
    expect(m.verifyDownload("renders/a.webm", url.searchParams.get("exp")!, url.searchParams.get("sig")!)).toBe(true);
    expect(m.verifyDownload("renders/b.webm", url.searchParams.get("exp")!, url.searchParams.get("sig")!)).toBe(false);
    expect(m.verifyDownload("renders/a.webm", "1", url.searchParams.get("sig")!)).toBe(false);
    await expect(m.put("../etc/passwd.png", new Uint8Array())).rejects.toThrow();
  });
});
