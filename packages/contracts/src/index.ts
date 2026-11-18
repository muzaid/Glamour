/**
 * @glamotion/contracts — canonical Zod schemas and TypeScript types shared by
 * the web app, worker, SQL layer and runtime agents. Field names mirror
 * supabase/migrations/0001_core.sql (snake_case in SQL, camelCase here; the
 * mapping lives in packages/core/src/store).
 */
import { z } from "zod";

export const Uuid = z.string().uuid();
export const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, "ISO-4217 code");
/** Money is always integer minor units + ISO currency. Never floats. */
export const Money = z.object({ amountMinor: z.number().int(), currency: CurrencyCode });
export type Money = z.infer<typeof Money>;

// ---------------------------------------------------------------- Roles
export const Role = z.enum([
  "platform_admin",
  "organization_owner",
  "organization_admin",
  "brand_manager",
  "creative_director",
  "designer",
  "motion_designer",
  "analyst",
  "client_reviewer",
  "shopper",
  "creator",
]);
export type Role = z.infer<typeof Role>;

// ---------------------------------------------------------------- Catalog
export const ProductStatus = z.enum(["draft", "in_review", "published", "archived"]);
export type ProductStatus = z.infer<typeof ProductStatus>;
/** Product category. Name kept for compatibility; includes apparel since the clothing addendum (ADR-010). */
export const CosmeticCategory = z.enum(["lipstick", "lip_gloss", "blush", "eyeshadow", "eyeliner", "foundation", "skincare", "fragrance", "top", "outerwear", "dress", "bottoms", "footwear", "bags"]);
export type CosmeticCategory = z.infer<typeof CosmeticCategory>;
export const ProductCategory = CosmeticCategory;
export type ProductCategory = CosmeticCategory;
export const ApparelCategory = z.enum(["top", "outerwear", "dress"]);
export type ApparelCategory = z.infer<typeof ApparelCategory>;
export const APPAREL_CATEGORIES: readonly ApparelCategory[] = ApparelCategory.options;
export const isApparel = (c: string): c is ApparelCategory => (APPAREL_CATEGORIES as readonly string[]).includes(c);
/** Everything that is worn and sold by size (try-on overlays exist only for ApparelCategory). */
export const WEARABLE_CATEGORIES: readonly CosmeticCategory[] = ["top", "outerwear", "dress", "bottoms", "footwear"];
export const isWearable = (c: string): boolean => (WEARABLE_CATEGORIES as readonly string[]).includes(c);
/** Fashion = wearables + accessories such as bags (the storefront "apparel" filter). */
export const isFashion = (c: string): boolean => isWearable(c) || c === "bags";
const SIZE_RANK = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
/** Sort sizes in wearing order (XS < S < M …), numeric sizes ascending, unknown labels last. */
export const compareSizes = (a: string, b: string): number => {
  const ra = SIZE_RANK.indexOf(a.toUpperCase()), rb = SIZE_RANK.indexOf(b.toUpperCase());
  if (ra >= 0 && rb >= 0) return ra - rb;
  const na = parseFloat(a), nb = parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return ra >= 0 ? -1 : rb >= 0 ? 1 : a.localeCompare(b);
};
export const SizeLabel = z.string().regex(/^[A-Za-z0-9./ -]{1,12}$/);
export const Finish = z.enum(["matte", "satin", "gloss", "shimmer", "metallic", "natural"]);
export type Finish = z.infer<typeof Finish>;
export const CosmeticRegion = z.enum(["lips", "cheeks", "eyelids"]);
export type CosmeticRegion = z.infer<typeof CosmeticRegion>;

export const CATEGORY_REGION: Partial<Record<CosmeticCategory, CosmeticRegion>> = {
  lipstick: "lips",
  lip_gloss: "lips",
  blush: "cheeks",
  eyeshadow: "eyelids",
};

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const ShadeData = z.object({
  hex: HexColor,
  /** Brand-supplied CIELAB reference (D65). Illustrative only. */
  lab: z.tuple([z.number(), z.number(), z.number()]).optional(),
  finish: Finish,
  defaultOpacity: z.number().min(0).max(1).default(0.55),
});
export type ShadeData = z.infer<typeof ShadeData>;

