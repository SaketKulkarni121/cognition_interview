import { apiHandler } from "@/lib/api";
import { listFlags } from "@/modules/flags/service";

// GET /api/flags?q=&env=&state=on|off
export const GET = apiHandler(async ({ req, user }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return listFlags(user, params);
});
