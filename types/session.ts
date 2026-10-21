import type { BookingMode, PaymentStatus } from "@/lib/booking";
import type { SessionStatus } from "@/lib/session-timer";
import type { ServiceZone } from "@/lib/zones";
import type { ProfileSnapshot } from "@/types/fitness";

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
  customerProfile?: ProfileSnapshot | null;
  previousSessions?: HistoryEntry[];
};

export type SessionFeedback = { rating: number; comment: string };

export type HistoryEntry = {
  id: string;
  trainer: { id: string; name: string };
  serviceZone: ServiceZone | null;
  startedAt: string | null;
  completedAt: string;
  durationMinutes: number;
  record: WorkoutRecordView;
  feedback: SessionFeedback | null;
};
