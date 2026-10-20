import { ArrowRight, CheckCircle2, FileInput, HelpCircle, MessageSquare, RotateCcw, UserCheck, UserMinus, XCircle, ArrowUpCircle, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

type Entry = {
  id: string;
  createdAt: Date;
  actorName: string;
  actorRole: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  metadata: string | null;
};

const EVENTS: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  "kyc.application.submitted": { icon: FileInput, label: "submitted the application", color: "bg-slate-100 text-slate-600" },
  "kyc.application.assigned": { icon: UserCheck, label: "assigned the application", color: "bg-blue-100 text-blue-700" },
  "kyc.application.unassigned": { icon: UserMinus, label: "removed the assigned reviewer", color: "bg-slate-100 text-slate-600" },
  "kyc.application.approved": { icon: CheckCircle2, label: "approved the application", color: "bg-emerald-100 text-emerald-700" },
  "kyc.application.rejected": { icon: XCircle, label: "rejected the application", color: "bg-red-100 text-red-700" },
  "kyc.application.info_requested": { icon: HelpCircle, label: "requested more information", color: "bg-amber-100 text-amber-700" },
  "kyc.application.escalated": { icon: ArrowUpCircle, label: "escalated to an Admin", color: "bg-violet-100 text-violet-700" },
  "kyc.application.review_resumed": { icon: RotateCcw, label: "marked information as received", color: "bg-blue-100 text-blue-700" },
  "kyc.note.added": { icon: MessageSquare, label: "added a note", color: "bg-slate-100 text-slate-600" },
};

export function describeAuditAction(action: string) {
  return EVENTS[action]?.label ?? action;
}

export function HistoryTimeline({ entries }: { entries: Entry[] }) {
  return (
    <ol className="relative space-y-5">
      {entries.map((e, i) => {
        const ev = EVENTS[e.action] ?? { icon: FileInput, label: e.action, color: "bg-slate-100 text-slate-600" };
        const meta = e.metadata ? (JSON.parse(e.metadata) as Record<string, unknown>) : {};
        const Icon = ev.icon;
        return (
          <li key={e.id} className="relative flex gap-3">
            {i < entries.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-4px)] w-px bg-slate-200" aria-hidden />}
            <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${ev.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{e.actorName}</span> {ev.label}
                {e.action === "kyc.application.assigned" && typeof meta.reviewerName === "string" && (
                  <>
                    {" "}to <span className="font-medium text-slate-900">{meta.reviewerName}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {formatDateTime(e.createdAt)}
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                  <span className="inline-flex items-center gap-1">
                    <StatusBadge status={e.fromStatus} /> <ArrowRight className="h-3 w-3" /> <StatusBadge status={e.toStatus} />
                  </span>
                )}
              </p>
              {e.reason && <blockquote className="mt-2 rounded-md border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">{e.reason}</blockquote>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
