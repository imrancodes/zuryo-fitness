import { AppShell } from "@/components/layout/app-shell";

export default function CustomerLayout({ children }: LayoutProps<"/customer">) {
  return <AppShell role="customer">{children}</AppShell>;
}