export const ProductVariant = z.object({
  id: Uuid,
  productId: Uuid,
  sku: z.string().min(2).max(64).regex(/^[A-Z0-9][A-Z0-9-_]*$/),
  shadeName: z.string().min(1).max(80),
  shade: ShadeData,
  price: Money,
  sizeLabel: z.string().max(40).optional(),
  available: z.number().int().min(0),
});
export type ProductVariant = z.infer<typeof ProductVariant>;

export const Product = z.object({
  id: Uuid,
  organizationId: Uuid,
  brandId: Uuid,
  brandName: z.string(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(140),
  category: CosmeticCategory,
  description: z.string().max(4000),
  instructions: z.string().max(2000).default(""),
  ingredients: z.string().max(4000).default(""),
  warnings: z.string().max(2000).default(""),
  status: ProductStatus,
  imageAlt: z.string().max(300).default(""),
  /** Packshot URL (public catalog media or the reference lookbook host); null → vector illustration. */
  imageUrl: z.string().nullable().default(null),
  variants: z.array(ProductVariant),
});
export type Product = z.infer<typeof Product>;

// ---------------------------------------------------------------- Catalog images
/** Host of the original "Try the Look" lookbook art (allow-listed in the CSP). */
export const REFERENCE_ASSET_BASE = "https://reel-ref-try-the-look.vercel.app/assets/";
/** Generated garment cut-outs, served through the images.higgs.ai proxy (sends CORS, usable as CSS masks). */
export const HIGGS_ORIGIN = "https://d8j0ntlcm91z4.cloudfront.net/";
export const higgsImageUrl = (path: string) => `https://images.higgs.ai/?default=1&output=webp&url=${encodeURIComponent(HIGGS_ORIGIN + path)}&w=1200&q=88`;
const ReferenceFile = z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpg)$/);
const MediaKey = z.string().regex(/^catalog\/[0-9a-f-]{36}\.(png|jpg|webp)$/);
/** Where an image lives. Never an arbitrary URL. */
export const ImageRef = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("media"), key: MediaKey }),
  z.object({ kind: z.literal("reference"), file: ReferenceFile, large: ReferenceFile.optional() }),
  z.object({ kind: z.literal("higgs"), path: z.string().regex(/^user_[A-Za-z0-9]{1,64}\/hf_[A-Za-z0-9_-]{1,100}\.png$/) }),
]);
export type ImageRef = z.infer<typeof ImageRef>;
export const CATALOG_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const CATALOG_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// ---------------------------------------------------------------- Runway looks
export const RunwayLookStatus = z.enum(["draft", "published"]);
export type RunwayLookStatus = z.infer<typeof RunwayLookStatus>;
export const RunwayPin = z.object({
  productId: Uuid,
  /** Pin position as a percentage of the model image box. */
  left: z.number().min(0).max(100),
  top: z.number().min(0).max(100),
  tag: z.string().trim().max(16).nullable().default(null),
});
export type RunwayPin = z.infer<typeof RunwayPin>;
export const RUNWAY_MAX_PINS = 6;
export const CreateRunwayLookInput = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).default(""),
});
export const UpdateRunwayLookInput = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  description: z.string().trim().max(200).optional(),
  position: z.number().int().min(0).max(999).optional(),
  pins: z.array(RunwayPin).max(RUNWAY_MAX_PINS).optional(),
  status: RunwayLookStatus.optional(),
});
export interface RunwayLook {
  id: string; organizationId: string; name: string; description: string; position: number; status: RunwayLookStatus;
  imageUrl: string | null; pins: RunwayPin[]; createdAt: string; updatedAt: string;
}
/** Public, server-priced runway feed (only published looks and published products). */
export interface RunwayFeedPiece {
  n: number; productId: string; slug: string; title: string; brandName: string; tag: string | null; left: number; top: number;
  imageUrl: string | null; optionName: string; price: Money;
  variants: { id: string; label: string; available: boolean; price: Money }[];
}
export interface RunwayFeedLook { id: string; name: string; description: string; imageUrl: string; imageLargeUrl: string | null; pieces: RunwayFeedPiece[] }

