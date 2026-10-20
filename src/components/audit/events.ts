import {
  AlertTriangle,
  ArrowUpCircle,
  BadgeCheck,
  CheckCircle2,
  FileInput,
  FilePlus2,
  HelpCircle,
  MessageSquare,
  RotateCcw,
  Send,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserMinus,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Human-readable descriptions for every audit action, across all internal apps. */
export type AuditEvent = { module: string; icon: LucideIcon; label: string; short: string; color: string };

const slate = "bg-slate-100 text-slate-600";

export const AUDIT_EVENTS: Record<string, AuditEvent> = {
  "kyc.application.submitted": { module: "kyc", icon: FileInput, label: "submitted the application", short: "Submitted", color: slate },
  "kyc.application.assigned": { module: "kyc", icon: UserCheck, label: "assigned the application", short: "Assigned", color: "bg-blue-100 text-blue-700" },
  "kyc.application.unassigned": { module: "kyc", icon: UserMinus, label: "removed the assigned reviewer", short: "Unassigned", color: slate },
  "kyc.application.approved": { module: "kyc", icon: CheckCircle2, label: "approved the application", short: "Approved", color: "bg-emerald-100 text-emerald-700" },
  "kyc.application.rejected": { module: "kyc", icon: XCircle, label: "rejected the application", short: "Rejected", color: "bg-red-100 text-red-700" },
  "kyc.application.info_requested": { module: "kyc", icon: HelpCircle, label: "requested more information", short: "Info requested", color: "bg-amber-100 text-amber-700" },
  "kyc.application.escalated": { module: "kyc", icon: ArrowUpCircle, label: "escalated to an Admin", short: "Escalated", color: "bg-violet-100 text-violet-700" },
  "kyc.application.review_resumed": { module: "kyc", icon: RotateCcw, label: "marked information as received", short: "Review resumed", color: "bg-blue-100 text-blue-700" },
  "kyc.note.added": { module: "kyc", icon: MessageSquare, label: "added a note", short: "Note added", color: slate },

  "refunds.case.created": { module: "refunds", icon: FilePlus2, label: "opened the refund request", short: "Request opened", color: slate },
  "refunds.case.approved": { module: "refunds", icon: CheckCircle2, label: "approved the refund", short: "Approved", color: "bg-emerald-100 text-emerald-700" },
  "refunds.case.rejected": { module: "refunds", icon: XCircle, label: "rejected the refund", short: "Rejected", color: "bg-red-100 text-red-700" },
  "refunds.case.escalated": { module: "refunds", icon: ArrowUpCircle, label: "escalated to an Admin", short: "Escalated", color: "bg-violet-100 text-violet-700" },
  "refunds.note.added": { module: "refunds", icon: MessageSquare, label: "added a note", short: "Note added", color: slate },
  "refunds.payment.requested": { module: "refunds", icon: Send, label: "sent the refund to the payment provider", short: "Refund requested", color: "bg-blue-100 text-blue-700" },
  "refunds.payment.succeeded": { module: "refunds", icon: BadgeCheck, label: "got confirmation that the refund was sent", short: "Refund sent", color: "bg-emerald-100 text-emerald-700" },
  "refunds.payment.failed": { module: "refunds", icon: AlertTriangle, label: "got an error from the payment provider", short: "Refund failed", color: "bg-red-100 text-red-700" },
  "refunds.payment.retried": { module: "refunds", icon: RotateCcw, label: "retried the failed refund", short: "Refund retried", color: "bg-blue-100 text-blue-700" },

  "flags.flag.created": { module: "flags", icon: FilePlus2, label: "created the flag", short: "Flag created", color: slate },
  "flags.flag.enabled": { module: "flags", icon: ToggleRight, label: "turned the flag on", short: "Turned on", color: "bg-emerald-100 text-emerald-700" },
  "flags.flag.disabled": { module: "flags", icon: ToggleLeft, label: "turned the flag off", short: "Turned off", color: "bg-slate-200 text-slate-700" },
};

export const AUDIT_MODULES: Record<string, string> = { kyc: "KYC Review", refunds: "Refunds", flags: "Feature Flags" };

/** Where an audited entity can be viewed. */
export const ENTITY_LINKS: Record<string, (id: string, ref: string | null) => string> = {
  KycApplication: (id) => `/kyc/${id}`,
  RefundCase: (id) => `/refunds/${id}`,
  FeatureFlag: (id, ref) => `/flags/${ref ?? id}`,
};

export function describeAuditAction(action: string) {
  return AUDIT_EVENTS[action]?.label ?? action;
}
