import { ChevronRight, Clock3, MapPin } from "lucide-react";
import Link from "next/link";
import { InitialsAvatar } from "@/components/initials-avatar";
import { SessionStatusBadge } from "@/features/sessions/session-status-badge";
import { formatDate, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { SessionView } from "@/types/session";

export function SessionList({ sessions }: { sessions: SessionView[] }) {
  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {sessions.map((session) => (
        <li key={session.id}>
          <Link
            href={`/trainer/sessions/${session.id}`}
            className="flex items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary"
          >
            <InitialsAvatar name={session.customer.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{session.customer.name}</p>
              <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span>
                  {formatDate(session.scheduledStart)} · {formatTime(session.scheduledStart)} {TIME_ZONE_LABEL}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {session.serviceZone}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" aria-hidden />
                  {session.durationMinutes} min
                </span>
              </p>
            </div>
            <SessionStatusBadge status={session.status} />
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
