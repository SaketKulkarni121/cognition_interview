import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { can } from "@/lib/auth/permissions";
import { ConflictError, ForbiddenError, InvalidTransitionError, ValidationError } from "@/lib/errors";
import { MockPaymentProvider } from "@/lib/payments/mock-provider";
import { PaymentProviderError, type PaymentProvider, type RefundRequest } from "@/lib/payments/types";
import { addNote, decide, getCase, getDashboardStats, retryPayout } from "@/modules/refunds/service";
import { assessEligibility, checkAction, nextStatus } from "@/modules/refunds/workflow";
import { createRefundCase, createUsers, resetDb } from "./fixtures";

const REASON = "Courier confirmed the parcel was lost in transit.";

function spyProvider(impl?: (r: RefundRequest) => Promise<{ providerRefundId: string; status: "succeeded" }>) {
  const mock = new MockPaymentProvider();
  const createRefund = vi.fn(impl ?? ((r: RefundRequest) => mock.createRefund(r)));
  const provider: PaymentProvider = { name: "mock", simulated: true, createRefund };
  return { provider, createRefund };
}

const failing = () => Promise.reject(new PaymentProviderError("Card issuer unavailable"));

let users: Awaited<ReturnType<typeof createUsers>>;
beforeEach(async () => {
  await resetDb();
  users = await createUsers();
});

describe("refund permissions", () => {
  it("lets Admins and Analysts decide, Viewers only read, and only Admins decide escalations or retry payments", () => {
    expect(can({ role: "VIEWER" }, "refunds:read")).toBe(true);
    expect(can({ role: "VIEWER" }, "refunds:decide")).toBe(false);
    expect(can({ role: "VIEWER" }, "refunds:note")).toBe(false);
    expect(can({ role: "ANALYST" }, "refunds:decide")).toBe(true);
    expect(can({ role: "ANALYST" }, "refunds:decide:escalated")).toBe(false);
    expect(can({ role: "ANALYST" }, "refunds:payment:retry")).toBe(false);
    expect(can({ role: "ADMIN" }, "refunds:decide:escalated")).toBe(true);
    expect(can({ role: "ADMIN" }, "refunds:payment:retry")).toBe(true);
  });
});

describe("refund state machine", () => {
  it("allows only the defined transitions", () => {
    expect(nextStatus("PENDING", "APPROVE")).toBe("APPROVED");
    expect(nextStatus("PENDING", "REJECT")).toBe("REJECTED");
    expect(nextStatus("PENDING", "ESCALATE")).toBe("ESCALATED");
    expect(nextStatus("ESCALATED", "APPROVE")).toBe("APPROVED");
    expect(nextStatus("ESCALATED", "REJECT")).toBe("REJECTED");
    expect(nextStatus("ESCALATED", "ESCALATE")).toBeNull();
    for (const s of ["APPROVED", "REJECTED"] as const) {
      for (const a of ["APPROVE", "REJECT", "ESCALATE"] as const) expect(nextStatus(s, a)).toBeNull();
    }
  });

  it("explains why an action is unavailable", () => {
    expect(checkAction(users.viewer, { status: "PENDING" }, "APPROVE")).toMatchObject({ allowed: false, reason: "Your role has read-only access." });
    expect(checkAction(users.analyst, { status: "ESCALATED" }, "APPROVE").allowed).toBe(false);
    expect(checkAction(users.admin, { status: "ESCALATED" }, "APPROVE").allowed).toBe(true);
    expect(checkAction(users.admin, { status: "APPROVED" }, "REJECT").allowed).toBe(false);
  });

  it("reports eligibility facts without deciding", () => {
    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    const purchasedAt = new Date("2026-01-01");
    const late = assessEligibility({ amountRequested: 5000, submittedAt: new Date("2026-02-20") }, { amount: 5000, purchasedAt }, 0, money);
    expect(late.map((c) => c.ok)).toEqual([false, true, true]);
    const partial = assessEligibility({ amountRequested: 4000, submittedAt: new Date("2026-01-05") }, { amount: 5000, purchasedAt }, 2000, money);
    expect(partial.map((c) => c.ok)).toEqual([true, false, false]);
  });
});

