import { z } from "zod";
import { reasonSchema } from "@/lib/validation";
import { REFUND_ACTIONS, REFUND_STATUSES } from "./workflow";

export const decisionSchema = z.object({
  action: z.enum(REFUND_ACTIONS, { message: "Choose a valid action" }),
  reason: reasonSchema,
  expectedStatus: z.enum(REFUND_STATUSES).optional(),
});
export type DecisionInput = z.infer<typeof decisionSchema>;

export const listQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum([...REFUND_STATUSES, "OPEN", "ALL"]).optional(),
  reason: z.string().optional(),
  sort: z.enum(["newest", "oldest", "amount"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;
