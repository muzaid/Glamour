import { describe, expect, it, beforeEach } from "vitest";
import {
  seedDemo, DEMO_USERS, DEMO_ORGS, DEFAULT_CONFIG, type Ctx, type MediaStorage, MemoryStore, AppError,
  listPublishedDrops, getPublishedDrop, createDrop, updateDrop, setDropImage, deleteDrop, listOrgDrops, canReadCatalogMedia,
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
const acode = async (fn: () => Promise<unknown>) => { try { await fn(); } catch (e) { return (e as AppError).code ?? (e as Error).name; } return "OK"; };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeEach(() => { store = seedDemo(); media = new MemMedia(); });

describe("drop posts", () => {
  it("seeds the Arriving Tomorrow post with the exact image URLs and colour sequences", () => {
    const [d] = listPublishedDrops(as(null));
    expect(d!.title).toBe("ARRIVING TOMORROW");
    expect(d!.top.imageUrl).toBe("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_065532_0fd0b9b0-7f8e-4519-b490-6478519b5186.png&w=1200&q=88");
    expect(d!.bottom.imageUrl).toBe("https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261106_065534_5ab4e8d0-8d00-42b4-b0ac-6dc60ea7aac0.png&w=1200&q=88");
    expect(d!.top.colours.map((c) => c.name)).toEqual(["sky", "grass", "tang", "fuchsia", "lemon", "sky", "lilac", "tang"]);
    expect(d!.bottom.colours.map((c) => c.name)).toEqual(["lemon", "lilac", "grass", "cobalt", "fuchsia", "tang", "sky", "lemon"]);
    expect(d!.top.colours[0]!.hex).toBe("#8dd2ef");
  });

  it("admin creates a new drop with new garments and colours; hidden until published", async () => {
    const d = createDrop(as("marco"), L, { title: "NEW IN FRIDAY" });
    expect(code(() => updateDrop(as("marco"), L, d.id, { status: "published" }))).toBe("VALIDATION_FAILED");
    await setDropImage(as("marco"), L, d.id, "top", PNG);
    await setDropImage(as("marco"), L, d.id, "bottom", PNG);
    updateDrop(as("marco"), L, d.id, { topColours: [{ name: "Ink", hex: "#1A1A2E" }], bottomColours: [{ name: "Sand", hex: "#d8c3a5" }, { name: "Moss", hex: "#5b7f3a" }] });
    expect(code(() => getPublishedDrop(as(null), d.id))).toBe("NOT_FOUND");
    updateDrop(as("marco"), L, d.id, { status: "published", position: 0 });
    const pub = listPublishedDrops(as(null));
    expect(pub[0]!.title).toBe("NEW IN FRIDAY");
    expect(pub[0]!.top.colours).toEqual([{ name: "Ink", hex: "#1a1a2e" }]);
    const key = pub[0]!.top.imageUrl!.replace("/api/v1/catalog-media/", "");
    expect(canReadCatalogMedia(as(null), key)).toBe(true);
  });

  it("enforces tenancy, roles and validation", async () => {
    const id = listOrgDrops(as("lena"), L)[0]!.id;
    expect(code(() => listOrgDrops(as("omar"), L))).toBe("NOT_FOUND");
    expect(code(() => updateDrop(as("omar"), N, id, { title: "pwned" }))).toBe("NOT_FOUND");
    expect(code(() => createDrop(as("dana"), N, { title: "x" }))).toBe("FORBIDDEN");
    expect(code(() => updateDrop(as("marco"), L, id, { topColours: [] }))).toBe("ZodError");
    expect(code(() => updateDrop(as("marco"), L, id, { topColours: [{ name: "x", hex: "red" }] }))).toBe("ZodError");
    expect(await acode(() => setDropImage(as("marco"), L, id, "middle", PNG))).toBe("ZodError");
    expect(await acode(() => setDropImage(as("marco"), L, id, "top", new TextEncoder().encode("GIF89a....")))).toBe("VALIDATION_FAILED");
    await deleteDrop(as("marco"), L, id);
    expect(listPublishedDrops(as(null))).toEqual([]);
  });
});
