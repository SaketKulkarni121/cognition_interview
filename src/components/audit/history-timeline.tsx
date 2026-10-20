import { ArrowRight, FileInput } from "lucide-react";
import { ModuleStatusBadge } from "@/components/workflow/status-badge";
import { formatDateTime } from "@/lib/utils";
import { AUDIT_EVENTS } from "./events";

type Entry = {
  id: string;
  createdAt: Date;
  actorName: string;
  module: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  metadata: string | null;
};

/** Renders audit-log entries for one record as a vertical timeline. */
export function HistoryTimeline({ entries }: { entries: Entry[] }) {
  return (
    <ol className="relative space-y-5">
      {entries.map((e, i) => {
        const ev = AUDIT_EVENTS[e.action] ?? { icon: FileInput, label: e.action, color: "bg-slate-100 text-slate-600" };
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
                {typeof meta.environmentLabel === "string" && (
                  <>
                    {" "}in <span className="font-medium text-slate-900">{meta.environmentLabel}</span>
                  </>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {formatDateTime(e.createdAt)}
                {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus && (
                  <span className="inline-flex items-center gap-1">
                    <ModuleStatusBadge module={e.module} status={e.fromStatus} /> <ArrowRight className="h-3 w-3" /> <ModuleStatusBadge module={e.module} status={e.toStatus} />
                  </span>
                )}
                {typeof meta.providerRefundId === "string" && <span className="font-mono">{meta.providerRefundId}</span>}
              </p>
              {e.reason && <blockquote className="mt-2 rounded-md border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">{e.reason}</blockquote>}
              {typeof meta.error === "string" && <blockquote className="mt-2 rounded-md border-l-2 border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{meta.error}</blockquote>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
