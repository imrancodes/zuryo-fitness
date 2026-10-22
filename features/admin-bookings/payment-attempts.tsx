import { Badge } from "@/components/ui/badge";
import { formatInr } from "@/lib/money";
import { formatDateTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { PaymentStatusValue, PaymentView } from "@/types/payment";

const ATTEMPT_BADGE: Record<PaymentStatusValue, { variant: "secondary" | "brand" | "destructive" | "outline"; label: string }> = {
  pending: { variant: "secondary", label: "Open checkout" },
  paid: { variant: "brand", label: "Paid" },
  failed: { variant: "destructive", label: "Failed" },
  expired: { variant: "outline", label: "Expired" },
};

function attemptNote(payment: PaymentView) {
  switch (payment.status) {
    case "paid":
      return `Paid ${formatDateTime(payment.paidAt ?? payment.createdAt)} ${TIME_ZONE_LABEL}${payment.providerReference ? ` · ${payment.providerReference}` : ""}`;
    case "failed":
      return payment.failureReason ?? "Payment failed";
    case "pending":
      return `Price locked until ${formatDateTime(payment.expiresAt)} ${TIME_ZONE_LABEL}`;
    case "expired":
      return `Price lock expired ${formatDateTime(payment.expiresAt)} ${TIME_ZONE_LABEL}`;
  }
}

export function PaymentAttempts({ payments }: { payments: PaymentView[] }) {
  if (payments.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">The customer hasn&apos;t started checkout.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card text-sm">
      {payments.map((payment) => {
        const badge = ATTEMPT_BADGE[payment.status];
        return (
          <li key={payment.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">Started {formatDateTime(payment.createdAt)} {TIME_ZONE_LABEL}</p>
              <p className="break-words">{attemptNote(payment)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium tabular-nums">{formatInr(payment.quote.totalAmount)}</span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
