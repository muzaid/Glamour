import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDemo, DEMO_USERS, DEMO_ORGS, DEFAULT_CONFIG, type Ctx, type MediaStorage, MemoryStore, AppError,
  runwayFeed, listOrgRunwayLooks, createRunwayLook, updateRunwayLook, setRunwayLookImage, deleteRunwayLook,
  transitionProduct, setProductImage, canReadCatalogMedia, sniffImage, createProduct, listOrgProducts,
} from "./index";

class MemMedia implements MediaStorage {
  files = new Map<string, Uint8Array>();
  async put(k: string, b: Uint8Array) { this.files.set(k, b); }
  async get(k: string) { return this.files.get(k) ?? null; }
  async delete(k: string) { this.files.delete(k); }
  signDownload(k: string) { return k; }
  verifyDownload() { return false; }
}
let store: MemoryStore; let media: MemMedia;
const as = (u: keyof typeof DEMO_USERS | null): Ctx => ({ store, actor: u ? { userId: DEMO_USERS[u].id } : null, requestId: "t", config: { ...DEFAULT_CONFIG }, media });
const L = DEMO_ORGS.lumiere.id, N = DEMO_ORGS.nova.id;
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as AppError).code ?? (e as Error).name; } return "OK"; };
const acode = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { return (e as AppError).code; } return "OK"; };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const product = (title: string) => listOrgProducts(as("lena"), L).find((p) => p.title === title)!;

beforeEach(() => { store = seedDemo(); media = new MemMedia(); });

describe("runway feed", () => {
  it("publishes the six seeded looks with server prices and sizes", () => {
    const feed = runwayFeed(as(null));
    expect(feed.map((l) => l.name)).toEqual(["The City Edit", "Gallery Opening", "Gallery Opening", "Studio Day", "Studio Day", "Studio Day"]);
    const first = feed[0]!.pieces;
    expect(first.map((p) => [p.title, p.left, p.top])).toEqual([["Air Jordan 12 Retro", 47, 27], ["Tshirt", 48, 58], ["Sweatshirt", 45, 96]]);
    expect(first[0]!.price).toEqual({ amountMinor: 14900, currency: "USD" });
    expect(first[0]!.optionName).toBe("Shoe size");
    expect(first[0]!.variants.map((v) => v.label)).toEqual(["40", "41", "42", "43", "44", "45", "46"]);
    expect(first[1]!.variants.map((v) => v.label)).toEqual(["S", "M", "L", "XL"]);
    expect(feed[1]!.pieces[1]!.tag).toBe("New");
  });

  it("a product change in the catalog shows up on the runway; unpublished products drop out", () => {
    const tee = product("Tshirt");
    transitionProduct(as("marco"), L, tee.id, "archived");
    const feed = runwayFeed(as(null));
    expect(feed[0]!.pieces.map((p) => p.title)).toEqual(["Air Jordan 12 Retro", "Sweatshirt"]);
    expect(feed[0]!.pieces.map((p) => p.n)).toEqual([1, 2]);
  });

  it("drafts are hidden until published, and publishing needs a photo and a published pin", async () => {
    const look = createRunwayLook(as("marco"), L, { name: "Weekend" });
    expect(code(() => updateRunwayLook(as("marco"), L, look.id, { status: "published" }))).toBe("VALIDATION_FAILED");
    await setRunwayLookImage(as("marco"), L, look.id, PNG);
    const hoodie = product("Hoodie");
    updateRunwayLook(as("marco"), L, look.id, { pins: [{ productId: hoodie.id, left: 50, top: 40, tag: "New" }] });
    expect(runwayFeed(as(null)).some((l) => l.name === "Weekend")).toBe(false);
    updateRunwayLook(as("marco"), L, look.id, { status: "published", position: 0 });
    const feed = runwayFeed(as(null));
    expect(feed[0]!.name).toBe("Weekend"); // moved to the front, others renumbered
    expect(listOrgRunwayLooks(as("lena"), L).map((l) => l.position)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(feed.find((l) => l.name === "Weekend")!.pieces[0]!.title).toBe("Hoodie");
    expect(feed.find((l) => l.name === "Weekend")!.imageUrl).toMatch(/^\/api\/v1\/catalog-media\/catalog\/[0-9a-f-]{36}\.png$/);
  });
});

describe("runway tenancy & validation", () => {
  it("non-members get NOT_FOUND, members without catalog rights get FORBIDDEN", () => {
    expect(code(() => listOrgRunwayLooks(as("omar"), L))).toBe("NOT_FOUND");
    expect(code(() => createRunwayLook(as("omar"), L, { name: "x" }))).toBe("NOT_FOUND");
    expect(code(() => createRunwayLook(as("dana"), N, { name: "x" }))).toBe("FORBIDDEN");
    expect(code(() => createRunwayLook(as(null), L, { name: "x" }))).toBe("UNAUTHENTICATED");
    const id = listOrgRunwayLooks(as("lena"), L)[0]!.id;
    expect(code(() => updateRunwayLook(as("omar"), N, id, { name: "pwned" }))).toBe("NOT_FOUND"); // look id from another tenant
    expect(code(() => updateRunwayLook(as("omar"), L, id, { name: "pwned" }))).toBe("NOT_FOUND");
  });

  it("cannot pin another organization's product or the same product twice", () => {
    const omarProduct = createProduct(as("omar"), N, { brandId: "30000000-0000-4000-8000-000000000002", title: "Other", slug: "other-x", category: "top" });
    const look = createRunwayLook(as("marco"), L, { name: "x" });
    expect(code(() => updateRunwayLook(as("marco"), L, look.id, { pins: [{ productId: omarProduct.id, left: 1, top: 1 }] }))).toBe("NOT_FOUND");
    const h = product("Hoodie").id;
    expect(code(() => updateRunwayLook(as("marco"), L, look.id, { pins: [{ productId: h, left: 1, top: 1 }, { productId: h, left: 2, top: 2 }] }))).toBe("VALIDATION_FAILED");
    expect(code(() => updateRunwayLook(as("marco"), L, look.id, { pins: [{ productId: h, left: 140, top: 1 }] }))).toBe("ZodError");
  });

  it("rejects non-image uploads by content, not by name", async () => {
    const look = createRunwayLook(as("marco"), L, { name: "x" });
    expect(await acode(() => setRunwayLookImage(as("marco"), L, look.id, new TextEncoder().encode("<svg onload=alert(1)>")))).toBe("VALIDATION_FAILED");
    expect(sniffImage(PNG)?.mime).toBe("image/png");
  });

  it("draft media is visible to members only; published media is public; delete removes the file", async () => {
    const look = createRunwayLook(as("marco"), L, { name: "x" });
    const withImg = await setRunwayLookImage(as("marco"), L, look.id, PNG);
    const key = withImg.imageUrl!.replace("/api/v1/catalog-media/", "");
    expect(canReadCatalogMedia(as(null), key)).toBe(false);
    expect(canReadCatalogMedia(as("omar"), key)).toBe(false);
    expect(canReadCatalogMedia(as("lena"), key)).toBe(true);
    const tee = product("Tshirt");
    const p = await setProductImage(as("marco"), L, tee.id, { bytes: PNG });
    expect(canReadCatalogMedia(as(null), p.imageUrl!.replace("/api/v1/catalog-media/", ""))).toBe(true);
    await deleteRunwayLook(as("marco"), L, look.id);
    expect(media.files.has(key)).toBe(false);
  });
});
