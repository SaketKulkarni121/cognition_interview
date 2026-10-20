import { apiHandler } from "@/lib/api";
import { listApplications } from "@/modules/kyc/service";

// GET /api/kyc/applications?q=&status=&reviewer=&sort=&page=
export const GET = apiHandler(async ({ req, user }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  return listApplications(user, params);
});
