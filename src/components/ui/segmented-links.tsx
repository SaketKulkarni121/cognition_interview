import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tab-like selector where each option is a link (state lives in the URL). */
export function SegmentedLinks({ label, items }: { label: string; items: { label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={cn("rounded-md px-3 py-1.5 text-sm font-medium transition", i.active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
