import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const badgeTones = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
  info: "bg-blue-50 text-blue-700 ring-blue-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/25",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
