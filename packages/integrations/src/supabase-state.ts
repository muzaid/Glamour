import { hmac, safeEqualHex, type MediaStorage, type StateRemote, type StateRow } from "@glamotion/core";

/**
 * Server-only client for the token-guarded glamotion_* RPCs (ADR-015). The
 * publishable key only identifies the project; every call also carries the
 * server-side state token, which never reaches the browser or the logs.
 */
export class SupabaseStateClient {
  constructor(private readonly url: string, private readonly publishableKey: string, private readonly token: string) {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error("Invalid Supabase URL");
    if (token.length < 32) throw new Error("State token too short");
  }
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: this.publishableKey, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ p_token: this.token, ...args }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`State store ${fn} failed (${res.status})`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }
}

export class SupabaseStateRemote implements StateRemote {
  constructor(private readonly client: SupabaseStateClient) {}
  pull(since: number) { return this.client.rpc<{ rev: number; rows: (StateRow & { r: number })[] }>("glamotion_state_pull", { p_since: since }); }
  push(rows: StateRow[]) { return this.client.rpc<number>("glamotion_state_push", { p_rows: rows }); }
}

const KEY_RE = /^[a-z0-9][a-z0-9/_-]{0,200}\.(webm|png|jpg|webp|json)$/;

/** Private media in the shared database; downloads still go through short-lived signed URLs. */
export class SupabaseMediaStorage implements MediaStorage {
  constructor(private readonly client: SupabaseStateClient, private readonly signingSecret: string, private readonly baseUrl = "/api/v1/media") {}
  private check(key: string) { if (!KEY_RE.test(key) || key.includes("..")) throw new Error("Invalid media key"); }
  async put(key: string, bytes: Uint8Array, mime?: string) {
    this.check(key);
    await this.client.rpc("glamotion_media_put", { p_key: key, p_mime: mime ?? "application/octet-stream", p_b64: Buffer.from(bytes).toString("base64") });
  }
  async get(key: string) {
    this.check(key);
    const r = await this.client.rpc<{ mime: string; b64: string } | null>("glamotion_media_get", { p_key: key });
    return r ? new Uint8Array(Buffer.from(r.b64, "base64")) : null;
  }
  async delete(key: string) { this.check(key); await this.client.rpc("glamotion_media_delete", { p_key: key }); }
  signDownload(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${this.baseUrl}/${key}?exp=${exp}&sig=${hmac(this.signingSecret, `${key}:${exp}`)}`;
  }
  verifyDownload(key: string, exp: string, sig: string) {
    const e = Number(exp);
    if (!Number.isInteger(e) || e < Math.floor(Date.now() / 1000) || !KEY_RE.test(key)) return false;
    return safeEqualHex(hmac(this.signingSecret, `${key}:${e}`), sig);
  }
}
