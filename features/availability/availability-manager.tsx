"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, MapPin, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AvailabilityDialog } from "@/features/availability/availability-dialog";
import { DeleteWindowDialog } from "@/features/availability/delete-window-dialog";
import { addDays, formatDate, formatTime, TIME_ZONE_LABEL, zonedToUtc } from "@/lib/time";
import type { AvailabilityWindowView } from "@/types/booking";

type AvailabilityManagerProps = {
  date: string;
  today: string;
  windows: AvailabilityWindowView[];
};

function WindowCard({ window, editable, date }: { window: AvailabilityWindowView; editable: boolean; date: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="tabular-nums">
          {formatTime(window.startTime)} – {formatTime(window.endTime)}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <MapPin aria-hidden />
            {window.serviceZone}
          </Badge>
          <Badge variant={window.bookings.length ? "brand" : "secondary"}>
            {window.bookings.length} booked
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {window.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions booked in this window yet.</p>
        ) : (
          <ul className="space-y-2">
            {window.bookings.map((booking) => (
              <li key={booking.id} className="flex items-center gap-3 text-sm">
                <InitialsAvatar name={booking.customerName} className="size-7 text-xs" />
                <span className="font-medium">{booking.customerName}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editable && (
        <CardFooter className="justify-end gap-2 border-t pt-4">
          <AvailabilityDialog date={date} window={window} variant="outline">
            <Pencil aria-hidden />
            Edit
          </AvailabilityDialog>
          <DeleteWindowDialog window={window} />
        </CardFooter>
      )}
    </Card>
  );
}

export function AvailabilityManager({ date, today, windows }: AvailabilityManagerProps) {
  const router = useRouter();
  const editable = date >= today;
  const go = (next: string) => router.push(`/trainer/availability?date=${next}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(event) => event.target.value && go(event.target.value)}
            className="h-8 w-auto bg-card"
          />
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => go(addDays(date, 1))}>
            <ChevronRight />
          </Button>
          {date !== today && (
            <Button variant="ghost" onClick={() => go(today)}>
              Today
            </Button>
          )}
        </div>
        {editable && (
          <AvailabilityDialog date={date}>
            <Plus aria-hidden />
            Add availability
          </AvailabilityDialog>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {formatDate(zonedToUtc(date))} · All times in {TIME_ZONE_LABEL}
      </p>

      {windows.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No availability on this day"
          description={
            editable
              ? "Add a time range so customers in your service zones can book you."
              : "This day has passed. Pick an upcoming date to add availability."
          }
        />
      ) : (
        <div className="grid gap-4">
          {windows.map((window) => (
            <WindowCard key={window.id} window={window} editable={editable} date={date} />
          ))}
        </div>
      )}
    </div>
  );
}
