import type { Finish, CosmeticCategory, Role } from "@glamotion/contracts";
import { MemoryStore } from "./store";
import { DEFAULT_BOTS, DEFAULT_TOPS } from "./drops";

/**
 * Clearly labelled FICTIONAL demo fixtures (spec §02), plus the owner's own
 * runway lookbook catalog (see seedRunway). No face photos of shoppers.
 */
export const DEMO_USERS = {
  ava: { id: "00000000-0000-4000-8000-0000000000a1", displayName: "Ava (demo shopper)", email: "ava@demo.glamotion.test" },
  bea: { id: "00000000-0000-4000-8000-0000000000a2", displayName: "Bea (demo shopper)", email: "bea@demo.glamotion.test" },
  lena: { id: "00000000-0000-4000-8000-0000000000b1", displayName: "Lena (Maison Lumière owner)", email: "lena@demo.glamotion.test" },
  marco: { id: "00000000-0000-4000-8000-0000000000b2", displayName: "Marco (Maison Lumière brand manager)", email: "marco@demo.glamotion.test" },
  omar: { id: "00000000-0000-4000-8000-0000000000c1", displayName: "Omar (Atelier Nova owner)", email: "omar@demo.glamotion.test" },
  dana: { id: "00000000-0000-4000-8000-0000000000c2", displayName: "Dana (Atelier Nova designer)", email: "dana@demo.glamotion.test" },
  ops: { id: "00000000-0000-4000-8000-0000000000f1", displayName: "Ops (platform admin)", email: "ops@demo.glamotion.test" },
} as const;
export type DemoUserKey = keyof typeof DEMO_USERS;

export const DEMO_ORGS = {
  lumiere: { id: "10000000-0000-4000-8000-000000000001", slug: "maison-lumiere", name: "Maison Lumière (demo brand)", kind: "brand" as const },
  nova: { id: "10000000-0000-4000-8000-000000000002", slug: "atelier-nova", name: "Atelier Nova (demo agency)", kind: "agency" as const },
};

let seq = 0;
const sid = (prefix: string) => `${prefix}${(++seq).toString(16).padStart(12, "0")}`;

