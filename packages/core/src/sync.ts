import type { MemoryStore } from "./store";

/**
 * Durable, shared state for multi-instance deployments (ADR-015). The
 * MemoryStore stays the source the domain code works on; this module turns it
 * into rows keyed by (collection, key), diffs against what the remote store
 * last confirmed, and applies remote changes. Last writer wins per entity.
 */
export interface StateRow { c: string; k: string; d: unknown; x?: boolean }
export interface StateRemote {
  pull(since: number): Promise<{ rev: number; rows: (StateRow & { r: number })[] }>;
  push(rows: StateRow[]): Promise<number>;
}

type Collection = { name: string; kind: "map"; value: Map<string, unknown> } | { name: string; kind: "array"; value: unknown[] };

/** Every Map / Array field of the store is a collection (new collections are picked up automatically). */
function collections(store: MemoryStore): Collection[] {
  const out: Collection[] = [];
  for (const [name, value] of Object.entries(store)) {
    if (value instanceof Map) out.push({ name, kind: "map", value: value as Map<string, unknown> });
    else if (Array.isArray(value)) out.push({ name, kind: "array", value });
  }
  return out;
}

/** Stable key for an array element (ids, or composite keys for id-less rows). */
export function arrayKey(item: unknown): string {
  const o = item as Record<string, unknown>;
  if (typeof o.id === "string") return o.id;
  if (typeof o.compositionId === "string" && typeof o.revision === "number") return `${o.compositionId}:${o.revision}`;
  return JSON.stringify(o).slice(0, 300);
}

const rowId = (c: string, k: string) => `${c}\u0000${k}`;

/** JSON with sorted object keys: Postgres jsonb re-orders keys, so comparisons must not depend on order. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? "null" : canonical(x))).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}

export function snapshot(store: MemoryStore): Map<string, string> {
  const snap = new Map<string, string>();
  for (const col of collections(store)) {
    if (col.kind === "map") for (const [k, v] of col.value) snap.set(rowId(col.name, k), canonical(v));
    else for (const v of col.value) snap.set(rowId(col.name, arrayKey(v)), canonical(v));
  }
  return snap;
}

/** Replace an object's contents in place so code holding a reference keeps seeing the live entity. */
function assignInPlace(target: unknown, source: unknown): boolean {
  if (!target || !source || typeof target !== "object" || typeof source !== "object" || Array.isArray(target) !== Array.isArray(source)) return false;
  const t = target as Record<string, unknown>, s = source as Record<string, unknown>;
  for (const k of Object.keys(t)) if (!(k in s)) delete t[k];
  Object.assign(t, s);
  return true;
}

export function applyRows(store: MemoryStore, rows: StateRow[], skip?: (c: string, k: string) => boolean) {
  const byName = new Map(collections(store).map((c) => [c.name, c]));
  const touchedArrays = new Set<Collection>();
  for (const row of rows) {
    const col = byName.get(row.c);
    if (!col || skip?.(row.c, row.k)) continue; // unknown collection, or a locally-dirty entity (local wins, pushed next)
    if (col.kind === "map") {
      if (row.x) col.value.delete(row.k);
      else if (!assignInPlace(col.value.get(row.k), row.d)) col.value.set(row.k, row.d);
    } else {
      const i = col.value.findIndex((v) => arrayKey(v) === row.k);
      if (row.x) { if (i >= 0) col.value.splice(i, 1); }
      else if (i >= 0) { if (!assignInPlace(col.value[i], row.d)) col.value[i] = row.d; }
      else col.value.push(row.d);
      touchedArrays.add(col);
    }
  }
  // Keep append-only logs chronological after merging rows from other instances.
  for (const col of touchedArrays) {
    if (col.kind !== "array") continue;
    col.value.sort((a, b) => String((a as { createdAt?: string }).createdAt ?? "").localeCompare(String((b as { createdAt?: string }).createdAt ?? "")));
  }
}

/** Canonical JSON of one local entity, or undefined if it does not exist. */
function localCanonical(store: MemoryStore, c: string, k: string): string | undefined {
  const col = collections(store).find((x) => x.name === c);
  if (!col) return undefined;
  const v = col.kind === "map" ? col.value.get(k) : col.value.find((x) => arrayKey(x) === k);
  return v === undefined ? undefined : canonical(v);
}

/** Rows that differ from the baseline (changed, new, or deleted locally). */
export function diff(store: MemoryStore, baseline: Map<string, string>): { rows: StateRow[]; snap: Map<string, string> } {
  const snap = snapshot(store);
  const rows: StateRow[] = [];
  for (const [id, json] of snap) {
    if (baseline.get(id) === json) continue;
    const [c, k] = id.split("\u0000") as [string, string];
    rows.push({ c, k, d: JSON.parse(json) });
  }
  for (const id of baseline.keys()) {
    if (snap.has(id)) continue;
    const [c, k] = id.split("\u0000") as [string, string];
    rows.push({ c, k, d: null, x: true });
  }
  return { rows, snap };
}

/**
 * Keeps one MemoryStore in step with a remote. Call pull() before handling a
 * request and flush() after any mutation. Both are serialised per instance.
 */
export class StateSync {
  private baseline = new Map<string, string>();
  private rev = 0;
  private chain: Promise<unknown> = Promise.resolve();
  private started = false;
  constructor(private readonly store: MemoryStore, private readonly remote: StateRemote, private readonly overlap = 200) {}

  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  pull(): Promise<void> {
    return this.serial(async () => {
      const since = this.started ? Math.max(0, this.rev - this.overlap) : 0;
      const res = await this.remote.pull(since);
      if (!this.started) {
        // Baseline = exactly what the remote holds, so entities that exist only
        // locally (a fresh seed, or seed rows added by a newer release) are pushed.
        this.baseline = new Map();
        this.started = true;
      }
      // An entity changed locally since the last confirmed state (another in-flight request on this
      // instance) keeps its local value; its baseline still moves to the remote, so flush() pushes it.
      const dirty = (c: string, k: string) => {
        const base = this.baseline.get(rowId(c, k));
        return base !== undefined && localCanonical(this.store, c, k) !== base;
      };
      applyRows(this.store, res.rows, dirty);
      for (const r of res.rows) {
        if (r.x) this.baseline.delete(rowId(r.c, r.k)); else this.baseline.set(rowId(r.c, r.k), canonical(r.d));
      }
      this.rev = Math.max(this.rev, res.rev);
    });
  }

  flush(): Promise<number> {
    return this.serial(async () => {
      if (!this.started) return 0;
      const { rows, snap } = diff(this.store, this.baseline);
      if (rows.length === 0) return 0;
      for (let i = 0; i < rows.length; i += 2000) await this.remote.push(rows.slice(i, i + 2000));
      for (const r of rows) {
        const id = rowId(r.c, r.k);
        if (r.x) this.baseline.delete(id); else this.baseline.set(id, snap.get(id)!);
      }
      return rows.length;
    });
  }
}
