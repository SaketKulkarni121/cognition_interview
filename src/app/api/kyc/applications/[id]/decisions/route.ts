import { apiHandler, parseBody } from "@/lib/api";
import { decisionSchema } from "@/modules/kyc/schemas";
import { decide } from "@/modules/kyc/service";

// POST /api/kyc/applications/:id/decisions  { action, reason, expectedStatus? }
export const POST = apiHandler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, decisionSchema);
  return decide(user, params.id, body);
});
