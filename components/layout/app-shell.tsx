import { Suspense, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavList, SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { requireRole } from "@/lib/auth";
import { ROLE_HOME, type Role } from "@/lib/roles";

async function CurrentUserMenu({ role }: { role: Role }) {
  const user = await requireRole(role);
  return <UserMenu user={user} />;
}

async function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  await requireRole(role);
  return children;
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card">
        <div className="flex h-16 items-center gap-2 px-4 lg:px-6">
          <MobileNav role={role} />
          <Brand href={ROLE_HOME[role]} />
          <div className="ml-auto">
            <Suspense fallback={<Skeleton className="h-9 w-40" />}>
              <CurrentUserMenu role={role} />
            </Suspense>
          </div>
        </div>
      </header>
      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
          <div className="sticky top-16 p-4">
            <Suspense fallback={<NavList role={role} pathname={null} />}>
              <SidebarNav role={role} />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
            <Suspense fallback={<PageSkeleton />}>
              <RoleGate role={role}>{children}</RoleGate>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
