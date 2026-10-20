import { apiHandler } from "@/lib/api";
import { getCase } from "@/modules/refunds/service";

// GET /api/refunds/cases/:id
export const GET = apiHandler<{ id: string }>(async ({ user, params }) => getCase(user, params.id));
