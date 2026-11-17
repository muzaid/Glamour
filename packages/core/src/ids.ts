import { randomUUID, createHash, createHmac, timingSafeEqual } from "node:crypto";

export const newId = (): string => randomUUID();
export const sha256 = (s: string | Uint8Array): string => createHash("sha256").update(s).digest("hex");
export const hmac = (secret: string, payload: string): string => createHmac("sha256", secret).update(payload).digest("hex");
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || !/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export const nowIso = (): string => new Date().toISOString();
