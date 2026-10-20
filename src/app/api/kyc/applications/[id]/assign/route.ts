import { apiHandler, parseBody } from "@/lib/api";
import { assignSchema } from "@/modules/kyc/schemas";
import { assignApplication } from "@/modules/kyc/service";

// POST /api/kyc/applications/:id/assign  { reviewerId: string | null }
export const POST = apiHandler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, assignSchema);
  return { application: await assignApplication(user, params.id, body) };
});
