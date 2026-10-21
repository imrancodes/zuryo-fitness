import { z } from "zod";

export const grantPackageSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter the customer's email")),
  sessions: z
    .number({ error: "Enter the number of sessions" })
    .int("Sessions must be a whole number")
    .min(1, "Grant at least 1 session")
    .max(50, "Grant at most 50 sessions at a time"),
});

export type GrantPackageInput = z.infer<typeof grantPackageSchema>;
