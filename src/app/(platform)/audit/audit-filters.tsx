"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input, Select } from "@/components/ui";
import { AUDIT_EVENTS, AUDIT_MODULES } from "@/components/audit/events";

export function AuditFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const selectedModule = params.get("module") ?? "";

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const modules = Object.entries(AUDIT_MODULES).filter(([m]) => !selectedModule || m === selectedModule);

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by reference, person, or reason" className="pl-9" aria-label="Search audit log" />
      </div>
      <Select aria-label="Filter by app" value={selectedModule} onChange={(e) => update({ module: e.target.value || null, action: null })} className="sm:w-44">
        <option value="">All apps</option>
        {Object.entries(AUDIT_MODULES).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Select aria-label="Filter by action" value={params.get("action") ?? ""} onChange={(e) => update({ action: e.target.value || null })} className="sm:w-52">
        <option value="">All actions</option>
        {modules.map(([m, label]) => (
          <optgroup key={m} label={label}>
            {Object.entries(AUDIT_EVENTS)
              .filter(([, ev]) => ev.module === m)
              .map(([action, ev]) => (
                <option key={action} value={action}>
                  {ev.short}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
    </div>
  );
}
