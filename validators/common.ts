import { z } from "zod";
import { SLOT_ALIGN_MINUTES } from "@/lib/booking";
import { SERVICE_ZONES } from "@/lib/zones";

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the YYYY-MM-DD format");

export const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the HH:mm format")
  .refine((time) => Number(time.slice(3)) % SLOT_ALIGN_MINUTES === 0, "Times must be on a 15-minute mark");

export const serviceZone = z.enum(SERVICE_ZONES, { error: "Choose a service zone" });

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
