import { apiHandler } from "@/lib/api";
import { getFlag } from "@/modules/flags/service";

// GET /api/flags/:key — flag with all environment configs and change history
export const GET = apiHandler<{ key: string }>(async ({ user, params }) => getFlag(user, params.key));
