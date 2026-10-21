import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DemoRoleCards } from "@/features/auth/demo-role-cards";
import { isDemoEnabled } from "@/lib/demo";

export const metadata: Metadata = { title: "Demo access" };

export default function DemoPage() {
  if (!isDemoEnabled()) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Brand href="/login" />
          <Badge variant="outline">Development only</Badge>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
        <PageHeader
          title="Choose a demo role"
          description="Each card signs you in as a seeded demo account. Access is still checked by the server for every page and API."
          actions={
            <Button variant="ghost" nativeButton={false} render={<Link href="/login" />}>
              <ArrowLeft aria-hidden />
              Back to sign in
            </Button>
          }
        />
        <DemoRoleCards />
      </main>
    </div>
  );
}
