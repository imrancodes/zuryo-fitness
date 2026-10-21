import { ChoiceChip } from "@/components/choice-chip";
import { SERVICE_ZONES, type ServiceZone } from "@/lib/zones";

type ZonePickerProps = {
  value: ServiceZone | null;
  onChange: (zone: ServiceZone) => void;
  error?: string;
};

export function ZonePicker({ value, onChange, error }: ZonePickerProps) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Service zone</legend>
      <div className="flex flex-wrap gap-2">
        {SERVICE_ZONES.map((zone) => (
          <ChoiceChip
            key={zone}
            name="serviceZone"
            value={zone}
            label={zone}
            checked={value === zone}
            onSelect={() => onChange(zone)}
          />
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </fieldset>
  );
}
