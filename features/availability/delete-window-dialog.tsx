"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { FormStatus } from "@/components/form-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatTime } from "@/lib/time";
import type { AvailabilityWindowView } from "@/types/booking";

export function DeleteWindowDialog({ window }: { window: AvailabilityWindowView }) {
  const [open, setOpen] = useState(false);
  const { pending, error, run, reset } = useApiMutation();
  const booked = window.bookings.length > 0;

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
    }
  }

  async function remove() {
    if (await run(`/api/trainers/me/availability/${window.id}`, "DELETE")) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}>
        <Trash2 aria-hidden />
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove this availability?</DialogTitle>
          <DialogDescription>
            {formatTime(window.startTime)} – {formatTime(window.endTime)} in {window.serviceZone}. Customers will no
            longer be able to book these times.
          </DialogDescription>
        </DialogHeader>
        <FormStatus
          error={booked ? "This window has booked sessions, so it can't be removed." : error}
        />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={remove} disabled={pending || booked}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
