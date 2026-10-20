import type { Prisma } from "@prisma/client";
import { db, type DbClient } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { assertCan, can, type SessionUser } from "@/lib/auth/permissions";
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  ACTION_META,
  availableActions,
  checkAction,
  checkAssign,
  isKycStatus,
  nextStatus,
  statusAfterAssign,
  type KycStatus,
} from "./workflow";
import {
  assignSchema,
  decisionSchema,
  listQuerySchema,
  noteSchema,
  type AssignInput,
  type DecisionInput,
  type ListQuery,
  type NoteInput,
} from "./schemas";

/**
 * KYC service layer. All reads and writes go through these functions, which
 * take the acting user explicitly and enforce authorization + workflow rules.
 * Route handlers and server components are thin wrappers around them.
 */

const MODULE = "kyc";
const ENTITY = "KycApplication";
export const PAGE_SIZE = 12;

const reviewerSelect = { select: { id: true, name: true, role: true, title: true } } as const;

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } }, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? "Invalid input", r.error.issues);
  return r.data;
}

export async function listApplications(actor: SessionUser, rawQuery: Partial<ListQuery> = {}, client: DbClient = db) {
  assertCan(actor, "kyc:read");
  const query = parse(listQuerySchema, rawQuery);
  const page = query.page ?? 1;
  const where: Prisma.KycApplicationWhereInput = {};

  if (query.status === "OPEN") where.status = { notIn: ["APPROVED", "REJECTED"] };
  else if (query.status && query.status !== "ALL") where.status = query.status;

  if (query.reviewer === "me") where.assignedReviewerId = actor.id;
  else if (query.reviewer === "unassigned") where.assignedReviewerId = null;
  else if (query.reviewer) where.assignedReviewerId = query.reviewer;

  if (query.q) {
    const q = query.q;
    const parts = q.split(/\s+/).filter(Boolean);
    where.OR = [
      { reference: { contains: q } },
      { email: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      ...(parts.length > 1
        ? [{ AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] }]
        : []),
    ];
  }

  const [items, total] = await Promise.all([
    client.kycApplication.findMany({
      where,
      orderBy: { submittedAt: query.sort === "oldest" ? "asc" : "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        firstName: true,
        lastName: true,
        email: true,
        country: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
        assignedReviewer: reviewerSelect,
      },
    }),
    client.kycApplication.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function getQueueStats(actor: SessionUser, client: DbClient = db) {
  assertCan(actor, "kyc:read");
  const grouped = await client.kycApplication.groupBy({ by: ["status"], _count: { _all: true } });
  const byStatus = Object.fromEntries(grouped.map((g) => [g.status, g._count._all])) as Partial<Record<KycStatus, number>>;
  const assignedToMe = await client.kycApplication.count({
    where: { assignedReviewerId: actor.id, status: { notIn: ["APPROVED", "REJECTED"] } },
  });
  return { byStatus, assignedToMe };
}

export async function getApplication(actor: SessionUser, id: string, client: DbClient = db) {
  assertCan(actor, "kyc:read");
  const app = await client.kycApplication.findUnique({
    where: { id },
    include: {
      assignedReviewer: reviewerSelect,
      documents: { orderBy: { uploadedAt: "asc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: reviewerSelect } },
      decisions: { orderBy: { createdAt: "desc" }, include: { reviewer: reviewerSelect } },
    },
  });
  if (!app) throw new NotFoundError("Application not found");
  const history = await client.auditLog.findMany({
    where: { entityType: ENTITY, entityId: id },
    orderBy: { createdAt: "desc" },
  });
  return {
    application: app,
    history,
    permissions: {
      actions: availableActions(actor, app),
      canNote: can(actor, "kyc:note"),
      canAssignAny: can(actor, "kyc:assign:any"),
      canClaim: checkAssign(actor, app, actor.id).allowed && app.assignedReviewerId !== actor.id,
      canRelease: app.assignedReviewerId === actor.id && checkAssign(actor, app, null).allowed,
    },
  };
}

export async function listReviewers(actor: SessionUser, client: DbClient = db) {
  assertCan(actor, "kyc:read");
  return client.user.findMany({
    where: { role: { in: ["ADMIN", "ANALYST"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true, title: true },
  });
}

export async function assignApplication(actor: SessionUser, id: string, input: AssignInput, client = db) {
  assertCan(actor, "kyc:assign:self", "Your role cannot assign applications.");
  const { reviewerId } = parse(assignSchema, input);
  return client.$transaction(async (tx) => {
    const app = await tx.kycApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundError("Application not found");
    if (!isKycStatus(app.status)) throw new InvalidTransitionError("Application has an unknown status");

    const check = checkAssign(actor, app, reviewerId);
    if (!check.allowed) throw new ForbiddenError(check.reason);

    let reviewer: { id: string; name: string } | null = null;
    if (reviewerId) {
      const r = await tx.user.findUnique({ where: { id: reviewerId } });
      if (!r || !["ADMIN", "ANALYST"].includes(r.role)) {
        throw new ValidationError("Applications can only be assigned to Admins or Analysts");
      }
      reviewer = { id: r.id, name: r.name };
    }
    if (app.assignedReviewerId === reviewerId) return tx.kycApplication.findUniqueOrThrow({ where: { id } });

    const toStatus = statusAfterAssign(app.status, reviewerId);
    const updated = await tx.kycApplication.updateMany({
      where: { id, status: app.status, assignedReviewerId: app.assignedReviewerId },
      data: { assignedReviewerId: reviewerId, status: toStatus },
    });
    if (updated.count === 0) throw new ConflictError("This application was changed by someone else. Refresh and try again.");

    await recordAudit(tx, {
      actor,
      module: MODULE,
      action: reviewerId ? "kyc.application.assigned" : "kyc.application.unassigned",
      entityType: ENTITY,
      entityId: id,
      entityRef: app.reference,
      fromStatus: app.status,
      toStatus,
      metadata: { previousReviewerId: app.assignedReviewerId, reviewerId, reviewerName: reviewer?.name ?? null },
    });
    return tx.kycApplication.findUniqueOrThrow({ where: { id } });
  });
}

export async function decide(actor: SessionUser, id: string, input: DecisionInput, client = db) {
  assertCan(actor, "kyc:decide", "Your role has read-only access.");
  const { action, reason, expectedStatus } = parse(decisionSchema, input);
  return client.$transaction(async (tx) => {
    const app = await tx.kycApplication.findUnique({ where: { id } });
    if (!app) throw new NotFoundError("Application not found");
    if (!isKycStatus(app.status)) throw new InvalidTransitionError("Application has an unknown status");
    if (expectedStatus && expectedStatus !== app.status) {
      throw new ConflictError("This application was updated by someone else. Refresh to see the latest status.");
    }

    const check = checkAction(actor, app, action);
    if (!check.allowed) {
      // Distinguish "not allowed for you" from "not a valid move at all".
      const to = nextStatus(app.status, action);
      if (!to || app.status === "SUBMITTED") throw new InvalidTransitionError(check.reason ?? "Invalid transition");
      throw new ForbiddenError(check.reason);
    }
    const toStatus = nextStatus(app.status, action)!;
    const terminal = toStatus === "APPROVED" || toStatus === "REJECTED";

    const updated = await tx.kycApplication.updateMany({
      where: { id, status: app.status },
      data: { status: toStatus, decidedAt: terminal ? new Date() : null },
    });
    if (updated.count === 0) throw new ConflictError("This application was changed by someone else. Refresh and try again.");

    const decision = await tx.kycDecision.create({
      data: { applicationId: id, reviewerId: actor.id, action, fromStatus: app.status, toStatus, reason },
    });
    await recordAudit(tx, {
      actor,
      module: MODULE,
      action: ACTION_META[action].auditAction,
      entityType: ENTITY,
      entityId: id,
      entityRef: app.reference,
      fromStatus: app.status,
      toStatus,
      reason,
      metadata: { decisionId: decision.id },
    });
    return { decision, status: toStatus };
  });
}

export async function addNote(actor: SessionUser, id: string, input: NoteInput, client = db) {
  assertCan(actor, "kyc:note");
  const { body } = parse(noteSchema, input);
  return client.$transaction(async (tx) => {
    const app = await tx.kycApplication.findUnique({ where: { id }, select: { id: true, reference: true, status: true } });
    if (!app) throw new NotFoundError("Application not found");
    const note = await tx.kycNote.create({ data: { applicationId: id, authorId: actor.id, body } });
    await recordAudit(tx, {
      actor,
      module: MODULE,
      action: "kyc.note.added",
      entityType: ENTITY,
      entityId: id,
      entityRef: app.reference,
      metadata: { noteId: note.id },
    });
    return note;
  });
}

export async function getDocument(actor: SessionUser, documentId: string, client: DbClient = db) {
  assertCan(actor, "kyc:read");
  const doc = await client.kycDocument.findUnique({ where: { id: documentId }, include: { application: true } });
  if (!doc) throw new NotFoundError("Document not found");
  return doc;
}
