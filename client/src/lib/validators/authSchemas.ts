import { z } from "zod";
import { USER_ROLES } from "@/lib/constants/roles";

export const loginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .min(1, { error: "Email is required" })
    .email({ error: "Enter a valid email address" }),
  password: z
    .string({ error: "Password is required" })
    .min(1, { error: "Password is required" }),
  remember: z.boolean().optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string({ error: "Full name is required" })
      .trim()
      .min(2, { error: "Name must be at least 2 characters" })
      .max(120, { error: "Name is too long" }),
    email: z
      .string({ error: "Email is required" })
      .min(1, { error: "Email is required" })
      .email({ error: "Enter a valid email address" }),
    phone: z
      .string()
      .optional()
      .refine((value) => !value || /^[0-9+\-\s()]{7,15}$/.test(value), {
        error: "Enter a valid phone number",
      }),
    password: z
      .string({ error: "Password is required" })
      .min(8, { error: "Use at least 8 characters" })
      .regex(/[A-Z]/, { error: "Add an uppercase letter" })
      .regex(/[a-z]/, { error: "Add a lowercase letter" })
      .regex(/[0-9]/, { error: "Add a number" }),
    confirmPassword: z.string({ error: "Please confirm your password" }),
    role: z.enum(
      [USER_ROLES.PLAYER, USER_ROLES.FRANCHISE_OWNER, USER_ROLES.ORGANIZER],
      { error: "Choose a role to continue" }
    ),
    terms: z.boolean().refine((value) => value === true, {
      error: "You must accept the Terms & Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;