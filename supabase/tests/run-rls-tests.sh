#!/usr/bin/env bash
# Spins up a throwaway local Postgres, applies the auth shim + migrations +
# seed, and runs tests/rls against it. Usage: pnpm test:rls
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="$ROOT/.tmp-pg/data"; PORT="${RLS_PG_PORT:-54329}"
RUNAS=()
if [ "$(id -u)" = "0" ]; then RUNAS=(runuser -u postgres --); fi
rm -rf "$ROOT/.tmp-pg"; mkdir -p "$ROOT/.tmp-pg"; [ "$(id -u)" = "0" ] && chown -R postgres "$ROOT/.tmp-pg"
"${RUNAS[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" -l "$ROOT/.tmp-pg/log" -w start >/dev/null
trap '"${RUNAS[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null' EXIT
PSQL=(psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$ROOT/supabase/tests/auth_shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "applying $(basename "$f")"; "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$ROOT/supabase/seed.sql"
echo "migrations + seed applied"
cd "$ROOT" && RLS_DATABASE_URL="postgres://postgres@127.0.0.1:$PORT/postgres" npx vitest run tests/rls
