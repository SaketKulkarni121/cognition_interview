"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; title: string; role: "ADMIN" | "ANALYST" | "VIEWER"; roleLabel: string; roleDescription: string };

export function LoginOptions({ options, currentId }: { options: Option[]; currentId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(id: string) {
    setPending(id);
    setError(null);
    const res = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) });
    if (!res.ok) {
      setError("Could not sign in. Please try again.");
      setPending(null);
      return;
    }
    router.push("/kyc");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => signIn(o.id)}
          disabled={pending !== null}
          className={cn(
            "flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md disabled:opacity-60",
            currentId === o.id ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200",
          )}
        >
          <Avatar name={o.name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{o.name}</span>
              <Badge tone={o.role === "ADMIN" ? "purple" : o.role === "ANALYST" ? "info" : "neutral"}>{o.roleLabel}</Badge>
              {currentId === o.id && <span className="text-xs text-indigo-600">Current</span>}
            </div>
            <p className="text-sm text-slate-500">{o.title}</p>
            <p className="mt-1 text-xs text-slate-400">{o.roleDescription}</p>
          </div>
          {pending === o.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
        </button>
      ))}
    </div>
  );
}
