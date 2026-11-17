# GLAMOTION — repository rules for Claude Code

GLAMOTION is a beauty & fashion commerce + creative-production platform: storefront with on-device virtual try-on (makeup and clothing), and a B2B studio for brands/agencies (catalog, projects, client review, motion templates, gated AI campaign workflows, render worker). Full spec: `docs/MASTER_SPEC.md`. Backlog (system of record): `backlog/tasks.csv` + `backlog/status.md`. Decisions: `docs/DECISIONS.md`.

## Layout
- `apps/web` — Next.js 15 App Router: storefront, try-on, studio, `/api/v1/*`, `/api/internal/*` (worker only)
- `apps/worker` — render worker (headless Chromium rasterises deterministic SVG frames → ffmpeg VP8/WebM)
- `packages/contracts` — Zod schemas/types (the only source of API/domain shapes)
- `packages/core` — domain services, state machines, permissions, store (MemoryStore demo backend), ports
- `packages/tryon` — makeup: face landmarks → region masks → compositor; clothing: pose landmarks → 3-point affine garment overlay (`apparel.ts`); quality checks; synthetic demo face and demo figure
- `packages/motion` — scene model, interpolation, presets, SVG frame renderer, preflight
- `packages/agents` — runtime agent registry, gated WF-01 orchestrator, deterministic compliance, Claude adapter
- `packages/integrations` — sandbox payment provider, local private media storage
- `packages/ui` — tokens + small accessible components
- `supabase/migrations` — immutable SQL (0001 core, 0002 RLS, 0003 jobs, 0004 apparel); `supabase/tests` local shim + runner
- `tests/rls` (Postgres attack tests), `tests/e2e` (Playwright), `docs/evidence` (screenshots)

## Commands
```
pnpm install
pnpm typecheck          # all packages + web
pnpm test               # unit/integration (vitest)
pnpm test:rls           # throwaway Postgres + migrations + two-tenant RLS tests
pnpm build && pnpm test:e2e   # Playwright starts web + worker
pnpm dev                # web on :3000 ; in another shell: pnpm worker
```

## Non-negotiable rules
1. **Tenancy**: every B2B read/write goes through `requireOrgCap()` (TS) and RLS (SQL). Non-members get `NOT_FOUND`, never `FORBIDDEN`, for tenant resources. Never add `USING (true)` on private tables. Never bypass RLS to make a test pass.
2. **Face & body data**: camera frames/photos stay in the browser. Never upload, log or persist pixels, face/pose landmarks, skin colour or body measurements. Saved looks/outfits are recipes only. No face recognition, no inference of race/gender/age/health/body shape. **Single exception (ADR-010):** the opt-in cloud clothing try-on may send one photo to a configured, disclosed provider after an explicit per-request consent; it is processed in memory and never stored, logged or passed to runtime agents.
3. **Money**: integer minor units + ISO currency; prices/stock/totals are computed on the server; checkout requires `Idempotency-Key`; only a verified, de-duplicated webhook marks an order paid.
4. **AI**: runtime agents have no tools and cannot publish, spend, charge or approve. Outputs are schema-validated; invalid → `needs_review`. Humans approve directions and final output. Deterministic compliance rules can only tighten.
5. **Rendering**: compositions pass `preflight()` (schema, caps, asset allowlist — no URLs). ffmpeg is spawned with an argv array, never a shell. Outputs are private; downloads use short-lived signed URLs.
6. **Secrets**: env only; service credentials (WORKER_TOKEN, webhook/media/session secrets) never reach the browser or logs. Dev fallbacks refuse to run in production.
7. **Honesty**: no fabricated tests or results. Unfinished work is a `NOT_IMPLEMENTED` stub + backlog ticket, never a deceptive mock. Try-on copy never claims exact shade match.
8. Strict TypeScript; validate at every external boundary; errors use `{ error: { code, message, requestId, details } }`; UUIDs; UTC timestamps.

## Handoff format (every agent, every ticket)
Ticket ID · intent · changed files · commands executed · test results (real output) · migrations · security/privacy implications · unresolved questions · dependent ticket IDs.

## Parallel work
Agents may work in parallel only on disjoint directories. Owners finalise shared contracts/migrations before others consume them; `package.json` and migrations are merged serially by the product-orchestrator. Use git worktrees for risky parallel work.
