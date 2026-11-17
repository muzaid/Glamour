/**
 * Deterministic claims & safety rules (spec §12, §20). Runs on every
 * AI-drafted string regardless of what the model says; it can only add
 * blockers/warnings, never remove them. Not a substitute for legal review.
 */
const BLOCKED: [RegExp, string][] = [
  [/\b(cure[sd]?|treat(s|ment)?|heal(s|ing)?|eczema|acne|psoriasis|rosacea|dermatitis)\b/i, "Medical or treatment claim"],
  [/\b(clinically|dermatologist|scientifically)[ -](proven|tested|approved)\b/i, "Unsubstantiated clinical claim"],
  [/\b(guarantee[sd]?|perfect|exact)\s+(shade\s+)?(match|colou?r)\b/i, "Guaranteed shade-match claim"],
  [/\b(anti[- ]?aging|reverses? (aging|wrinkles)|whiten(ing|s)?|lighten(s|ing)? skin)\b/i, "Prohibited beauty claim"],
  [/\b(for (fair|dark|white|black) skin only|flawless race)\b/i, "Discriminatory beauty standard"],
];
const INJECTION = /(ignore (all |any )?(previous|prior|above) instructions|system prompt|you are now|publish (it )?(now|immediately)|auto[- ]?approve)/i;

export function deterministicCompliance(texts: string[], untrustedSource = "") {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const t of texts) for (const [re, label] of BLOCKED) if (re.test(t)) blockers.push(`${label}: "${t.slice(0, 80)}"`);
  if (texts.some((t) => INJECTION.test(t))) blockers.push("Instruction-like text found in generated copy");
  if (INJECTION.test(untrustedSource)) warnings.push("Product data contains instruction-like text; treated as data only");
  if (!texts.some((t) => /illustrative|may vary|virtual/i.test(t))) warnings.push("Consider adding the 'virtual try-on is illustrative' disclaimer");
  return { blockers, warnings };
}
