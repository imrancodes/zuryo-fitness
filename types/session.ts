import type { BookingMode, PaymentStatus } from "@/lib/booking";
import type { SessionStatus } from "@/lib/session-timer";
import type { ServiceZone } from "@/lib/zones";

export type ExerciseEntry = {
  name: string;
  sets?: number;
  reps?: number;
  notes?: string;
};

export type WorkoutRecordView = {
  exercises: ExerciseEntry[];
  trainerNotes: string;
  suggestedNextWorkout: string;
  editable: boolean;
  editableUntil: string | null;
};

export type SessionView = {
  id: string;
  status: SessionStatus;
  mode: BookingMode;
  serviceZone: ServiceZone;
  paymentStatus: PaymentStatus;
  customer: { id: string; name: string };
  trainer: { id: string; name: string } | null;
  scheduledStart: string;
  scheduledEnd: string;
  startWindow: { opensAt: string; closesAt: string };
  canStart: boolean;
  startBlockedReason: string | null;
  startedAt: string | null;
  endsAt: string | null;
  completedAt: string | null;
  durationMinutes: number;
  record: WorkoutRecordView | null;
  serverNow: string;
};
