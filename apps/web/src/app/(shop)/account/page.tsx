import { redirect } from "next/navigation";
import { ctx } from "@/server/runtime";
import { PrivacyControls } from "@/components/PrivacyControls";

export const metadata = { title: "Account & privacy" };
export const dynamic = "force-dynamic";

export default async function Account() {
  const c = await ctx();
  if (!c.actor) redirect("/sign-in?next=/account");
  const p = c.store.profiles.get(c.actor.userId)!;
  const consents = c.store.photoConsents.filter((x) => x.userId === p.id).slice(-5).reverse();
  return (
    <div className="gm-container gm-section gm-stack" style={{ maxWidth: 820 }}>
      <h1>Account & privacy</h1>
      <div className="gm-card"><strong>{p.displayName}</strong><div className="gm-muted">{p.email}</div></div>
      <div className="gm-card gm-stack">
        <h2>Your face data</h2>
        <ul>
          <li>Camera frames and uploaded photos are processed <strong>on your device</strong> and are never uploaded in this version.</li>
          <li>Saved looks store only shade choices and slider settings — never an image, landmarks or skin colour.</li>
          <li>We don&apos;t use face recognition, identity matching or train models on your photos.</li>
          <li>Support staff cannot access face media.</li>
        </ul>
        <h3>Consent history</h3>
        {consents.length === 0 ? <p className="gm-muted">No consents recorded.</p> : <ul>{consents.map((x) => <li key={x.id}>{x.scope.replace("_", " ")} — {x.granted ? "granted" : "revoked"} (policy {x.policyVersion}) · {new Date(x.createdAt).toLocaleString()}</li>)}</ul>}
        <PrivacyControls />
        <p className="gm-muted gm-small">Deletion removes data from active storage immediately. Encrypted backups roll off within the documented backup window (see privacy policy); deleted data is not restored to active systems.</p>
      </div>
    </div>
  );
}
