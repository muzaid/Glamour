import { notFound } from "next/navigation";
import { getComposition, isAppError } from "@glamotion/core";
import { studio } from "@/server/studio";
import { MotionEditor } from "@/components/studio/MotionEditor";

export const dynamic = "force-dynamic";

export default async function MotionPage({ params }: { params: Promise<{ orgSlug: string; id: string }> }) {
  const { orgSlug, id } = await params;
  const { c, org, can } = await studio(orgSlug);
  let data;
  try { data = getComposition(c, org.id, id); } catch (e) { if (isAppError(e)) notFound(); throw e; }
  return <MotionEditor orgId={org.id} compositionId={id} initialDoc={data.doc} initialRevision={data.revision} projectId={data.composition.projectId} canRender={can("render.create")} canReview={can("review.request")} />;
}
