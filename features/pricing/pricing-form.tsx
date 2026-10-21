"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ChoiceChip } from "@/components/choice-chip";
import { FormField } from "@/components/form-field";
import { FormStatus } from "@/components/form-status";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { paiseToRupees, rupeesToPaise } from "@/lib/money";
import { quoteForPrice, type PeakSlot } from "@/lib/pricing";
import { formatDateTime, TIME_ZONE_LABEL, WEEKDAYS } from "@/lib/time";
import type { PricingRuleView } from "@/types/payment";
import { pricingRuleSchema } from "@/validators/pricing";

const NEW_SLOT: PeakSlot = { daysOfWeek: [1, 2, 3, 4, 5], startTime: "06:00", endTime: "09:00" };

export function PricingForm({ rule }: { rule: PricingRuleView }) {
  const [normalPrice, setNormalPrice] = useState(paiseToRupees(rule.normalPrice));
  const [peakPrice, setPeakPrice] = useState(paiseToRupees(rule.peakPrice));
  const [commission, setCommission] = useState(String(rule.commissionPercent));
  const [peakSlots, setPeakSlots] = useState<PeakSlot[]>(rule.peakSlots);
  const [isActive, setIsActive] = useState(rule.isActive);
  const [saved, setSaved] = useState(false);
  const { pending, error, fieldErrors, setFieldErrors, run } = useApiMutation();

  const parsed = pricingRuleSchema.safeParse({
    normalPrice: rupeesToPaise(normalPrice) ?? Number.NaN,
    peakPrice: rupeesToPaise(peakPrice) ?? Number.NaN,
    commissionPercent: commission.trim() ? Number(commission) : Number.NaN,
    peakSlots,
    isActive,
  });

  function changeSlots(next: PeakSlot[]) {
    setPeakSlots(next);
    setSaved(false);
  }

  function updateSlot(index: number, change: Partial<PeakSlot>) {
    changeSlots(peakSlots.map((slot, current) => (current === index ? { ...slot, ...change } : slot)));
  }

  function toggleDay(index: number, day: number) {
    const days = peakSlots[index].daysOfWeek;
    updateSlot(index, { daysOfWeek: days.includes(day) ? days.filter((value) => value !== day) : [...days, day].sort() });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);

    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }

    setSaved(await run("/api/admin/pricing", "PUT", parsed.data));
  }

  return (
    <form noValidate onSubmit={onSubmit} onChange={() => setSaved(false)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <FormStatus
          error={error}
          success={saved ? "Pricing saved. New checkouts use these prices; open quotes keep their locked price." : null}
        />

        <Card>
          <CardHeader>
            <CardTitle>Session prices</CardTitle>
            <CardDescription>Amounts in rupees. They are stored as whole paise.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <FormField
              id="normalPrice"
              label="Normal price (₹)"
              inputMode="decimal"
              value={normalPrice}
              onChange={(event) => setNormalPrice(event.target.value)}
              error={fieldErrors.normalPrice?.[0]}
            />
            <FormField
              id="peakPrice"
              label="Peak price (₹)"
              inputMode="decimal"
              value={peakPrice}
              onChange={(event) => setPeakPrice(event.target.value)}
              error={fieldErrors.peakPrice?.[0]}
            />
            <FormField
              id="commissionPercent"
              label="Society commission (%)"
              inputMode="decimal"
              value={commission}
              onChange={(event) => setCommission(event.target.value)}
              error={fieldErrors.commissionPercent?.[0]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peak windows</CardTitle>
            <CardDescription>
              A session is peak when its start time falls inside a window. Times are in {TIME_ZONE_LABEL}; the end time is
              exclusive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {peakSlots.length === 0 && <p className="text-sm text-muted-foreground">No peak windows. Every session uses the normal price.</p>}
            {peakSlots.map((slot, index) => (
              <fieldset key={index} className="space-y-3 rounded-xl border p-4">
                <legend className="sr-only">Peak window {index + 1}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((label, day) => (
                    <ChoiceChip
                      key={label}
                      type="checkbox"
                      name={`days-${index}`}
                      value={String(day)}
                      label={label}
                      checked={slot.daysOfWeek.includes(day)}
                      onSelect={() => toggleDay(index, day)}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="grid gap-1.5 text-sm font-medium">
                    From
                    <Input
                      type="time"
                      value={slot.startTime}
                      onChange={(event) => updateSlot(index, { startTime: event.target.value })}
                      className="h-9 w-32 bg-card"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Until
                    <Input
                      type="time"
                      value={slot.endTime}
                      onChange={(event) => updateSlot(index, { endTime: event.target.value })}
                      className="h-9 w-32 bg-card"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto text-destructive hover:text-destructive"
                    aria-label={`Remove peak window ${index + 1}`}
                    onClick={() => changeSlots(peakSlots.filter((_, current) => current !== index))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </fieldset>
            ))}
            {fieldErrors.peakSlots && <p className="text-sm text-destructive">{fieldErrors.peakSlots[0]}</p>}
            <Button type="button" variant="outline" onClick={() => changeSlots([...peakSlots, NEW_SLOT])}>
              <Plus aria-hidden />
              Add peak window
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-3">
            <input
              id="isActive"
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="mt-0.5 size-4 accent-brand"
            />
            <label htmlFor="isActive" className="space-y-1">
              <span className="block text-sm font-medium">Pricing is active</span>
              <span className="block text-sm text-muted-foreground">
                When inactive, checkout is paused for customers until pricing is activated again.
              </span>
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {rule.updatedAt && `Last updated ${formatDateTime(rule.updatedAt)} ${TIME_ZONE_LABEL}`}
          </p>
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            Save pricing
          </Button>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start" aria-label="Price preview">
        <h2 className="text-sm font-medium text-muted-foreground">What customers pay</h2>
        {parsed.success ? (
          <>
            <PriceBreakdown quote={quoteForPrice(parsed.data.normalPrice, parsed.data.commissionPercent, false)} />
            <PriceBreakdown quote={quoteForPrice(parsed.data.peakPrice, parsed.data.commissionPercent, true)} />
          </>
        ) : (
          <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">
            Fix the highlighted values to see a preview.
          </p>
        )}
      </aside>
    </form>
  );
}
