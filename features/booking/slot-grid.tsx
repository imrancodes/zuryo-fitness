import { ChoiceChip } from "@/components/choice-chip";
import { formatTime } from "@/lib/time";

export type SlotSelection = { startTime: string; trainerId: string | null };

type SlotGridProps = {
  label: string;
  slots: string[];
  trainerId: string | null;
  selection: SlotSelection | null;
  onSelect: (selection: SlotSelection) => void;
};

export function SlotGrid({ label, slots, trainerId, selection, onSelect }: SlotGridProps) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {slots.map((slot) => (
        <ChoiceChip
          key={slot}
          name={label}
          value={slot}
          label={formatTime(slot)}
          checked={selection?.startTime === slot && selection.trainerId === trainerId}
          onSelect={() => onSelect({ startTime: slot, trainerId })}
        />
      ))}
    </div>
  );
}
