import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type ComingSoonItem = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ComingSoonGrid({ items }: { items: ComingSoonItem[] }) {
  return (
    <section aria-labelledby="coming-soon" className="space-y-3">
      <h2 id="coming-soon" className="text-sm font-medium text-muted-foreground">
        Coming in the next phases
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader className="gap-3">
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <Badge variant="outline">Soon</Badge>
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
