"use client";

import { ArrowLeft, ArrowRight, CalendarDays, CalendarX, Loader2, RefreshCw, Users, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { OptionCard } from "@/components/option-card";
import { Stepper } from "@/components/stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormStatus } from "@/components/form-status";
import { BookingSummary } from "@/features/booking/booking-summary";
import { SlotGrid, type SlotSelection } from "@/features/booking/slot-grid";
import { TrainerCard } from "@/features/booking/trainer-card";
import { ZonePicker } from "@/features/booking/zone-picker";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { MAX_DAYS_AHEAD, type BookingMode } from "@/lib/booking";
import { requestJson } from "@/lib/request";
import { addDays, TIME_ZONE_LABEL, todayInZone } from "@/lib/time";
import type { ServiceZone } from "@/lib/zones";
import type { BookingView, OpenSlots } from "@/types/booking";

const STEPS = ["Booking type", "Where & when", "Choose a time", "Review"];

const MODES = [
  { value: "instant", label: "Instant", description: "A session starting within the next hour", icon: Zap },
  { value: "scheduled", label: "Scheduled", description: "Pick a future date and time", icon: CalendarDays },
];

export function BookingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<BookingMode | null>(null);
  const [zone, setZone] = useState<ServiceZone | null>(null);
  const [date, setDate] = useState(() => todayInZone());
  const [openSlots, setOpenSlots] = useState<OpenSlots | null>(null);
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep(0);
    setMode(null);
    setZone(null);
    setDate(todayInZone());
    setOpenSlots(null);
    setSelection(null);
    setRequestId(null);
    setLoading(false);
    setSubmitting(false);
    setError(null);
  }

  useResetOnHide(reset);

  async function loadSlots() {
    if (!mode || !zone) {
      return;
    }

    setStep(2);
    setLoading(true);
    setError(null);
    setSelection(null);

    const params = new URLSearchParams({ mode, serviceZone: zone, ...(mode === "scheduled" && { date }) });
    const result = await requestJson<OpenSlots>(`/api/availability?${params}`);

    setLoading(false);
    setOpenSlots(result.ok ? result.data : null);
    setError(result.ok ? null : result.error);
  }

  function review() {
    setRequestId(crypto.randomUUID());
    setError(null);
    setStep(3);
  }

  async function confirm() {
    if (!mode || !zone || !selection || !requestId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await requestJson<{ booking: BookingView }>("/api/bookings", {
      method: "POST",
      body: {
        mode,
        serviceZone: zone,
        startTime: selection.startTime,
        preferredTrainerId: selection.trainerId ?? undefined,
        idempotencyKey: requestId,
      },
    });

    if (result.ok) {
      router.push(`/customer/checkout/${result.data.booking.id}?new=1`);
      return;
    }

    setSubmitting(false);
    setError(result.error);
  }

  const trainerName = selection?.trainerId
    ? openSlots?.trainers.find((entry) => entry.trainer.id === selection.trainerId)?.trainer.name
    : null;

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={step} />

      {step === 0 && (
        <section className="space-y-4" aria-labelledby="mode-heading">
          <h2 id="mode-heading" className="text-lg font-semibold">
            How soon do you want to train?
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((option) => (
              <OptionCard
                key={option.value}
                name="mode"
                checked={mode === option.value}
                onSelect={(value) => setMode(value as BookingMode)}
                {...option}
              />
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="lg" disabled={!mode} onClick={() => setStep(1)}>
              Continue
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-6" aria-labelledby="where-heading">
          <h2 id="where-heading" className="text-lg font-semibold">
            Where and when?
          </h2>
          <ZonePicker value={zone} onChange={setZone} />
          {mode === "scheduled" && (
            <div className="max-w-xs">
              <FormField
                id="date"
                label={`Date (${TIME_ZONE_LABEL})`}
                type="date"
                value={date}
                min={todayInZone()}
                max={addDays(todayInZone(), MAX_DAYS_AHEAD)}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            <Button size="lg" disabled={!zone || (mode === "scheduled" && !date)} onClick={loadSlots}>
              Find trainers
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6" aria-labelledby="time-heading" aria-busy={loading}>
          <div className="space-y-1">
            <h2 id="time-heading" className="text-lg font-semibold">
              Choose a time
            </h2>
            <p className="text-sm text-muted-foreground">
              60-minute sessions in {zone} · All times in {TIME_ZONE_LABEL}
            </p>
          </div>

          {loading && (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-40 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <FormStatus error={error} />
              <Button variant="outline" onClick={loadSlots}>
                <RefreshCw aria-hidden />
                Try again
              </Button>
            </div>
          )}

          {!loading && openSlots && openSlots.slots.length === 0 && (
            <EmptyState
              icon={CalendarX}
              title="No trainers available"
              description={
                mode === "instant"
                  ? "No one can start within the next hour in this zone. Try another zone or schedule a session."
                  : "No open times on this date in this zone. Try another date or zone."
              }
            >
              <Button variant="outline" onClick={() => setStep(1)}>
                Change zone or date
              </Button>
            </EmptyState>
          )}

          {!loading && openSlots && openSlots.slots.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="size-4 text-brand" aria-hidden />
                    Any available trainer
                  </CardTitle>
                  <CardDescription>We&apos;ll assign the first eligible trainer when you confirm.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SlotGrid
                    label="Times with any trainer"
                    slots={openSlots.slots}
                    trainerId={null}
                    selection={selection}
                    onSelect={setSelection}
                  />
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Or choose a preferred trainer</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {openSlots.trainers.map((entry) => (
                    <TrainerCard
                      key={entry.trainer.id}
                      entry={entry}
                      serviceZone={zone ?? ""}
                      selection={selection}
                      onSelect={setSelection}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between">
            <Button variant="ghost" size="lg" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            <Button size="lg" disabled={!selection} onClick={review}>
              Review booking
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </section>
      )}

      {step === 3 && mode && zone && selection && (
        <section className="space-y-6" aria-labelledby="review-heading">
          <h2 id="review-heading" className="text-lg font-semibold">
            Review and confirm
          </h2>
          <BookingSummary
            mode={mode}
            startTime={selection.startTime}
            serviceZone={zone}
            trainer={trainerName ?? "Any available trainer"}
          />
          <p className="text-sm text-muted-foreground">
            You&apos;ll see the exact price and complete payment on the next screen.
          </p>
          {error && (
            <div className="space-y-3">
              <FormStatus error={error} />
              <Button variant="outline" onClick={loadSlots}>
                Choose another time
              </Button>
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" size="lg" onClick={() => setStep(2)} disabled={submitting}>
              <ArrowLeft aria-hidden />
              Back
            </Button>
            <Button size="lg" onClick={confirm} disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" aria-hidden />}
              {submitting ? "Confirming…" : "Confirm booking"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
