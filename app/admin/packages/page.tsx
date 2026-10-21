import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GrantPackageForm } from "@/features/packages/grant-package-form";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/time";
import { listRecentPackages } from "@/services/package.service";

export const metadata: Metadata = { title: "Packages" };

export default async function AdminPackagesPage() {
  await requireRole("admin");
  const packages = await listRecentPackages();

  return (
    <>
      <PageHeader
        title="Packages"
        description="Grant session credits to customers. A credit is used when one of their sessions completes."
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Packages" }]}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Grant a package</CardTitle>
            <CardDescription>Credits are tracked separately from per-session payments in this version.</CardDescription>
          </CardHeader>
          <CardContent>
            <GrantPackageForm />
          </CardContent>
        </Card>
        <section aria-labelledby="recent" className="space-y-3">
          <h2 id="recent" className="text-sm font-medium text-muted-foreground">
            Recent packages
          </h2>
          {packages.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">No packages yet.</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {packages.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.customer.email} · {formatDate(item.createdAt)} · {item.source === "seed" ? "Demo seed" : "Granted by admin"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">
                      {item.usedSessions}/{item.totalSessions} used
                    </span>
                    <Badge variant={item.status === "active" ? "brand" : "secondary"} className="capitalize">
                      {item.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
