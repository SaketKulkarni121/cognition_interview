import { apiHandler } from "@/lib/api";
import { currentEnvironment, isFeatureEnabled } from "@/lib/feature-flags";
import { parseInput } from "@/lib/validation";
import { environmentSchema } from "@/modules/flags/schemas";

/**
 * SAMPLE: how application code uses a feature flag. A real checkout service
 * would call isFeatureEnabled() the same way and render the matching flow.
 * GET /api/examples/checkout?env=STAGING   (env defaults to APP_ENV / DEVELOPMENT)
 */
export const GET = apiHandler(async ({ req }) => {
  const raw = new URL(req.url).searchParams.get("env");
  const environment = raw ? parseInput(environmentSchema, raw) : currentEnvironment();

  const useNewCheckout = await isFeatureEnabled("new_checkout_experience", environment);

  return {
    environment,
    flag: "new_checkout_experience",
    enabled: useNewCheckout,
    checkout: useNewCheckout
      ? { version: "new", steps: ["Review cart", "Pay with saved card"] }
      : { version: "classic", steps: ["Cart", "Shipping address", "Payment details", "Review", "Confirm"] },
  };
});
