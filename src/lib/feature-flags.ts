import { db, type DbClient } from "./db";
import { isEnvironment, type Environment } from "@/modules/flags/workflow";

/**
 * How application code checks a flag. Reads the database directly (no user
 * session needed) and fails closed: unknown flags or environments are off.
 *
 *   if (await isFeatureEnabled("new_checkout_experience")) { ... }
 */
export function currentEnvironment(): Environment {
  const env = process.env.APP_ENV?.toUpperCase();
  return isEnvironment(env) ? env : "DEVELOPMENT";
}

export async function isFeatureEnabled(key: string, environment: Environment = currentEnvironment(), client: DbClient = db): Promise<boolean> {
  const row = await client.featureFlagEnvironment.findFirst({
    where: { environment, flag: { key } },
    select: { enabled: true },
  });
  return row?.enabled ?? false;
}
