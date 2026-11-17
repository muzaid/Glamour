import { BUILTIN_ASSETS, GARMENT_ASSET } from "@glamotion/motion";

/** Rights-cleared vector product illustration (no photography in the demo). */
export function ProductArt({ category, hex, size = 160, label }: { category: string; hex: string; size?: number; label: string }) {
  const asset = BUILTIN_ASSETS[GARMENT_ASSET[category as keyof typeof GARMENT_ASSET] ?? (category === "blush" || category === "eyeshadow" ? "asset:blush-compact" : "asset:lipstick-bullet")]!;
  const [w, h] = asset.viewBox;
  const uid = `${category}-${hex.slice(1)}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label.replace(/"/g, "")}" viewBox="0 0 ${w} ${h}" width="${(size * w) / Math.max(w, h)}" height="${(size * h) / Math.max(w, h)}">${asset.svg(hex).replace(/gm-/g, `gm-${uid}-`)}</svg>`;
  return <span style={{ display: "block", width: "100%", minWidth: 0, textAlign: "center" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
