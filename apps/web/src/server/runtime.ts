import "server-only";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { AppError, DEFAULT_CONFIG, MemoryStore, StateSync, seedDemo, type AppConfig, type Ctx, type MediaStorage } from "@glamotion/core";
import { LocalMediaStorage, SandboxPaymentProvider, SupabaseMediaStorage, SupabaseStateClient, SupabaseStateRemote, UnconfiguredApparelTryOnProvider } from "@glamotion/integrations";
import { ClaudeLanguageModel, DeterministicLanguageModel } from "@glamotion/agents";
import type { ApparelTryOnProvider, LanguageModelProvider } from "@glamotion/core";
import { verifySession, SESSION_COOKIE } from "./session";

const isProd = process.env.NODE_ENV === "production";
export const DEMO_MODE = !isProd || process.env.GLAMOTION_DEMO_MODE === "1";

/** Secrets: env only. Dev-only fallbacks are refused in production. */
export function secret(name: string): string {
  const v = process.env[name];
  if (v && v.length >= 16) return v;
  if (isProd && process.env.GLAMOTION_DEMO_MODE !== "1") throw new Error(`Missing required secret ${name}`);
  return `dev-only-${name.toLowerCase()}-not-for-production`;
}

interface Runtime {
  store: MemoryStore;
  config: AppConfig;
  payments: SandboxPaymentProvider;
  media: MediaStorage;
  /** Shared durable state (ADR-015); null when SUPABASE_* / GLAMOTION_STATE_TOKEN are not configured. */
  sync: StateSync | null;
  llm: LanguageModelProvider;
  apparelTryOn: ApparelTryOnProvider;
}

const g = globalThis as unknown as { __glamotion?: Runtime };

export function runtime(): Runtime {
  if (!g.__glamotion) {
    const llm = process.env.AI_PROVIDER === "anthropic" ? new ClaudeLanguageModel() : new DeterministicLanguageModel();
    const store = seedDemo(new MemoryStore());
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, token = process.env.GLAMOTION_STATE_TOKEN;
    const client = url && key && token ? new SupabaseStateClient(url, key, token) : null;
    if (!client && isProd && process.env.VERCEL) console.warn(JSON.stringify({ level: "warn", msg: "shared state not configured; data is per-instance" }));
    g.__glamotion = {
      store,
      sync: client ? new StateSync(store, new SupabaseStateRemote(client)) : null,
      config: { ...DEFAULT_CONFIG, checkoutMode: (process.env.CHECKOUT_MODE as AppConfig["checkoutMode"]) ?? "sandbox" },
      payments: new SandboxPaymentProvider(secret("PAYMENT_WEBHOOK_SECRET")),
      // Serverless hosts (e.g. Vercel) only allow writes under the OS temp dir.
      media: client
        ? new SupabaseMediaStorage(client, secret("MEDIA_SIGNING_SECRET"))
        : new LocalMediaStorage(process.env.VERCEL ? path.join(os.tmpdir(), "glamotion-media") : path.resolve(process.cwd(), ".var/media"), secret("MEDIA_SIGNING_SECRET")),
      llm,
      // Vendor adapter selected via APPAREL_TRYON_PROVIDER once chosen (ADR-010); none ships yet.
      apparelTryOn: new UnconfiguredApparelTryOnProvider(),
    };
  }
  return g.__glamotion;
}

/** Bring this instance up to date with the shared store (no-op without one). */
export async function pullState() {
  const sync = runtime().sync;
  if (!sync) return;
  try { await sync.pull(); } catch { console.error(JSON.stringify({ level: "error", msg: "state pull failed" })); }
}

/** Persist local changes; a failure is reported to the caller instead of silently losing the change. */
export async function flushState() {
  const sync = runtime().sync;
  if (!sync) return;
  try { await sync.flush(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "state flush failed" }));
    throw new AppError("INTERNAL", "Couldn’t save your changes. Please try again.");
  }
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  const uid = raw ? verifySession(raw, secret("GLAMOTION_SESSION_SECRET")) : null;
  if (!uid) return null;
  const p = runtime().store.profiles.get(uid);
  return p && !p.deletedAt ? uid : null;
}

export async function ctx(): Promise<Ctx> {
  const rt = runtime();
  await pullState();
  // Safety net for code paths that mutate outside the api() wrapper.
  try { after(() => flushState().catch(() => undefined)); } catch { /* outside a request scope */ }
  const h = await headers();
  const requestId = h.get("x-request-id")?.slice(0, 64) || randomUUID();
  const uid = await currentUserId();
  return { store: rt.store, actor: uid ? { userId: uid } : null, requestId, config: rt.config, payments: rt.payments, media: rt.media };
}

/** Service context for the worker/webhook paths (no end-user actor). Callers pull/flush state. */
export function serviceCtx(requestId: string): Ctx {
  const rt = runtime();
  return { store: rt.store, actor: null, requestId, config: rt.config, payments: rt.payments, media: rt.media };
}

/** Sandbox checkout session, read from the shared store so any instance can serve the hosted payment page. */
export async function sandboxSession(id: string): Promise<{ orderId: string; amountMinor: number; currency: string } | null> {
  await pullState();
  const cs = [...runtime().store.checkoutSessions.values()].find((x) => x.providerSessionId === id);
  return cs ? { orderId: cs.orderId, amountMinor: cs.totalMinor, currency: cs.currency } : null;
}
