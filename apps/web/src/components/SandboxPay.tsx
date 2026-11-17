"use client";
import { useState } from "react";
import { apiFetch } from "./client";

export function SandboxPay({ session, orderId }: { session: string; orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go(outcome: "success" | "cancel") {
    setBusy(true);
    const r = await apiFetch("/api/v1/sandbox/pay", { method: "POST", body: { session, outcome } });
    if (!r.ok) { setErr(r.error.message); setBusy(false); return; }
    window.location.assign(`/orders/${orderId}`);
  }
  return (
    <div className="gm-row">
      <button className="gm-btn" disabled={busy} onClick={() => go("success")} data-testid="sandbox-pay">Pay (sandbox)</button>
      <button className="gm-btn gm-btn-ghost" disabled={busy} onClick={() => go("cancel")}>Cancel payment</button>
      {err && <div className="gm-alert gm-alert-error" role="alert">{err}</div>}
    </div>
  );
}
