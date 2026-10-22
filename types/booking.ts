import type { BookingMode, BookingStatus, PaymentStatus } from "@/lib/booking";
import type { SessionStatus } from "@/lib/session-timer";
import type { ServiceZone } from "@/lib/zones";
import type { PaymentView } from "@/types/payment";
import type { SessionView } from "@/types/session";

export type TrainerSummary = {
  id: string;
  name: string;
  specialties: string[];
};

export type TrainerSlots = {
  trainer: TrainerSummary;
  slots: string[];
};

export type OpenSlots = {
  trainers: TrainerSlots[];
  slots: string[];
};

export type BookingView = {
  id: string;
  mode: BookingMode;
  status: BookingStatus;
  sessionStatus: SessionStatus;
  startTime: string;
  endTime: string;
  serviceZone: ServiceZone;
  trainer: { id: string; name: string } | null;
  customer: { id: string; name: string };
  paymentStatus: PaymentStatus;
  createdAt: string;
};

export type PersonContact = { id: string; name: string; email: string | null };

export type BookingAmounts = { sessionPrice: number; commissionAmount: number; totalAmount: number };

export type AdminBookingView = Omit<BookingView, "customer" | "trainer"> & {
  customer: PersonContact;
  trainer: PersonContact | null;
  amounts: BookingAmounts | null;
};

export type AdminBookingPage = {
  bookings: AdminBookingView[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminSessionLifecycle = Pick<
  SessionView,
  "status" | "startWindow" | "startedAt" | "endsAt" | "completedAt" | "durationMinutes"
>;

export type AdminBookingDetail = {
  booking: AdminBookingView;
  payments: PaymentView[];
  session: AdminSessionLifecycle;
};

export type AvailabilityWindowView = {
  id: string;
  startTime: string;
  endTime: string;
  serviceZone: ServiceZone;
  bookings: { id: string; startTime: string; endTime: string; customerName: string }[];
};
