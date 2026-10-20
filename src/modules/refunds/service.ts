import { Prisma } from "@prisma/client";
import { db, type DbClient } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { assertCan, can, type SessionUser } from "@/lib/auth/permissions";
import { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError } from "@/lib/errors";
import { getPaymentProvider, type PaymentProvider } from "@/lib/payments";
import { formatMoney } from "@/lib/utils";
import { noteSchema, parseInput, type NoteInput } from "@/lib/validation";
import { ACTION_META, assessEligibility, availableActions, checkAction, isRefundStatus, isTerminal, nextStatus, type RefundStatus } from "./workflow";
import { decisionSchema, listQuerySchema, type DecisionInput, type ListQuery } from "./schemas";

/**
 * Refunds service layer. Every read/write takes the acting user explicitly and
 * enforces authorization + workflow rules; routes and pages are thin wrappers.
 */

const MODULE = "refunds";
const ENTITY = "RefundCase";
export const PAGE_SIZE = 12;

type Deps = { client?: typeof db; provider?: PaymentProvider };

const userSelect = { select: { id: true, name: true, role: true, title: true } } as const;

export async function listCases(actor: SessionUser, rawQuery: Partial<ListQuery> = {}, client: DbClient = db) {
  assertCan(actor, "refunds:read");
  const query = parseInput(listQuerySchema, rawQuery);
  const page = query.page ?? 1;
  const where: Prisma.RefundCaseWhereInput = {};
  if (query.status === "OPEN") where.status = { in: ["PENDING", "ESCALATED"] };
  else if (query.status && query.status !== "ALL") where.status = query.status;
  if (query.reason) where.reasonCategory = query.reason;
  if (query.q) {
    const q = query.q;
    where.OR = [
      { reference: { contains: q } },
      { customerName: { contains: q } },
      { customerEmail: { contains: q } },
      { supportTicketRef: { contains: q } },
      { transaction: { reference: { contains: q } } },
      { transaction: { merchantName: { contains: q } } },
    ];
  }
  const orderBy: Prisma.RefundCaseOrderByWithRelationInput =
    query.sort === "oldest" ? { submittedAt: "asc" } : query.sort === "amount" ? { amountRequested: "desc" } : { submittedAt: "desc" };

  const [items, total] = await Promise.all([
    client.refundCase.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        status: true,
        customerName: true,
        customerEmail: true,
        amountRequested: true,
        currency: true,
        reasonCategory: true,
        supportAgentName: true,
        submittedAt: true,
        transaction: { select: { reference: true, merchantName: true } },
        payout: { select: { status: true } },
      },
    }),
    client.refundCase.count({ where }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function getDashboardStats(actor: SessionUser, client: DbClient = db) {
  assertCan(actor, "refunds:read");
  const [grouped, refunded] = await Promise.all([
    client.refundCase.groupBy({ by: ["status"], _count: { _all: true }, _sum: { amountRequested: true } }),
    client.refundPayout.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
  ]);
  const count = (s: RefundStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const amount = (s: RefundStatus) => grouped.find((g) => g.status === s)?._sum.amountRequested ?? 0;
  return {
    pending: count("PENDING"),
    escalated: count("ESCALATED"),
    approved: count("APPROVED"),
    rejected: count("REJECTED"),
    totalRequested: grouped.reduce((sum, g) => sum + (g._sum.amountRequested ?? 0), 0),
    openRequested: amount("PENDING") + amount("ESCALATED"),
    refundedAmount: refunded._sum.amount ?? 0,
  };
}

export async function getCase(actor: SessionUser, id: string, client: DbClient = db) {
  assertCan(actor, "refunds:read");
  const refundCase = await client.refundCase.findUnique({
    where: { id },
    include: {
      transaction: true,
      notes: { orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { createdAt: "desc" }, include: { reviewer: userSelect } },
      payout: { include: { requestedBy: userSelect } },
    },
  });
  if (!refundCase) throw new NotFoundError("Refund case not found");

  const [history, earlierRefunds] = await Promise.all([
    client.auditLog.findMany({ where: { entityType: ENTITY, entityId: id }, orderBy: { createdAt: "desc" } }),
    client.refundPayout.aggregate({
      where: { status: "SUCCEEDED", case: { transactionId: refundCase.transactionId, id: { not: id } } },
      _sum: { amount: true },
    }),
  ]);
  const previouslyRefunded = earlierRefunds._sum.amount ?? 0;

  return {
    refundCase,
    history,
    eligibility: assessEligibility(refundCase, refundCase.transaction, previouslyRefunded, (c) => formatMoney(c, refundCase.currency)),
    permissions: {
      actions: availableActions(actor, refundCase),
      canNote: can(actor, "refunds:note"),
      canRetryPayment: can(actor, "refunds:payment:retry") && refundCase.payout?.status === "FAILED",
    },
  };
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Record a decision. Approving also creates the (single, unique) payout record
 * in the same transaction and then sends it to the payment provider.
 */
export async function decide(actor: SessionUser, id: string, input: DecisionInput, deps: Deps = {}) {
  const client = deps.client ?? db;
  assertCan(actor, "refunds:decide", "Your role has read-only access.");
  const { action, reason, expectedStatus } = parseInput(decisionSchema, input);
  const provider = action === "APPROVE" ? (deps.provider ?? getPaymentProvider()) : null;

  let result;
  try {
    result = await client.$transaction(async (tx) => {
      const c = await tx.refundCase.findUnique({ where: { id } });
      if (!c) throw new NotFoundError("Refund case not found");
      if (!isRefundStatus(c.status)) throw new InvalidTransitionError("Case has an unknown status");
      if (expectedStatus && expectedStatus !== c.status) {
        throw new ConflictError("This case was updated by someone else. Refresh to see the latest status.");
      }
      const check = checkAction(actor, c, action);
      if (!check.allowed) {
        if (!nextStatus(c.status, action)) throw new InvalidTransitionError(check.reason ?? "Invalid transition");
        throw new ForbiddenError(check.reason);
      }
      const toStatus = nextStatus(c.status, action)!;

      // Conditional update: only one concurrent request can move the case out of its current status.
      const updated = await tx.refundCase.updateMany({
        where: { id, status: c.status },
        data: { status: toStatus, decidedAt: isTerminal(toStatus) ? new Date() : null },
      });
      if (updated.count === 0) throw new ConflictError("This case was changed by someone else. Refresh and try again.");

      const decision = await tx.refundDecision.create({
        data: { caseId: id, reviewerId: actor.id, action, fromStatus: c.status, toStatus, reason },
      });
      await recordAudit(tx, {
        actor,
        module: MODULE,
        action: ACTION_META[action].auditAction,
        entityType: ENTITY,
        entityId: id,
        entityRef: c.reference,
        fromStatus: c.status,
        toStatus,
        reason,
        metadata: { decisionId: decision.id, amount: c.amountRequested, currency: c.currency },
      });

      let payoutId: string | null = null;
      if (provider) {
        const idempotencyKey = `refund:${c.id}`;
        const payout = await tx.refundPayout.create({
          data: { caseId: id, idempotencyKey, provider: provider.name, amount: c.amountRequested, currency: c.currency, status: "PROCESSING", requestedById: actor.id },
        });
        payoutId = payout.id;
        await recordAudit(tx, {
          actor,
          module: MODULE,
          action: "refunds.payment.requested",
          entityType: ENTITY,
          entityId: id,
          entityRef: c.reference,
          metadata: { payoutId, provider: provider.name, idempotencyKey, amount: c.amountRequested, currency: c.currency },
        });
      }
      return { decision, status: toStatus, payoutId };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError("A refund has already been sent for this case. It will not be sent again.");
    throw e;
  }

  const payout = result.payoutId && provider ? await sendPayout(actor, result.payoutId, provider, client) : null;
  return { decision: result.decision, status: result.status, payout };
}

/** Send a claimed (PROCESSING) payout to the provider and record the outcome. */
async function sendPayout(actor: SessionUser, payoutId: string, provider: PaymentProvider, client: typeof db) {
  const payout = await client.refundPayout.update({
    where: { id: payoutId },
    data: { attempts: { increment: 1 } },
    include: { case: { select: { id: true, reference: true, transaction: { select: { reference: true } } } } },
  });
  const audit = { actor, module: MODULE, entityType: ENTITY, entityId: payout.case.id, entityRef: payout.case.reference };

  let outcome: { ok: true; providerRefundId: string } | { ok: false; error: string };
  try {
    const res = await provider.createRefund({
      idempotencyKey: payout.idempotencyKey,
      amount: payout.amount,
      currency: payout.currency,
      transactionReference: payout.case.transaction.reference,
      metadata: { caseReference: payout.case.reference },
    });
    outcome = { ok: true, providerRefundId: res.providerRefundId };
  } catch (e) {
    outcome = { ok: false, error: e instanceof Error ? e.message : "Unknown payment provider error" };
  }

  return client.$transaction(async (tx) => {
    if (outcome.ok) {
      const p = await tx.refundPayout.update({
        where: { id: payoutId },
        data: { status: "SUCCEEDED", providerRefundId: outcome.providerRefundId, completedAt: new Date(), lastError: null },
      });
      await recordAudit(tx, { ...audit, action: "refunds.payment.succeeded", metadata: { payoutId, provider: provider.name, providerRefundId: outcome.providerRefundId } });
      return p;
    }
    const p = await tx.refundPayout.update({ where: { id: payoutId }, data: { status: "FAILED", lastError: outcome.error } });
    await recordAudit(tx, { ...audit, action: "refunds.payment.failed", metadata: { payoutId, provider: provider.name, error: outcome.error } });
    return p;
  });
}

/** Admin-only retry of a FAILED payout, reusing the original idempotency key. */
export async function retryPayout(actor: SessionUser, caseId: string, deps: Deps = {}) {
  const client = deps.client ?? db;
  assertCan(actor, "refunds:payment:retry", "Only Admins can retry a failed refund payment.");
  const payout = await client.refundPayout.findUnique({ where: { caseId }, include: { case: { select: { reference: true } } } });
  if (!payout) throw new NotFoundError("No refund payment exists for this case");
  if (payout.status === "SUCCEEDED") throw new ConflictError("This refund was already sent. It will not be sent again.");

  const claimed = await client.refundPayout.updateMany({ where: { id: payout.id, status: "FAILED" }, data: { status: "PROCESSING" } });
  if (claimed.count === 0) throw new ConflictError("This refund payment is already being processed.");
  await recordAudit(client, {
    actor,
    module: MODULE,
    action: "refunds.payment.retried",
    entityType: ENTITY,
    entityId: caseId,
    entityRef: payout.case.reference,
    metadata: { payoutId: payout.id, idempotencyKey: payout.idempotencyKey, previousError: payout.lastError },
  });
  return sendPayout(actor, payout.id, deps.provider ?? getPaymentProvider(), client);
}

export async function addNote(actor: SessionUser, id: string, input: NoteInput, client = db) {
  assertCan(actor, "refunds:note");
  const { body } = parseInput(noteSchema, input);
  return client.$transaction(async (tx) => {
    const c = await tx.refundCase.findUnique({ where: { id }, select: { id: true, reference: true } });
    if (!c) throw new NotFoundError("Refund case not found");
    const note = await tx.refundNote.create({
      data: { caseId: id, kind: "REVIEWER", authorId: actor.id, authorName: actor.name, authorTitle: actor.title ?? null, body },
    });
    await recordAudit(tx, { actor, module: MODULE, action: "refunds.note.added", entityType: ENTITY, entityId: id, entityRef: c.reference, metadata: { noteId: note.id } });
    return note;
  });
}
