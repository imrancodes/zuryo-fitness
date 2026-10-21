"use client";

import { Loader2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
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
import { ZonePicker } from "@/features/booking/zone-picker";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { formatDate, TIME_ZONE_LABEL, toZonedParts, zonedToUtc } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import type { AvailabilityWindowView } from "@/types/booking";
import { availabilitySchema } from "@/validators/availability";

type AvailabilityDialogProps = {
  date: string;
  window?: AvailabilityWindowView;
  variant?: "default" | "outline" | "ghost";
  children: ReactNode;
};

export function AvailabilityDialog({ date, window, variant = "default", children }: AvailabilityDialogProps) {
  const initialZone = window?.serviceZone ?? null;
  const [open, setOpen] = useState(false);
  const [zone, setZone] = useState<ServiceZone | null>(initialZone);
  const { pending, error, fieldErrors, setFieldErrors, run, reset } = useApiMutation();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
      setZone(initialZone);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = availabilitySchema.safeParse({
      date,
      startTime: form.get("startTime"),
      endTime: form.get("endTime"),
      serviceZone: zone,
    });

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    const saved = window
      ? await run(`/api/trainers/me/availability/${window.id}`, "PATCH", parsed.data)
      : await run("/api/trainers/me/availability", "POST", parsed.data);

    if (saved) {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant={variant} size={window ? "sm" : "default"} />}>{children}</DialogTrigger>
      <DialogContent>
        <form noValidate onSubmit={onSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{window ? "Edit availability" : "Add availability"}</DialogTitle>
            <DialogDescription>
              {formatDate(zonedToUtc(date))} · Times in {TIME_ZONE_LABEL}, in 15-minute steps
            </DialogDescription>
          </DialogHeader>
          <FormStatus error={error} />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              id="startTime"
              label="Start"
              type="time"
              step={900}
              defaultValue={window ? toZonedParts(window.startTime).time : "09:00"}
              error={fieldErrors.startTime?.[0] ?? fieldErrors.date?.[0]}
            />
            <FormField
              id="endTime"
              label="End"
              type="time"
              step={900}
              defaultValue={window ? toZonedParts(window.endTime).time : "12:00"}
              error={fieldErrors.endTime?.[0]}
            />
          </div>
          <ZonePicker value={zone} onChange={setZone} error={fieldErrors.serviceZone?.[0]} />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {window ? "Save changes" : "Add availability"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
