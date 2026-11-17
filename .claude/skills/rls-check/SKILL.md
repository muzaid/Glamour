---
name: rls-check
description: Verify tenant isolation after any change to supabase/migrations or packages/core permissions. Runs the throwaway-Postgres RLS suite and the TS tenancy tests.
---
1. `pnpm test:rls` — must report all tests passed; read the output, do not summarise from memory.
2. `pnpm vitest run packages/core` — tenancy tests in `core.test.ts`.
3. For a new table: confirm it appears in no failure of "every public table has RLS enabled and forced", and add an attack test (org B cannot read/write org A rows; anon cannot read private rows).
4. Report results in the handoff format from CLAUDE.md.