export const CreateProductInput = z.object({
  brandId: Uuid,
  title: z.string().min(2).max(140),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(80),
  category: CosmeticCategory,
  description: z.string().max(4000).default(""),
  instructions: z.string().max(2000).default(""),
  ingredients: z.string().max(4000).default(""),
  warnings: z.string().max(2000).default(""),
});
export type CreateProductInput = z.infer<typeof CreateProductInput>;

export const CreateVariantInput = z.object({
  sku: ProductVariant.shape.sku,
  shadeName: z.string().min(1).max(80),
  hex: HexColor,
  finish: Finish,
  priceMinor: z.number().int().positive().max(10_000_000),
  currency: CurrencyCode,
  initialStock: z.number().int().min(0).max(1_000_000),
  /** Apparel only (e.g. "M", "UK 10"). Colour lives in shadeName/hex. */
  sizeLabel: SizeLabel.optional(),
});
export type CreateVariantInput = z.infer<typeof CreateVariantInput>;

export const ProductTransitionInput = z.object({ to: ProductStatus });

// ---------------------------------------------------------------- Try-on
export const TryOnRecipeV1 = z.object({
  version: z.literal(1),
  sourceAssetId: Uuid.optional(),
  selectedProducts: z
    .array(
      z.object({
        productVariantId: Uuid,
        cosmeticRegion: CosmeticRegion,
        opacity: z.number().min(0).max(1),
        hueShift: z.number().min(-30).max(30).default(0),
        gloss: z.number().min(0).max(1).default(0),
      }),
    )
    .max(6)
    .default([]),
  /** On-device garment overlays (apparel variants). */
  garments: z
    .array(z.object({ productVariantId: Uuid, fitScale: z.number().min(0.8).max(1.3).default(1), offsetY: z.number().min(-0.3).max(0.3).default(0) }))
    .max(3)
    .default([]),
  lightingPreset: z.enum(["neutral", "warm", "cool"]).default("neutral"),
  crop: z.object({ x: z.number(), y: z.number(), w: z.number().positive(), h: z.number().positive() }).optional(),
  viewportTransform: z.object({ scale: z.number().positive(), tx: z.number(), ty: z.number() }).optional(),
  /** Versioned algorithm id keeps renders reproducible. */
  engine: z.string().default("glamotion-overlay@1"),
}).refine((r) => r.selectedProducts.length + r.garments.length > 0, "Select at least one product");
export type TryOnRecipeV1 = z.infer<typeof TryOnRecipeV1>;

export const SaveLookInput = z.object({
  name: z.string().min(1).max(80),
  recipe: TryOnRecipeV1,
  /** Explicit opt-in is required to store any image; P0 slice stores recipe only. */
  persistImage: z.literal(false).default(false),
});

