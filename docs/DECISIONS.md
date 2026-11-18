# Architecture decision records

Each open product decision from spec §25 has a safe default so building is never blocked. Status: Accepted unless noted.

## ADR-001 Modular monolith + separate render worker
Next.js (App Router) hosts UI and `/api/v1`; heavy work runs in `apps/worker`. Domain logic lives in framework-free packages (`core`, `tryon`, `motion`, `agents`) so it is unit-testable and reusable by the worker. No microservices until load requires them.

## ADR-002 Demo persistence: in-memory store behind the same service API
To ship a runnable slice without a provisioned Supabase project, services operate on `MemoryStore` (single Node process; synchronous critical sections give atomic reservation). The SQL schema in `supabase/migrations` is the production contract and is verified independently by `pnpm test:rls`. **Consequence:** data resets on restart; horizontal scaling is not possible until ticket F-011 (Postgres store executing as `authenticated` with JWT claims so RLS applies) lands.

## ADR-003 Demo identities instead of Supabase Auth (temporary)
A signed (HMAC) cookie selects one of the fictional demo users. Enabled only when `NODE_ENV!=production` or `GLAMOTION_DEMO_MODE=1`. Replaced by `@supabase/ssr` cookie sessions in F-005; authorisation already derives from membership rows, never from client-supplied roles.

## ADR-004 Rendering: Chromium-rasterised SVG frames → ffmpeg VP8/WebM; Remotion later
The scene JSON is renderer-independent. P0 uses a deterministic `renderFrameSvg()` shared by the editor preview and the worker, rasterised in a sandboxed (JS-disabled, network-blocked) headless Chromium page and encoded with ffmpeg via argv (no shell). Remotion is the intended P1 adapter once its commercial licence, codecs and cost model are verified (DM-010). Output container: WebM/VP8 (broad browser support; MP4/H.264 requires codec licensing review).

## ADR-005 Try-on: on-device MediaPipe + deterministic canvas compositor
MediaPipe Face Landmarker (wasm self-hosted, model file from Google's model host — self-host for production) provides landmarks; `packages/tryon` builds region masks and composites pixels deterministically. Nothing leaves the device. P0 single-face policy. No cloud enhancement in P0.

## ADR-006 Payments: sandbox provider behind `PaymentProvider` port
Hosted-checkout + signed-webhook shape. Live checkout is refused (`FEATURE_DISABLED`) until the vendor, tax engine, shipping zones and markets are chosen. Open decision: vendor (Stripe/Adyen/Checkout.com), currencies, jurisdictions.

## ADR-007 Runtime AI: deterministic offline model by default; Claude when configured
`AI_PROVIDER=anthropic` switches to `ClaudeLanguageModel` (official SDK, structured outputs validated against each agent's Zod schema, model `claude-opus-5-5`, server-side refusal fallback enabled). The deterministic provider keeps local tests key-free and is labelled in the UI. Agents receive catalog metadata only — never images.

## ADR-008 Not-found over forbidden for tenant resources
Non-members receive 404 for another tenant's resources (pages and APIs) to avoid existence disclosure; members lacking a capability get 403.

## ADR-010 Clothing addendum: on-device garment overlay + opt-in cloud try-on
**Context.** The v2.1 spec covered cosmetics only. The product owner asked for clothing that shoppers can see on their own photo or camera.
**Decision.** (1) Catalog: apparel categories `top | outerwear | dress`; colour reuses `shadeName/hex`; `sizeLabel` per variant (one SKU per colour × size); size is snapshotted on order lines (migration 0004). (2) Default try-on is on-device: MediaPipe Pose Landmarker finds shoulders/hips; a 3-point affine maps a garment template's anchors (shoulder seams + mid-hip) onto the body; hips are estimated from shoulder width when out of frame (webcam). Templates are original vector garments tinted per colour — real product cut-outs need a background-removal + anchor-annotation pipeline (AP-006). (3) Optional realistic preview goes through the `ApparelTryOnProvider` port: availability is checked before any upload; explicit per-request consent; signed-in users; 5/hour; magic-byte validation; in-memory only; consent + audit recorded without the image. No vendor ships: the default provider returns `FEATURE_DISABLED`.
**Consequences.** The overlay is a 2D illustration: no cloth simulation, folds, arm occlusion or fit prediction; UI copy says so and never claims fit. Generative try-on needs a vendor decision (data-processing terms, retention, cost) and legal review before enabling. Size recommendation from body measurements is out of scope (it would infer body shape).

## ADR-011 Fitting room uses photographed models, not illustrated figures
**Decision (product owner, 2026-11-18).** The fitting room shows real-looking photography of a model rather than an illustrated/3D figure. Demo photos are AI-generated images of a fictional adult model with recorded provenance (`apps/web/public/models/*/PROVENANCE.md`); production uses brand shoots. Outfit → photo matching is explicit (`pickOnModelPhoto`); a missing combination shows the closest photo with a visible note rather than a silent substitute. The camera/photo mirror (ADR-010) is unchanged: it overlays garments on the shopper's own image on-device.

## ADR-009 Open decisions (defaults in use)
| Decision | Default now |
|---|---|
| Countries / currencies / shipping | USD only, sandbox, no shipping |
| Payment vendor | Sandbox provider |
| High-fidelity cloud try-on | Not offered |
| Brand name / domain | "GLAMOTION" placeholder |
| Age threshold | 18+ self-attestation for camera/photo |
| Default locale | en (ar/he copy generated; RTL layout checks pending) |
| Video output | 9:16 1080×1920 WebM, ≤60 s |
| AI clothing try-on vendor | None configured (`FEATURE_DISABLED`) |
| Size guides / fit data | Text-only care/size notes; no fit prediction |
