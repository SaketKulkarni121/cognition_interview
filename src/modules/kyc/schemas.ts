import { z } from "zod";
import { noteSchema as sharedNoteSchema, reasonSchema } from "@/lib/validation";
import { KYC_ACTIONS, KYC_STATUSES } from "./workflow";

export const decisionSchema = z.object({
  action: z.enum(KYC_ACTIONS, { message: "Choose a valid action" }),
  reason: reasonSchema,
  expectedStatus: z.enum(KYC_STATUSES).optional(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const assignSchema = z.object({
  reviewerId: z.string().min(1).nullable(),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const noteSchema = sharedNoteSchema;
export type NoteInput = z.infer<typeof noteSchema>;

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum([...KYC_STATUSES, "OPEN", "ALL"]).optional(),
  reviewer: z.string().optional(), // user id | "me" | "unassigned"
  sort: z.enum(["newest", "oldest"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