// ---------------------------------------------------------------- Commerce
export const AddCartItemInput = z.object({
  productVariantId: Uuid,
  quantity: z.number().int().min(1).max(10),
});
export const CheckoutInput = z.object({
  /** Client-displayed total; server recomputes and rejects on mismatch. */
  expectedTotalMinor: z.number().int().min(0),
  currency: CurrencyCode,
});
export const OrderStatus = z.enum(["created", "pending_payment", "paid", "fulfilling", "fulfilled", "cancelled", "refunded"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

// ---------------------------------------------------------------- Agency
export const ProjectStatus = z.enum(["intake", "active", "review", "approved", "delivered", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;
export const BriefInput = z.object({
  title: z.string().min(2).max(140),
  projectType: z.enum(["product_video", "social_graphics", "campaign", "launch_kit"]),
  objective: z.string().min(2).max(1000),
  audience: z.string().max(500).default(""),
  channels: z.array(z.enum(["instagram", "tiktok", "youtube", "web", "email"])).min(1),
  aspectRatios: z.array(z.enum(["1:1", "4:5", "9:16", "16:9"])).min(1),
  productIds: z.array(Uuid).max(20).default([]),
  legalClaims: z.array(z.string().max(200)).max(20).default([]),
  dueDate: z.string().date().optional(),
});
export type BriefInput = z.infer<typeof BriefInput>;

export const CommentInput = z.object({
  body: z.string().min(1).max(2000),
  frame: z.number().int().min(0).optional(),
  elementId: z.string().max(64).optional(),
});
export const ApprovalInput = z.object({ decision: z.enum(["approved", "changes_requested"]), note: z.string().max(1000).optional() });

// ---------------------------------------------------------------- Design document
export const Transform = z.object({ x: z.number(), y: z.number(), w: z.number().nonnegative(), h: z.number().nonnegative(), rotation: z.number().default(0) });
const LayerBase = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string().max(80),
  parentId: z.string().nullable().default(null),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  transform: Transform,
  opacity: z.number().min(0).max(1).default(1),
});
export const DesignLayer = z.discriminatedUnion("type", [
  LayerBase.extend({ type: z.literal("rect"), fill: HexColor, radius: z.number().min(0).default(0) }),
  LayerBase.extend({ type: z.literal("ellipse"), fill: HexColor }),
  LayerBase.extend({
    type: z.literal("text"),
    text: z.string().max(500),
    fontFamily: z.enum(["display", "sans"]),
    fontSize: z.number().min(6).max(400),
    fontWeight: z.number().int().min(100).max(900).default(400),
    color: HexColor,
    align: z.enum(["start", "center", "end"]).default("center"),
  }),
  /** Images reference internal media ids only — never raw URLs (SSRF guard). */
  LayerBase.extend({ type: z.literal("image"), assetId: z.string().regex(/^asset:[a-z0-9-]{1,80}$/), fit: z.enum(["cover", "contain"]).default("contain"), tint: HexColor.optional() }),
  LayerBase.extend({ type: z.literal("swatch"), productVariantId: Uuid, hex: HexColor, label: z.string().max(80) }),
]);
export type DesignLayer = z.infer<typeof DesignLayer>;

// ---------------------------------------------------------------- Motion
export const AnimatableProperty = z.enum(["x", "y", "opacity", "rotation", "scale", "blur"]);
export type AnimatableProperty = z.infer<typeof AnimatableProperty>;
export const Easing = z.enum(["linear", "easeIn", "easeOut", "easeInOut", "luxe"]);
export type Easing = z.infer<typeof Easing>;
export const Keyframe = z.object({ frame: z.number().int().min(0), value: z.number(), easing: Easing.default("easeInOut") });
export type Keyframe = z.infer<typeof Keyframe>;
export const Track = z.object({ property: AnimatableProperty, keyframes: z.array(Keyframe).min(1).max(240) });
export type Track = z.infer<typeof Track>;
export const MotionElement = z.object({
  layer: DesignLayer,
  startFrame: z.number().int().min(0),
  endFrame: z.number().int().min(1),
  tracks: z.array(Track).max(12).default([]),
});
export type MotionElement = z.infer<typeof MotionElement>;
export const Scene = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  name: z.string().max(80),
  durationInFrames: z.number().int().min(1).max(1800),
  background: HexColor,
  elements: z.array(MotionElement).max(60),
});
export type Scene = z.infer<typeof Scene>;
export const AspectRatio = z.enum(["1:1", "4:5", "9:16", "16:9"]);
export type AspectRatio = z.infer<typeof AspectRatio>;
export const MotionComposition = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string().max(140),
  aspectRatio: AspectRatio,
  width: z.number().int().min(16).max(3840),
  height: z.number().int().min(16).max(3840),
  fps: z.union([z.literal(24), z.literal(25), z.literal(30), z.literal(60)]),
  scenes: z.array(Scene).min(1).max(20),
  brandKitVersion: z.number().int().min(0).default(0),
  provenance: z.object({ preset: z.string().optional(), productVariantIds: z.array(Uuid).default([]), generatedBy: z.enum(["human", "template", "agent"]).default("template") }),
});
export type MotionComposition = z.infer<typeof MotionComposition>;