export function seedDemo(store = new MemoryStore()): MemoryStore {
  seq = 0;
  const t0 = Date.parse("2026-11-01T09:00:00Z");
  const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
  for (const u of Object.values(DEMO_USERS)) {
    store.profiles.set(u.id, { ...u, isPlatformAdmin: u.id === DEMO_USERS.ops.id, createdAt: at(0), deletedAt: null });
  }
  for (const o of Object.values(DEMO_ORGS)) store.organizations.set(o.id, { ...o, status: "active", createdAt: at(0) });
  const member = (orgId: string, userId: string, role: Role) => {
    const id = sid("20000000-0000-4000-8000-");
    store.memberships.set(id, { id, organizationId: orgId, userId, role, status: "active", createdAt: at(1) });
  };
  member(DEMO_ORGS.lumiere.id, DEMO_USERS.lena.id, "organization_owner");
  member(DEMO_ORGS.lumiere.id, DEMO_USERS.marco.id, "brand_manager");
  member(DEMO_ORGS.nova.id, DEMO_USERS.omar.id, "organization_owner");
  member(DEMO_ORGS.nova.id, DEMO_USERS.dana.id, "designer");

  const brandL = { id: "30000000-0000-4000-8000-000000000001", organizationId: DEMO_ORGS.lumiere.id, name: "Maison Lumière", slug: "maison-lumiere" };
  const brandR = { id: "30000000-0000-4000-8000-000000000002", organizationId: DEMO_ORGS.nova.id, name: "Rosebud Studio (demo client)", slug: "rosebud-studio" };
  store.brands.set(brandL.id, brandL);
  store.brands.set(brandR.id, brandR);

  const product = (
    brand: typeof brandL, slug: string, title: string, category: CosmeticCategory, status: "draft" | "published", minute: number,
    shades: [string, string, string, Finish, number, number][], extra: { description: string; instructions: string; ingredients: string; warnings: string },
  ) => {
    const id = sid("40000000-0000-4000-8000-");
    store.products.set(id, {
      id, organizationId: brand.organizationId, brandId: brand.id, slug, title, category, ...extra, status, imageAlt: `${title} by ${brand.name}`, image: null,
      createdAt: at(minute), updatedAt: at(minute), publishedAt: status === "published" ? at(minute + 1) : null,
    });
    shades.forEach(([sku, name, hex, finish, price, stock], i) => {
      const vid = sid("50000000-0000-4000-8000-");
      store.variants.set(vid, { id: vid, organizationId: brand.organizationId, productId: id, sku, shadeName: name, hex, finish, defaultOpacity: finish === "gloss" ? 0.45 : 0.6, sizeLabel: null, priceMinor: price, currency: "USD", active: true, createdAt: at(minute + i), updatedAt: at(minute + i) });
      store.inventories.set(vid, { variantId: vid, organizationId: brand.organizationId, onHand: stock, reserved: 0 });
    });
    return id;
  };
  const lipCopy = {
    description: "A weightless, velvet-matte lipstick with a soft-focus finish. Demo product — fictional brand.",
    instructions: "Apply from the centre of the lips outward. Layer for more intensity.",
    ingredients: "Demo formula — ingredient list supplied by brand before launch.",
    warnings: "For external use only. Discontinue use if irritation occurs.",
  };
  product(brandL, "velvet-matte-lipstick", "Velvet Matte Lipstick", "lipstick", "published", 10, [
    ["ML-VML-ROSEWOOD", "Rosewood", "#9E4B5A", "matte", 2800, 40],
    ["ML-VML-CORAL", "Coral Muse", "#D9644F", "matte", 2800, 25],
    ["ML-VML-BERRY", "Midnight Berry", "#6E1F3A", "matte", 2800, 12],
    ["ML-VML-NUDE", "Bare Petal", "#C88A7A", "satin", 2800, 0],
  ], lipCopy);
  product(brandL, "silk-glow-blush", "Silk Glow Blush", "blush", "published", 20, [
    ["ML-SGB-PEONY", "Peony", "#E58A9A", "satin", 3200, 30],
    ["ML-SGB-APRICOT", "Apricot", "#E9A07A", "shimmer", 3200, 18],
    ["ML-SGB-MAUVE", "Mauve Dusk", "#B97489", "matte", 3200, 9],
  ], { ...lipCopy, description: "A buildable powder blush with a silk-soft glow. Demo product — fictional brand.", instructions: "Sweep onto the apples of the cheeks and blend upward." });
  product(brandL, "halo-eyeshadow", "Halo Cream Eyeshadow", "eyeshadow", "published", 30, [
    ["ML-HCE-CHAMPAGNE", "Champagne", "#D8B48C", "shimmer", 2400, 22],
    ["ML-HCE-PLUM", "Plum Smoke", "#6C4A6E", "satin", 2400, 15],
    ["ML-HCE-BRONZE", "Bronze Halo", "#9C6B3F", "metallic", 2400, 14],
  ], { ...lipCopy, description: "A cream eyeshadow that sets to a crease-resistant wash of colour. Demo product — fictional brand.", instructions: "Pat onto the lid with a fingertip; build at the outer corner." });
  product(brandL, "glass-lip-gloss", "Glass Lip Gloss", "lip_gloss", "draft", 40, [
    ["ML-GLG-CLEAR", "Crystal", "#E8B6B6", "gloss", 2200, 50],
  ], { ...lipCopy, description: "High-shine gloss. Draft — not yet published." });
  product(brandR, "petal-tint", "Petal Lip & Cheek Tint", "lipstick", "published", 50, [
    ["RB-PT-POPPY", "Poppy", "#C8323C", "satin", 1900, 60],
    ["RB-PT-ROSE", "Rose Water", "#D47A8C", "satin", 1900, 60],
  ], { ...lipCopy, description: "A sheer, buildable tint for lips and cheeks. Demo product — fictional client brand." });
  // Apparel (clothing addendum, ADR-010): colour × size variants on a fictional label.
  const brandA = { id: "30000000-0000-4000-8000-000000000003", organizationId: DEMO_ORGS.lumiere.id, name: "Lumière Atelier", slug: "lumiere-atelier" };
  store.brands.set(brandA.id, brandA);
  const apparel = (slug: string, title: string, category: "top" | "outerwear" | "dress", minute: number, price: number, colours: [string, string, string][], sizes: string[], description: string) => {
    const id = sid("40000000-0000-4000-8000-");
    store.products.set(id, {
      id, organizationId: brandA.organizationId, brandId: brandA.id, slug, title, category, description,
      instructions: "Care: cool hand wash or dry clean. Size guide on request.", ingredients: "Demo fabric composition — supplied by brand before launch.", warnings: "",
      status: "published", imageAlt: `${title} by ${brandA.name}`, image: null, createdAt: at(minute), updatedAt: at(minute), publishedAt: at(minute + 1),
    });
    colours.forEach(([code, name, hex], ci) => sizes.forEach((size, si) => {
      const vid = sid("50000000-0000-4000-8000-");
      store.variants.set(vid, { id: vid, organizationId: brandA.organizationId, productId: id, sku: `LA-${slug.split("-").map((w) => w[0]!.toUpperCase()).join("")}-${code}-${size}`, shadeName: name, hex, finish: "satin", defaultOpacity: 1, sizeLabel: size, priceMinor: price, currency: "USD", active: true, createdAt: at(minute + ci), updatedAt: at(minute + ci) });
      store.inventories.set(vid, { variantId: vid, organizationId: brandA.organizationId, onHand: size === "XL" ? 0 : 6 + ((ci + si) % 4) * 3, reserved: 0 });
    }));
  };
  apparel("silk-shell-top", "Silk Shell Top", "top", 60, 7800, [["IVR", "Ivory", "#EDE6DA"], ["BLS", "Blush", "#E2A4AE"], ["NOR", "Noir", "#1E1B22"]], ["XS", "S", "M", "L", "XL"], "A fluid silk-feel shell with a soft cowl neckline. Demo product — fictional label.");
  apparel("tailored-wool-blazer", "Tailored Wool Blazer", "outerwear", 70, 24800, [["CML", "Camel", "#B9875A"], ["CHR", "Charcoal", "#3B3A40"]], ["S", "M", "L"], "A single-breasted blazer with a softly structured shoulder. Demo product — fictional label.");
  apparel("satin-slip-dress", "Satin Slip Dress", "dress", 80, 16800, [["CHP", "Champagne", "#D9C3A0"], ["EMR", "Emerald", "#1F5F4A"]], ["XS", "S", "M", "L"], "A bias-cut slip dress with adjustable straps. Demo product — fictional label.");
  seedRunway(store, at);
  seedDrops(store, at);
  seedMaison(store, at);
  return store;
}

