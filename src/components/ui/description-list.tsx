import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Labelled group of read-only fields, e.g. "Personal details". */
export function DetailSection({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      {title && <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

export function DetailField({ label, value, mono, className }: { label: string; value: ReactNode; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={cn("mt-0.5 text-sm text-slate-900", mono && "font-mono")}>{value || "—"}</dd>
    </div>
  );
}
