import { apiHandler } from "@/lib/api";
import { evaluateFlags } from "@/modules/flags/service";

// GET /api/flags/evaluate?env=PRODUCTION&keys=instant_refunds,new_checkout_experience
// -> { environment, flags: { instant_refunds: true, ... }, evaluatedAt }. Unknown keys are false.
export const GET = apiHandler(async ({ req, user }) => {
  const sp = new URL(req.url).searchParams;
  return evaluateFlags(user, { env: sp.get("env") ?? undefined, keys: sp.get("keys") ?? undefined });
});
