import { notFound } from "next/navigation";
import { getOrgDrop, isAppError } from "@glamotion/core";
import { studio } from "@/server/studio";
import { DropEditor } from "@/components/studio/DropEditor";

export const dynamic = "force-dynamic";

export default async function DropPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org, can } = await studio(orgSlug);
  let drop;
  try { drop = getOrgDrop(c, org.id, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  return <DropEditor drop={drop} orgId={org.id} orgSlug={org.slug} canWrite={can("catalog.write")} canPublish={can("catalog.publish")} />;
}