/**
 * The "Try the Look" lookbook: the owner's reference catalog (names, sizes and
 * prices from their original store export) with art served from the reference
 * host, plus the six published runway looks. Managed in Studio → Runway.
 */
function seedRunway(store: MemoryStore, at: (min: number) => string) {
  const org = DEMO_ORGS.lumiere.id;
  const brand = { id: "30000000-0000-4000-8000-000000000004", organizationId: org, name: "Nike", slug: "nike" };
  store.brands.set(brand.id, brand);
  const SHOE = ["40", "41", "42", "43", "44", "45", "46"], APP = ["S", "M", "L", "XL"];
  const items: [key: string, title: string, slug: string, category: CosmeticCategory, price: number, sizes: string[], file: string][] = [
    ["aj12", "Air Jordan 12 Retro", "air-jordan-12-retro", "footwear", 14900, SHOE, "source-tatum-5-orbit-copy.webp"],
    ["tshirt", "Tshirt", "tshirt", "top", 19900, APP, "source-tshirt.webp"],
    ["sweatshirt", "Sweatshirt", "sweatshirt", "top", 19900, APP, "source-sweatshirt.webp"],
    ["tatum", "Tatum 5 Orbit", "tatum-5-orbit", "footwear", 14900, SHOE, "source-tatum-5-orbit.webp"],
    ["hoodieBlack", "Hoodie Black", "hoodie-black", "top", 19900, APP, "source-hoodie-black.webp"],
    ["sweatshirtPlus", "Sweatshirt Plus", "sweatshirt-plus", "top", 19900, APP, "source-sweatshirt-plus.webp"],
    ["hoodie", "Hoodie", "hoodie", "top", 19900, APP, "source-hoodie.webp"],
    ["luka", "Luka 5", "luka-5", "footwear", 14900, SHOE, "source-air-jordan-12-retro-copy.webp"],
  ];
  const ids: Record<string, string> = {};
  items.forEach(([key, title, slug, category, price, sizes, file], i) => {
    const id = sid("40000000-0000-4000-8000-");
    ids[key] = id;
    const minute = 100 + i * 2;
    store.products.set(id, {
      id, organizationId: org, brandId: brand.id, slug, title, category, status: "published", imageAlt: `${title} by ${brand.name}`,
      image: { kind: "reference", file }, description: "From the original Try the Look lookbook.", instructions: "Size guide on request.",
      ingredients: "Composition supplied by brand before launch.", warnings: "", createdAt: at(minute), updatedAt: at(minute), publishedAt: at(minute + 1),
    });
    sizes.forEach((size, si) => {
      const vid = sid("50000000-0000-4000-8000-");
      store.variants.set(vid, { id: vid, organizationId: org, productId: id, sku: `RW-${slug.toUpperCase()}-${size}`, shadeName: "Standard", hex: "#151413", finish: "natural", defaultOpacity: 1, sizeLabel: size, priceMinor: price, currency: "USD", active: true, createdAt: at(minute + si / 100), updatedAt: at(minute) });
      store.inventories.set(vid, { variantId: vid, organizationId: org, onHand: 10, reserved: 0 });
    });
  });
  const looks: [name: string, model: number, description: string, pins: [key: string, left: number, top: number, tag: string | null][]][] = [
    ["The City Edit", 1, "A charcoal knit and easy denim.", [["aj12", 47, 27, null], ["tshirt", 48, 58, null], ["sweatshirt", 45, 96, null]]],
    ["Gallery Opening", 5, "A clean white tee and relaxed denim.", [["tatum", 50, 28, null], ["hoodieBlack", 48, 58, "New"], ["tshirt", 45, 88, null]]],
    ["Gallery Opening", 4, "Olive knitwear. A grounded palette.", [["sweatshirtPlus", 50, 28, null], ["tatum", 48, 58, "New"], ["tshirt", 45, 88, null]]],
    ["Studio Day", 6, "Black, white and laid-back denim.", [["hoodieBlack", 50, 28, null], ["aj12", 48, 58, null], ["tshirt", 45, 88, null]]],
    ["Studio Day", 3, "Burgundy layers. A tailored perspective.", [["sweatshirt", 50, 28, null], ["tatum", 48, 58, null], ["tshirt", 45, 88, null]]],
    ["Studio Day", 2, "A grey crew and your favourite denim.", [["hoodie", 50, 28, null], ["luka", 48, 58, null], ["tshirt", 45, 88, null]]],
  ];
  looks.forEach(([name, model, description, pins], i) => {
    const id = sid("60000000-0000-4000-8000-");
    store.runwayLooks.set(id, {
      id, organizationId: org, name, description, position: i, status: "published",
      image: { kind: "reference", file: `model-${model}-640.webp`, large: `original-look-${model}.webp` },
      pins: pins.map(([key, left, top, tag]) => ({ productId: ids[key]!, left, top, tag })),
      createdBy: DEMO_USERS.lena.id, createdAt: at(200 + i), updatedAt: at(200 + i),
    });
  });
}

