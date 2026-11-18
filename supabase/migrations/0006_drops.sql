-- GLAMOTION 0006_drops: "Arriving Tomorrow" mix-and-match drop posts.
-- Two rows (top/bottom), each one white garment cut-out plus an ordered list of
-- colourways; colours are produced client-side by masking the white photo.
-- Also allows the images.higgs.ai-proxied cut-outs as an image reference kind.

create or replace function app.valid_image_ref(img jsonb) returns boolean language sql immutable set search_path = '' as $$
  select img is null
      or (img->>'kind' = 'media' and (img->>'key') ~ '^catalog/[0-9a-f-]{36}\.(png|jpg|webp)$' and img - 'kind' - 'key' = '{}'::jsonb)
      or (img->>'kind' = 'reference' and (img->>'file') ~ '^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpg)$'
          and (img->>'large' is null or (img->>'large') ~ '^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpg)$')
          and img - 'kind' - 'file' - 'large' = '{}'::jsonb)
      or (img->>'kind' = 'higgs' and (img->>'path') ~ '^user_[A-Za-z0-9]{1,64}/hf_[A-Za-z0-9_-]{1,100}\.png$' and img - 'kind' - 'path' = '{}'::jsonb)
$$;

create or replace function app.valid_drop_colours(cs jsonb) returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(cs) = 'array' and jsonb_array_length(cs) between 1 and 12
     and not exists (
       select 1 from jsonb_array_elements(cs) c
       where jsonb_typeof(c) <> 'object'
          or c - 'name' - 'hex' <> '{}'::jsonb
          or coalesce(char_length(c->>'name'), 0) not between 1 and 20
          or coalesce(c->>'hex', '') !~ '^#[0-9A-Fa-f]{6}$')
$$;

create table public.drop_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  position integer not null default 0 check (position between 0 and 999),
  status public.runway_look_status not null default 'draft',
  top_image jsonb check (app.valid_image_ref(top_image)),
  top_colours jsonb not null check (app.valid_drop_colours(top_colours)),
  bottom_image jsonb check (app.valid_image_ref(bottom_image)),
  bottom_colours jsonb not null check (app.valid_drop_colours(bottom_colours)),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (top_image is not null and bottom_image is not null))
);
create index drop_posts_public_idx on public.drop_posts (position, created_at) where status = 'published';

create or replace function app.drop_is_public(did uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.drop_posts d join public.organizations o on o.id = d.organization_id
                 where d.id = did and d.status = 'published' and o.status = 'active');
$$;
revoke all on function app.drop_is_public, app.valid_drop_colours from public;
grant execute on function app.drop_is_public, app.valid_drop_colours to anon, authenticated;

alter table public.drop_posts enable row level security;
alter table public.drop_posts force row level security;
create policy drop_posts_public_read on public.drop_posts for select to anon, authenticated using (app.drop_is_public(id));
create policy drop_posts_member_read on public.drop_posts for select to authenticated using (app.can_workspace_read(organization_id));
create policy drop_posts_catalog_insert on public.drop_posts for insert to authenticated
  with check (app.can_catalog(organization_id) and status = 'draft' and created_by = auth.uid());
create policy drop_posts_catalog_update on public.drop_posts for update to authenticated
  using (app.can_catalog(organization_id)) with check (app.can_catalog(organization_id));
create policy drop_posts_catalog_delete on public.drop_posts for delete to authenticated using (app.can_catalog(organization_id));

grant select on public.drop_posts to anon, authenticated;
grant insert, update, delete on public.drop_posts to authenticated;
