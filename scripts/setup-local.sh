#!/usr/bin/env bash
# One-time local setup + start for GLAMOTION (macOS / Linux / WSL).
# Usage (from the repo root): bash scripts/setup-local.sh
set -euo pipefail

need() { command -v "$1" >/dev/null 2>&1; }

if ! need node; then echo "✗ Node.js 20+ is required: https://nodejs.org (LTS)"; exit 1; fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
if [ "$NODE_MAJOR" -lt 20 ]; then echo "✗ Node $NODE_MAJOR found; need 20 or newer"; exit 1; fi
if ! need pnpm; then echo "→ installing pnpm via corepack"; corepack enable && corepack prepare pnpm@10.28.0 --activate; fi
if ! need ffmpeg; then echo "⚠ ffmpeg not found — the app runs, but video rendering needs it (macOS: brew install ffmpeg; Ubuntu: sudo apt install ffmpeg)"; fi

echo "→ installing dependencies"
pnpm install

echo "→ installing the headless browser used by the render worker"
npx playwright install chromium

echo "→ building the web app"
GLAMOTION_DEMO_MODE=1 pnpm build

export GLAMOTION_DEMO_MODE=1 WORKER_TOKEN=local-dev-worker-token-0123 GLAMOTION_WEB_URL=http://localhost:3000 NEXT_TELEMETRY_DISABLED=1
echo "→ starting web app on http://localhost:3000 (Ctrl+C stops everything)"
(cd apps/web && pnpm start) &
WEB=$!
trap 'kill $WEB 2>/dev/null' EXIT
until curl -s -o /dev/null http://localhost:3000/api/v1/products; do sleep 1; done
echo "✓ open http://localhost:3000 — click Sign in and pick a demo user"
if need ffmpeg; then pnpm worker; else wait $WEB; fi
