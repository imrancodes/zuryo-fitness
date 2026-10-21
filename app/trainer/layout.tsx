import { AppShell } from "@/components/layout/app-shell";

export default function TrainerLayout({ children }: LayoutProps<"/trainer">) {
  return <AppShell role="trainer">{children}</AppShell>;
}
