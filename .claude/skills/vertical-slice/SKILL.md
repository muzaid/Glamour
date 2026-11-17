---
name: vertical-slice
description: Prove the end-to-end value loop still works (publish → try-on → paid sandbox order → motion → client approval → render). Use before reporting any milestone done.
---
1. `pnpm build` then `pnpm test:e2e` (Playwright starts web + worker).
2. All tests in `tests/e2e/vertical-slice.spec.ts` and `security-privacy.spec.ts` must pass; screenshots land in `docs/evidence/`.
3. If a step fails, open the failure screenshot under `test-results/` before changing code.
