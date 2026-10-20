import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Accessible on/off switch (role="switch"). */
export function Switch({ checked, className, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "role"> & { checked: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-600" : "bg-slate-300",
        className,
      )}
      {...props}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
