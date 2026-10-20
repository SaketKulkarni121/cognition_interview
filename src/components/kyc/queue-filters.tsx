"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { KYC_STATUSES, STATUS_META } from "@/modules/kyc/workflow";

type Reviewer = { id: string; name: string };

export function QueueFilters({ reviewers, showMine }: { reviewers: Reviewer[]; showMine: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    if ((params.get("q") ?? "") === q) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "status", "reviewer", "sort"].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by customer name, email, or reference (e.g. KYC-10425)"
          className="pl-9"
          aria-label="Search applications"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
        <Select aria-label="Filter by status" value={params.get("status") ?? "OPEN"} onChange={(e) => update({ status: e.target.value === "OPEN" ? null : e.target.value })} className="lg:w-44">
          <option value="OPEN">All open</option>
          <option value="ALL">All statuses</option>
          {KYC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by reviewer" value={params.get("reviewer") ?? ""} onChange={(e) => update({ reviewer: e.target.value || null })} className="lg:w-44">
          <option value="">Any reviewer</option>
          {showMine && <option value="me">Assigned to me</option>}
          <option value="unassigned">Unassigned</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select aria-label="Sort" value={params.get("sort") ?? "newest"} onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })} className="col-span-2 sm:col-span-1 lg:w-36">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
      </div>
      <div className="flex h-9 items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading" />}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
