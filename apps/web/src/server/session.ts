import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "gm_session";

/** Demo session token: `<userId>.<exp>.<hmac>`. Replaced by Supabase Auth in production (ticket F-005). */
export function signSession(userId: string, secret: string, ttlSeconds = 60 * 60 * 8) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const mac = createHmac("sha256", secret).update(`${userId}.${exp}`).digest("hex");
  return `${userId}.${exp}.${mac}`;
}

export function verifySession(token: string, secret: string): string | null {
  const [uid, exp, mac] = token.split(".");
  if (!uid || !exp || !mac || !/^[0-9a-f-]{36}$/.test(uid)) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  const expect = createHmac("sha256", secret).update(`${uid}.${exp}`).digest("hex");
  if (expect.length !== mac.length || !timingSafeEqual(Buffer.from(expect), Buffer.from(mac))) return null;
  return uid;
}
