import { describe, expect, it, beforeAll, afterAll } from "vitest";
import pg from "pg";

/**
 * Two-tenant attack tests against the real SQL (spec §17 threat checks).
 * Run via `pnpm test:rls`, which provisions a throwaway Postgres. Skipped
 * when RLS_DATABASE_URL is not set.
 */
const url = process.env.RLS_DATABASE_URL;
const U = { ava: "00000000-0000-4000-8000-0000000000a1", bea: "00000000-0000-4000-8000-0000000000a2", lena: "00000000-0000-4000-8000-0000000000b1", marco: "00000000-0000-4000-8000-0000000000b2", omar: "00000000-0000-4000-8000-0000000000c1", dana: "00000000-0000-4000-8000-0000000000c2", rhea: "00000000-0000-4000-8000-0000000000d1" };
const ORG_L = "10000000-0000-4000-8000-000000000001", ORG_N = "10000000-0000-4000-8000-000000000002";
const DRAFT = "40000000-0000-4000-8000-000000000002";

let client: pg.Client;
async function as<T>(user: keyof typeof U | "anon", fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    if (user === "anon") await client.query("set local role anon");
    else {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[user], role: "authenticated" })]);
    }
    return await fn((sql, params) => client.query(sql, params as unknown[]));
  } finally {
    await client.query("rollback");
  }
}
/** Run a statement expected to fail inside a savepoint so the enclosing transaction survives. */
async function sqlErrQ(sql: string, params?: unknown[]) {
  await client.query("savepoint sp");
  try { await client.query(sql, params as unknown[]); await client.query("release savepoint sp"); return null; }
  catch (e) { await client.query("rollback to savepoint sp"); return (e as Error).message; }
}

