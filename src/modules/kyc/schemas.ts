import { z } from "zod";
import { KYC_ACTIONS, KYC_STATUSES, MAX_REASON_LENGTH, MIN_REASON_LENGTH } from "./workflow";

export const decisionSchema = z.object({
  action: z.enum(KYC_ACTIONS, { message: "Choose a valid action" }),
  reason: z
    .string({ message: "An explanation is required" })
    .trim()
    .min(MIN_REASON_LENGTH, `Please explain your decision (at least ${MIN_REASON_LENGTH} characters)`)
    .max(MAX_REASON_LENGTH, `Explanation must be under ${MAX_REASON_LENGTH} characters`),
  expectedStatus: z.enum(KYC_STATUSES).optional(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const assignSchema = z.object({
  reviewerId: z.string().min(1).nullable(),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(MAX_REASON_LENGTH),
});
export type NoteInput = z.infer<typeof noteSchema>;

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum([...KYC_STATUSES, "OPEN", "ALL"]).optional(),
  reviewer: z.string().optional(), // user id | "me" | "unassigned"
  sort: z.enum(["newest", "oldest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
