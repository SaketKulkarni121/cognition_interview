import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { evaluateFlags, getFlag, listFlags, updateFlag } from "@/modules/flags/service";
import { checkUpdate, validateChange } from "@/modules/flags/workflow";
import { createFlag, createUsers, resetDb } from "./fixtures";

const PROD_REASON = "Staging verified for a week; enabling for customers.";

let users: Awaited<ReturnType<typeof createUsers>>;
beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});

async function envRow(flagId: string, environment: string) {
  return db.featureFlagEnvironment.findFirstOrThrow({ where: { flagId, environment } });
}

describe("feature flag permissions", () => {
  it("lets everyone read, Analysts change non-production, and only Admins change production", () => {
    expect(can({ role: "VIEWER" }, "flags:read")).toBe(true);
    expect(can({ role: "VIEWER" }, "flags:update")).toBe(false);
    expect(checkUpdate(users.analyst, "STAGING").allowed).toBe(true);
    expect(checkUpdate(users.analyst, "PRODUCTION")).toMatchObject({ allowed: false, reason: "Only Admins can change production flags." });
    expect(checkUpdate(users.admin, "PRODUCTION").allowed).toBe(true);
    expect(checkUpdate(users.viewer, "DEVELOPMENT").allowed).toBe(false);
  });

  it("blocks Viewers and Analysts server-side and leaves the flag unchanged", async () => {
    const f = await createFlag({ STAGING: true });
    await expect(updateFlag(users.viewer, f.key, "DEVELOPMENT", { enabled: true })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(updateFlag(users.analyst, f.key, "PRODUCTION", { enabled: true, confirmation: f.key, reason: PROD_REASON })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await envRow(f.id, "DEVELOPMENT")).enabled).toBe(false);
    expect((await envRow(f.id, "PRODUCTION")).enabled).toBe(false);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("reports per-environment permissions to the UI", async () => {
    const f = await createFlag();
    const { permissions } = await getFlag(users.analyst, f.key);
    expect(permissions.DEVELOPMENT.allowed).toBe(true);
    expect(permissions.PRODUCTION.allowed).toBe(false);
  });
});

describe("updating flags", () => {
  it("toggles a non-production flag, bumps the version and audits the change", async () => {
    const f = await createFlag();
    const row = await updateFlag(users.analyst, f.key, "DEVELOPMENT", { enabled: true, expectedVersion: 1 });
    expect(row).toMatchObject({ enabled: true, version: 2, updatedById: users.analyst.id });

    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: f.id } });
    expect(audit).toMatchObject({ module: "flags", action: "flags.flag.enabled", actorId: users.analyst.id, entityRef: f.key, fromStatus: "DISABLED", toStatus: "ENABLED" });
    expect(JSON.parse(audit.metadata!)).toMatchObject({ environment: "DEVELOPMENT", version: 2 });
  });

  it("requires the typed flag key and a reason for production changes", async () => {
    const f = await createFlag({ STAGING: true });
    await expect(updateFlag(users.admin, f.key, "PRODUCTION", { enabled: true, reason: PROD_REASON })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateFlag(users.admin, f.key, "PRODUCTION", { enabled: true, reason: PROD_REASON, confirmation: "wrong_key" })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateFlag(users.admin, f.key, "PRODUCTION", { enabled: true, confirmation: f.key, reason: "ok" })).rejects.toBeInstanceOf(ValidationError);
    expect((await envRow(f.id, "PRODUCTION")).enabled).toBe(false);

    await updateFlag(users.admin, f.key, "PRODUCTION", { enabled: true, confirmation: f.key, reason: PROD_REASON });
    expect((await envRow(f.id, "PRODUCTION")).enabled).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: f.id } });
    expect(audit.reason).toBe(PROD_REASON);
    expect(JSON.parse(audit.metadata!)).toMatchObject({ environment: "PRODUCTION", confirmed: true });
  });

  it("rejects invalid configurations", async () => {
    const f = await createFlag({ DEVELOPMENT: true });
    expect(validateChange({ STAGING: false }, "PRODUCTION", true)).toMatch(/Staging/);
    await expect(updateFlag(users.admin, f.key, "PRODUCTION", { enabled: true, confirmation: f.key, reason: PROD_REASON })).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(updateFlag(users.analyst, f.key, "DEVELOPMENT", { enabled: true })).rejects.toBeInstanceOf(InvalidTransitionError);
    await expect(updateFlag(users.analyst, f.key, "QA", { enabled: true })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateFlag(users.analyst, f.key, "STAGING", { enabled: "yes" as unknown as boolean })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateFlag(users.analyst, "does_not_exist", "STAGING", { enabled: true })).rejects.toBeInstanceOf(NotFoundError);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("rejects stale updates", async () => {
    const f = await createFlag();
    await updateFlag(users.analyst, f.key, "STAGING", { enabled: true, expectedVersion: 1 });
    await expect(updateFlag(users.otherAnalyst, f.key, "STAGING", { enabled: false, expectedVersion: 1 })).rejects.toBeInstanceOf(ConflictError);
    expect((await envRow(f.id, "STAGING")).enabled).toBe(true);
  });

  it("allows turning production off (kill switch) even when staging is off", async () => {
    const f = await createFlag({ STAGING: true, PRODUCTION: true });
    await updateFlag(users.analyst, f.key, "STAGING", { enabled: false });
    await updateFlag(users.admin, f.key, "PRODUCTION", { enabled: false, confirmation: f.key, reason: "Error rate spiked after release; disabling." });
    expect((await envRow(f.id, "PRODUCTION")).enabled).toBe(false);
  });
});

describe("evaluating flags", () => {
  it("returns per-environment values and fails closed for unknown flags", async () => {
    const f = await createFlag({ DEVELOPMENT: true, STAGING: true });
    expect(await isFeatureEnabled(f.key, "DEVELOPMENT")).toBe(true);
    expect(await isFeatureEnabled(f.key, "PRODUCTION")).toBe(false);
    expect(await isFeatureEnabled("no_such_flag", "DEVELOPMENT")).toBe(false);

    const res = await evaluateFlags(users.viewer, { env: "STAGING", keys: `${f.key},no_such_flag` });
    expect(res).toMatchObject({ environment: "STAGING", flags: { [f.key]: true, no_such_flag: false } });
    await expect(evaluateFlags(users.viewer, { env: "QA" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("lists and filters flags for the selected environment", async () => {
    await createFlag({ PRODUCTION: false, DEVELOPMENT: true });
    await createFlag({ STAGING: true, PRODUCTION: true });
    expect((await listFlags(users.viewer, { env: "PRODUCTION", state: "on" })).flags).toHaveLength(1);
    expect((await listFlags(users.viewer, { env: "DEVELOPMENT", state: "on" })).flags).toHaveLength(1);
    expect((await listFlags(users.viewer, { q: "test_flag" })).flags).toHaveLength(2);
  });
});
