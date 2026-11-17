import { promises as fs } from "node:fs";
import path from "node:path";
import { hmac, safeEqualHex, type MediaStorage } from "@glamotion/core";

const KEY_RE = /^[a-z0-9][a-z0-9/_-]{0,200}\.(webm|png|jpg|json)$/;

/**
 * Local private object storage for development (stands in for a private
 * Supabase Storage bucket). Downloads only through short-lived HMAC-signed URLs.
 */
export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root: string, private readonly signingSecret: string, private readonly baseUrl = "/api/v1/media") {}

  private resolve(key: string) {
    if (!KEY_RE.test(key) || key.includes("..")) throw new Error("Invalid media key");
    return path.join(this.root, key);
  }
  async put(key: string, bytes: Uint8Array, _mime?: string) {
    const p = this.resolve(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, bytes);
  }
  async get(key: string) {
    try { return new Uint8Array(await fs.readFile(this.resolve(key))); } catch { return null; }
  }
  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
  signDownload(key: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = hmac(this.signingSecret, `${key}:${exp}`);
    return `${this.baseUrl}/${key}?exp=${exp}&sig=${sig}`;
  }
  verifyDownload(key: string, exp: string, sig: string) {
    const e = Number(exp);
    if (!Number.isInteger(e) || e < Math.floor(Date.now() / 1000)) return false;
    try { this.resolve(key); } catch { return false; }
    return safeEqualHex(hmac(this.signingSecret, `${key}:${e}`), sig);
  }
}
