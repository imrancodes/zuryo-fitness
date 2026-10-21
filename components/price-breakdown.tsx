import { Badge } from "@/components/ui/badge";
import { formatInr } from "@/lib/money";
import type { PriceQuote } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export function SlotTypeBadge({ isPeak }: { isPeak: boolean }) {
  return <Badge variant={isPeak ? "brand" : "secondary"}>{isPeak ? "Peak slot" : "Normal slot"}</Badge>;
}

export function PriceBreakdown({ quote, className }: { quote: PriceQuote; className?: string }) {
  return (
    <dl className={cn("divide-y rounded-xl border bg-card text-sm", className)}>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="flex items-center gap-2 text-muted-foreground">
          Session price
          <SlotTypeBadge isPeak={quote.isPeak} />
        </dt>
        <dd className="font-medium tabular-nums">{formatInr(quote.sessionPrice)}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="text-muted-foreground">Society commission ({quote.commissionPercent}%)</dt>
        <dd className="font-medium tabular-nums">{formatInr(quote.commissionAmount)}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <dt className="font-medium">Total payable</dt>
        <dd className="text-lg font-semibold tabular-nums">{formatInr(quote.totalAmount)}</dd>
      </div>
    </dl>
  );
}
