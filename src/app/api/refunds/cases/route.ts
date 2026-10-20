import { apiHandler } from "@/lib/api";
import { listCases } from "@/modules/refunds/service";

// GET /api/refunds/cases?q=&status=&reason=&sort=&page=
export const GET = apiHandler(async ({ req, user }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return listCases(user, params);
});
