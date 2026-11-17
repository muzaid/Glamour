-- Fictional demo/test fixtures. Two tenants, two shoppers. No real people.
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1','ava@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000a2','bea@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000b1','lena@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000b2','marco@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000c1','omar@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000c2','dana@demo.glamotion.test'),
  ('00000000-0000-4000-8000-0000000000d1','rhea@demo.glamotion.test');
insert into public.profiles (id, display_name) select id, split_part(email,'@',1) from auth.users;
insert into public.organizations (id, slug, name, kind) values
  ('10000000-0000-4000-8000-000000000001','maison-lumiere','Maison Lumière (demo brand)','brand'),
  ('10000000-0000-4000-8000-000000000002','atelier-nova','Atelier Nova (demo agency)','agency');
insert into public.organization_members (organization_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000b1','organization_owner'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000b2','brand_manager'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000c1','organization_owner'),
  ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-0000000000c2','designer'),
  ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000d1','client_reviewer');
insert into public.brands (id, organization_id, name, slug) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Maison Lumière','maison-lumiere'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Rosebud Studio','rosebud-studio');
insert into public.products (id, organization_id, brand_id, slug, title, category, description, status) values
  ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','velvet-matte-lipstick','Velvet Matte Lipstick','lipstick','Demo','draft'),
  ('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','glass-lip-gloss','Glass Lip Gloss','lip_gloss','Draft','draft'),
  ('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','petal-tint','Petal Tint','lipstick','Demo','draft');
insert into public.product_variants (id, organization_id, product_id, sku, shade_name, hex, finish, price_minor, currency) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','ML-VML-ROSEWOOD','Rosewood','#9E4B5A','matte',2800,'USD'),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','ML-GLG-CLEAR','Crystal','#E8B6B6','gloss',2200,'USD'),
  ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003','RB-PT-POPPY','Poppy','#C8323C','satin',1900,'USD');
insert into public.inventories (variant_id, organization_id, on_hand) values
  ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',5),
  ('50000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',50),
  ('50000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',60);
update public.products set status = 'published' where slug in ('velvet-matte-lipstick','petal-tint');
