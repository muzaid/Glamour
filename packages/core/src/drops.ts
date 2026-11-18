import { CreateDropInput, DropRowKey, UpdateDropInput, type DropColour, type DropPost } from "@glamotion/contracts";
import type { Ctx } from "./context";
import { requireOrgCap } from "./context";
import { AppError, notFound } from "./errors";
import { newId, nowIso } from "./ids";
import { audit } from "./audit";
import { dropCatalogImage, imageUrl, storeCatalogImage } from "./catalog";
import type { DropPostRow } from "./store";

/**
 * Drop posts ("Arriving Tomorrow" mix-and-match teaser). Each post has a top
 * and a bottom row: one white garment cut-out and an ordered colourway list.
 * Every colour is produced in the browser by masking the white photo.
 */
export const DEFAULT_DROP_PALETTE: Record<string, string> = {
  sky: "#8dd2ef", lemon: "#f6dc55", grass: "#46cc45", lilac: "#b29de4", tang: "#fa8430", fuchsia: "#ee4cb3", cobalt: "#1d84d2",
};
const seq = (names: string[]): DropColour[] => names.map((name) => ({ name, hex: DEFAULT_DROP_PALETTE[name]! }));
export const DEFAULT_TOPS = seq(["sky", "grass", "tang", "fuchsia", "lemon", "sky", "lilac", "tang"]);
export const DEFAULT_BOTS = seq(["lemon", "lilac", "grass", "cobalt", "fuchsia", "tang", "sky", "lemon"]);

const toDto = (d: DropPostRow): DropPost => ({
  id: d.id, organizationId: d.organizationId, title: d.title, position: d.position, status: d.status,
  top: { imageUrl: imageUrl(d.top.image), colours: d.top.colours.map((c) => ({ ...c })) },
  bottom: { imageUrl: imageUrl(d.bottom.image), colours: d.bottom.colours.map((c) => ({ ...c })) },
  createdAt: d.createdAt, updatedAt: d.updatedAt,
});
const byOrder = (a: DropPostRow, b: DropPostRow) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);
const normal = (cs: DropColour[]) => cs.map((c) => ({ name: c.name.trim(), hex: c.hex.toLowerCase() }));

function orgDrop(ctx: Ctx, organizationId: string, id: string): DropPostRow {
  const d = ctx.store.dropPosts.get(id);
  if (!d || d.organizationId !== organizationId) throw notFound("Drop");
  return d;
}

export function listOrgDrops(ctx: Ctx, organizationId: string): DropPost[] {
  requireOrgCap(ctx, organizationId, "org.read");
  return [...ctx.store.dropPosts.values()].filter((d) => d.organizationId === organizationId).sort(byOrder).map(toDto);
}

export function getOrgDrop(ctx: Ctx, organizationId: string, id: string): DropPost {
  requireOrgCap(ctx, organizationId, "org.read");
  return toDto(orgDrop(ctx, organizationId, id));
}

export function createDrop(ctx: Ctx, organizationId: string, raw: unknown): DropPost {
  const actor = requireOrgCap(ctx, organizationId, "catalog.write");
  const input = CreateDropInput.parse(raw);
  const mine = [...ctx.store.dropPosts.values()].filter((d) => d.organizationId === organizationId);
  if (mine.length >= 24) throw new AppError("QUOTA_EXCEEDED", "A workspace can have up to 24 drop posts");
  const now = nowIso();
  const row: DropPostRow = {
    id: newId(), organizationId, title: input.title, status: "draft", position: mine.reduce((m, d) => Math.max(m, d.position + 1), 0),
    top: { image: null, colours: DEFAULT_TOPS.map((c) => ({ ...c })) }, bottom: { image: null, colours: DEFAULT_BOTS.map((c) => ({ ...c })) },
    createdBy: actor.userId, createdAt: now, updatedAt: now,
  };
  ctx.store.dropPosts.set(row.id, row);
  audit(ctx, "drop.created", "drop_post", row.id, organizationId);
  return toDto(row);
}

function assertPublishable(d: DropPostRow) {
  if (!d.top.image || !d.bottom.image) throw new AppError("VALIDATION_FAILED", "Upload both garment photos before publishing");
}

export function updateDrop(ctx: Ctx, organizationId: string, id: string, raw: unknown): DropPost {
  const input = UpdateDropInput.parse(raw);
  requireOrgCap(ctx, organizationId, input.status === "published" ? "catalog.publish" : "catalog.write");
  const d = orgDrop(ctx, organizationId, id);
  if (input.title !== undefined) d.title = input.title;
  if (input.topColours) d.top.colours = normal(input.topColours);
  if (input.bottomColours) d.bottom.colours = normal(input.bottomColours);
  if (input.position !== undefined && input.position !== d.position) {
    const others = [...ctx.store.dropPosts.values()].filter((x) => x.organizationId === organizationId && x.id !== d.id).sort(byOrder);
    others.splice(Math.min(input.position, others.length), 0, d);
    others.forEach((x, i) => { x.position = i; });
  }
  if (input.status && input.status !== d.status) {
    if (input.status === "published") assertPublishable(d);
    audit(ctx, "drop.status_changed", "drop_post", d.id, organizationId, { from: d.status, to: input.status });
    d.status = input.status;
  }
  d.updatedAt = nowIso();
  return toDto(d);
}

export async function setDropImage(ctx: Ctx, organizationId: string, id: string, rowKey: unknown, bytes: Uint8Array): Promise<DropPost> {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const key = DropRowKey.parse(rowKey);
  const d = orgDrop(ctx, organizationId, id);
  const old = d[key].image;
  d[key].image = await storeCatalogImage(ctx, organizationId, bytes);
  d.updatedAt = nowIso();
  if (old?.kind === "media") await dropCatalogImage(ctx, old.key);
  audit(ctx, "drop.image_set", "drop_post", d.id, organizationId, { row: key });
  return toDto(d);
}

export async function deleteDrop(ctx: Ctx, organizationId: string, id: string) {
  requireOrgCap(ctx, organizationId, "catalog.write");
  const d = orgDrop(ctx, organizationId, id);
  ctx.store.dropPosts.delete(d.id);
  for (const r of [d.top, d.bottom]) if (r.image?.kind === "media") await dropCatalogImage(ctx, r.image.key);
  audit(ctx, "drop.deleted", "drop_post", d.id, organizationId);
}

const isPublic = (ctx: Ctx, d: DropPostRow) => d.status === "published" && !!d.top.image && !!d.bottom.image && ctx.store.organizations.get(d.organizationId)?.status === "active";

/** Public: published drops in active organizations, in workspace order. */
export function listPublishedDrops(ctx: Ctx): DropPost[] {
  return [...ctx.store.dropPosts.values()].filter((d) => isPublic(ctx, d)).sort(byOrder).map(toDto);
}

export function getPublishedDrop(ctx: Ctx, id: string): DropPost {
  const d = ctx.store.dropPosts.get(id);
  if (!d || !isPublic(ctx, d)) throw notFound("Drop");
  return toDto(d);
}
