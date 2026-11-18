import { describe, expect, it } from "vitest";
import { seedDemo, StateSync, canonical, createRunwayLook, getOrgRunwayLook, deleteRunwayLook, addCartItem, getCart, DEMO_USERS, DEMO_ORGS, DEFAULT_CONFIG, type Ctx, type StateRemote, type StateRow, MemoryStore } from "./index";

/** In-memory stand-in for the glamotion.state table: latest row per key, monotonically increasing rev. */
class FakeRemote implements StateRemote {
  rows = new Map<string, StateRow & { r: number }>();
  rev = 0; pushes = 0;
  async pull(since: number) {
    // Mimic jsonb: key order is not preserved.
    const out = [...this.rows.values()].filter((r) => r.r > since).sort((a, b) => a.r - b.r)
      .map((r) => ({ ...r, d: r.d == null ? r.d : JSON.parse(canonical(r.d)) }));
    return { rev: this.rev, rows: out };
  }
  async push(rows: StateRow[]) {
    this.pushes++;
    for (const row of rows) this.rows.set(`${row.c}/${row.k}`, { ...row, d: row.x ? null : row.d, r: ++this.rev });
    return this.rev;
  }
}
const ctxFor = (store: MemoryStore, u: keyof typeof DEMO_USERS): Ctx => ({ store, actor: { userId: DEMO_USERS[u].id }, requestId: "t", config: { ...DEFAULT_CONFIG } });

describe("state sync across instances", () => {
  it("a look created on instance A is visible on instance B, and deletes propagate", async () => {
    const remote = new FakeRemote();
    const a = seedDemo(new MemoryStore()), b = seedDemo(new MemoryStore());
    const sa = new StateSync(a, remote), sb = new StateSync(b, remote);
    await sa.pull(); expect(await sa.flush()).toBeGreaterThan(50); // first instance publishes the seed
    await sb.pull(); expect(await sb.flush()).toBe(0); // identical seed: nothing to push, key order ignored
    await sa.pull();
    const look = createRunwayLook(ctxFor(a, "marco"), DEMO_ORGS.lumiere.id, { name: "Weekend Edit" });
    expect(await sa.flush()).toBeGreaterThan(0);
    await sb.pull();
    expect(getOrgRunwayLook(ctxFor(b, "marco"), DEMO_ORGS.lumiere.id, look.id).name).toBe("Weekend Edit");
    await deleteRunwayLook(ctxFor(b, "marco"), DEMO_ORGS.lumiere.id, look.id);
    await sb.flush(); await sa.pull();
    expect(a.runwayLooks.has(look.id)).toBe(false);
  });

  it("a pull never clobbers an in-flight local change and keeps object references live", async () => {
    const remote = new FakeRemote();
    const a = seedDemo(new MemoryStore()), b = seedDemo(new MemoryStore());
    const sa = new StateSync(a, remote), sb = new StateSync(b, remote);
    await sa.pull(); await sa.flush(); await sb.pull();
    const look = createRunwayLook(ctxFor(a, "marco"), DEMO_ORGS.lumiere.id, { name: "Race" });
    await sa.flush(); await sb.pull();
    const held = b.runwayLooks.get(look.id)!;      // e.g. an upload handler holding the row across an await
    a.runwayLooks.get(look.id)!.description = "edited on A";
    await sa.flush();
    held.name = "Race (B)";                          // B mutates before its next pull
    await sb.pull();                                  // must not replace or overwrite B's dirty object
    expect(b.runwayLooks.get(look.id)).toBe(held);
    expect(held.name).toBe("Race (B)");
    await sb.flush(); await sa.pull();
    expect(a.runwayLooks.get(look.id)!.name).toBe("Race (B)"); // last writer wins per entity
    // A clean entity is refreshed in place (same object reference).
    const ref = b.brands.get("30000000-0000-4000-8000-000000000001")!;
    a.brands.get("30000000-0000-4000-8000-000000000001")!.name = "Maison Lumière II";
    await sa.flush(); await sb.pull();
    expect(b.brands.get("30000000-0000-4000-8000-000000000001")).toBe(ref);
    expect(ref.name).toBe("Maison Lumière II");
  });

  it("carts follow the shopper between instances; unchanged requests push nothing", async () => {
    const remote = new FakeRemote();
    const a = seedDemo(new MemoryStore()), b = seedDemo(new MemoryStore());
    const sa = new StateSync(a, remote), sb = new StateSync(b, remote);
    await sa.pull(); await sa.flush(); await sb.pull();
    const v = [...a.variants.values()].find((x) => x.sku === "ML-VML-ROSEWOOD")!;
    addCartItem(ctxFor(a, "ava"), { productVariantId: v.id, quantity: 2 });
    await sa.flush(); await sb.pull();
    expect(getCart(ctxFor(b, "ava")).lines.map((l) => [l.sku, l.quantity])).toEqual([["ML-VML-ROSEWOOD", 2]]);
    const before = remote.pushes;
    getCart(ctxFor(b, "ava"));
    expect(await sb.flush()).toBe(0);
    expect(remote.pushes).toBe(before);
  });
});
