# Runbook (demo / staging)

## Processes
- Web: `pnpm --filter @glamotion/web start` (port 3000). Health: `GET /api/v1/products`.
- Worker: `pnpm worker` — needs `GLAMOTION_WEB_URL`, `WORKER_TOKEN` (same as web), Chromium (`CHROMIUM_PATH` or Playwright's) and ffmpeg with libvpx (`FFMPEG_PATH`).

## Render queue
- Jobs lease for 60 s; a crashed worker's job is reclaimed after lease expiry.
- Retries: 3 attempts, exponential backoff with jitter; terminal `failed` with a human-readable message.
- Cancel: `POST /api/v1/renders/{id}/cancel`; the worker stops at the next heartbeat (every 15 frames).
- Caps: ≤1800 frames, ≤1920 px, ≤120 s encode, ≤80 MB output; only allowlisted built-in assets.
- Inspect: `/ops/jobs` (platform admin).

## Payments (sandbox)
- Webhook: `POST /api/v1/webhooks/payments` with `x-sandbox-signature: t=<unix>,v1=<hmac>`; 5-minute tolerance; duplicate event ids are no-ops.
- Stuck `pending_payment`: the sandbox expiry event releases reservations.

## Secrets rotation
Rotate `PAYMENT_WEBHOOK_SECRET`, `MEDIA_SIGNING_SECRET`, `GLAMOTION_SESSION_SECRET`, `WORKER_TOKEN` by updating env and restarting web + worker together (sessions and outstanding signed links are invalidated).

## Not yet covered
Backups/PITR drill (OP-010), alerting/tracing backend (OP-009), rate limiting (OP-005).
