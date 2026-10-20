import { can, type SessionUser } from "@/lib/auth/permissions";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Feature-flag rules. Pure (no database access) so the same rules drive
 * server-side enforcement, the UI, and unit tests.
 */
export const ENVIRONMENTS = ["DEVELOPMENT", "STAGING", "PRODUCTION"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const ENVIRONMENT_META: Record<Environment, { label: string; short: string; description: string; tone: BadgeTone }> = {
  DEVELOPMENT: { label: "Development", short: "Dev", description: "Engineers' local and shared dev environments.", tone: "neutral" },
  STAGING: { label: "Staging", short: "Stg", description: "Pre-release environment that mirrors production.", tone: "warning" },
  PRODUCTION: { label: "Production", short: "Prod", description: "Live customers. Changes take effect immediately.", tone: "danger" },
};

/** Flag states as shown in the audit log (fromStatus / toStatus). */
export const FLAG_STATE_META: Record<string, { label: string; description: string; tone: BadgeTone }> = {
  ENABLED: { label: "On", description: "Feature is enabled.", tone: "success" },
  DISABLED: { label: "Off", description: "Feature is disabled.", tone: "neutral" },
};

export function isEnvironment(v: unknown): v is Environment {
  return typeof v === "string" && (ENVIRONMENTS as readonly string[]).includes(v);
}

export function requiresConfirmation(env: Environment) {
  return env === "PRODUCTION";
}

export type UpdateCheck = { allowed: boolean; reason?: string };

/** Whether `user` may change flags in `env`, with a plain-language reason when not. */
export function checkUpdate(user: SessionUser, env: Environment): UpdateCheck {
  if (!can(user, "flags:update")) return { allowed: false, reason: "Your role has read-only access to feature flags." };
  if (env === "PRODUCTION" && !can(user, "flags:update:production")) {
    return { allowed: false, reason: "Only Admins can change production flags." };
  }
  return { allowed: true };
}

/**
 * Configuration rules that apply regardless of who is asking. Returns an error
 * message for an invalid change, or null when the change is valid.
 */
export function validateChange(states: Partial<Record<Environment, boolean>>, env: Environment, enabled: boolean): string | null {
  if (states[env] === enabled) return `This flag is already ${enabled ? "on" : "off"} in ${ENVIRONMENT_META[env].label}.`;
  if (env === "PRODUCTION" && enabled && !states.STAGING) {
    return "Turn the flag on in Staging and verify it there before enabling it in Production.";
  }
  return null;
}
