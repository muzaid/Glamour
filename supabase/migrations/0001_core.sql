-- GLAMOTION 0001_core: extensions, enums, tables, constraints, indexes.
-- Field names mirror packages/core/src/store.ts (snake_case here).
-- Immutable once applied; changes go in new numbered migrations.

create extension if not exists pgcrypto;
create schema if not exists app;

-- ------------------------------------------------------------------ enums
create type public.org_role as enum ('organization_owner','organization_admin','brand_manager','creative_director','designer','motion_designer','analyst','client_reviewer','creator');
create type public.membership_status as enum ('active','revoked');
create type public.product_status as enum ('draft','in_review','published','archived');
create type public.cosmetic_category as enum ('lipstick','lip_gloss','blush','eyeshadow','eyeliner','foundation','skincare','fragrance');
create type public.finish as enum ('matte','satin','gloss','shimmer','metallic','natural');
create type public.order_status as enum ('created','pending_payment','paid','fulfilling','fulfilled','cancelled','refunded');
create type public.project_status as enum ('intake','active','review','approved','delivered','archived');
create type public.render_status as enum ('queued','running','completed','failed','cancelled');
create type public.workflow_status as enum ('proposed','queued','running','awaiting_human','completed','failed','cancelled');
create type public.privacy_class as enum ('product_public','creative_private','face_private');

-- ------------------------------------------------------------------ identity & tenants
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check (char_length(name) between 2 and 120),
  kind text not null check (kind in ('brand','agency')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.org_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now()
);
-- One active membership per (user, org, role).
create unique index organization_members_active_uq on public.organization_members (organization_id, user_id, role) where status = 'active';
create index organization_members_user_idx on public.organization_members (user_id) where status = 'active';

create table public.org_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email_hash text not null,
  role public.org_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version int not null default 1 check (version > 0),
  tokens jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, version)
);

-- ------------------------------------------------------------------ catalog
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  unique (id, organization_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  brand_id uuid not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,80}$'),
  title text not null check (char_length(title) between 2 and 140),
  category public.cosmetic_category not null,
  description text not null default '' check (char_length(description) <= 4000),
  instructions text not null default '',
  ingredients text not null default '',
  warnings text not null default '',
  image_alt text not null default '',
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  -- composite FK: brand must belong to the same organization
  foreign key (brand_id, organization_id) references public.brands(id, organization_id),
  unique (id, organization_id)
);
create index products_public_idx on public.products (status, published_at desc) where status = 'published';
create index products_org_idx on public.products (organization_id, created_at desc);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  product_id uuid not null,
  sku text not null check (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,63}$'),
  shade_name text not null check (char_length(shade_name) between 1 and 80),
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  lab real[] check (lab is null or array_length(lab, 1) = 3),
  finish public.finish not null,
  default_opacity real not null default 0.6 check (default_opacity between 0 and 1),
  price_minor bigint not null check (price_minor > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, organization_id) references public.products(id, organization_id) on delete cascade,
  unique (organization_id, sku)
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.inventories (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  on_hand int not null default 0 check (on_hand >= 0),
  reserved int not null default 0 check (reserved >= 0),
  check (reserved <= on_hand)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  delta int not null,
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  storage_key text not null,
  alt_text text not null default '',
  license_source text not null,
  license_expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ commerce
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id),
  quantity int not null check (quantity between 1 and 10),
  unique (cart_id, variant_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status public.order_status not null default 'created',
  total_minor bigint not null check (total_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  currency char(3) not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  variant_id uuid not null references public.product_variants(id),
  -- immutable snapshots
  product_title text not null, shade_name text not null, sku text not null,
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  quantity int not null check (quantity > 0),
  tax_minor bigint not null default 0, discount_minor bigint not null default 0,
  currency char(3) not null
);
create index order_items_org_idx on public.order_items (organization_id, order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status, to_status public.order_status not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create table public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cart_id uuid not null,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9_-]{8,128}$'),
  request_hash text not null,
  total_minor bigint not null, currency char(3) not null,
  provider_session_id text not null unique,
  order_id uuid not null references public.orders(id),
  status text not null default 'open' check (status in ('open','completed','expired')),
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.payment_events (
  provider_event_id text primary key,
  type text not null,
  order_id uuid references public.orders(id),
  processed boolean not null default false,
  received_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ beauty
create table public.looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  recipe jsonb not null check (recipe ? 'version' and recipe ? 'selectedProducts'),
  created_at timestamptz not null default now()
);
create index looks_user_idx on public.looks (user_id, created_at desc);

create table public.photo_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  scope text not null check (scope in ('camera_session','store_photo')),
  granted boolean not null,
  created_at timestamptz not null default now()
);

