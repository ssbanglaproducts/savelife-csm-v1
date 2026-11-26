import { z } from "zod";

/** Shared shape for member-created and member-edited saved addresses. */
export const addressInputSchema = z.object({
  label: z.enum(["HOME", "OFFICE", "PERSONAL", "OTHER"]).optional().default("OTHER"),
  fullAddress: z.string().trim().min(3).max(200),
  thana: z.string().trim().min(1).max(80),
  district: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().max(20).optional().default(""),
});

export type AddressInput = z.infer<typeof addressInputSchema>;
