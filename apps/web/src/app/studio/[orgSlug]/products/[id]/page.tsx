import { notFound } from "next/navigation";
import { getOrgProduct, isAppError } from "@glamotion/core";
import { studio } from "@/server/studio";
import { ProductEditor } from "@/components/studio/ProductEditor";

export const dynamic = "force-dynamic";

export default async function ProductDetail({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org, can } = await studio(orgSlug);
  let product;
  try { product = getOrgProduct(c, org.id, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  const projects = [...c.store.projects.values()].filter((p) => p.organizationId === org.id).map((p) => ({ id: p.id, name: p.name }));
  return <ProductEditor product={product} orgId={org.id} orgSlug={org.slug} canWrite={can("catalog.write")} canPublish={can("catalog.publish")} canCreate={can("creative.write")} projects={projects} />;
}
