import { z } from "zod";
import { MAX_REASON_LENGTH, MIN_REASON_LENGTH } from "@/lib/validation";
import { ENVIRONMENTS } from "./workflow";

export const environmentSchema = z.enum(ENVIRONMENTS, { message: "Environment must be DEVELOPMENT, STAGING or PRODUCTION" });

export const updateSchema = z.object({
  enabled: z.boolean({ message: "enabled must be true or false" }),
  /** Version the user saw; rejects the change if someone else changed it first. */
  expectedVersion: z.number().int().positive().optional(),
  reason: z
    .string()
    .trim()
    .max(MAX_REASON_LENGTH)
    .optional()
    .transform((v) => v || undefined),
  /** Production only: the flag key, typed by the user to confirm. */
  confirmation: z.string().trim().optional(),
});
export type UpdateInput = z.input<typeof updateSchema>;

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  env: environmentSchema.optional(),
  state: z.enum(["on", "off"]).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const evaluateQuerySchema = z.object({
  env: environmentSchema,
  keys: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((k) => k.trim()).filter(Boolean) : undefined)),
});

export { MIN_REASON_LENGTH };
