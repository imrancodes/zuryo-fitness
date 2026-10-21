import { z } from "zod";
import { PUBLIC_ROLES, ROLES } from "@/lib/roles";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
  next: z.string().optional(),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
  role: z.enum(PUBLIC_ROLES, { error: "Choose customer or trainer" }),
});

export const demoLoginSchema = z.object({
  role: z.enum(ROLES),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
