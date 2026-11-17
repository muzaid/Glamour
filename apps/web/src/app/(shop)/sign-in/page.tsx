import { DEMO_USERS } from "@glamotion/core";

export const metadata = { title: "Sign in" };
const GROUPS: [string, (keyof typeof DEMO_USERS)[]][] = [
  ["Shoppers", ["ava", "bea"]],
  ["Maison Lumière (brand)", ["lena", "marco"]],
  ["Atelier Nova (agency)", ["omar", "dana"]],
  ["Platform", ["ops"]],
];

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return (
    <div className="gm-container gm-section" style={{ maxWidth: 720 }}>
      <h1>Choose a demo identity</h1>
      <p className="gm-muted">This demo uses fictional accounts with no passwords so you can explore each role. Production uses Supabase Auth with server-verified sessions.</p>
      <form method="post" action="/api/demo/session" className="gm-stack">
        <input type="hidden" name="next" value={next} />
        {GROUPS.map(([label, keys]) => (
          <fieldset key={label} className="gm-card gm-card-tight" style={{ border: "1px solid var(--gm-border)" }}>
            <legend className="gm-eyebrow">{label}</legend>
            <div className="gm-row">
              {keys.map((k) => <button key={k} name="user" value={k} className="gm-btn gm-btn-ghost" data-testid={`signin-${k}`}>{DEMO_USERS[k].displayName}</button>)}
            </div>
          </fieldset>
        ))}
        <button name="user" value="signout" className="gm-btn gm-btn-danger gm-btn-sm">Sign out</button>
      </form>
    </div>
  );
}
