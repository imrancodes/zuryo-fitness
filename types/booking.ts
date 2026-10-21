import type { BookingMode, BookingStatus } from "@/lib/booking";
import type { ServiceZone } from "@/lib/zones";

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
  startTime: string;
  endTime: string;
  serviceZone: ServiceZone;
  trainer: { id: string; name: string } | null;
  customer: { id: string; name: string };
  paymentStatus: string;
  createdAt: string;
};

export type AvailabilityWindowView = {
  id: string;
  startTime: string;
  endTime: string;
  serviceZone: ServiceZone;
  bookings: { id: string; startTime: string; endTime: string; customerName: string }[];
};
