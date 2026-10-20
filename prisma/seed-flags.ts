/**
 * Fictional feature flags with per-environment states and change history.
 * Invariant kept by the seed (and enforced by the app): a flag is only on in
 * Production if it is also on in Staging.
 */
import type { PrismaClient } from "@prisma/client";

type Actor = { id: string; name: string; role: string };
type UserKey = "admin" | "marcus" | "elena" | "jordan";
type Env = "DEVELOPMENT" | "STAGING" | "PRODUCTION";
const LABEL: Record<Env, string> = { DEVELOPMENT: "Development", STAGING: "Staging", PRODUCTION: "Production" };
const HOUR = 60 * 60 * 1000;

type Change = { env: Env; enabled: boolean; by: UserKey; hoursAgo: number; reason?: string };
type FlagSeed = { key: string; name: string; description: string; ownerTeam: string; createdDaysAgo: number; changes: Change[] };

const flags: FlagSeed[] = [
  {
    key: "instant_refunds", name: "Instant refunds", ownerTeam: "Payments",
    description: "Approved refunds under $500 are paid out to the customer's card in seconds instead of 3–5 business days.",
    createdDaysAgo: 40,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "jordan", hoursAgo: 700 },
      { env: "STAGING", enabled: true, by: "elena", hoursAgo: 300 },
      { env: "PRODUCTION", enabled: true, by: "admin", hoursAgo: 120, reason: "Staging soak test passed for 7 days with no failed payouts. Rolling out to all customers." },
    ],
  },
  {
    key: "fraud_detection_model_v2", name: "Fraud detection model v2", ownerTeam: "Risk Engineering",
    description: "Scores card transactions with the retrained v2 model. When off, the v1 model is used. Final fraud decisions stay with human analysts.",
    createdDaysAgo: 25,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "marcus", hoursAgo: 500 },
      { env: "STAGING", enabled: true, by: "marcus", hoursAgo: 90 },
    ],
  },
  {
    key: "new_checkout_experience", name: "New checkout experience", ownerTeam: "Growth",
    description: "Single-page checkout with saved payment methods and address autocomplete.",
    createdDaysAgo: 60,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "jordan", hoursAgo: 1300 },
      { env: "STAGING", enabled: true, by: "jordan", hoursAgo: 800 },
      { env: "PRODUCTION", enabled: true, by: "admin", hoursAgo: 400, reason: "Launch approved by the product review." },
      { env: "PRODUCTION", enabled: false, by: "admin", hoursAgo: 30, reason: "Kill switch: checkout error rate rose from 0.4% to 2.1% after release. Reverting to the classic checkout while Growth investigates." },
    ],
  },
  {
    key: "enhanced_transaction_notifications", name: "Enhanced transaction notifications", ownerTeam: "Mobile",
    description: "Rich push notifications with merchant logo, location and a one-tap 'This wasn't me' button.",
    createdDaysAgo: 18,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "elena", hoursAgo: 380 },
      { env: "STAGING", enabled: true, by: "elena", hoursAgo: 48 },
    ],
  },
  {
    key: "multi_currency_wallets", name: "Multi-currency wallets", ownerTeam: "Accounts",
    description: "Lets customers hold balances in EUR and GBP alongside USD.",
    createdDaysAgo: 9,
    changes: [{ env: "DEVELOPMENT", enabled: true, by: "jordan", hoursAgo: 150 }],
  },
  {
    key: "card_freeze_self_service", name: "Self-service card freeze", ownerTeam: "Mobile",
    description: "Customers can freeze and unfreeze their card from the app without calling support.",
    createdDaysAgo: 120,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "elena", hoursAgo: 2600 },
      { env: "STAGING", enabled: true, by: "elena", hoursAgo: 2300 },
      { env: "PRODUCTION", enabled: true, by: "admin", hoursAgo: 2000, reason: "Launched after support-team training." },
    ],
  },
  {
    key: "kyc_queue_auto_assignment", name: "KYC queue auto-assignment", ownerTeam: "Internal Tools",
    description: "Assigns new KYC applications round-robin to available analysts. Analysts still make every decision.",
    createdDaysAgo: 5,
    changes: [],
  },
  {
    key: "payout_batching", name: "Payout batching", ownerTeam: "Payments",
    description: "Groups merchant payouts into hourly batches to reduce provider fees.",
    createdDaysAgo: 75,
    changes: [
      { env: "DEVELOPMENT", enabled: true, by: "marcus", hoursAgo: 1700 },
      { env: "DEVELOPMENT", enabled: false, by: "marcus", hoursAgo: 1500, reason: "Paused — waiting on provider batch API." },
    ],
  },
];

export async function seedFlags(prisma: PrismaClient, users: Record<UserKey, Actor>) {
  const now = Date.now();
  for (const f of flags) {
    const createdAt = new Date(now - f.createdDaysAgo * 24 * HOUR);
    const flag = await prisma.featureFlag.create({ data: { key: f.key, name: f.name, description: f.description, ownerTeam: f.ownerTeam, createdAt } });
    const state: Record<Env, { id: string; enabled: boolean; version: number }> = {} as never;
    for (const env of ["DEVELOPMENT", "STAGING", "PRODUCTION"] as Env[]) {
      const row = await prisma.featureFlagEnvironment.create({ data: { flagId: flag.id, environment: env, enabled: false, updatedAt: createdAt, updatedById: users.admin.id } });
      state[env] = { id: row.id, enabled: false, version: 1 };
    }
    await prisma.auditLog.create({
      data: {
        actorId: users.admin.id, actorName: users.admin.name, actorRole: users.admin.role, module: "flags", action: "flags.flag.created",
        entityType: "FeatureFlag", entityId: flag.id, entityRef: f.key, createdAt, metadata: JSON.stringify({ ownerTeam: f.ownerTeam }),
      },
    });
    for (const c of [...f.changes].sort((a, b) => b.hoursAgo - a.hoursAgo)) {
      const actor = users[c.by];
      const at = new Date(now - c.hoursAgo * HOUR);
      const s = state[c.env];
      if (c.env === "PRODUCTION" && c.enabled && !state.STAGING.enabled) throw new Error(`Seed for ${f.key} enables Production before Staging`);
      await prisma.featureFlagEnvironment.update({ where: { id: s.id }, data: { enabled: c.enabled, version: s.version + 1, updatedAt: at, updatedById: actor.id } });
      await prisma.auditLog.create({
        data: {
          actorId: actor.id, actorName: actor.name, actorRole: actor.role, module: "flags", action: c.enabled ? "flags.flag.enabled" : "flags.flag.disabled",
          entityType: "FeatureFlag", entityId: flag.id, entityRef: f.key, createdAt: at, reason: c.reason ?? null,
          fromStatus: s.enabled ? "ENABLED" : "DISABLED", toStatus: c.enabled ? "ENABLED" : "DISABLED",
          metadata: JSON.stringify({ environment: c.env, environmentLabel: LABEL[c.env], version: s.version + 1, confirmed: c.env === "PRODUCTION" }),
        },
      });
      state[c.env] = { ...s, enabled: c.enabled, version: s.version + 1 };
    }
  }
  return flags.length;
}
