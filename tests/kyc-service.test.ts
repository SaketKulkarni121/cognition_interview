import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ConflictError, ForbiddenError, InvalidTransitionError, ValidationError } from "@/lib/errors";
import { addNote, assignApplication, decide, getApplication, listApplications } from "@/modules/kyc/service";
import { createApplication, createUsers, resetDb } from "./fixtures";

let users: Awaited<ReturnType<typeof createUsers>>;

beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});

const REASON = "Documents match the profile and are valid.";

describe("approval workflow (database)", () => {
  it("runs claim → approve end to end, updating status and writing decision + audit records", async () => {
    const app = await createApplication();

    await assignApplication(users.analyst, app.id, { reviewerId: users.analyst.id });
    expect((await db.kycApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("IN_REVIEW");

    const result = await decide(users.analyst, app.id, { action: "APPROVE", reason: REASON, expectedStatus: "IN_REVIEW" });
    expect(result.status).toBe("APPROVED");

    const updated = await db.kycApplication.findUniqueOrThrow({ where: { id: app.id } });
    expect(updated.status).toBe("APPROVED");
    expect(updated.decidedAt).toBeInstanceOf(Date);

    const decisions = await db.kycDecision.findMany({ where: { applicationId: app.id } });
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ action: "APPROVE", fromStatus: "IN_REVIEW", toStatus: "APPROVED", reason: REASON, reviewerId: users.analyst.id });

    const audit = await db.auditLog.findMany({ where: { entityId: app.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["kyc.application.assigned", "kyc.application.approved"]);
    expect(audit[1]).toMatchObject({ actorId: users.analyst.id, actorName: users.analyst.name, actorRole: "ANALYST", reason: REASON, fromStatus: "IN_REVIEW", toStatus: "APPROVED" });
    expect(audit[1].createdAt).toBeInstanceOf(Date);
  });

  it("supports request info → info received → escalate → admin reject", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await decide(users.analyst, app.id, { action: "REQUEST_INFO", reason: "Need a recent utility bill." });
    await decide(users.analyst, app.id, { action: "RESUME_REVIEW", reason: "Customer uploaded the bill." });
    await decide(users.analyst, app.id, { action: "ESCALATE", reason: "Unusual source of funds." });
    await expect(decide(users.analyst, app.id, { action: "APPROVE", reason: REASON })).rejects.toBeInstanceOf(ForbiddenError);
    const res = await decide(users.admin, app.id, { action: "REJECT", reason: "Source of funds could not be verified." });
    expect(res.status).toBe("REJECTED");
    expect(await db.kycDecision.count({ where: { applicationId: app.id } })).toBe(4);
  });

  it("requires an explanation for every decision", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await expect(decide(users.analyst, app.id, { action: "APPROVE", reason: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(decide(users.analyst, app.id, { action: "APPROVE", reason: "   ok   " })).rejects.toBeInstanceOf(ValidationError);
    expect((await db.kycApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("IN_REVIEW");
    expect(await db.auditLog.count()).toBe(0);
  });

  it("rejects invalid state transitions without changing data", async () => {
    const approved = await createApplication({ status: "APPROVED", assignedReviewerId: users.analyst.id });
    await expect(decide(users.admin, approved.id, { action: "REJECT", reason: REASON })).rejects.toBeInstanceOf(InvalidTransitionError);

    const fresh = await createApplication();
    await expect(decide(users.admin, fresh.id, { action: "APPROVE", reason: REASON })).rejects.toBeInstanceOf(InvalidTransitionError);

    const waiting = await createApplication({ status: "INFO_REQUESTED", assignedReviewerId: users.analyst.id });
    await expect(decide(users.analyst, waiting.id, { action: "APPROVE", reason: REASON })).rejects.toBeInstanceOf(InvalidTransitionError);

    expect(await db.kycDecision.count()).toBe(0);
    expect(await db.auditLog.count()).toBe(0);
  });

  it("detects stale updates via expectedStatus", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await decide(users.admin, app.id, { action: "ESCALATE", reason: "Second opinion needed." });
    await expect(decide(users.analyst, app.id, { action: "APPROVE", reason: REASON, expectedStatus: "IN_REVIEW" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("server-side authorization (database)", () => {
  it("blocks viewers from deciding, assigning, or adding notes", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await expect(decide(users.viewer, app.id, { action: "APPROVE", reason: REASON })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(assignApplication(users.viewer, app.id, { reviewerId: users.viewer.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addNote(users.viewer, app.id, { body: "hello" })).rejects.toBeInstanceOf(ForbiddenError);
    expect((await db.kycApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("IN_REVIEW");
  });

  it("lets viewers read but reports no available actions", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    const { permissions } = await getApplication(users.viewer, app.id);
    expect(permissions.actions.every((a) => !a.allowed)).toBe(true);
    expect(permissions.canNote).toBe(false);
    const list = await listApplications(users.viewer, {});
    expect(list.total).toBe(1);
  });

  it("blocks analysts from deciding applications assigned to someone else", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.otherAnalyst.id });
    await expect(decide(users.analyst, app.id, { action: "APPROVE", reason: REASON })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks analysts from assigning applications to other people", async () => {
    const app = await createApplication();
    await expect(assignApplication(users.analyst, app.id, { reviewerId: users.otherAnalyst.id })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets admins reassign, and refuses to assign to a viewer", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await assignApplication(users.admin, app.id, { reviewerId: users.otherAnalyst.id });
    expect((await db.kycApplication.findUniqueOrThrow({ where: { id: app.id } })).assignedReviewerId).toBe(users.otherAnalyst.id);
    await expect(assignApplication(users.admin, app.id, { reviewerId: users.viewer.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it("records notes in the audit log", async () => {
    const app = await createApplication({ status: "IN_REVIEW", assignedReviewerId: users.analyst.id });
    await addNote(users.analyst, app.id, { body: "Checked address." });
    const audit = await db.auditLog.findFirstOrThrow({ where: { entityId: app.id } });
    expect(audit).toMatchObject({ action: "kyc.note.added", actorId: users.analyst.id });
  });
});
