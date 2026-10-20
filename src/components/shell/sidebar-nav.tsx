"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { INTERNAL_APPS } from "@/config/apps";

export function SidebarNav({ allowedIds, onNavigate }: { allowedIds: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const live = INTERNAL_APPS.filter((a) => a.status === "live" && allowedIds.includes(a.id));
  const soon = INTERNAL_APPS.filter((a) => a.status === "coming-soon");
  return (
    <nav className="flex flex-col gap-6" aria-label="Internal applications">
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Applications</p>
        {live.map((app) => {
          const active = app.href === "/" ? pathname === "/" : pathname.startsWith(app.href);
          return (
            <Link
              key={app.id}
              href={app.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <app.icon className="h-4 w-4" />
              {app.name}
            </Link>
          );
        })}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Coming soon</p>
        {soon.map((app) => (
          <span key={app.id} className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-400" title="Not built yet">
            <app.icon className="h-4 w-4" />
            {app.name}
          </span>
        ))}
      </div>
    </nav>
  );
}
