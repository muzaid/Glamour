# Data model

Authoritative DDL: `supabase/migrations/0001_core.sql`. TypeScript row types: `packages/core/src/store.ts` (camelCase mirror). Public contracts: `packages/contracts`.

```
auth.users ─1:1─ profiles
organizations ─< organization_members >─ auth.users          (role, status; unique active (org,user,role))
organizations ─< brands ─< products ─< product_variants ─1:1─ inventories ─< inventory_movements
                                     product_variants: unique (organization_id, sku); composite FK (product_id, organization_id)
auth.users ─1:1─ carts ─< cart_items >─ product_variants
auth.users ─< orders ─< order_items (immutable snapshots, organization_id per line) ; orders ─< order_events
checkout_sessions (unique user_id+idempotency_key) ; payment_events (pk provider_event_id → dedupe)
auth.users ─< looks (recipe jsonb, no image) ; photo_consents ; private_assets (face_private ⇒ owner+consent, no org)
organizations ─< projects ─< briefs ; motion_compositions ─< scene_versions (immutable, pk composition+revision)
projects ─< review_sessions (token_hash) ─< annotations ; approvals ; deliveries (checksum)
motion_compositions ─< render_jobs (unique org+idempotency_key; queue index) ; job_outbox
organizations ─< campaigns ; ai_workflows ─< ai_steps, agent_artifacts, human_approvals ; usage_ledger ; audit_events (append-only)
```

## Tenancy rule
Every tenant-owned row carries `organization_id` or a composite FK to a parent that does (`(id, organization_id)` uniques make cross-tenant references impossible at the FK level).

## RLS summary (0002)
- Helpers `app.is_member / has_org_role / can_catalog / can_create / can_admin / can_workspace_read` are `SECURITY DEFINER` with empty `search_path`.
- RLS is enabled **and forced** on all public tables; tests assert this and that no policy is `USING (true)`.
- Public reads: only published products of active orgs (and their active variants, brands, media); stock via `app.available_units()`.
- Shopper data (carts, orders, looks, consents, face assets): `user_id = auth.uid()` only.
- `client_reviewer` membership grants no workspace read; reviewers use `app.review_by_token()`.
- Money/queue writes go through security-definer functions (`reserve_inventory`, `apply_payment`, `claim_render_job`) callable only by the service role.

## Not yet in SQL (planned)
discount_codes, shipping_addresses, shipping zones/tax rules (CC-010), design_documents/design_versions (DM-009), client_accounts, quotes/billing (AR-007).
