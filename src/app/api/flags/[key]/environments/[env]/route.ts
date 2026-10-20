import { apiHandler, parseBody } from "@/lib/api";
import { updateSchema } from "@/modules/flags/schemas";
import { updateFlag } from "@/modules/flags/service";

// POST /api/flags/:key/environments/:env  { enabled, expectedVersion?, reason?, confirmation? }
// PRODUCTION requires confirmation === key and a reason.
export const POST = apiHandler<{ key: string; env: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, updateSchema);
  return { config: await updateFlag(user, params.key, params.env, body) };
});
