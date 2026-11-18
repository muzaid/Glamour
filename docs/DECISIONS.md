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

## ADR-012 Runway lookbook is catalog-driven
`/runway` ("Try the Look.") is server-rendered on every request from `runwayFeed()`: published runway looks of active organizations, pinned only to that organization's **published** products, with sizes, availability and prices read from the catalog. Brands manage looks in Studio → Runway (`catalog.write`; publishing needs `catalog.publish`), and product photos on the product page. Images are stored as references only (`ImageRef`: a private catalog-media key or an allow-listed file on the reference lookbook host), never as arbitrary URLs; uploads are type-sniffed (PNG/JPEG/WebP ≤ 4 MB). Catalog media is public only while a published product or look uses it, otherwise members-only. "Add to bag" uses the real cart API, so totals and stock are server-side; the reference store's "save 10%" bundle copy was dropped because no bundle discount exists at checkout. SQL: 0005_runway.sql with RLS.

## ADR-013 Drop posts ("Arriving Tomorrow") are admin-managed
`/drop` (first published drop) and `/drop/{id}` render a square mix-and-match teaser from a `drop_posts` record: headline, a top and a bottom **white** garment cut-out, and an ordered colourway list per row. Colours are produced in the browser (colour layer masked by the cut-out + the white photo multiplied through a gamma-2.6 shading filter), so one photo serves every colourway. Brands manage drops in Studio → Drops (`catalog.write`; publishing needs `catalog.publish` and both photos). Images are `ImageRef`s only; the seeded cut-outs use the new `higgs` kind (a validated path on the images.higgs.ai proxy). Inter Tight is self-hosted (latin subset) instead of loading Google Fonts, so the CSP needs no font/style hosts; `images.higgs.ai` is added to `img-src`. Autoplay is skipped under `prefers-reduced-motion`. SQL: 0006_drops.sql with RLS.

## ADR-014 Maison Edit build-your-look page uses the real catalog
`/maison-edit` recreates the "Maison Edit — Build Your Look" try-on page: a canvas compositor blends nine pixel-registered model photos through eight soft region masks (verbatim from the brief), with sweep reveals, shop filters, stylist looks, AR backdrop and drag-to-rotate. The 12 pieces and 4 fictional stores (NORRA, Lune&Co, MERIDIAN, ODE STUDIO) are seeded as real catalog products (new `bags` category, 0007), so names, stores and prices are read from the catalog on each request and "Shop the Look" adds the actual variants to the signed-in shopper's bag (signed-out shoppers are asked to sign in) instead of a fake "added" state. The model photos are fictional AI-generated imagery supplied by the product owner; no shopper photo is involved. Fonts (Inter, Bodoni Moda) are self-hosted.

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
