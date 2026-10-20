import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "./button";

/** Table footer: "Showing 1–12 of 40" with Previous/Next links. */
export function Pagination({ total, page, pageSize, hrefFor }: { total: number; page: number; pageSize: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span>{total === 0 ? "0 results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</span>
      {pages > 1 && (
        <div className="flex gap-2">
          <Link aria-disabled={page <= 1} href={hrefFor(page - 1)} className={cn(buttonClasses("secondary", "sm"), page <= 1 && "pointer-events-none opacity-50")}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Link>
          <Link aria-disabled={page >= pages} href={hrefFor(page + 1)} className={cn(buttonClasses("secondary", "sm"), page >= pages && "pointer-events-none opacity-50")}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
