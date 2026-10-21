import { MapPin } from "lucide-react";
import { InitialsAvatar } from "@/components/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SlotGrid, type SlotSelection } from "@/features/booking/slot-grid";
import { cn } from "@/lib/utils";
import type { TrainerSlots } from "@/types/booking";

type TrainerCardProps = {
  entry: TrainerSlots;
  serviceZone: string;
  selection: SlotSelection | null;
  onSelect: (selection: SlotSelection) => void;
};

export function TrainerCard({ entry, serviceZone, selection, onSelect }: TrainerCardProps) {
  const { trainer, slots } = entry;

  return (
    <Card className={cn(selection?.trainerId === trainer.id && "ring-2 ring-brand")}>
      <CardHeader className="flex items-center gap-3">
        <InitialsAvatar name={trainer.name} className="size-10" />
        <div className="min-w-0">
          <p className="truncate font-medium">{trainer.name}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden />
            {serviceZone}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {trainer.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trainer.specialties.map((specialty) => (
              <Badge key={specialty} variant="secondary">
                {specialty}
              </Badge>
            ))}
          </div>
        )}
        <SlotGrid
          label={`Times with ${trainer.name}`}
          slots={slots}
          trainerId={trainer.id}
          selection={selection}
          onSelect={onSelect}
        />
      </CardContent>
    </Card>
  );
}
