import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormStatus({ error, success }: { error?: string | null; success?: string | null }) {
  if (success) {
    return (
      <Alert role="status" className="border-brand/30 bg-brand/5 text-brand">
        <CircleCheck />
        <AlertDescription className="text-brand">{success}</AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert role="alert" variant="destructive" className="border-destructive/30">
        <CircleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return null;
}