/** The "Arriving Tomorrow" drop post: white hoodie + white sweat shorts, recoloured in the browser. */
function seedDrops(store: MemoryStore, at: (min: number) => string) {
  const id = sid("70000000-0000-4000-8000-");
  store.dropPosts.set(id, {
    id, organizationId: DEMO_ORGS.lumiere.id, title: "ARRIVING TOMORROW", position: 0, status: "published",
    top: { image: { kind: "higgs", path: "user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261106_065532_0fd0b9b0-7f8e-4519-b490-6478519b5186.png" }, colours: DEFAULT_TOPS.map((c) => ({ ...c })) },
    bottom: { image: { kind: "higgs", path: "user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261106_065534_5ab4e8d0-8d00-42b4-b0ac-6dc60ea7aac0.png" }, colours: DEFAULT_BOTS.map((c) => ({ ...c })) },
    createdBy: DEMO_USERS.lena.id, createdAt: at(300), updatedAt: at(300),
  });
}

/** Maison Edit build-your-look pieces: four fictional stores, keys t/k/s/g + index (1 = what the base photo wears). */
export const MAISON_STORES = [
  { key: "norra", id: "30000000-0000-4000-8000-000000000011", name: "NORRA", slug: "norra" },
  { key: "lune", id: "30000000-0000-4000-8000-000000000012", name: "Lune&Co", slug: "lune-co" },
  { key: "meridian", id: "30000000-0000-4000-8000-000000000013", name: "MERIDIAN", slug: "meridian" },
  { key: "ode", id: "30000000-0000-4000-8000-000000000014", name: "ODE STUDIO", slug: "ode-studio" },
] as const;
export const MAISON_PIECES: { key: string; store: string; name: string; priceMinor: number; c: number; r: number; tags: string[] }[] = [
  { key: "t1", store: "norra", name: "Off-shoulder top", priceMinor: 2990, c: 0, r: 0, tags: ["minimal", "soft"] },
  { key: "t2", store: "meridian", name: "Ribbed turtleneck", priceMinor: 3490, c: 1, r: 0, tags: ["minimal", "sharp"] },
  { key: "t3", store: "lune", name: "Cropped knit cardigan", priceMinor: 4500, c: 2, r: 0, tags: ["romantic", "wine"] },
  { key: "k1", store: "meridian", name: "Pleated mini skirt", priceMinor: 4999, c: 0, r: 1, tags: ["minimal", "sharp"] },
  { key: "k2", store: "norra", name: "Denim mini skirt", priceMinor: 3990, c: 1, r: 1, tags: ["casual"] },
  { key: "k3", store: "ode", name: "Bouclé tweed skirt", priceMinor: 5900, c: 2, r: 1, tags: ["romantic", "soft"] },
  { key: "s1", store: "norra", name: "Leather knee boots", priceMinor: 12900, c: 0, r: 2, tags: ["minimal", "sharp"] },
  { key: "s2", store: "ode", name: "Leather sneakers", priceMinor: 8900, c: 1, r: 2, tags: ["casual"] },
  { key: "s3", store: "lune", name: "Wine knee boots", priceMinor: 13900, c: 2, r: 2, tags: ["romantic", "wine"] },
  { key: "g1", store: "ode", name: "Buckle shoulder bag", priceMinor: 18900, c: 0, r: 3, tags: ["minimal", "sharp"] },
  { key: "g2", store: "lune", name: "Quilted mini bag", priceMinor: 15900, c: 1, r: 3, tags: ["romantic", "soft"] },
  { key: "g3", store: "meridian", name: "Wine top-handle bag", priceMinor: 17500, c: 2, r: 3, tags: ["romantic", "wine"] },
];
export const maisonSlug = (key: string) => `maison-${key}`;

