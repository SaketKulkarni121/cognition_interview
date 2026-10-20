import { apiHandler } from "@/lib/api";
import { listReviewers } from "@/modules/kyc/service";

export const GET = apiHandler(async ({ user }) => ({ reviewers: await listReviewers(user) }));
