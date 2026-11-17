# Start here

1. Read `CLAUDE.md` (rules), `docs/MASTER_SPEC.md` (product spec), `backlog/status.md` (what exists and what doesn't).
2. Install & verify:
   ```
   pnpm install
   pnpm typecheck && pnpm test && pnpm test:rls
   pnpm build && pnpm test:e2e
   ```
3. Run it: `bash scripts/setup-local.sh` (installs, builds, starts web + worker). Or manually: `pnpm dev`, then `pnpm worker` in a second terminal. Open http://localhost:3000, click **Sign in** and pick a demo identity.
4. Development agents live in `.claude/agents/`; runtime (in-app) agents are documented in `runtime_agents/`. Kick-off prompt for a new Claude Code session: `prompts/START_IN_CLAUDE_CODE.md`.

## What runs today (demo mode)
- In-memory store seeded with fictional brands; restarts reset data.
- Sandbox payments (signed webhooks), local private media storage, deterministic offline AI (set `AI_PROVIDER=anthropic` + an Anthropic credential to use Claude).
- Real on-device try-on: illustrated demo face (fixture landmarks) or your own photo/camera via MediaPipe (model fetched from Google's model host; wasm self-hosted).

## Required before production (see backlog P0 TODO/PARTIAL)
Supabase Auth (F-005), Postgres-backed store (F-011), rate limiting (OP-005), production payment provider (CC-012), tax/shipping config (CC-010), accessibility audit (OP-008), device try-on matrix (TO-004/005), legal review of privacy/claims copy.
