import { apiHandler, parseBody } from "@/lib/api";
import { decisionSchema } from "@/modules/refunds/schemas";
import { decide } from "@/modules/refunds/service";

// POST /api/refunds/cases/:id/decisions  { action: APPROVE|REJECT|ESCALATE, reason, expectedStatus? }
export const POST = apiHandler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, decisionSchema);
  return decide(user, params.id, body);
});
