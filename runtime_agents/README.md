# Runtime agents (in-app, not development personas)

Source of truth: `packages/agents/src/prompts.ts` (versioned system prompts + Zod output schemas) and `packages/agents/src/orchestrator.ts` (WF-01 DAG).

| Agent | Version | Output | Gate |
|---|---|---|---|
| brief_interpreter | 1 | verifiedClaims, requiredAssets, risks, missingInfo | shown as "AI suggestion — verify facts" |
| creative_director | 1 | 2–3 concepts (preset, tagline, criteria) | **Human selects direction** |
| art_director | 1 | layout notes, palette, assets | — |
| copywriter | 1 | headline, caption, tagline, hashtags, en/ar/he | deterministic claims rules |
| motion_director | 1 | preset + pacing → compiled by code into keyframes | — |
| compliance_reviewer | 1 | allow / block / needs_review + findings | rules can only tighten; block disables approval |
| qa_evaluator | 1 | checklist, deviations, confidence | — |
| (render) | — | render job (final quality) | **Human approves output** first |

Policies: agents have no tools; untrusted product text is wrapped as data; max 2 retries per step; schema-invalid output → `needs_review` (workflow stops, nothing published); per-workflow token budget and per-tenant daily quota recorded in the usage ledger. Planned: beauty_advisor (WF-02), merchandising (WF-05), campaign_planner, asset_producer, analytics_interpreter.
