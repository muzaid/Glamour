"use client";
import { useState } from "react";
import { apiFetch } from "./client";

export function PrivacyControls() {
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  async function exportData() {
    const r = await apiFetch<unknown>("/api/v1/privacy/export");
    if (!r.ok) return setMsg(r.error.message);
    const url = URL.createObjectURL(new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "glamotion-export.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function del() {
    const r = await apiFetch<{ looksDeleted: number; mediaDeleted: number }>("/api/v1/privacy/delete", { method: "POST", body: { confirm: true } });
    setConfirm(false);
    setMsg(r.ok ? `Deleted ${r.data.looksDeleted} saved looks and ${r.data.mediaDeleted} stored photos. Order records are kept for the legally required period.` : r.error.message);
  }
  return (
    <div className="gm-stack">
      <div className="gm-row">
        <button className="gm-btn gm-btn-ghost" onClick={exportData}>Export my data</button>
        {!confirm ? <button className="gm-btn gm-btn-danger" onClick={() => setConfirm(true)} data-testid="delete-data">Delete my looks & photos</button> : (
          <span className="gm-row"><span>Are you sure? This cannot be undone.</span><button className="gm-btn gm-btn-danger" onClick={del} data-testid="confirm-delete">Yes, delete</button><button className="gm-btn gm-btn-ghost" onClick={() => setConfirm(false)}>Cancel</button></span>
        )}
      </div>
      {msg && <div className="gm-alert" role="status">{msg}</div>}
    </div>
  );
}
