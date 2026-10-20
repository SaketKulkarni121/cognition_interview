import { apiHandler } from "@/lib/api";
import { getDashboardStats } from "@/modules/refunds/service";

// GET /api/refunds/stats
export const GET = apiHandler(async ({ user }) => getDashboardStats(user));