describe("approving and executing refunds", () => {
  it("approves, sends exactly one refund to the provider, and audits every step", async () => {
    const c = await createRefundCase({ amountRequested: 4200 });
    const { provider, createRefund } = spyProvider();
    const res = await decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, { provider });

    expect(res.status).toBe("APPROVED");
    expect(res.payout).toMatchObject({ status: "SUCCEEDED", amount: 4200, attempts: 1 });
    expect(res.payout?.providerRefundId).toMatch(/^mock_re_/);
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(createRefund.mock.calls[0][0]).toMatchObject({ idempotencyKey: `refund:${c.id}`, amount: 4200, currency: "USD" });

    const audit = await db.auditLog.findMany({ where: { entityId: c.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["refunds.case.approved", "refunds.payment.requested", "refunds.payment.succeeded"]);
    expect(audit[0]).toMatchObject({ actorId: users.analyst.id, reason: REASON, fromStatus: "PENDING", toStatus: "APPROVED" });
  });

  it("never executes a second refund when the case is approved again", async () => {
    const c = await createRefundCase();
    const { provider, createRefund } = spyProvider();
    await decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, { provider });
    await expect(decide(users.admin, c.id, { action: "APPROVE", reason: REASON }, { provider })).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(await db.refundPayout.count({ where: { caseId: c.id } })).toBe(1);
  });

  it("lets only one of two simultaneous approvals through", async () => {
    const c = await createRefundCase();
    const { provider, createRefund } = spyProvider();
    const results = await Promise.allSettled([
      decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, { provider }),
      decide(users.admin, c.id, { action: "APPROVE", reason: REASON }, { provider }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(await db.refundPayout.count({ where: { caseId: c.id } })).toBe(1);
    expect(await db.refundDecision.count({ where: { caseId: c.id } })).toBe(1);
  });

  it("enforces one payout per case at the database level", async () => {
    const c = await createRefundCase();
    await decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, spyProvider());
    await expect(
      db.refundPayout.create({ data: { caseId: c.id, idempotencyKey: "another-key", provider: "mock", amount: 1, currency: "USD", status: "PROCESSING", requestedById: users.admin.id } }),
    ).rejects.toThrow();
  });

  it("keeps a failed payout retryable by Admins only, reusing the idempotency key, and never twice", async () => {
    const c = await createRefundCase();
    const bad = spyProvider(failing);
    const res = await decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, { provider: bad.provider });
    expect(res.status).toBe("APPROVED");
    expect(res.payout).toMatchObject({ status: "FAILED", lastError: "Card issuer unavailable" });

    const good = spyProvider();
    await expect(retryPayout(users.analyst, c.id, { provider: good.provider })).rejects.toBeInstanceOf(ForbiddenError);
    const retried = await retryPayout(users.admin, c.id, { provider: good.provider });
    expect(retried).toMatchObject({ status: "SUCCEEDED", attempts: 2 });
    expect(good.createRefund.mock.calls[0][0].idempotencyKey).toBe(bad.createRefund.mock.calls[0][0].idempotencyKey);

    await expect(retryPayout(users.admin, c.id, { provider: good.provider })).rejects.toBeInstanceOf(ConflictError);
    expect(good.createRefund).toHaveBeenCalledTimes(1);
    const actions = (await db.auditLog.findMany({ where: { entityId: c.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["refunds.payment.failed", "refunds.payment.retried", "refunds.payment.succeeded"]));
  });

  it("mock provider is idempotent per key", async () => {
    const p = new MockPaymentProvider();
    const req = { idempotencyKey: "k1", amount: 100, currency: "USD", transactionReference: "TXN-1" };
    const a = await p.createRefund(req);
    const b = await p.createRefund(req);
    expect(b.providerRefundId).toBe(a.providerRefundId);
    await expect(p.createRefund({ ...req, idempotencyKey: "k2", amount: 0 })).rejects.toBeInstanceOf(PaymentProviderError);
  });
});

describe("rejecting, escalating and authorization", () => {
  it("requires a reason and never contacts the provider on rejection", async () => {
    const c = await createRefundCase();
    const { provider, createRefund } = spyProvider();
    await expect(decide(users.analyst, c.id, { action: "REJECT", reason: "no" }, { provider })).rejects.toBeInstanceOf(ValidationError);
    const res = await decide(users.analyst, c.id, { action: "REJECT", reason: "Signed proof of delivery at the customer's address." }, { provider });
    expect(res).toMatchObject({ status: "REJECTED", payout: null });
    expect(createRefund).not.toHaveBeenCalled();
    await expect(decide(users.admin, c.id, { action: "APPROVE", reason: REASON }, { provider })).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(await db.refundPayout.count()).toBe(0);
  });

  it("routes escalated cases to Admins", async () => {
    const c = await createRefundCase();
    const { provider, createRefund } = spyProvider();
    await decide(users.analyst, c.id, { action: "ESCALATE", reason: "High value, new account; need a second opinion." }, { provider });
    await expect(decide(users.otherAnalyst, c.id, { action: "APPROVE", reason: REASON }, { provider })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decide(users.admin, c.id, { action: "ESCALATE", reason: "Escalating again for no reason." }, { provider })).rejects.toBeInstanceOf(InvalidTransitionError);
    const res = await decide(users.admin, c.id, { action: "APPROVE", reason: REASON }, { provider });
    expect(res.status).toBe("APPROVED");
    expect(createRefund).toHaveBeenCalledTimes(1);
  });

  it("blocks viewers from deciding or adding notes, and detects stale updates", async () => {
    const c = await createRefundCase();
    const { provider, createRefund } = spyProvider();
    await expect(decide(users.viewer, c.id, { action: "APPROVE", reason: REASON }, { provider })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(addNote(users.viewer, c.id, { body: "hi" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(decide(users.analyst, c.id, { action: "APPROVE", reason: REASON, expectedStatus: "ESCALATED" }, { provider })).rejects.toBeInstanceOf(ConflictError);
    expect(createRefund).not.toHaveBeenCalled();
    expect((await db.refundCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("PENDING");

    const { permissions } = await getCase(users.viewer, c.id);
    expect(permissions.actions.every((a) => !a.allowed)).toBe(true);
    expect(permissions.canNote).toBe(false);
  });

  it("audits reviewer notes and summarizes the dashboard", async () => {
    const c = await createRefundCase({ amountRequested: 1000 });
    await createRefundCase({ status: "ESCALATED", amountRequested: 2500 });
    await addNote(users.analyst, c.id, { body: "Asked courier for proof of delivery." });
    expect(await db.auditLog.findFirstOrThrow({ where: { entityId: c.id } })).toMatchObject({ action: "refunds.note.added", module: "refunds" });
    await decide(users.analyst, c.id, { action: "APPROVE", reason: REASON }, spyProvider());
    expect(await getDashboardStats(users.viewer)).toMatchObject({ pending: 0, escalated: 1, approved: 1, totalRequested: 3500, openRequested: 2500, refundedAmount: 1000 });
  });
});
