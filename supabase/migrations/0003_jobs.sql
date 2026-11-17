-- GLAMOTION 0003_jobs: state-machine guards, atomic inventory reservation,
-- render queue claim with leases, transactional outbox.

create table public.job_outbox (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  organization_id uuid,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  attempts int not null default 0
);
alter table public.job_outbox enable row level security;
alter table public.job_outbox force row level security;
create index job_outbox_pending_idx on public.job_outbox (created_at) where dispatched_at is null;

-- ---------------------------------------------------------------- state machine guards
create or replace function app.guard_product_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status in ('in_review','published','archived')) or
    (old.status = 'in_review' and new.status in ('draft','published','archived')) or
    (old.status = 'published' and new.status in ('archived','draft')) or
    (old.status = 'archived' and new.status = 'draft')) then
    raise exception 'INVALID_TRANSITION product % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  if new.status = 'published' and old.status <> 'published' then
    if not exists (select 1 from public.product_variants v where v.product_id = new.id and v.active) then
      raise exception 'VALIDATION_FAILED product needs an active variant' using errcode = 'P0001';
    end if;
    new.published_at := now();
    insert into public.job_outbox (topic, organization_id, payload)
      values ('product.published.v1', new.organization_id, jsonb_build_object('productId', new.id));
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger products_status_guard before update on public.products for each row execute function app.guard_product_status();

create or replace function app.guard_order_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'created' and new.status in ('pending_payment','cancelled')) or
    (old.status = 'pending_payment' and new.status in ('paid','cancelled')) or
    (old.status = 'paid' and new.status in ('fulfilling','refunded')) or
    (old.status = 'fulfilling' and new.status in ('fulfilled','refunded')) or
    (old.status = 'fulfilled' and new.status = 'refunded')) then
    raise exception 'INVALID_TRANSITION order % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status then
    insert into public.order_events (order_id, from_status, to_status, actor) values (new.id, old.status, new.status, coalesce(current_setting('app.actor', true), 'system'));
  end if;
  return new;
end $$;
create trigger orders_status_guard before update on public.orders for each row execute function app.guard_order_status();

-- Order line snapshots are immutable.
create trigger order_items_immutable before update on public.order_items for each row execute function app.forbid_mutation();

create or replace function app.guard_render_status() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status and not (
    (old.status = 'queued' and new.status in ('running','cancelled','failed')) or
    (old.status = 'running' and new.status in ('completed','failed','cancelled','queued'))) then
    raise exception 'INVALID_TRANSITION render % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger render_jobs_status_guard before update on public.render_jobs for each row execute function app.guard_render_status();

create or replace function app.enqueue_render_event() returns trigger language plpgsql as $$
begin
  insert into public.job_outbox (topic, organization_id, payload)
    values ('render.queued.v1', new.organization_id, jsonb_build_object('renderJobId', new.id, 'compositionId', new.composition_id));
  return new;
end $$;
create trigger render_jobs_outbox after insert on public.render_jobs for each row execute function app.enqueue_render_event();

-- ---------------------------------------------------------------- public availability (no stock levels leak beyond a count)
create or replace function app.available_units(vid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, i.on_hand - i.reserved) from public.inventories i
  join public.product_variants v on v.id = i.variant_id
  where i.variant_id = vid and v.active and app.product_is_public(v.product_id);
$$;
grant execute on function app.available_units to anon, authenticated;

-- ---------------------------------------------------------------- atomic reservation (all-or-nothing, row locks in id order to avoid deadlocks)
create or replace function app.reserve_inventory(p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in
    select i.variant_id, oi.quantity, i.on_hand, i.reserved
    from public.order_items oi join public.inventories i on i.variant_id = oi.variant_id
    where oi.order_id = p_order order by i.variant_id for update of i
  loop
    if r.on_hand - r.reserved < r.quantity then
      raise exception 'OUT_OF_STOCK %', r.variant_id using errcode = 'P0001';
    end if;
    update public.inventories set reserved = reserved + r.quantity where variant_id = r.variant_id;
  end loop;
end $$;
revoke all on function app.reserve_inventory from public, anon, authenticated;

-- Convert reservation to sale on verified payment; idempotent per provider event id.
create or replace function app.apply_payment(p_event text, p_type text, p_order uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare st public.order_status;
begin
  insert into public.payment_events (provider_event_id, type, order_id) values (p_event, p_type, p_order)
    on conflict (provider_event_id) do nothing;
  if not found then return 'duplicate'; end if;
  select status into st from public.orders where id = p_order for update;
  if p_type = 'checkout.completed' and st = 'pending_payment' then
    update public.inventories i set reserved = i.reserved - oi.quantity, on_hand = i.on_hand - oi.quantity
      from public.order_items oi where oi.order_id = p_order and i.variant_id = oi.variant_id;
    update public.orders set status = 'paid', paid_at = now() where id = p_order;
  elsif p_type in ('checkout.expired','payment.failed') and st = 'pending_payment' then
    update public.inventories i set reserved = i.reserved - oi.quantity
      from public.order_items oi where oi.order_id = p_order and i.variant_id = oi.variant_id;
    update public.orders set status = 'cancelled' where id = p_order;
  end if;
  update public.payment_events set processed = true where provider_event_id = p_event;
  return 'processed';
end $$;
revoke all on function app.apply_payment from public, anon, authenticated;

-- ---------------------------------------------------------------- render queue claim (SKIP LOCKED + lease)
create or replace function app.claim_render_job(p_worker text, p_lease interval default interval '60 seconds')
returns setof public.render_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.render_jobs j set
    status = 'running', attempts = j.attempts + 1, locked_by = p_worker, locked_at = now(), progress = 0
  where j.id = (
    select id from public.render_jobs
    where (status = 'queued' and available_at <= now()) or (status = 'running' and locked_at < now() - p_lease)
    order by created_at for update skip locked limit 1
  )
  -- worker-side tenant provenance check: composition must belong to the job's org
  and exists (select 1 from public.motion_compositions c where c.id = j.composition_id and c.organization_id = j.organization_id)
  returning j.*;
end $$;
revoke all on function app.claim_render_job from public, anon, authenticated;

-- ---------------------------------------------------------------- review links (token-scoped access without accounts)
create or replace function app.review_by_token(p_token text)
returns table (review_session_id uuid, composition_id uuid, revision int, can_approve boolean, reviewer_name text, doc jsonb)
language sql stable security definer set search_path = '' as $$
  select r.id, r.composition_id, r.revision, r.can_approve, r.reviewer_name, s.doc
  from public.review_sessions r
  join public.scene_versions s on s.composition_id = r.composition_id and s.revision = r.revision
  where r.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and r.revoked_at is null and r.expires_at > now();
$$;
grant execute on function app.review_by_token to anon, authenticated;
