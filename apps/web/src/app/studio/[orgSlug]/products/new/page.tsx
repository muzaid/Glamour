import { notFound } from "next/navigation";
import { studio } from "@/server/studio";
import { NewProductForm } from "@/components/studio/NewProductForm";

export default async function NewProduct({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { c, org, can } = await studio(orgSlug);
  if (!can("catalog.write")) notFound();
  const brands = [...c.store.brands.values()].filter((b) => b.organizationId === org.id).map((b) => ({ id: b.id, name: b.name }));
  return <div className="gm-stack"><h1>New product</h1><NewProductForm orgId={org.id} orgSlug={org.slug} brands={brands} /></div>;
}