create table public.private_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete cascade,
  bucket text not null, key text not null,
  content_sha256 text not null, mime text not null, bytes bigint not null check (bytes > 0),
  privacy_class public.privacy_class not null,
  consent_id uuid references public.photo_consents(id),
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket, key),
  -- face media is always user-owned and requires a consent record
  check (privacy_class <> 'face_private' or (owner_user_id is not null and consent_id is not null and organization_id is null))
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ------------------------------------------------------------------ agency & creative
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null, client_name text not null default 'Internal',
  status public.project_status not null default 'intake',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index projects_org_idx on public.projects (organization_id, status, created_at desc);

create table public.briefs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  input jsonb not null,
  confirmed_by_client boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects(id, organization_id) on delete cascade
);

create table public.motion_compositions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  product_id uuid,
  title text not null,
  head_revision int not null default 1 check (head_revision >= 1),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects(id, organization_id),
  foreign key (product_id, organization_id) references public.products(id, organization_id),
  unique (id, organization_id)
);

create table public.scene_versions (
  composition_id uuid not null,
  organization_id uuid not null,
  revision int not null check (revision >= 1),
  doc jsonb not null check ((doc->>'schemaVersion')::int = 1),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (composition_id, revision),
  foreign key (composition_id, organization_id) references public.motion_compositions(id, organization_id) on delete cascade
);

create table public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  project_id uuid not null,
  composition_id uuid not null,
  revision int not null,
  token_hash text not null unique,
  reviewer_name text not null,
  can_approve boolean not null default false,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (project_id, organization_id) references public.projects(id, organization_id) on delete cascade,
  foreign key (composition_id, revision) references public.scene_versions(composition_id, revision)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_session_id uuid not null references public.review_sessions(id) on delete cascade,
  composition_id uuid not null, revision int not null,
  frame int check (frame >= 0), element_id text,
  body text not null check (char_length(body) between 1 and 2000),
  author_label text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  composition_id uuid not null, revision int not null,
  review_session_id uuid references public.review_sessions(id),
  decision text not null check (decision in ('approved','changes_requested')),
  actor_label text not null, note text,
  created_at timestamptz not null default now()
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  composition_id uuid not null,
  revision int not null,
  status public.render_status not null default 'queued',
  quality text not null default 'preview' check (quality in ('preview','final')),
  idempotency_key text not null,
  attempts int not null default 0, max_attempts int not null default 3 check (max_attempts between 1 and 10),
  locked_by text, locked_at timestamptz,
  available_at timestamptz not null default now(),
  progress real not null default 0 check (progress between 0 and 1),
  output_key text, checksum text, error text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (composition_id, organization_id) references public.motion_compositions(id, organization_id),
  unique (organization_id, idempotency_key)
);
create index render_jobs_queue_idx on public.render_jobs (status, available_at, created_at) where status in ('queued','running');

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  composition_id uuid not null, revision int not null,
  render_job_id uuid not null references public.render_jobs(id),
  checksum text not null,
  created_at timestamptz not null default now()
);

create table public.asset_licenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_ref text not null, source text not null, license text not null, expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ AI & operations
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  name text not null,
  status text not null default 'brief' check (status in ('brief','proposals','editing','compliance_check','human_approval','approved','scheduled','published','archived')),
  workflow_id uuid, composition_id uuid,
  input jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (product_id, organization_id) references public.products(id, organization_id)
);

create table public.ai_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null,
  status public.workflow_status not null default 'proposed',
  invoked_by uuid not null references auth.users(id),
  correlation_id text not null,
  state jsonb not null default '{}'::jsonb,
  tokens_used int not null default 0, max_tokens int not null default 60000 check (tokens_used <= max_tokens + 8000),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.ai_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  key text not null, agent text,
  status text not null check (status in ('proposed','queued','running','awaiting_human','completed','failed','cancelled','needs_review')),
  attempts int not null default 0 check (attempts <= 3),
  input_hash text, output_hash text, error text,
  started_at timestamptz, finished_at timestamptz
);

create table public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  step_key text not null, prompt_id text not null, prompt_version int not null,
  output jsonb not null,
  created_at timestamptz not null default now()
);

create table public.human_approvals (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.ai_workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gate_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id), selection text, note text,
  created_at timestamptz not null default now(), decided_at timestamptz
);
create unique index human_approvals_pending_uq on public.human_approvals (workflow_id, gate_id) where status = 'pending';

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('llm_tokens','render_seconds','images','storage_bytes')),
  quantity bigint not null check (quantity >= 0),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index usage_ledger_org_idx on public.usage_ledger (organization_id, kind, created_at);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid,
  action text not null, entity text not null, entity_id uuid,
  meta jsonb not null default '{}'::jsonb check (pg_column_size(meta) < 4096),
  created_at timestamptz not null default now()
);
create index audit_events_org_idx on public.audit_events (organization_id, created_at desc);

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name in ('product_view','shade_selected','tryon_started','tryon_effect_applied','look_saved','cart_added','checkout_started','purchase_completed','brief_submitted','concept_generated','asset_approved','render_started','render_completed','export_downloaded')),
  user_id uuid, organization_id uuid,
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) < 2048),
  created_at timestamptz not null default now()
);
