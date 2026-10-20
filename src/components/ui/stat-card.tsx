import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Clickable summary metric, typically linking to a pre-filtered list. */
export function StatCard({ label, value, hint, href, active }: { label: string; value: ReactNode; hint?: ReactNode; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md",
        active ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200",
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Link>
  );
}
