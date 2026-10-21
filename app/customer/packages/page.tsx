import { Package } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageSummary } from "@/features/packages/package-summary";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/time";
import { getPackageSummary, listPackages } from "@/services/package.service";

export const metadata: Metadata = { title: "My packages" };

const STATUS_VARIANT = { active: "brand", exhausted: "secondary", expired: "outline", cancelled: "destructive" } as const;

export default async function PackagesPage() {
  const user = await requireRole("customer");
  const [summary, { packages, deductions }] = await Promise.all([getPackageSummary(user.id), listPackages(user.id)]);

  return (
    <>
      <PageHeader
        title="My packages"
        description="Session credits on your account. A credit is used only when a session is completed."
        breadcrumbs={[{ label: "Customer", href: "/customer" }, { label: "My packages" }]}
      />
      <Card>
        <CardHeader>
          <CardTitle>Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <PackageSummary summary={summary} />
        </CardContent>
      </Card>

      {packages.length === 0 ? (
        <EmptyState icon={Package} title="No packages yet" description="Buying packages isn't available in the app yet. The Zuryo team can add credits to your account." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="packages" className="space-y-3">
            <h2 id="packages" className="text-sm font-medium text-muted-foreground">
              Packages
            </h2>
            <ul className="space-y-3">
              {packages.map((item) => (
                <li key={item.id}>
                  <Card size="sm">
                    <CardHeader className="flex items-center justify-between">
                      <div>
                        <CardTitle>{item.totalSessions}-session package</CardTitle>
                        <CardDescription>Added {formatDate(item.createdAt)}</CardDescription>
                      </div>
                      <Badge variant={STATUS_VARIANT[item.status]} className="capitalize">
                        {item.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {item.usedSessions} used · {item.remainingSessions} remaining
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="ledger" className="space-y-3">
            <h2 id="ledger" className="text-sm font-medium text-muted-foreground">
              Recent deductions
            </h2>
            {deductions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions have been deducted yet.</p>
            ) : (
              <ul className="divide-y rounded-xl border bg-card text-sm">
                {deductions.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span>Session on {entry.sessionDate ? formatDate(entry.sessionDate) : formatDate(entry.createdAt)}</span>
                    <span className="text-muted-foreground">{entry.outcome === "deducted" ? "1 credit used" : "No credit available"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
