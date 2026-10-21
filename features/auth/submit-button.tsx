import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function SubmitButton({ pending, pendingLabel, children }: { pending: boolean; pendingLabel: string; children: ReactNode }) {
  return (
    <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
