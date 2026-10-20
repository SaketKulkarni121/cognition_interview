"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Menu, ShieldAlert, X } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { ROLE_LABELS, type SessionUser } from "@/lib/auth/permissions";
import { SidebarNav } from "./sidebar-nav";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">N</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-slate-900">Northstar Ops</span>
        <span className="block text-xs text-slate-500">Internal tools</span>
      </span>
    </Link>
  );
}

function UserCard({ user }: { user: SessionUser }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.title}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <Badge tone={user.role === "ADMIN" ? "purple" : user.role === "ANALYST" ? "info" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
        <Link href="/login" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
          Switch user
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ user, allowedAppIds, children }: { user: SessionUser; allowedAppIds: string[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <SidebarNav allowedIds={allowedAppIds} onNavigate={() => setOpen(false)} />
      </div>
      <UserCard user={user} />
    </div>
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900">
        <ShieldAlert className="h-3.5 w-3.5" />
        Simulated authentication — demo environment with fictional data. Signed in as {user.name} ({ROLE_LABELS[user.role]}).
      </div>
      <aside className="fixed bottom-0 left-0 top-[28px] z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Brand />
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100" aria-label="Open navigation">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close navigation">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
