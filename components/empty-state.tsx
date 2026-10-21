import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyState({ icon: Icon, title, description, children }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
        <Icon className="size-6" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </section>
  );
}
