import Link from "next/link";
import { getReview, isAppError } from "@glamotion/core";
import { ctx } from "@/server/runtime";
import { ReviewRoom } from "@/components/ReviewRoom";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client review", robots: { index: false } };

export default async function Review({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await ctx();
  let data;
  try { data = getReview(c, token); } catch (e) {
    if (!isAppError(e)) throw e;
    return <main id="main" className="gm-container gm-section"><h1>This review link is invalid or has expired</h1><p>Ask your agency contact for a new link.</p><Link href="/">GLAMOTION</Link></main>;
  }
  return (
    <div className="gm-studio gm-studio-shell">
      <main id="main" className="gm-container" style={{ maxWidth: 1300, paddingTop: 24 }}>
        <ReviewRoom token={token} initial={JSON.parse(JSON.stringify(data))} />
      </main>
    </div>
  );
}
