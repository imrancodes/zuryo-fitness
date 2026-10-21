import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { PricingForm } from "@/features/pricing/pricing-form";
import { requireRole } from "@/lib/auth";
import { getPricingRule } from "@/services/pricing.service";

export const metadata: Metadata = { title: "Pricing" };

export default async function PricingPage() {
  await requireRole("admin");
  const rule = await getPricingRule();

  return (
    <>
      <PageHeader
        title="Pricing"
        description="Set session prices, the society commission and the peak hours used at checkout."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Pricing" }]}
      />
      <PricingForm rule={rule} />
    </>
  );
}
