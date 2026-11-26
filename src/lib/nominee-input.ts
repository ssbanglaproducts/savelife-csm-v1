import { z } from "zod";

/** One nominee record. Relation is free text so members can describe it precisely. */
export const nomineeInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  relation: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(8).max(30),
});

export type NomineeInput = z.infer<typeof nomineeInputSchema>;
