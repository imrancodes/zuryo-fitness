import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function DemoAccessNotice() {
  return (
    <section aria-labelledby="demo-access" className="space-y-3 rounded-xl border border-dashed bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 id="demo-access" className="flex items-center gap-2 text-sm font-medium">
          <FlaskConical className="size-4 text-brand" aria-hidden />
          Demo access
        </h2>
        <Badge variant="outline">Development only</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Explore Zuryo as a seeded demo customer, trainer or admin. Roles are still enforced by the server.
      </p>
      <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/demo" />}>
        Open demo access
      </Button>
    </section>
  );
}
