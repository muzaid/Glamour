import type { LanguageModelProvider, LanguageModelRequest, LanguageModelResult } from "@glamotion/core";

const estimateTokens = (v: unknown) => Math.ceil(JSON.stringify(v).length / 4);

type Input = { product?: { title?: string; brandName?: string; category?: string; shades?: { name: string }[] }; concept?: { preset?: string; tagline?: string; id?: string }; locales?: string[] };

/**
 * Deterministic, offline language model for local development, demos and
 * tests. It produces schema-shaped outputs from the input so the workflow,
 * gates and failure routing can be exercised without network calls or keys.
 * It is clearly labelled in the UI as "Demo AI (deterministic)".
 */
export class DeterministicLanguageModel implements LanguageModelProvider {
  readonly name = "deterministic-demo";
  async complete(req: LanguageModelRequest): Promise<LanguageModelResult> {
    const input = req.input as Input;
    const p = input.product ?? {};
    const shade = p.shades?.[0]?.name ?? "signature shade";
    let output: unknown;
    switch (req.promptId) {
      case "brief_interpreter":
        output = {
          verifiedClaims: [`${p.title} is available in ${p.shades?.length ?? 0} shades`, `Category: ${p.category}`],
          requiredAssets: ["Product illustration (built-in)", "Brand wordmark"],
          risks: ["Try-on visuals are illustrative — include disclaimer"],
          missingInfo: ["Final ingredient list review by brand", "Music licence (none used)"],
        };
        break;
      case "creative_director":
        output = {
          concepts: [
            { id: "quiet-luxury", title: "Quiet luxury", logline: `A slow, sculpted reveal of ${p.title} in ${shade}.`, preset: "reel-9x16", tagline: `${shade}, made to be worn`.slice(0, 60), criteria: ["Hero product in first second", "Shade name legible"] },
            { id: "shade-story", title: "Every shade, one story", logline: "The full shade range lands in rhythm.", preset: "shade-lineup", tagline: "Find your shade — try it on virtually", criteria: ["All shades shown", "Even pacing"] },
            { id: "swipe", title: "The swipe", logline: "A single confident swipe of colour.", preset: "lipstick-swipe", tagline: `One swipe of ${shade}`.slice(0, 60), criteria: ["Colour fills frame", "Under 4 seconds"] },
          ],
        };
        break;
      case "art_director":
        output = { layoutNotes: "Centered hero, generous negative space, title in lower third within safe area.", palette: { background: "#101016", accent: "#E6A7B0" }, assetsUsed: ["asset:lipstick-bullet", "asset:monogram"] };
        break;
      case "copywriter": {
        const tagline = (input.concept?.tagline ?? `Meet ${p.title}`).slice(0, 60);
        const loc: Record<string, { tagline: string; caption: string }> = {};
        for (const l of input.locales ?? ["en"]) {
          loc[l] = l === "ar"
            ? { tagline: `${p.title} — جرّبيه افتراضياً`, caption: "المعاينة الافتراضية توضيحية وقد يختلف اللون." }
            : l === "he"
              ? { tagline: `${p.title} — נסי וירטואלית`, caption: "התצוגה הווירטואלית להמחשה בלבד; הגוון עשוי להשתנות." }
              : { tagline, caption: `${p.title} by ${p.brandName}. Virtual try-on is illustrative; shade may vary.` };
        }
        output = { headline: `${p.title} in ${shade}`.slice(0, 80), caption: `${p.title} by ${p.brandName}. Try every shade virtually. Preview is illustrative.`, tagline, hashtags: ["#Glamotion", "#VirtualTryOn"], localized: loc };
        break;
      }
      case "motion_director":
        output = { preset: input.concept?.preset ?? "reel-9x16", pacing: "medium", notes: "Hold the hero for 1s before titles; keep CTA inside the 9:16 safe area." };
        break;
      case "compliance_reviewer":
        output = { decision: "allow", findings: [{ severity: "info", text: "Illustrative try-on disclaimer present." }] };
        break;
      case "qa_evaluator":
        output = { checklist: [{ item: "Matches selected concept", pass: true }, { item: "Shade names correct", pass: true }, { item: "Disclaimer present", pass: true }], deviations: [], confidence: 0.82 };
        break;
      default:
        throw new Error(`Unknown prompt ${req.promptId}`);
    }
    return { output, inputTokens: estimateTokens(req.input) + estimateTokens(req.system), outputTokens: estimateTokens(output), model: this.name };
  }
}