export const SaveCompositionInput = z.object({ baseRevision: z.number().int().min(0), composition: MotionComposition });

export const RenderStatus = z.enum(["queued", "running", "completed", "failed", "cancelled"]);
export type RenderStatus = z.infer<typeof RenderStatus>;
export const CreateRenderInput = z.object({
  compositionId: Uuid,
  revision: z.number().int().min(1),
  format: z.enum(["webm"]).default("webm"),
  quality: z.enum(["preview", "final"]).default("preview"),
});

// ---------------------------------------------------------------- AI workflows
export const WorkflowStatus = z.enum(["proposed", "queued", "running", "awaiting_human", "completed", "failed", "cancelled"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;
export const CampaignObjective = z.enum(["launch", "awareness", "promotion", "seasonal"]);
export const CreateCampaignInput = z.object({
  name: z.string().min(2).max(120),
  productId: Uuid,
  objective: CampaignObjective,
  platform: z.enum(["instagram_reel", "tiktok", "youtube_short"]),
  locales: z.array(z.enum(["en", "ar", "he"])).min(1).max(3),
  aspectRatio: AspectRatio.default("9:16"),
});
export type CreateCampaignInput = z.infer<typeof CreateCampaignInput>;
export const WorkflowApproveInput = z.object({
  gateId: z.string(),
  decision: z.enum(["approve", "reject"]),
  selection: z.string().max(64).optional(),
  note: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------- Errors & events
export const ApiErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string(), details: z.record(z.unknown()).default({}) }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

export const DomainEventType = z.enum([
  "product.published.v1",
  "look.saved.v1",
  "checkout.paid.v1",
  "creative.approved.v1",
  "campaign.approval_requested.v1",
  "render.queued.v1",
  "render.completed.v1",
  "render.failed.v1",
  "privacy.delete_requested.v1",
]);
export type DomainEventType = z.infer<typeof DomainEventType>;
export const DomainEvent = z.object({
  eventId: Uuid,
  type: DomainEventType,
  timestamp: z.string().datetime(),
  actorId: Uuid.nullable(),
  organizationId: Uuid.nullable(),
  entityIds: z.record(z.string()),
  correlationId: z.string(),
});
export type DomainEvent = z.infer<typeof DomainEvent>;

export const AnalyticsEventName = z.enum([
  "product_view", "shade_selected", "tryon_started", "tryon_effect_applied", "look_saved", "cart_added",
  "checkout_started", "purchase_completed", "brief_submitted", "concept_generated", "asset_approved",
  "render_started", "render_completed", "export_downloaded",
]);
/** Analytics payloads: coarse, non-sensitive scalars only (no pixels, landmarks, colours sampled from skin). */
export const AnalyticsEvent = z.object({
  name: AnalyticsEventName,
  props: z.record(z.union([z.string().max(120), z.number(), z.boolean()])).refine((p) => Object.keys(p).length <= 12, "too many props"),
});

// ---------------------------------------------------------------- Drop posts
/** "Arriving Tomorrow" mix-and-match teaser: two white cut-outs recoloured in code. */
export const DropRowKey = z.enum(["top", "bottom"]);
export type DropRowKey = z.infer<typeof DropRowKey>;
export const DropColour = z.object({ name: z.string().trim().min(1).max(20), hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/) });
export type DropColour = z.infer<typeof DropColour>;
export const DROP_MAX_COLOURS = 12;
export const DropColours = z.array(DropColour).min(1).max(DROP_MAX_COLOURS);
export const CreateDropInput = z.object({ title: z.string().trim().min(1).max(40) });
export const UpdateDropInput = z.object({
  title: z.string().trim().min(1).max(40).optional(),
  position: z.number().int().min(0).max(999).optional(),
  status: RunwayLookStatus.optional(),
  topColours: DropColours.optional(),
  bottomColours: DropColours.optional(),
});
export interface DropRowView { imageUrl: string | null; colours: DropColour[] }
export interface DropPost {
  id: string; organizationId: string; title: string; position: number; status: RunwayLookStatus;
  top: DropRowView; bottom: DropRowView; createdAt: string; updatedAt: string;
}
