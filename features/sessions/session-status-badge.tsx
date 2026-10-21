import { Badge } from "@/components/ui/badge";
import { SESSION_STATUS_LABEL, type SessionStatus } from "@/lib/session-timer";

const STATUS_VARIANT = {
  scheduled: "secondary",
  in_progress: "brand",
  completed: "outline",
  missed: "destructive",
  cancelled: "destructive",
} as const;

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{SESSION_STATUS_LABEL[status]}</Badge>;
}
