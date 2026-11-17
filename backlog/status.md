# Status — sprint 1 (vertical slice)

**Tickets:** 77 total · 49 DONE · 11 PARTIAL · 17 TODO (machine-readable: `tasks.csv`).
P0 still TODO: F-005 Supabase Auth, F-011 Postgres store, DM-009 static design canvas, OP-005 rate limiting.

## Evidence (commands run locally on this commit)
| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm typecheck` | pass (packages, worker, web) |
| Unit/integration | `pnpm test` | 59 passed, 11 skipped (RLS suite needs DB) |
| SQL + RLS | `pnpm test:rls` | 3 migrations applied on Postgres 16; 11/11 attack tests passed |
| Production build | `pnpm build` | pass (Next.js 15.5.4) |
| E2E | `pnpm test:e2e` | 11/11 passed (web + worker started by Playwright) |

Screenshots: `docs/evidence/` (mobile home, PDP, merchant product, consent gate, try-on before/after, cart, paid order, motion editor, client review, completed render, agent graph gates, camera-denied fallback).

## Demonstrated end to end (E2E)
Merchant creates → adds shade → publishes lipstick · shopper opens PDP → try-on with illustrated demo face → opacity change verified by canvas pixels → saves recipe → adds to cart (no image bytes sent) → sandbox checkout → order **paid only via signed webhook** · brand creates brief/project → 9:16 motion from product → edits text → saves rev 2 → client approver link → comment + approve → final render produces real WebM via worker → signed download works, tampered signature 404 · AI campaign stops at both human gates, then renders · tenant B gets 404 on tenant A pages/APIs · forged webhook/worker/cross-origin refused · camera denied → fallback · data deletion removes looks · 320 px storefront has no horizontal scroll.

## Known gaps / risks
- Demo backend is in-memory (single process); restarts lose data (ADR-002).
- MediaPipe detection on real photos/camera is wired but not automatically tested (needs rights-cleared fixtures and a device matrix).
- Claude provider typechecks against the SDK but was not called (no key in this environment).
- Static design canvas, refunds, real payment provider, tax/shipping, rate limiting, accessibility audit, observability backend, backups: not done.
- Legal review required for privacy text, product claims and try-on disclaimers before launch.

## Next tickets
F-005 → F-011 → DM-008 (worker on Postgres) → OP-005 → CC-010 → TO-003/004/005 device QA → OP-008.
