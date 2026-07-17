import { Logo } from "@/components/auth/Logo";
import { z } from "zod";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const tournamentFormSchema = z
  .object({
    name: z.string().trim().min(3, "Name must be at least 3 characters").max(160, "Name is too long"),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Slug must be at least 3 characters")
      .max(160, "Slug is too long")
      .regex(SLUG_RE, "Use lowercase letters, numbers and single hyphens only"),
    description: z.string().max(2000, "Description is too long").optional().or(z.literal("")),
    season: z.string().max(40, "Season is too long").optional().or(z.literal("")),
    venue: z.string().max(160, "Venue is too long").optional().or(z.literal("")),
    registrationDeadline: z.string().optional().or(z.literal("")),
    auctionDate: z.string().optional().or(z.literal("")),
    maxTeams: z.coerce.number().min(2, "At least 2 teams required").max(40, "Maximum 40 teams"),
    squadSize: z.coerce.number().min(5, "At least 5 players per squad").max(40, "Maximum 40 players per squad"),
    defaultPurse: z.coerce.number().min(0, "Purse cannot be negative"),
    minBidIncrement: z.coerce.number().min(1, "Minimum increment must be at least 1"),
    lotTimerSeconds: z.coerce.number().min(5, "At least 5 seconds").max(600, "At most 600 seconds"),
    currency: z.string().trim().toUpperCase().length(3, "Use a 3-letter currency code"),
    logo: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.registrationDeadline || !data.auctionDate) return true;
      return new Date(data.registrationDeadline) <= new Date(data.auctionDate);
    },
    { message: "Registration deadline must be on or before the auction date", path: ["registrationDeadline"] }
  );

export type TournamentFormValues = z.infer<typeof tournamentFormSchema>;