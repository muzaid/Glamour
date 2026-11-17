import { DEMO_BODY, demoBodyInner, demoBodyPose, type SkinTone } from "./demo-body";
import { garmentAsset, garmentTransform } from "./apparel";

export interface OutfitLayer { category: string; hex: string; fitScale?: number; offsetY?: number }

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Deterministic SVG of the illustrated figure wearing an outfit. Uses the
 * same anchor-based affine fit as the camera/photo mirror, so the fitting
 * room and the mirror always agree. Layers draw in order (base, then outer).
 */
export function outfitSvg(layers: OutfitLayer[], opts: { skin?: SkinTone; background?: boolean; label?: string } = {}): string {
  const pose = demoBodyPose();
  const parts: string[] = [];
  layers.forEach((l, i) => {
    const asset = garmentAsset(l.category);
    if (!asset || !HEX.test(l.hex)) return;
    const m = garmentTransform(asset, pose, DEMO_BODY.width, DEMO_BODY.height, { fitScale: l.fitScale, offsetY: l.offsetY });
    if (!m) return;
    const [w, h] = asset.viewBox;
    parts.push(`<g data-layer="${l.category}" transform="matrix(${m.map((n) => n.toFixed(5)).join(" ")})"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" overflow="visible">${asset.svg(l.hex).replace(/gm-/g, `gm-o${i}-`)}</svg></g>`);
  });
  const label = (opts.label ?? "Illustrated figure wearing the selected outfit").replace(/[<>&"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${DEMO_BODY.width} ${DEMO_BODY.height}" role="img" aria-label="${label}">${demoBodyInner(opts)}${parts.join("")}</svg>`;
}
