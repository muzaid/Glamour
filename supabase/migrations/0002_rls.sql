-- GLAMOTION 0002_rls: helper functions + row level security on every table.
-- Helpers are SECURITY DEFINER with an empty search_path so that policies on
-- organization_members do not recurse and cannot be hijacked via search_path.

create or replace function app.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.status = 'active'
    where m.organization_id = org and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function app.has_org_role(org uuid, roles public.org_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.organization_id and o.status = 'active'
    where m.organization_id = org and m.user_id = auth.uid() and m.status = 'active' and m.role = any(roles)
  );
$$;

-- Capability groups (mirror packages/core/src/permissions.ts).
create or replace function app.can_catalog(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['organization_owner','organization_admin','brand_manager']::public.org_role[]) $$;
create or replace function app.can_create(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['organization_owner','organization_admin','creative_director','designer','motion_designer']::public.org_role[]) $$;
create or replace function app.can_admin(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_org_role(org, array['organization_owner','organization_admin']::public.org_role[]) $$;
create or replace function app.can_workspace_read(org uuid) returns boolean language sql stable security definer set search_path = '' as $$
  -- client_reviewer accounts read only via scoped review tokens, never the workspace.
  select app.has_org_role(org, array['organization_owner','organization_admin','brand_manager','creative_director','designer','motion_designer','analyst']::public.org_role[]) $$;

create or replace function app.product_is_public(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.products p join public.organizations o on o.id = p.organization_id
                 where p.id = pid and p.status = 'published' and o.status = 'active');
$$;

revoke all on function app.is_member, app.has_org_role, app.can_catalog, app.can_create, app.can_admin, app.can_workspace_read, app.product_is_public from public;
grant usage on schema app to anon, authenticated;
grant execute on function app.is_member, app.has_org_role, app.can_catalog, app.can_create, app.can_admin, app.can_workspace_read, app.product_is_public to anon, authenticated;

-- Enable RLS everywhere (default deny).
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;

-- ---------------------------------------------------------------- identity
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and is_platform_admin = false);

create policy orgs_member_read on public.organizations for select to authenticated using (app.is_member(id));
create policy orgs_public_brand_read on public.organizations for select to anon, authenticated
  using (status = 'active' and exists (select 1 from public.products p where p.organization_id = id and p.status = 'published'));
create policy orgs_admin_update on public.organizations for update to authenticated using (app.can_admin(id)) with check (app.can_admin(id));

create policy members_read on public.organization_members for select to authenticated using (app.can_workspace_read(organization_id) or user_id = auth.uid());
create policy members_admin_insert on public.organization_members for insert to authenticated with check (app.can_admin(organization_id));
create policy members_admin_update on public.organization_members for update to authenticated using (app.can_admin(organization_id)) with check (app.can_admin(organization_id));
create policy members_admin_delete on public.organization_members for delete to authenticated using (app.can_admin(organization_id));

create policy invites_admin on public.org_invitations for all to authenticated using (app.can_admin(organization_id)) with check (app.can_admin(organization_id));
create policy brand_kits_read on public.brand_kits for select to authenticated using (app.can_workspace_read(organization_id));
create policy brand_kits_write on public.brand_kits for insert to authenticated with check (app.can_create(organization_id) or app.can_catalog(organization_id));

-- ---------------------------------------------------------------- catalog
create policy brands_public_read on public.brands for select to anon, authenticated
  using (exists (select 1 from public.products p where p.brand_id = id and app.product_is_public(p.id)));
create policy brands_member_read on public.brands for select to authenticated using (app.can_workspace_read(organization_id));
create policy brands_catalog_write on public.brands for insert to authenticated with check (app.can_catalog(organization_id));

create policy products_public_read on public.products for select to anon, authenticated using (app.product_is_public(id));
create policy products_member_read on public.products for select to authenticated using (app.can_workspace_read(organization_id));
create policy products_catalog_insert on public.products for insert to authenticated with check (app.can_catalog(organization_id) and status = 'draft');
create policy products_catalog_update on public.products for update to authenticated using (app.can_catalog(organization_id)) with check (app.can_catalog(organization_id));
create policy products_admin_delete on public.products for delete to authenticated using (app.can_admin(organization_id) and status = 'draft');

create policy variants_public_read on public.product_variants for select to anon, authenticated using (active and app.product_is_public(product_id));
create policy variants_member_read on public.product_variants for select to authenticated using (app.can_workspace_read(organization_id));
create policy variants_catalog_write on public.product_variants for insert to authenticated with check (app.can_catalog(organization_id));
create policy variants_catalog_update on public.product_variants for update to authenticated using (app.can_catalog(organization_id)) with check (app.can_catalog(organization_id));

-- Stock levels: members only; public availability via app.available_units().
create policy inventories_member_read on public.inventories for select to authenticated using (app.can_workspace_read(organization_id));
create policy movements_member_read on public.inventory_movements for select to authenticated using (app.can_workspace_read(organization_id));
create policy product_media_public on public.product_media for select to anon, authenticated using (app.product_is_public(product_id) or app.can_workspace_read(organization_id));
create policy product_media_write on public.product_media for insert to authenticated with check (app.can_catalog(organization_id));

