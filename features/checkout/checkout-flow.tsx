"use client";

import { ArrowRight, CircleCheck, CircleX, FlaskConical, Loader2, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormStatus } from "@/components/form-status";
import { OptionCard } from "@/components/option-card";
import { PriceBreakdown } from "@/components/price-breakdown";
import { Stepper } from "@/components/stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingSummary } from "@/features/booking/booking-summary";
import { useResetOnHide } from "@/hooks/use-reset-on-hide";
import { formatInr } from "@/lib/money";
import type { PriceQuote } from "@/lib/pricing";
import { requestJson } from "@/lib/request";
import { formatDateTime, formatTime, TIME_ZONE_LABEL } from "@/lib/time";
import type { BookingView } from "@/types/booking";
import type { PaymentView } from "@/types/payment";

type Step = "review" | "payment" | "result";
type Outcome = "approve" | "decline";

const STEPS = ["Review", "Payment", "Done"];
const STEP_INDEX: Record<Step, number> = { review: 0, payment: 1, result: 2 };

const OUTCOMES = [
  { value: "approve", label: "Approve payment", description: "Simulates a successful payment", icon: CircleCheck },
  { value: "decline", label: "Decline payment", description: "Simulates a failed payment so you can retry", icon: CircleX },
];

type CheckoutFlowProps = {
  booking: BookingView;
  quote: PriceQuote | null;
  initialPayment: PaymentView | null;
};

function initialStep(payment: PaymentView | null): Step {
  if (payment?.status === "paid") {
    return "result";
  }
  return payment?.status === "pending" ? "payment" : "review";
}

export function CheckoutFlow({ booking, quote, initialPayment }: CheckoutFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep(initialPayment));
  const [payment, setPayment] = useState(initialPayment);
  const [outcome, setOutcome] = useState<Outcome>("approve");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnHide(() => {
    setStep(initialStep(initialPayment));
    setPayment(initialPayment);
    setOutcome("approve");
    setPending(false);
    setError(null);
  });

  async function openCheckout() {
    setPending(true);
    setError(null);
    const result = await requestJson<{ payment: PaymentView }>(`/api/bookings/${booking.id}/checkout`, { method: "POST" });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayment(result.data.payment);
    setOutcome("approve");
    setStep("payment");
  }

  async function pay() {
    if (!payment) {
      return;
    }

    setPending(true);
    setError(null);
    const result = await requestJson<{ payment: PaymentView }>("/api/payments/simulate", {
      method: "POST",
      body: { paymentId: payment.id, outcome },
    });
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPayment(result.data.payment);
    setStep("result");
    router.refresh();
  }

  const summary = (
    <BookingSummary
      mode={booking.mode}
      startTime={booking.startTime}
      serviceZone={booking.serviceZone}
      trainer={booking.trainer?.name ?? "Assigning trainer"}
    />
  );

  return (
    <div className="space-y-6">
      <Stepper steps={STEPS} current={STEP_INDEX[step]} />

      {step === "review" && quote && (
        <section aria-labelledby="review-heading" className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 id="review-heading" className="text-lg font-semibold">
              Your session
            </h2>
            {summary}
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Price</h2>
            <PriceBreakdown quote={quote} />
            <FormStatus error={error} />
            <Button size="lg" className="h-10 w-full" onClick={openCheckout} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Lock aria-hidden />}
              Continue to payment
            </Button>
            <p className="text-xs text-muted-foreground">
              The price is calculated on our servers and locked for 15 minutes once you continue.
            </p>
          </div>
        </section>
      )}

      {step === "payment" && payment && (
        <section aria-labelledby="payment-heading" className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 id="payment-heading" className="text-lg font-semibold">
              Amount due
            </h2>
            <PriceBreakdown quote={payment.quote} />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              Price locked until {formatTime(payment.expiresAt)} {TIME_ZONE_LABEL}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <FlaskConical className="size-4 text-brand" aria-hidden />
                  Simulated payment
                </span>
                <Badge variant="outline">Demo only</Badge>
              </CardTitle>
              <CardDescription>No real money moves and no card details are collected. Pick the result to simulate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="grid gap-3 sm:grid-cols-2" disabled={pending}>
                <legend className="sr-only">Simulated outcome</legend>
                {OUTCOMES.map((option) => (
                  <OptionCard
                    key={option.value}
                    name="outcome"
                    checked={outcome === option.value}
                    onSelect={(value) => setOutcome(value as Outcome)}
                    className="p-3"
                    {...option}
                  />
                ))}
              </fieldset>
              {error && (
                <div className="space-y-3">
                  <FormStatus error={error} />
                  <Button variant="outline" onClick={openCheckout} disabled={pending}>
                    <RefreshCw aria-hidden />
                    Refresh price
                  </Button>
                </div>
              )}
              <Button size="lg" className="h-10 w-full" onClick={pay} disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {pending ? "Processing…" : `Pay ${formatInr(payment.quote.totalAmount)}`}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {step === "result" && payment && (
        <section aria-labelledby="result-heading" className="space-y-6">
          <h2 id="result-heading" className="sr-only">
            Payment result
          </h2>
          {payment.status === "paid" ? (
            <FormStatus success={`Payment successful. ${formatInr(payment.quote.totalAmount)} paid (simulated).`} />
          ) : (
            <FormStatus error={payment.failureReason ?? "The payment did not go through."} />
          )}
          <div className="grid gap-6 lg:grid-cols-2">
            {summary}
            <div className="space-y-3">
              <PriceBreakdown quote={payment.quote} />
              {payment.status === "paid" && (
                <dl className="divide-y rounded-xl border bg-card text-sm">
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="font-mono text-xs">{payment.providerReference}</dd>
                  </div>
                  <div className="flex justify-between gap-4 px-4 py-3">
                    <dt className="text-muted-foreground">Paid at</dt>
                    <dd className="font-medium">
                      {payment.paidAt && `${formatDateTime(payment.paidAt)} ${TIME_ZONE_LABEL}`}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
          <FormStatus error={error} />
          <div className="flex flex-wrap gap-2">
            {payment.status !== "paid" && (
              <Button onClick={openCheckout} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                Try again
              </Button>
            )}
            <Button variant="outline" nativeButton={false} render={<Link href={`/customer/bookings/${booking.id}`} />}>
              View booking
              <ArrowRight aria-hidden />
            </Button>
            {payment.status === "paid" && (
              <Button variant="ghost" nativeButton={false} render={<Link href="/customer/book" />}>
                Book another session
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
