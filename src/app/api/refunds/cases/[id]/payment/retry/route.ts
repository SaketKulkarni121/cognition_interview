import { apiHandler } from "@/lib/api";
import { retryPayout } from "@/modules/refunds/service";

// POST /api/refunds/cases/:id/payment/retry  (Admin only; only for FAILED payouts)
export const POST = apiHandler<{ id: string }>(async ({ user, params }) => ({ payout: await retryPayout(user, params.id) }));
