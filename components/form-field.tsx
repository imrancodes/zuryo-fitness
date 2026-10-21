import type { ComponentProps, ComponentType } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type InputProps = ComponentProps<typeof Input>;

type FormFieldProps = InputProps & {
  id: string;
  label: string;
  error?: string;
  as?: ComponentType<InputProps>;
};

export function FormField({ id, label, error, as: Control = Input, className, ...props }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Control
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn("h-10 bg-card", className)}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