describe.skipIf(!url)("RLS: tenant & privacy boundaries", () => {
  beforeAll(async () => { client = new pg.Client({ connectionString: url }); await client.connect(); });
  afterAll(async () => { await client?.end(); });

  it("every public table has RLS enabled and forced", async () => {
    const r = await client.query(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and (not c.relrowsecurity or not c.relforcerowsecurity)`);
    expect(r.rows).toEqual([]);
  });

  it("no policy uses USING (true)", async () => {
    const r = await client.query(`select policyname from pg_policies where schemaname='public' and (qual = 'true' or with_check = 'true')`);
    expect(r.rows).toEqual([]);
  });

  it("anonymous users see only published products and no drafts, stock or orders", async () => {
    await as("anon", async (q) => {
      const slugs = (await q("select slug from public.products order by slug")).rows.map((r) => r.slug);
      expect(slugs).toEqual(["petal-tint", "velvet-matte-lipstick"]);
      expect((await q("select * from public.product_variants where product_id = $1", [DRAFT])).rowCount).toBe(0);
      expect((await q("select * from public.inventories")).rowCount).toBe(0);
      expect((await q("select * from public.looks")).rowCount).toBe(0);
      expect((await q("select app.available_units('50000000-0000-4000-8000-000000000001') as n")).rows[0].n).toBe(5);
      expect(await sqlErrQ("insert into public.looks (user_id, name, recipe) values ($1, 'x', '{\"version\":1,\"selectedProducts\":[]}')", [U.ava])).toMatch(/permission denied|row-level security/);
    });
  });

  it("org B members cannot read or modify org A drafts, members, or renders", async () => {
    await as("omar", async (q) => {
      expect((await q("select * from public.products where id = $1", [DRAFT])).rowCount).toBe(0);
      expect((await q("select * from public.organization_members where organization_id = $1", [ORG_L])).rowCount).toBe(0);
      const upd = await q("update public.products set title = 'pwned' where id = $1", [DRAFT]);
      expect(upd.rowCount).toBe(0);
      expect(await sqlErrQ("insert into public.products (organization_id, brand_id, slug, title, category) values ($1, '30000000-0000-4000-8000-000000000001', 'evil-x', 'Evil', 'lipstick')", [ORG_L])).toMatch(/row-level security/);
      expect(await sqlErrQ("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'organization_owner')", [ORG_L, U.omar])).toMatch(/row-level security/);
    });
  });

  it("brand manager edits own catalog; designer in agency cannot touch catalog writes", async () => {
    await as("marco", async (q) => {
      expect((await q("update public.products set title = 'Glass Lip Gloss II' where id = $1", [DRAFT])).rowCount).toBe(1);
      expect((await q("select count(*)::int as n from public.inventories")).rows[0].n).toBe(2);
    });
    await as("dana", async (q) => {
      expect(await sqlErrQ("insert into public.brands (organization_id, name, slug) values ($1, 'x', 'x-brand')", [ORG_N])).toMatch(/row-level security/);
    });
  });

  it("client_reviewer membership grants no workspace read", async () => {
    await as("rhea", async (q) => {
      expect((await q("select * from public.products where id = $1", [DRAFT])).rowCount).toBe(0);
      expect((await q("select * from public.projects")).rowCount).toBe(0);
    });
  });

  it("shopper A cannot see shopper B's looks or orders", async () => {
    await client.query(`insert into public.looks (id, user_id, name, recipe) values ('60000000-0000-4000-8000-000000000001', $1, 'Bea look', '{"version":1,"selectedProducts":[]}')`, [U.bea]);
    await client.query(`insert into public.orders (id, user_id, status, total_minor, currency) values ('70000000-0000-4000-8000-000000000001', $1, 'created', 100, 'USD')`, [U.bea]);
    try {
      await as("ava", async (q) => {
        expect((await q("select * from public.looks")).rowCount).toBe(0);
        expect((await q("select * from public.orders")).rowCount).toBe(0);
        expect((await q("delete from public.looks")).rowCount).toBe(0);
      });
      await as("bea", async (q) => { expect((await q("select * from public.looks")).rowCount).toBe(1); });
    } finally {
      await client.query("delete from public.looks; delete from public.order_events; delete from public.orders;");
    }
  });

  it("revoked membership takes effect immediately", async () => {
    await client.query("begin");
    await client.query("update public.organization_members set status = 'revoked' where user_id = $1", [U.marco]);
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U.marco })]);
    const r = await client.query("select * from public.products where id = $1", [DRAFT]);
    await client.query("rollback");
    expect(r.rowCount).toBe(0);
  });

  it("face media cannot be stored without consent or attached to an org", async () => {
    await client.query("begin");
    const err = await sqlErrQ(`insert into public.private_assets (organization_id, owner_user_id, bucket, key, content_sha256, mime, bytes, privacy_class) values ($1, $2, 'faces', 'x.jpg', 'h', 'image/jpeg', 10, 'face_private')`, [ORG_L, U.ava]);
    await client.query("rollback");
    expect(err).toMatch(/check constraint/);
  });

  it("state machine, reservation and payment functions enforce invariants", async () => {
    await client.query("begin");
    try {
      expect(await sqlErrQ("update public.products set status = 'in_review' where id = '40000000-0000-4000-8000-000000000003' and status = 'published'")).toMatch(/INVALID_TRANSITION/);
      await client.query("rollback"); await client.query("begin");
      await client.query(`insert into public.orders (id, user_id, status, total_minor, currency) values ('70000000-0000-4000-8000-000000000002', $1, 'created', 5600, 'USD')`, [U.ava]);
      await client.query(`insert into public.order_items (order_id, organization_id, variant_id, product_title, shade_name, sku, unit_price_minor, quantity, currency) values ('70000000-0000-4000-8000-000000000002', $1, '50000000-0000-4000-8000-000000000001', 'Velvet', 'Rosewood', 'ML-VML-ROSEWOOD', 2800, 6, 'USD')`, [ORG_L]);
      expect(await sqlErrQ("select app.reserve_inventory('70000000-0000-4000-8000-000000000002')")).toMatch(/OUT_OF_STOCK/);
      await client.query("rollback"); await client.query("begin");
      await client.query(`insert into public.orders (id, user_id, status, total_minor, currency) values ('70000000-0000-4000-8000-000000000003', $1, 'created', 5600, 'USD')`, [U.ava]);
      await client.query(`insert into public.order_items (order_id, organization_id, variant_id, product_title, shade_name, sku, unit_price_minor, quantity, currency) values ('70000000-0000-4000-8000-000000000003', $1, '50000000-0000-4000-8000-000000000001', 'Velvet', 'Rosewood', 'ML-VML-ROSEWOOD', 2800, 2, 'USD')`, [ORG_L]);
      await client.query("select app.reserve_inventory('70000000-0000-4000-8000-000000000003')");
      await client.query("update public.orders set status = 'pending_payment' where id = '70000000-0000-4000-8000-000000000003'");
      expect((await client.query("select app.apply_payment('evt_1', 'checkout.completed', '70000000-0000-4000-8000-000000000003') as r")).rows[0].r).toBe("processed");
      expect((await client.query("select app.apply_payment('evt_1', 'checkout.completed', '70000000-0000-4000-8000-000000000003') as r")).rows[0].r).toBe("duplicate");
      const inv = (await client.query("select on_hand, reserved from public.inventories where variant_id = '50000000-0000-4000-8000-000000000001'")).rows[0];
      expect(inv).toEqual({ on_hand: 3, reserved: 0 });
      expect(await sqlErrQ("update public.order_items set unit_price_minor = 1 where order_id = '70000000-0000-4000-8000-000000000003'")).toMatch(/append-only/);
      expect(await sqlErrQ("update public.orders set status = 'created' where id = '70000000-0000-4000-8000-000000000003'")).toMatch(/INVALID_TRANSITION/);
    } finally {
      await client.query("rollback");
    }
  });

  it("render queue claim is exclusive and checks tenant provenance; review tokens are scoped", async () => {
    await client.query("begin");
    try {
      await client.query(`insert into public.projects (id, organization_id, name, created_by) values ('80000000-0000-4000-8000-000000000001', $1, 'P', $2)`, [ORG_L, U.lena]);
      await client.query(`insert into public.motion_compositions (id, organization_id, project_id, title, created_by) values ('90000000-0000-4000-8000-000000000001', $1, '80000000-0000-4000-8000-000000000001', 'C', $2)`, [ORG_L, U.lena]);
      await client.query(`insert into public.scene_versions (composition_id, organization_id, revision, doc, created_by) values ('90000000-0000-4000-8000-000000000001', $1, 1, '{"schemaVersion":1}', $2)`, [ORG_L, U.lena]);
      await client.query(`insert into public.render_jobs (organization_id, composition_id, revision, idempotency_key, created_by) values ($1, '90000000-0000-4000-8000-000000000001', 1, 'k-00000001', $2)`, [ORG_L, U.lena]);
      expect(await sqlErrQ(`insert into public.render_jobs (organization_id, composition_id, revision, idempotency_key, created_by) values ($1, '90000000-0000-4000-8000-000000000001', 1, 'k-00000002', $2)`, [ORG_N, U.omar])).toMatch(/foreign key/);
      expect((await client.query("select count(*)::int n from public.job_outbox where topic = 'render.queued.v1'")).rows[0].n).toBe(1);
      expect((await client.query("select * from app.claim_render_job('w1')")).rowCount).toBe(1);
      expect((await client.query("select * from app.claim_render_job('w2')")).rowCount).toBe(0);
      await client.query(`insert into public.review_sessions (organization_id, project_id, composition_id, revision, token_hash, reviewer_name, expires_at, created_by) values ($1, '80000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', 1, encode(extensions.digest('tok-abcdefghijklmnopqrstuvwxyz', 'sha256'), 'hex'), 'Client', now() + interval '1 day', $2)`, [ORG_L, U.lena]);
      await client.query("set local role anon");
      expect((await client.query("select * from app.review_by_token('tok-abcdefghijklmnopqrstuvwxyz')")).rowCount).toBe(1);
      expect((await client.query("select * from app.review_by_token('wrong-token-wrong-token')")).rowCount).toBe(0);
      expect((await client.query("select * from public.review_sessions")).rowCount).toBe(0);
      expect((await client.query("select * from public.projects")).rowCount).toBe(0);
    } finally {
      await client.query("rollback");
    }
  });
});

describe.skipIf(!url)("0004 apparel migration", () => {
  beforeAll(async () => { client = new pg.Client({ connectionString: url }); await client.connect(); });
  afterAll(async () => { await client?.end(); });
  it("accepts apparel categories, sizes and the cloud consent scope; rejects junk sizes", async () => {
    await client.query("begin");
    try {
      await client.query(`insert into public.products (id, organization_id, brand_id, slug, title, category, description) values ('40000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'shell-top-x', 'Shell Top', 'top', 'x')`);
      await client.query(`insert into public.product_variants (organization_id, product_id, sku, shade_name, hex, finish, price_minor, currency, size_label) values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-0000000000aa', 'LA-ST-IVR-M', 'Ivory', '#EDE6DA', 'satin', 7800, 'USD', 'M')`);
      expect(await sqlErrQ(`insert into public.product_variants (organization_id, product_id, sku, shade_name, hex, finish, price_minor, currency, size_label) values ('10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-0000000000aa', 'LA-ST-IVR-Z', 'Ivory', '#EDE6DA', 'satin', 7800, 'USD', '<script>')`)).toMatch(/check constraint/);
      await client.query(`insert into public.photo_consents (user_id, policy_version, scope, granted) values ('00000000-0000-4000-8000-0000000000a1', 'v1', 'cloud_generation', true)`);
    } finally { await client.query("rollback"); }
  });

  describe("runway looks (0005)", () => {
    const LOOK_PUB = "60000000-0000-4000-8000-0000000000e1", LOOK_DRAFT = "60000000-0000-4000-8000-0000000000e2";
    /** Fixtures inserted as the table owner inside the test transaction, then the role is dropped. */
    async function withLooks<T>(user: keyof typeof U | "anon", fn: (q: (sql: string, params?: unknown[]) => Promise<pg.QueryResult>) => Promise<T>) {
      await client.query("begin");
      try {
        const pub = (await client.query("select id from public.products where slug = 'velvet-matte-lipstick'")).rows[0].id;
        await client.query(`insert into public.runway_looks (id, organization_id, name, status, image, created_by) values
          ($1, $3, 'Public look', 'published', '{"kind":"reference","file":"model-1-640.webp"}', $4),
          ($2, $3, 'Draft look', 'draft', null, $4)`, [LOOK_PUB, LOOK_DRAFT, ORG_L, U.lena]);
        await client.query(`insert into public.runway_look_pins (look_id, organization_id, product_id, position, pin_left, pin_top) values
          ($1, $3, $4, 1, 50, 20), ($1, $3, $5, 2, 50, 60), ($2, $3, $4, 1, 40, 40)`, [LOOK_PUB, LOOK_DRAFT, ORG_L, pub, DRAFT]);
        if (user === "anon") await client.query("set local role anon");
        else {
          await client.query("set local role authenticated");
          await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: U[user], role: "authenticated" })]);
        }
        return await fn((sql, params) => client.query(sql, params as unknown[]));
      } finally { await client.query("rollback"); }
    }

    it("anonymous shoppers see published looks and only pins to published products", async () => {
      await withLooks("anon", async (q) => {
        expect((await q("select name from public.runway_looks")).rows.map((r) => r.name)).toEqual(["Public look"]);
        const pins = (await q("select product_id from public.runway_look_pins")).rows;
        expect(pins.length).toBe(1);
        expect(pins.some((r) => r.product_id === DRAFT)).toBe(false);
        expect(await sqlErrQ("insert into public.runway_looks (organization_id, name, created_by) values ($1, 'x', $2)", [ORG_L, U.ava])).toMatch(/permission denied|row-level security/);
      });
    });

    it("other tenants cannot read drafts, edit, publish, or pin into a foreign look", async () => {
      await withLooks("omar", async (q) => {
        expect((await q("select id from public.runway_looks where id = $1", [LOOK_DRAFT])).rowCount).toBe(0);
        expect((await q("update public.runway_looks set name = 'pwned' where id = $1", [LOOK_PUB])).rowCount).toBe(0);
        expect((await q("delete from public.runway_looks where id = $1", [LOOK_PUB])).rowCount).toBe(0);
        expect(await sqlErrQ("insert into public.runway_look_pins (look_id, organization_id, product_id, position, pin_left, pin_top) values ($1, $2, $3, 3, 1, 1)", [LOOK_PUB, ORG_L, DRAFT])).toMatch(/row-level security/);
        expect(await sqlErrQ("insert into public.runway_looks (organization_id, name, created_by) values ($1, 'x', $2)", [ORG_L, U.omar])).toMatch(/row-level security/);
      });
    });

    it("brand manager manages own looks; agency designer cannot; inserts start as drafts", async () => {
      await withLooks("marco", async (q) => {
        expect((await q("select id from public.runway_looks order by name")).rowCount).toBe(2);
        expect((await q("update public.runway_looks set name = 'Edited' where id = $1", [LOOK_DRAFT])).rowCount).toBe(1);
        expect(await sqlErrQ("insert into public.runway_looks (organization_id, name, status, image, created_by) values ($1, 'x', 'published', '{\"kind\":\"reference\",\"file\":\"a.webp\"}', $2)", [ORG_L, U.marco])).toMatch(/row-level security/);
        expect(await sqlErrQ("update public.runway_looks set image = '{\"kind\":\"url\",\"href\":\"https://evil.example/x.png\"}' where id = $1", [LOOK_DRAFT])).toMatch(/check constraint/);
      });
      await withLooks("dana", async (q) => {
        expect(await sqlErrQ("insert into public.runway_looks (organization_id, name, created_by) values ($1, 'x', $2)", [ORG_N, U.dana])).toMatch(/row-level security/);
      });
    });

    it("a pin cannot reference another organization's product", async () => {
      await withLooks("lena", async (q) => {
        const other = (await q("select id from public.products where slug = 'petal-tint'")).rows[0].id;
        expect(await sqlErrQ("insert into public.runway_look_pins (look_id, organization_id, product_id, position, pin_left, pin_top) values ($1, $2, $3, 3, 1, 1)", [LOOK_PUB, ORG_L, other])).toMatch(/foreign key/);
      });
    });
  });
});
