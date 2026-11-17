-- GLAMOTION 0004_apparel: clothing addendum (ADR-010).
-- Apparel categories, size per variant, size on order snapshots, and the
-- opt-in cloud try-on consent scope. No face/body media is stored by this feature.

alter type public.cosmetic_category add value if not exists 'top';
alter type public.cosmetic_category add value if not exists 'outerwear';
alter type public.cosmetic_category add value if not exists 'dress';

alter table public.product_variants add column size_label text check (size_label is null or size_label ~ '^[A-Za-z0-9./ -]{1,12}$');
alter table public.order_items add column size_label text;

alter table public.photo_consents drop constraint photo_consents_scope_check;
alter table public.photo_consents add constraint photo_consents_scope_check check (scope in ('camera_session','store_photo','cloud_generation'));
