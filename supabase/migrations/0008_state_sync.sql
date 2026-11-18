-- GLAMOTION 0008_state_sync (ADR-015): shared, durable state for the serverless
-- demo deployment until the per-table repository (F-011) lands.
-- Everything lives in a private schema that the API does not expose; the only
-- entry points are four SECURITY DEFINER functions that require a server-only
-- token (stored here as a SHA-256 hash). No table has an RLS policy, so the
-- anon/authenticated roles can never read or write rows directly.
create schema if not exists glamotion;
revoke all on schema glamotion from public, anon, authenticated;

create sequence if not exists glamotion.state_rev;
create table if not exists glamotion.state (
  collection text not null check (collection ~ '^[a-zA-Z]{1,40}$'),
  key text not null check (char_length(key) between 1 and 300),
  data jsonb,
  deleted boolean not null default false,
  rev bigint not null default nextval('glamotion.state_rev'),
  updated_at timestamptz not null default now(),
  primary key (collection, key)
);
create index if not exists state_rev_idx on glamotion.state (rev);
create table if not exists glamotion.media (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9/_-]{0,200}\.(webm|png|jpg|webp|json)$'),
  mime text not null check (char_length(mime) <= 100),
  bytes bytea not null check (octet_length(bytes) <= 26214400),
  created_at timestamptz not null default now()
);
create table if not exists glamotion.secret (id int primary key check (id = 1), token_sha256 text not null check (token_sha256 ~ '^[0-9a-f]{64}$'));
alter table glamotion.state enable row level security; alter table glamotion.state force row level security;
alter table glamotion.media enable row level security; alter table glamotion.media force row level security;
alter table glamotion.secret enable row level security; alter table glamotion.secret force row level security;

create or replace function glamotion.authorize(p_token text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_token is null or char_length(p_token) < 32 or not exists (
    select 1 from glamotion.secret s where s.token_sha256 = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;
revoke all on function glamotion.authorize(text) from public, anon, authenticated;

/** Rows changed after p_since (callers re-read a small overlap; applying a row twice is harmless). */
create or replace function public.glamotion_state_pull(p_token text, p_since bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform glamotion.authorize(p_token);
  return jsonb_build_object(
    'rev', (select coalesce(max(rev), 0) from glamotion.state),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('c', collection, 'k', key, 'd', data, 'x', deleted, 'r', rev) order by rev)
                      from glamotion.state where rev > coalesce(p_since, 0)), '[]'::jsonb));
end $$;

/** Upsert rows [{c,k,d,x}]; last writer wins per entity. Returns the newest revision. */
create or replace function public.glamotion_state_push(p_token text, p_rows jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
begin
  perform glamotion.authorize(p_token);
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 20000 then raise exception 'bad rows' using errcode = '22023'; end if;
  insert into glamotion.state (collection, key, data, deleted)
    select r->>'c', r->>'k', case when coalesce((r->>'x')::boolean, false) then null else r->'d' end, coalesce((r->>'x')::boolean, false)
    from jsonb_array_elements(p_rows) r
  on conflict (collection, key) do update
    set data = excluded.data, deleted = excluded.deleted, rev = nextval('glamotion.state_rev'), updated_at = now();
  return (select coalesce(max(rev), 0) from glamotion.state);
end $$;

create or replace function public.glamotion_media_put(p_token text, p_key text, p_mime text, p_b64 text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform glamotion.authorize(p_token);
  insert into glamotion.media (key, mime, bytes) values (p_key, p_mime, decode(p_b64, 'base64'))
  on conflict (key) do update set mime = excluded.mime, bytes = excluded.bytes, created_at = now();
end $$;

create or replace function public.glamotion_media_get(p_token text, p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform glamotion.authorize(p_token);
  return (select jsonb_build_object('mime', m.mime, 'b64', encode(m.bytes, 'base64')) from glamotion.media m where m.key = p_key);
end $$;

create or replace function public.glamotion_media_delete(p_token text, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform glamotion.authorize(p_token);
  delete from glamotion.media where key = p_key;
end $$;

revoke all on function public.glamotion_state_pull(text, bigint), public.glamotion_state_push(text, jsonb),
  public.glamotion_media_put(text, text, text, text), public.glamotion_media_get(text, text), public.glamotion_media_delete(text, text) from public;
grant execute on function public.glamotion_state_pull(text, bigint), public.glamotion_state_push(text, jsonb),
  public.glamotion_media_put(text, text, text, text), public.glamotion_media_get(text, text), public.glamotion_media_delete(text, text) to anon, authenticated;
