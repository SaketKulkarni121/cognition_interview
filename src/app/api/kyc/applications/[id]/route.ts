import { apiHandler } from "@/lib/api";
import { getApplication } from "@/modules/kyc/service";

// GET /api/kyc/applications/:id — full application, documents, notes, decisions, history
export const GET = apiHandler<{ id: string }>(async ({ user, params }) => getApplication(user, params.id));
