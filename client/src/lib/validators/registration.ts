import { z } from "zod";

export const franchiseFormSchema = z.object({
  name: z.string().trim().min(3, "Franchise name must be at least 3 characters").max(60, "Name is too long"),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "At least 2 characters")
    .max(6, "At most 6 characters")
    .regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  city: z.string().trim().max(60, "Too long").optional().or(z.literal("")),
  contactEmail: z.string().trim().email("Enter a valid email address"),
  contactPhone: z.string().trim().max(15, "Too long").optional().or(z.literal("")),
  brandColor: z.string().trim().min(1, "Pick a color"),
});

export type FranchiseFormValues = z.infer<typeof franchiseFormSchema>;

export const playerFormSchema = z.object({
  role: z.enum(["BATSMAN", "BOWLER", "ALL_ROUNDER", "WICKET_KEEPER"], { message: "Select a playing role" }),
  battingStyle: z.string().trim().max(30, "Too long").optional().or(z.literal("")),
  bowlingStyle: z.string().trim().max(30, "Too long").optional().or(z.literal("")),
  basePrice: z.coerce.number().min(10_000, "Minimum base price is 10,000").max(10_000_000, "That's too high"),
  contactPhone: z.string().trim().max(15, "Too long").optional().or(z.literal("")),
  experienceYears: z.coerce.number().min(0, "Cannot be negative").max(40, "That's too many years").optional(),
});

export type PlayerFormValues = z.infer<typeof playerFormSchema>;
