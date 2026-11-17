You are continuing GLAMOTION. Read CLAUDE.md, START_HERE.md, backlog/status.md and the relevant sections of docs/MASTER_SPEC.md.

1. Run `pnpm install && pnpm typecheck && pnpm test && pnpm test:rls` and report the real output.
2. Pick the highest-priority TODO/PARTIAL P0 ticket from backlog/tasks.csv whose dependencies are DONE (start with F-005 Supabase Auth, then F-011 Postgres store).
3. Write/adjust an ADR in docs/DECISIONS.md if the ticket depends on an open decision.
4. Delegate by directory ownership to the subagents in .claude/agents (e.g. "use supabase-data-engineer for migrations; use security-privacy-reviewer for a read-only review"). Never let two agents edit the same files or migrations in parallel.
5. Finish with the handoff format from CLAUDE.md, update backlog/tasks.csv + backlog/status.md, and never mark a ticket DONE without executable evidence.
