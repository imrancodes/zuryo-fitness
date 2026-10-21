import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/booking";

const STATUS_VARIANT = {
  pending: "secondary",
  confirmed: "brand",
  cancelled: "destructive",
  completed: "outline",
} as const;

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="capitalize">
      {status}
    </Badge>
  );
}
