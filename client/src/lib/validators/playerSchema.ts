// src/lib/validations/playerSchema.ts
import { z } from "zod";

export const playerFormSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name must be less than 120 characters")
    .trim(),
  dateOfBirth: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      if (isNaN(date.getTime())) return false;
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - 15);
      return date <= cutoff;
    }, "Player must be at least 15 years old"),
  nationality: z
    .string()
    .max(60, "Must be 60 characters or less")
    .optional()
    .or(z.literal("")),
  primaryRole: z.enum(["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"], {
    required_error: "Please select a primary role",
  }),
  battingStyle: z
    .string()
    .max(40, "Must be 40 characters or less")
    .optional()
    .or(z.literal("")),
  bowlingStyle: z
    .string()
    .max(40, "Must be 40 characters or less")
    .optional()
    .or(z.literal("")),
  // Profile/logo image URL — from LogoSelector. Field name matches the
  // backend `profileImage` field 1:1 (see Player.js / player_service.js)
  // so the value actually survives the round trip to the API.
  profileImage: z
    .string()
    .url("Invalid logo URL")
    .optional()
    .or(z.literal("")),
  bio: z
    .string()
    .max(1000, "Bio must be 1,000 characters or less")
    .optional()
    .or(z.literal("")),
});

export type PlayerFormValues = z.infer<typeof playerFormSchema>;

/** Strips empty strings to undefined so the backend receives clean partials. */
export const sanitizePlayerPayload = (
  values: PlayerFormValues
): Partial<PlayerFormValues> => {
  const payload: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      payload[key] = value;
    }
  });
  return payload as Partial<PlayerFormValues>;
};