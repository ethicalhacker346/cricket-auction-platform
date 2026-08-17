// src/lib/validations/franchiseSchema.ts
import { z } from "zod";

// src/lib/validators/franchiseSchema.ts

export const franchiseFormSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  logo: z.string().url().optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  
  // ═══════════════════════════════════════════════════════════════════════
  // NEW: Team Colors
  // ═══════════════════════════════════════════════════════════════════════
  colorFrom: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #4F46E5)")
    .optional()
    .nullable(),
  colorTo: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #06B6D4)")
    .optional()
    .nullable(),
});

export type FranchiseFormValues = z.infer<typeof franchiseFormSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Sanitizer — strips empty strings so the backend doesn't store ""
// ═══════════════════════════════════════════════════════════════════════════
export function sanitizeFranchisePayload(values: FranchiseFormValues) {
  return {
    ...values,
    name: values.name.trim(),
    slug: values.slug.trim().toLowerCase(),
    city: values.city?.trim() || undefined,
    description: values.description?.trim() || undefined,
    logo: values.logo?.trim() || undefined,
    
    // NEW: convert empty strings → null so Mongoose stores null, not ""
    colorFrom: values.colorFrom?.trim() || null,
    colorTo: values.colorTo?.trim() || null,
  };
}

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
