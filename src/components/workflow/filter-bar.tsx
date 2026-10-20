"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";

export type FilterDef = {
  param: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  className?: string;
};

/**
 * URL-synced search box + select filters for list pages. State lives in the
 * query string so filtered views can be bookmarked and shared.
 */
export function FilterBar({
  searchPlaceholder,
  searchLabel,
  filters,
  preserve = [],
}: {
  searchPlaceholder: string;
  searchLabel: string;
  filters: FilterDef[];
  /** Query params kept when the user clicks Clear (e.g. a selected environment). */
  preserve?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [syncedQ, setSyncedQ] = useState(urlQ);
  const [pushedQ, setPushedQ] = useState<string | null>(null);
  if (urlQ !== syncedQ) {
    // URL changed from outside the search box (Clear, navigation): reflect it.
    setSyncedQ(urlQ);
    if (urlQ !== pushedQ) setQ(urlQ);
    setPushedQ(null);
  }

  function navigate(search: URLSearchParams) {
    const qs = search.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function update(patch: Record<string, string | null>) {
    // Read the live URL so a pending debounce never resurrects cleared filters.
    const next = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    if ("q" in patch) setPushedQ(patch.q ?? "");
    navigate(next);
  }

  // Debounced search-as-you-type.
  useEffect(() => {
    if (urlQ === q) return;
    const t = setTimeout(() => {
      if ((new URLSearchParams(window.location.search).get("q") ?? "") !== q.trim()) update({ q: q.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "sort", ...filters.map((f) => f.param)].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-9" aria-label={searchLabel} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
        {filters.map((f) => (
          <Select
            key={f.param}
            aria-label={f.label}
            value={params.get(f.param) ?? f.defaultValue}
            onChange={(e) => update({ [f.param]: e.target.value === f.defaultValue ? null : e.target.value })}
            className={f.className ?? "lg:w-44"}
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        ))}
      </div>
      <div className="flex h-9 items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-label="Loading" />}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setPushedQ(null);
              const kept = new URLSearchParams();
              for (const k of preserve) {
                const v = params.get(k);
                if (v) kept.set(k, v);
              }
              navigate(kept);
            }}
          >
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