-- ---------------------------------------------------------------- commerce (writes go through server functions)
create policy carts_own on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()) and exists (select 1 from public.product_variants v where v.id = variant_id and v.active and app.product_is_public(v.product_id)));
create policy orders_own_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy order_items_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or app.can_admin(organization_id));
create policy order_events_own on public.order_events for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy checkout_own_read on public.checkout_sessions for select to authenticated using (user_id = auth.uid());
-- payment_events: no client policies (service role only).

-- ---------------------------------------------------------------- beauty / privacy
create policy looks_own on public.looks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy consents_own_read on public.photo_consents for select to authenticated using (user_id = auth.uid());
create policy consents_own_insert on public.photo_consents for insert to authenticated with check (user_id = auth.uid());
-- Face media: owner only. Tenant operators have no path to face_private rows.
create policy private_assets_owner on public.private_assets for select to authenticated using (owner_user_id = auth.uid());
create policy private_assets_owner_delete on public.private_assets for delete to authenticated using (owner_user_id = auth.uid());
create policy private_assets_creative on public.private_assets for select to authenticated using (privacy_class = 'creative_private' and app.can_workspace_read(organization_id));
create policy deletion_own on public.deletion_requests for select to authenticated using (user_id = auth.uid());
create policy deletion_own_insert on public.deletion_requests for insert to authenticated with check (user_id = auth.uid());

-- ---------------------------------------------------------------- agency & creative
create policy projects_read on public.projects for select to authenticated using (app.can_workspace_read(organization_id));
create policy projects_write on public.projects for insert to authenticated with check (app.can_create(organization_id) or app.can_admin(organization_id));
create policy projects_update on public.projects for update to authenticated using (app.can_create(organization_id)) with check (app.can_create(organization_id));
create policy briefs_read on public.briefs for select to authenticated using (app.can_workspace_read(organization_id));
create policy briefs_write on public.briefs for insert to authenticated with check (app.can_create(organization_id));
create policy compositions_read on public.motion_compositions for select to authenticated using (app.can_workspace_read(organization_id));
create policy compositions_write on public.motion_compositions for insert to authenticated with check (app.can_create(organization_id));
create policy compositions_update on public.motion_compositions for update to authenticated using (app.can_create(organization_id)) with check (app.can_create(organization_id));
create policy scene_versions_read on public.scene_versions for select to authenticated using (app.can_workspace_read(organization_id));
create policy scene_versions_insert on public.scene_versions for insert to authenticated with check (app.can_create(organization_id));
-- scene_versions are immutable: no update/delete policy.
create policy review_sessions_read on public.review_sessions for select to authenticated using (app.can_workspace_read(organization_id));
create policy review_sessions_write on public.review_sessions for insert to authenticated with check (app.can_create(organization_id) or app.can_catalog(organization_id));
create policy review_sessions_revoke on public.review_sessions for update to authenticated using (app.can_create(organization_id) or app.can_catalog(organization_id)) with check (app.can_create(organization_id) or app.can_catalog(organization_id));
create policy annotations_read on public.annotations for select to authenticated using (app.can_workspace_read(organization_id));
create policy approvals_read on public.approvals for select to authenticated using (app.can_workspace_read(organization_id));
create policy render_jobs_read on public.render_jobs for select to authenticated using (app.can_workspace_read(organization_id));
create policy render_jobs_insert on public.render_jobs for insert to authenticated with check ((app.can_create(organization_id) or app.can_catalog(organization_id)) and status = 'queued' and created_by = auth.uid());
create policy deliveries_read on public.deliveries for select to authenticated using (app.can_workspace_read(organization_id));
create policy licenses_read on public.asset_licenses for select to authenticated using (app.can_workspace_read(organization_id));
create policy licenses_write on public.asset_licenses for insert to authenticated with check (app.can_create(organization_id) or app.can_catalog(organization_id));

-- ---------------------------------------------------------------- AI & ops (writes by orchestrator service only)
create policy campaigns_read on public.campaigns for select to authenticated using (app.can_workspace_read(organization_id));
create policy workflows_read on public.ai_workflows for select to authenticated using (app.can_workspace_read(organization_id));
create policy steps_read on public.ai_steps for select to authenticated using (app.can_workspace_read(organization_id));
create policy artifacts_read on public.agent_artifacts for select to authenticated using (app.can_workspace_read(organization_id));
create policy human_approvals_read on public.human_approvals for select to authenticated using (app.can_workspace_read(organization_id));
create policy usage_read on public.usage_ledger for select to authenticated using (app.can_admin(organization_id));
create policy audit_read on public.audit_events for select to authenticated using (app.can_admin(organization_id));
-- analytics_events: no client policies (ingested by server after validation).

-- Audit log is append-only even for table owners other than superuser.
create or replace function app.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'audit_events is append-only'; end $$;
create trigger audit_events_immutable before update or delete on public.audit_events for each row execute function app.forbid_mutation();
create trigger scene_versions_immutable before update on public.scene_versions for each row execute function app.forbid_mutation();
