import { notFound } from "next/navigation";
import { sandboxSession, DEMO_MODE } from "@/server/runtime";
import { formatMoney } from "@glamotion/core";
import { SandboxPay } from "@/components/SandboxPay";

export const metadata = { title: "Sandbox payment" };

/** Simulated hosted payment page (stands in for the processor's checkout). */
export default async function SandboxCheckout({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  const s = session ? await sandboxSession(session) : null;
  if (!DEMO_MODE || !s || !session) notFound();
  return (
    <div className="gm-container gm-section" style={{ maxWidth: 560 }}>
      <div className="gm-card gm-stack">
        <div className="gm-eyebrow">Sandbox payment processor</div>
        <h1>Pay {formatMoney(s.amountMinor, s.currency)}</h1>
        <p className="gm-muted">No real card is used. Choosing an option sends a signed webhook to GLAMOTION, which is the only thing that can mark your order paid.</p>
        <SandboxPay session={session} orderId={s.orderId} />
      </div>
    </div>
  );
}
