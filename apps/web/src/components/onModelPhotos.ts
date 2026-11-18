import type { OnModelPhoto } from "@glamotion/tryon";

/**
 * On-model photography for the demo label. These are AI-generated images of
 * a fictional adult model (Higgsfield · FLUX 3, generated from the project
 * owner's account for this demo) — not a real person. Each entry records
 * exactly what the model is wearing so the fitting room never mislabels it.
 * Production replaces these with brand-supplied, licence-recorded shoots (AP-010).
 */
export const MODEL_CREDIT = "Fictional AI-generated model, created for this demo — not a real person.";

const base = "/models/lumiere-model-a";
export const ON_MODEL_PHOTOS: OnModelPhoto[] = [
  { id: "top-ivory", src: `${base}/top-ivory.jpg`, alt: "Model wearing the Silk Shell Top in Ivory with charcoal trousers", base: { slug: "silk-shell-top", colour: "Ivory", title: "Silk Shell Top" } },
  { id: "top-blush", src: `${base}/top-blush.jpg`, alt: "Model wearing the Silk Shell Top in Blush with charcoal trousers", base: { slug: "silk-shell-top", colour: "Blush", title: "Silk Shell Top" } },
  { id: "blazer-charcoal", src: `${base}/blazer-charcoal.jpg`, alt: "Model wearing the Tailored Wool Blazer in Charcoal over the Ivory Silk Shell Top", base: { slug: "silk-shell-top", colour: "Ivory", title: "Silk Shell Top" }, outer: { slug: "tailored-wool-blazer", colour: "Charcoal", title: "Tailored Wool Blazer" } },
  { id: "blazer-camel", src: `${base}/blazer-camel.jpg`, alt: "Model wearing the Tailored Wool Blazer in Camel over the Ivory Silk Shell Top", base: { slug: "silk-shell-top", colour: "Ivory", title: "Silk Shell Top" }, outer: { slug: "tailored-wool-blazer", colour: "Camel", title: "Tailored Wool Blazer" } },
  { id: "dress-emerald", src: `${base}/dress-emerald.jpg`, alt: "Model wearing the Satin Slip Dress in Emerald", base: { slug: "satin-slip-dress", colour: "Emerald", title: "Satin Slip Dress" } },
];
