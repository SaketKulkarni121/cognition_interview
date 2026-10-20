import { can, type SessionUser } from "@/lib/auth/permissions";

/**
 * KYC application state machine. This file is pure (no database access) so the
 * same rules drive server-side enforcement, the UI, and unit tests.
 */
export const KYC_STATUSES = [
  "SUBMITTED",
  "IN_REVIEW",
  "INFO_REQUESTED",
  "ESCALATED",
  "APPROVED",
  "REJECTED",
] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const TERMINAL_STATUSES: readonly KycStatus[] = ["APPROVED", "REJECTED"];

export const STATUS_META: Record<
  KycStatus,
  { label: string; description: string; tone: "neutral" | "info" | "warning" | "danger" | "success" | "purple" }
> = {
  SUBMITTED: { label: "New", description: "Waiting for a reviewer to pick it up.", tone: "neutral" },
  IN_REVIEW: { label: "In review", description: "A reviewer is working on this application.", tone: "info" },
  INFO_REQUESTED: {
    label: "Awaiting customer",
    description: "More information was requested from the customer.",
    tone: "warning",
  },
  ESCALATED: { label: "Escalated", description: "Needs a decision from an Admin.", tone: "purple" },
  APPROVED: { label: "Approved", description: "The customer passed review.", tone: "success" },
  REJECTED: { label: "Rejected", description: "The application was declined.", tone: "danger" },
};

export const KYC_ACTIONS = ["APPROVE", "REJECT", "REQUEST_INFO", "ESCALATE", "RESUME_REVIEW"] as const;
export type KycAction = (typeof KYC_ACTIONS)[number];

export const ACTION_META: Record<
  KycAction,
  { label: string; pastTense: string; help: string; placeholder: string; auditAction: string }
> = {
  APPROVE: {
    label: "Approve",
    pastTense: "Approved",
    help: "The customer's identity and information check out. Their account can be opened.",
    placeholder: "e.g. Passport and proof of address match the profile; all details consistent.",
    auditAction: "kyc.application.approved",
  },
  REJECT: {
    label: "Reject",
    pastTense: "Rejected",
    help: "Decline the application. The customer will not be onboarded.",
    placeholder: "e.g. Name on the passport does not match the application and the customer did not respond.",
    auditAction: "kyc.application.rejected",
  },
  REQUEST_INFO: {
    label: "Request info",
    pastTense: "Requested information",
    help: "Ask the customer for missing or clearer documents before deciding.",
    placeholder: "e.g. Proof of address is older than 3 months — request a recent utility bill.",
    auditAction: "kyc.application.info_requested",
  },
  ESCALATE: {
    label: "Escalate",
    pastTense: "Escalated",
    help: "Send to an Admin for a second opinion when you are unsure or something looks unusual.",
    placeholder: "e.g. Source of funds is unclear for the stated monthly volume; need senior review.",
    auditAction: "kyc.application.escalated",
  },
  RESUME_REVIEW: {
    label: "Info received",
    pastTense: "Resumed review",
    help: "The customer has replied. Move the application back into review.",
    placeholder: "e.g. Customer uploaded a new utility bill dated last week.",
    auditAction: "kyc.application.review_resumed",
  },
};

/** Allowed transitions: action -> (from status -> to status). */
export const TRANSITIONS: Record<KycAction, Partial<Record<KycStatus, KycStatus>>> = {
  APPROVE: { IN_REVIEW: "APPROVED", ESCALATED: "APPROVED" },
  REJECT: { IN_REVIEW: "REJECTED", INFO_REQUESTED: "REJECTED", ESCALATED: "REJECTED" },
  REQUEST_INFO: { IN_REVIEW: "INFO_REQUESTED", ESCALATED: "INFO_REQUESTED" },
  ESCALATE: { IN_REVIEW: "ESCALATED", INFO_REQUESTED: "ESCALATED" },
  RESUME_REVIEW: { INFO_REQUESTED: "IN_REVIEW" },
};

export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 2000;

export function isKycStatus(v: unknown): v is KycStatus {
  return typeof v === "string" && (KYC_STATUSES as readonly string[]).includes(v);
}

export function isTerminal(status: KycStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export function nextStatus(from: KycStatus, action: KycAction): KycStatus | null {
  return TRANSITIONS[action][from] ?? null;
}

type AppLike = { status: string; assignedReviewerId: string | null };

export type ActionAvailability = { action: KycAction; allowed: boolean; reason?: string };

/**
 * Decide whether `user` may take `action` on `app`, combining the state machine
 * with role- and assignment-based rules. Returns a human-readable reason when not
 * allowed so the UI can explain *why* a button is disabled.
 */
export function checkAction(user: SessionUser, app: AppLike, action: KycAction): ActionAvailability {
  const status = app.status as KycStatus;
  if (!can(user, "kyc:decide")) {
    return { action, allowed: false, reason: "Your role has read-only access." };
  }
  if (isTerminal(status)) {
    return { action, allowed: false, reason: `This application is already ${STATUS_META[status].label.toLowerCase()}.` };
  }
  if (status === "SUBMITTED") {
    return { action, allowed: false, reason: "Assign a reviewer to start the review first." };
  }
  if (!nextStatus(status, action)) {
    return {
      action,
      allowed: false,
      reason: `Not available while the application is "${STATUS_META[status].label}".`,
    };
  }
  if (status === "ESCALATED" && !can(user, "kyc:decide:escalated")) {
    return { action, allowed: false, reason: "Escalated applications can only be decided by an Admin." };
  }
  const isAssignee = app.assignedReviewerId === user.id;
  if (!isAssignee && !can(user, "kyc:decide:unassigned")) {
    return { action, allowed: false, reason: "Only the assigned reviewer can take action on this application." };
  }
  return { action, allowed: true };
}

export function availableActions(user: SessionUser, app: AppLike): ActionAvailability[] {
  return KYC_ACTIONS.map((a) => checkAction(user, app, a));
}

export type AssignCheck = { allowed: boolean; reason?: string };

/** Who may set `targetReviewerId` (or null to unassign) on `app`. */
export function checkAssign(user: SessionUser, app: AppLike, targetReviewerId: string | null): AssignCheck {
  const status = app.status as KycStatus;
  if (!can(user, "kyc:assign:self")) return { allowed: false, reason: "Your role cannot assign applications." };
  if (isTerminal(status)) return { allowed: false, reason: "Closed applications cannot be reassigned." };
  if (can(user, "kyc:assign:any")) return { allowed: true };
  // Analysts: may claim an unassigned application, or release their own.
  if (targetReviewerId === user.id && app.assignedReviewerId === null) {
    if (status === "ESCALATED") return { allowed: false, reason: "Escalated applications are handled by Admins." };
    return { allowed: true };
  }
  if (targetReviewerId === null && app.assignedReviewerId === user.id) return { allowed: true };
  if (targetReviewerId !== null && targetReviewerId !== user.id) {
    return { allowed: false, reason: "Only Admins can assign applications to other reviewers." };
  }
  return { allowed: false, reason: "This application is assigned to another reviewer." };
}

/** Status side-effects of (un)assignment. */
export function statusAfterAssign(status: KycStatus, targetReviewerId: string | null): KycStatus {
  if (targetReviewerId && status === "SUBMITTED") return "IN_REVIEW";
  if (!targetReviewerId && status === "IN_REVIEW") return "SUBMITTED";
  return status;
}
