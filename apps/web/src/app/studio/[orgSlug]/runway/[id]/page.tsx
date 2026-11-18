import { notFound } from "next/navigation";
import { getOrgRunwayLook, isAppError, listOrgProducts } from "@glamotion/core";
import { studio } from "@/server/studio";
import { RunwayLookEditor } from "@/components/studio/RunwayLookEditor";

export const dynamic = "force-dynamic";

export default async function RunwayLookPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org, can } = await studio(orgSlug);
  let look;
  try { look = getOrgRunwayLook(c, org.id, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  const products = listOrgProducts(c, org.id).filter((p) => p.status !== "archived").map((p) => ({ id: p.id, title: p.title, status: p.status, imageUrl: p.imageUrl }));
  return <RunwayLookEditor look={look} orgId={org.id} orgSlug={org.slug} products={products} canWrite={can("catalog.write")} canPublish={can("catalog.publish")} />;
}
