import { can, type SessionUser } from "@/lib/auth/permissions";
import type { BadgeTone } from "@/components/ui/badge";

/**
 * Refund case state machine. Pure (no database access) so the same rules drive
 * server-side enforcement, the UI, and unit tests.
 */
export const REFUND_STATUSES = ["PENDING", "ESCALATED", "APPROVED", "REJECTED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const TERMINAL_STATUSES: readonly RefundStatus[] = ["APPROVED", "REJECTED"];

export const STATUS_META: Record<RefundStatus, { label: string; description: string; tone: BadgeTone }> = {
  PENDING: { label: "Pending", description: "Waiting for a reviewer to decide.", tone: "info" },
  ESCALATED: { label: "Escalated", description: "Needs a decision from an Admin.", tone: "purple" },
  APPROVED: { label: "Approved", description: "The refund was approved and sent to the payment provider.", tone: "success" },
  REJECTED: { label: "Rejected", description: "The refund request was declined.", tone: "danger" },
};

export const REFUND_ACTIONS = ["APPROVE", "REJECT", "ESCALATE"] as const;
export type RefundAction = (typeof REFUND_ACTIONS)[number];

export const ACTION_META: Record<
  RefundAction,
  { label: string; pastTense: string; help: string; placeholder: string; auditAction: string; tone: "success" | "danger" | "purple" }
> = {
  APPROVE: {
    label: "Approve",
    pastTense: "Approved",
    help: "Refund the customer. The refund is sent to the payment provider straight away.",
    placeholder: "e.g. Courier confirmed the parcel was lost; purchase is within the 30-day window.",
    auditAction: "refunds.case.approved",
    tone: "success",
  },
  REJECT: {
    label: "Reject",
    pastTense: "Rejected",
    help: "Decline the refund. Support will use your reason to explain it to the customer.",
    placeholder: "e.g. Tracking shows the order was delivered and signed for; no evidence of damage provided.",
    auditAction: "refunds.case.rejected",
    tone: "danger",
  },
  ESCALATE: {
    label: "Escalate",
    pastTense: "Escalated",
    help: "Send to an Admin when the case is unusual, high-value, or you're unsure.",
    placeholder: "e.g. Third refund request from this customer this quarter; needs a senior decision.",
    auditAction: "refunds.case.escalated",
    tone: "purple",
  },
};

/** Allowed transitions: action -> (from status -> to status). */
export const TRANSITIONS: Record<RefundAction, Partial<Record<RefundStatus, RefundStatus>>> = {
  APPROVE: { PENDING: "APPROVED", ESCALATED: "APPROVED" },
  REJECT: { PENDING: "REJECTED", ESCALATED: "REJECTED" },
  ESCALATE: { PENDING: "ESCALATED" },
};

export const REASON_CATEGORIES: Record<string, string> = {
  NOT_RECEIVED: "Item not received",
  DAMAGED: "Damaged or defective",
  NOT_AS_DESCRIBED: "Not as described",
  DUPLICATE_CHARGE: "Duplicate charge",
  CANCELLED_SUBSCRIPTION: "Cancelled subscription",
  UNRECOGNIZED: "Unrecognized charge",
};

export const CHANNEL_LABELS: Record<string, string> = { EMAIL: "Email", CHAT: "Live chat", PHONE: "Phone" };

export const PAYOUT_STATUS_META: Record<string, { label: string; tone: BadgeTone; description: string }> = {
  PROCESSING: { label: "Sending", tone: "info", description: "Waiting for the payment provider to confirm." },
  SUCCEEDED: { label: "Refund sent", tone: "success", description: "The payment provider confirmed the refund." },
  FAILED: { label: "Send failed", tone: "danger", description: "The payment provider returned an error. An Admin can retry." },
};

export const REFUND_WINDOW_DAYS = 30;

export function isRefundStatus(v: unknown): v is RefundStatus {
  return typeof v === "string" && (REFUND_STATUSES as readonly string[]).includes(v);
}

export function isTerminal(status: RefundStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export function nextStatus(from: RefundStatus, action: RefundAction): RefundStatus | null {
  return TRANSITIONS[action][from] ?? null;
}

export type ActionAvailability = { action: RefundAction; allowed: boolean; reason?: string };

/** Whether `user` may take `action` on a case, with a plain-language reason when not. */
export function checkAction(user: SessionUser, refundCase: { status: string }, action: RefundAction): ActionAvailability {
  const status = refundCase.status as RefundStatus;
  if (!can(user, "refunds:decide")) return { action, allowed: false, reason: "Your role has read-only access." };
  if (!isRefundStatus(status)) return { action, allowed: false, reason: "This case has an unknown status." };
  if (isTerminal(status)) {
    return { action, allowed: false, reason: `This refund request is already ${STATUS_META[status].label.toLowerCase()}.` };
  }
  if (!nextStatus(status, action)) {
    return { action, allowed: false, reason: `Not available while the case is "${STATUS_META[status].label}".` };
  }
  if (status === "ESCALATED" && !can(user, "refunds:decide:escalated")) {
    return { action, allowed: false, reason: "Escalated cases can only be decided by an Admin." };
  }
  return { action, allowed: true };
}

export function availableActions(user: SessionUser, refundCase: { status: string }): ActionAvailability[] {
  return REFUND_ACTIONS.map((a) => checkAction(user, refundCase, a));
}

export type EligibilityCheck = { label: string; ok: boolean; detail: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Policy facts shown to reviewers. Informational only: nothing here approves
 * or rejects a case automatically.
 */
export function assessEligibility(
  refundCase: { amountRequested: number; submittedAt: Date },
  transaction: { amount: number; purchasedAt: Date },
  previouslyRefunded: number,
  formatAmount: (cents: number) => string,
): EligibilityCheck[] {
  const days = Math.floor((refundCase.submittedAt.getTime() - transaction.purchasedAt.getTime()) / DAY_MS);
  const remaining = transaction.amount - previouslyRefunded;
  return [
    {
      label: `Requested within ${REFUND_WINDOW_DAYS} days of purchase`,
      ok: days <= REFUND_WINDOW_DAYS,
      detail: `Requested ${days} day${days === 1 ? "" : "s"} after purchase.`,
    },
    {
      label: "Amount is within what was paid",
      ok: refundCase.amountRequested <= remaining,
      detail:
        refundCase.amountRequested === transaction.amount
          ? `Full refund of ${formatAmount(transaction.amount)}.`
          : `${formatAmount(refundCase.amountRequested)} requested of ${formatAmount(remaining)} still refundable.`,
    },
    {
      label: "No earlier refund on this transaction",
      ok: previouslyRefunded === 0,
      detail: previouslyRefunded === 0 ? "This transaction has not been refunded before." : `${formatAmount(previouslyRefunded)} was already refunded.`,
    },
  ];
}