function seedMaison(store: MemoryStore, at: (min: number) => string) {
  const org = DEMO_ORGS.lumiere.id;
  for (const b of MAISON_STORES) store.brands.set(b.id, { id: b.id, organizationId: org, name: b.name, slug: b.slug });
  const category = { t: "top", k: "bottoms", s: "footwear", g: "bags" } as const;
  const size = { t: "M", k: "M", s: "38", g: null } as const;
  MAISON_PIECES.forEach((p, i) => {
    const brand = MAISON_STORES.find((b) => b.key === p.store)!;
    const cat = p.key[0] as keyof typeof category;
    const id = sid("40000000-0000-4000-8000-");
    const minute = 400 + i;
    store.products.set(id, {
      id, organizationId: org, brandId: brand.id, slug: maisonSlug(p.key), title: p.name, category: category[cat], status: "published",
      imageAlt: `${p.name} by ${brand.name}`, image: null, description: "From the Maison Edit build-your-look collection. Demo product — fictional store.",
      instructions: "Size guide on request.", ingredients: "Composition supplied by brand before launch.", warnings: "",
      createdAt: at(minute), updatedAt: at(minute), publishedAt: at(minute),
    });
    const vid = sid("50000000-0000-4000-8000-");
    store.variants.set(vid, { id: vid, organizationId: org, productId: id, sku: `ME-${p.key.toUpperCase()}`, shadeName: "Standard", hex: "#151515", finish: "natural", defaultOpacity: 1, sizeLabel: size[cat], priceMinor: p.priceMinor, currency: "USD", active: true, createdAt: at(minute), updatedAt: at(minute) });
    store.inventories.set(vid, { variantId: vid, organizationId: org, onHand: 20, reserved: 0 });
  });
}
