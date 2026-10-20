import type { Prisma } from "@prisma/client";
import { db, type DbClient } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { assertCan, type SessionUser } from "@/lib/auth/permissions";
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import { MIN_REASON_LENGTH, parseInput } from "@/lib/validation";
import { evaluateQuerySchema, listQuerySchema, updateSchema, type ListQuery, type UpdateInput } from "./schemas";
import { ENVIRONMENTS, ENVIRONMENT_META, checkUpdate, isEnvironment, requiresConfirmation, validateChange, type Environment } from "./workflow";

/**
 * Feature flag service layer: authorization, validation, optimistic
 * concurrency and audit logging for every change.
 */

const MODULE = "flags";
const ENTITY = "FeatureFlag";
const DAY = 24 * 60 * 60 * 1000;

const userSelect = { select: { id: true, name: true, role: true, title: true } } as const;
const envInclude = { environments: { include: { updatedBy: userSelect } } } as const;

type FlagWithEnvs = Prisma.FeatureFlagGetPayload<{ include: typeof envInclude }>;

function statesOf(flag: { environments: { environment: string; enabled: boolean }[] }) {
  return Object.fromEntries(flag.environments.map((e) => [e.environment, e.enabled])) as Partial<Record<Environment, boolean>>;
}

function permissionsFor(actor: SessionUser) {
  return Object.fromEntries(ENVIRONMENTS.map((env) => [env, checkUpdate(actor, env)])) as Record<Environment, ReturnType<typeof checkUpdate>>;
}

export async function listFlags(actor: SessionUser, rawQuery: Partial<ListQuery> = {}, client: DbClient = db) {
  assertCan(actor, "flags:read");
  const query = parseInput(listQuerySchema, rawQuery);
  const env = query.env ?? "DEVELOPMENT";
  const where: Prisma.FeatureFlagWhereInput = {};
  if (query.q) {
    where.OR = [{ key: { contains: query.q } }, { name: { contains: query.q } }, { description: { contains: query.q } }, { ownerTeam: { contains: query.q } }];
  }
  if (query.state) where.environments = { some: { environment: env, enabled: query.state === "on" } };
  const flags: FlagWithEnvs[] = await client.featureFlag.findMany({ where, orderBy: { name: "asc" }, include: envInclude });
  return { environment: env, flags, permissions: permissionsFor(actor) };
}

export async function getFlagStats(actor: SessionUser, env: Environment, client: DbClient = db) {
  assertCan(actor, "flags:read");
  const [total, enabled, changedThisWeek] = await Promise.all([
    client.featureFlag.count(),
    client.featureFlagEnvironment.count({ where: { environment: env, enabled: true } }),
    client.auditLog.count({ where: { module: MODULE, createdAt: { gte: new Date(Date.now() - 7 * DAY) } } }),
  ]);
  return { total, enabled, disabled: total - enabled, changedThisWeek };
}

export async function getFlag(actor: SessionUser, key: string, client: DbClient = db) {
  assertCan(actor, "flags:read");
  const flag = await client.featureFlag.findUnique({ where: { key }, include: envInclude });
  if (!flag) throw new NotFoundError(`No feature flag with key "${key}"`);
  const history = await client.auditLog.findMany({ where: { entityType: ENTITY, entityId: flag.id }, orderBy: { createdAt: "desc" } });
  return { flag, history, permissions: permissionsFor(actor) };
}

/**
 * Turn a flag on/off in one environment. Production changes must be confirmed
 * by re-typing the flag key and need a reason.
 */
export async function updateFlag(actor: SessionUser, key: string, environment: string, input: UpdateInput, client = db) {
  assertCan(actor, "flags:update", "Your role has read-only access to feature flags.");
  if (!isEnvironment(environment)) throw new ValidationError("Environment must be DEVELOPMENT, STAGING or PRODUCTION");
  const env = environment;
  const check = checkUpdate(actor, env);
  if (!check.allowed) throw new ForbiddenError(check.reason);
  const { enabled, expectedVersion, reason, confirmation } = parseInput(updateSchema, input);

  return client.$transaction(async (tx) => {
    const flag = await tx.featureFlag.findUnique({ where: { key }, include: { environments: true } });
    if (!flag) throw new NotFoundError(`No feature flag with key "${key}"`);
    const config = flag.environments.find((e) => e.environment === env);
    if (!config) throw new NotFoundError(`Flag "${key}" has no ${ENVIRONMENT_META[env].label} configuration`);

    if (requiresConfirmation(env)) {
      if (confirmation !== flag.key) throw new ValidationError(`Type the flag key "${flag.key}" to confirm this production change.`);
      if (!reason || reason.length < MIN_REASON_LENGTH) throw new ValidationError(`Explain why you're changing production (at least ${MIN_REASON_LENGTH} characters).`);
    }
    if (expectedVersion !== undefined && expectedVersion !== config.version) {
      throw new ConflictError("Someone else changed this flag since you loaded the page. Refresh and try again.");
    }
    const invalid = validateChange(statesOf(flag), env, enabled);
    if (invalid) throw new InvalidTransitionError(invalid);

    const updated = await tx.featureFlagEnvironment.updateMany({
      where: { id: config.id, version: config.version },
      data: { enabled, version: { increment: 1 }, updatedAt: new Date(), updatedById: actor.id },
    });
    if (updated.count === 0) throw new ConflictError("Someone else changed this flag at the same time. Refresh and try again.");

    await recordAudit(tx, {
      actor,
      module: MODULE,
      action: enabled ? "flags.flag.enabled" : "flags.flag.disabled",
      entityType: ENTITY,
      entityId: flag.id,
      entityRef: flag.key,
      fromStatus: config.enabled ? "ENABLED" : "DISABLED",
      toStatus: enabled ? "ENABLED" : "DISABLED",
      reason: reason ?? null,
      metadata: { environment: env, environmentLabel: ENVIRONMENT_META[env].label, version: config.version + 1, confirmed: requiresConfirmation(env) },
    });
    return tx.featureFlagEnvironment.findUniqueOrThrow({ where: { id: config.id }, include: { updatedBy: userSelect } });
  });
}

/** Flag values for one environment, for application code. Unknown keys evaluate to false. */
export async function evaluateFlags(actor: SessionUser, rawQuery: { env?: string; keys?: string }, client: DbClient = db) {
  assertCan(actor, "flags:read");
  const { env, keys } = parseInput(evaluateQuerySchema, rawQuery);
  const rows = await client.featureFlagEnvironment.findMany({
    where: { environment: env, ...(keys ? { flag: { key: { in: keys } } } : {}) },
    select: { enabled: true, flag: { select: { key: true } } },
  });
  const flags: Record<string, boolean> = Object.fromEntries(rows.map((r) => [r.flag.key, r.enabled]));
  for (const k of keys ?? []) flags[k] ??= false;
  return { environment: env, flags, evaluatedAt: new Date().toISOString() };
}
