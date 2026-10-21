import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@/lib/booking";

const PAYMENT_BADGE = {
  unpaid: { variant: "outline", label: "Unpaid" },
  paid: { variant: "brand", label: "Paid" },
  failed: { variant: "destructive", label: "Payment failed" },
  refunded: { variant: "secondary", label: "Refunded" },
} as const;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { variant, label } = PAYMENT_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
