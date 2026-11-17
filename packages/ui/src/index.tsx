import type { ReactNode } from "react";

export const TOKENS = {
  background: "#101016", surface: "#191922", ink: "#FAF7F3", blush: "#E6A7B0", copper: "#BE8D70", lavender: "#9C86EA", border: "#34303A", success: "#4B9B79",
} as const;

export function ShadeSwatch({ hex, name, selected, disabled, onSelect, size = 36 }: { hex: string; name: string; selected?: boolean; disabled?: boolean; onSelect?: () => void; size?: number }) {
  return (
    <button type="button" className="gm-swatch" aria-pressed={selected} aria-label={`${name}${disabled ? " (out of stock)" : ""}`} title={name} disabled={disabled} onClick={onSelect}
      style={{ width: size, height: size, background: hex }} data-selected={selected ? "true" : undefined} />
  );
}

export function StatusChip({ status }: { status: string }) {
  const tone = /completed|approved|published|paid|allow|delivered/.test(status) ? "ok" : /failed|rejected|cancelled|block|needs_review/.test(status) ? "bad" : /awaiting|pending|review|running|queued/.test(status) ? "warn" : "neutral";
  return <span className={`gm-chip gm-chip-${tone}`}>{status.replace(/_/g, " ")}</span>;
}

export function KpiCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="gm-card gm-kpi">
      <div className="gm-kpi-label">{label}</div>
      <div className="gm-kpi-value">{value}</div>
      {hint && <div className="gm-muted gm-small">{hint}</div>}
    </div>
  );
}

export function Disclaimer({ children }: { children?: ReactNode }) {
  return (
    <p className="gm-disclaimer" role="note">
      {children ?? "Virtual try-on is a simulated, illustrative preview. Lighting, cameras and screens change how colour looks — the real shade may vary."}
    </p>
  );
}
