import { AppShell } from "@/components/layout/app-shell";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AppShell role="admin">{children}</AppShell>;
}
