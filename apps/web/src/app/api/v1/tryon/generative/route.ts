import { NextResponse } from "next/server";
import { isApparel } from "@glamotion/contracts";
import { AppError, audit, recordPhotoConsent, requireActor } from "@glamotion/core";
import { api } from "@/server/api";
import { runtime } from "@/server/runtime";

const MAX_PERSON = 8 * 1024 * 1024, MAX_GARMENT = 2 * 1024 * 1024;
const PERSON_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const hits = new Map<string, number[]>(); // in-memory per-user limiter (OP-005 replaces with shared store)

function magicOk(b: Uint8Array, mime: string) {
  if (mime === "image/png") return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8;
  if (mime === "image/webp") return b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return false;
}

/** Availability check — the browser calls this first and uploads nothing if no provider is configured. */
export const GET = api(() => {
  const p = runtime().apparelTryOn;
  return { available: p.disclosure !== null, provider: p.disclosure ? p.name : null, disclosure: p.disclosure };
});

/**
 * Opt-in cloud clothing try-on. The person image is held in memory for this
 * request only: never written to storage, never logged, never sent to
 * runtime AI agents. Requires a signed-in adult and explicit consent.
 */
export const POST = api(async (c, req) => {
  const actor = requireActor(c);
  const provider = runtime().apparelTryOn;
  if (!provider.disclosure) throw new AppError("FEATURE_DISABLED", "Realistic AI try-on isn't configured for this store yet. The on-device preview is still available.");
  const now = Date.now();
  const recent = (hits.get(actor.userId) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= 5) throw new AppError("QUOTA_EXCEEDED", "You've reached the hourly limit for AI previews.");
  const form = await req.formData();
  if (form.get("consent") !== "true") throw new AppError("VALIDATION_FAILED", "Explicit consent is required before a photo is sent for AI processing.");
  const consentVersion = String(form.get("consentVersion") ?? "").slice(0, 40);
  const variant = c.store.variants.get(String(form.get("productVariantId") ?? ""));
  const product = variant && c.store.products.get(variant.productId);
  if (!variant || !product || product.status !== "published" || !isApparel(product.category)) throw new AppError("PRODUCT_UNAVAILABLE", "Choose a published clothing item.");
  const person = form.get("person"), garment = form.get("garment");
  if (!(person instanceof File) || !(garment instanceof File)) throw new AppError("VALIDATION_FAILED", "Photo and garment image are required.");
  if (!(PERSON_TYPES as readonly string[]).includes(person.type) || person.size > MAX_PERSON || garment.type !== "image/png" || garment.size > MAX_GARMENT) throw new AppError("VALIDATION_FAILED", "Unsupported or oversized image.");
  const pb = new Uint8Array(await person.arrayBuffer()), gb = new Uint8Array(await garment.arrayBuffer());
  if (!magicOk(pb, person.type) || !magicOk(gb, "image/png")) throw new AppError("VALIDATION_FAILED", "File contents don't match the image type.");
  recent.push(now); hits.set(actor.userId, recent);
  recordPhotoConsent(c, "cloud_generation", true, consentVersion || "unknown");
  audit(c, "tryon.cloud_requested", "product_variant", variant.id, null, { provider: provider.name, category: product.category });
  const out = await provider.generate({ personImage: pb, personMime: person.type as (typeof PERSON_TYPES)[number], garmentImage: gb, garmentMime: "image/png", category: product.category, requestId: c.requestId });
  return new NextResponse(Buffer.from(out.image), { headers: { "content-type": out.mime, "cache-control": "no-store", "x-request-id": c.requestId } });
});
