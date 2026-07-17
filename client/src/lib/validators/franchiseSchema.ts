// src/lib/validations/franchiseSchema.ts
import { z } from "zod";

export const franchiseFormSchema = z.object({
  name: z
    .string()
    .min(2, "Franchise name must be at least 2 characters")
    .max(120, "Must be 120 characters or less")
    .trim(),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase alphanumeric with single hyphens (e.g. 'hyderabad-tigers')"
    ),
  logo: z.string().url("Invalid logo URL").optional().or(z.literal("")),
  city: z
    .string()
    .max(80, "Must be 80 characters or less")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(1000, "Description must be 1,000 characters or less")
    .optional()
    .or(z.literal("")),
});

export type FranchiseFormValues = z.infer<typeof franchiseFormSchema>;
 
/** Strips empty strings to undefined so the backend receives clean partials. */
export const sanitizeFranchisePayload = (
  values: FranchiseFormValues
): Partial<FranchiseFormValues> => {
  const payload: Record<string, unknown> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      payload[key] = value;
    }
  });
  return payload as Partial<FranchiseFormValues>;
};

/** Auto-generates a valid slug from a franchise name. */
export const generateSlug = (name: string) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .substring(0, 60);               // reasonable max length
};
