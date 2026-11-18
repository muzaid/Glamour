-- GLAMOTION 0005_runway: "Try the Look" runway lookbook managed by brands.
-- Wearable categories beyond the try-on garments, product packshots, and
-- runway looks (model photo + pins onto the organization's own products).
-- Images are references only: a private-bucket key or an allow-listed file name, never a URL.

alter type public.cosmetic_category add value if not exists 'bottoms';
alter type public.cosmetic_category add value if not exists 'footwear';

create or replace function app.valid_image_ref(img jsonb) returns boolean language sql immutable set search_path = '' as $$
  select img is null
      or (img->>'kind' = 'media' and (img->>'key') ~ '^catalog/[0-9a-f-]{36}\.(png|jpg|webp)$' and img - 'kind' - 'key' = '{}'::jsonb)
      or (img->>'kind' = 'reference' and (img->>'file') ~ '^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpg)$'
          and (img->>'large' is null or (img->>'large') ~ '^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpg)$')
          and img - 'kind' - 'file' - 'large' = '{}'::jsonb)
$$;

alter table public.products add column image jsonb check (app.valid_image_ref(image));

create type public.runway_look_status as enum ('draft', 'published');

create table public.runway_looks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  position integer not null default 0 check (position between 0 and 999),
  status public.runway_look_status not null default 'draft',
  image jsonb check (app.valid_image_ref(image)),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  check (status = 'draft' or image is not null)
);
create index runway_looks_public_idx on public.runway_looks (position, created_at) where status = 'published';

create table public.runway_look_pins (
  look_id uuid not null,
  organization_id uuid not null,
  product_id uuid not null,
  position smallint not null check (position between 1 and 6),
  pin_left numeric(4,1) not null check (pin_left between 0 and 100),
  pin_top numeric(4,1) not null check (pin_top between 0 and 100),
  tag text check (tag is null or char_length(tag) between 1 and 16),
  primary key (look_id, product_id),
  unique (look_id, position),
  -- composite FKs: the look and the pinned product must belong to the same organization
  foreign key (look_id, organization_id) references public.runway_looks(id, organization_id) on delete cascade,
  foreign key (product_id, organization_id) references public.products(id, organization_id) on delete cascade
);

create or replace function app.runway_look_is_public(lid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.runway_looks l join public.organizations o on o.id = l.organization_id
                 where l.id = lid and l.status = 'published' and o.status = 'active');
$$;
revoke all on function app.runway_look_is_public, app.valid_image_ref from public;
grant execute on function app.runway_look_is_public, app.valid_image_ref to anon, authenticated;

alter table public.runway_looks enable row level security;
alter table public.runway_looks force row level security;
alter table public.runway_look_pins enable row level security;
alter table public.runway_look_pins force row level security;

create policy runway_looks_public_read on public.runway_looks for select to anon, authenticated using (app.runway_look_is_public(id));
create policy runway_looks_member_read on public.runway_looks for select to authenticated using (app.can_workspace_read(organization_id));
create policy runway_looks_catalog_insert on public.runway_looks for insert to authenticated
  with check (app.can_catalog(organization_id) and status = 'draft' and created_by = auth.uid());
create policy runway_looks_catalog_update on public.runway_looks for update to authenticated
  using (app.can_catalog(organization_id)) with check (app.can_catalog(organization_id));
create policy runway_looks_catalog_delete on public.runway_looks for delete to authenticated using (app.can_catalog(organization_id));

-- Public pins only for published looks AND published products (drafts never leak through a look).
create policy runway_pins_public_read on public.runway_look_pins for select to anon, authenticated
  using (app.runway_look_is_public(look_id) and app.product_is_public(product_id));
create policy runway_pins_member_read on public.runway_look_pins for select to authenticated using (app.can_workspace_read(organization_id));
create policy runway_pins_catalog_write on public.runway_look_pins for insert to authenticated with check (app.can_catalog(organization_id));
create policy runway_pins_catalog_update on public.runway_look_pins for update to authenticated
  using (app.can_catalog(organization_id)) with check (app.can_catalog(organization_id));
create policy runway_pins_catalog_delete on public.runway_look_pins for delete to authenticated using (app.can_catalog(organization_id));

grant select on public.runway_looks, public.runway_look_pins to anon, authenticated;
grant insert, update, delete on public.runway_looks, public.runway_look_pins to authenticated;
