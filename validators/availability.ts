import { z } from "zod";
import { SESSION_MINUTES } from "@/lib/booking";
import { dateString, serviceZone, timeString } from "@/validators/common";

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export const availabilitySchema = z
  .object({
    date: dateString,
    startTime: timeString,
    endTime: timeString,
    serviceZone,
  })
  .refine((value) => toMinutes(value.endTime) > toMinutes(value.startTime), {
    path: ["endTime"],
    message: "End time must be after the start time",
  })
  .refine((value) => toMinutes(value.endTime) - toMinutes(value.startTime) >= SESSION_MINUTES, {
    path: ["endTime"],
    message: "Availability must be at least 60 minutes long",
  });

export const availabilityDateQuerySchema = z.object({
  date: dateString.optional(),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
