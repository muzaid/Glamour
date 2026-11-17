import "server-only";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { DEFAULT_CONFIG, MemoryStore, seedDemo, type AppConfig, type Ctx } from "@glamotion/core";
import { LocalMediaStorage, SandboxPaymentProvider, UnconfiguredApparelTryOnProvider } from "@glamotion/integrations";
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
  media: LocalMediaStorage;
  llm: LanguageModelProvider;
  apparelTryOn: ApparelTryOnProvider;
}

const g = globalThis as unknown as { __glamotion?: Runtime };

export function runtime(): Runtime {
  if (!g.__glamotion) {
    const llm = process.env.AI_PROVIDER === "anthropic" ? new ClaudeLanguageModel() : new DeterministicLanguageModel();
    g.__glamotion = {
      store: seedDemo(new MemoryStore()),
      config: { ...DEFAULT_CONFIG, checkoutMode: (process.env.CHECKOUT_MODE as AppConfig["checkoutMode"]) ?? "sandbox" },
      payments: new SandboxPaymentProvider(secret("PAYMENT_WEBHOOK_SECRET")),
      // Serverless hosts (e.g. Vercel) only allow writes under the OS temp dir.
      media: new LocalMediaStorage(process.env.VERCEL ? path.join(os.tmpdir(), "glamotion-media") : path.resolve(process.cwd(), ".var/media"), secret("MEDIA_SIGNING_SECRET")),
      llm,
      // Vendor adapter selected via APPAREL_TRYON_PROVIDER once chosen (ADR-010); none ships yet.
      apparelTryOn: new UnconfiguredApparelTryOnProvider(),
    };
  }
  return g.__glamotion;
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
  const h = await headers();
  const requestId = h.get("x-request-id")?.slice(0, 64) || randomUUID();
  const uid = await currentUserId();
  return { store: rt.store, actor: uid ? { userId: uid } : null, requestId, config: rt.config, payments: rt.payments, media: rt.media };
}

/** Service context for the worker/webhook paths (no end-user actor). */
export function serviceCtx(requestId: string): Ctx {
  const rt = runtime();
  return { store: rt.store, actor: null, requestId, config: rt.config, payments: rt.payments, media: rt.media };
}
