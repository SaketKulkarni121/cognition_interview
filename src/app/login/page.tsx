import { ShieldAlert } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, isRole } from "@/lib/auth/permissions";
import { LoginOptions } from "./login-options";

export const metadata = { title: "Sign in (simulated)" };

export default async function LoginPage() {
  const [users, current] = await Promise.all([db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }), getCurrentUser()]);
  const options = users
    .filter((u) => isRole(u.role))
    .map((u) => ({
      id: u.id,
      name: u.name,
      title: u.title ?? "",
      role: u.role as keyof typeof ROLE_LABELS,
      roleLabel: ROLE_LABELS[u.role as keyof typeof ROLE_LABELS],
      roleDescription: ROLE_DESCRIPTIONS[u.role as keyof typeof ROLE_LABELS],
    }));
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">N</span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to Northstar Ops</h1>
          <p className="mt-1 text-sm text-slate-500">Choose a demo user to continue.</p>
        </div>
        <div className="mb-5 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Simulated authentication.</strong> There are no passwords — picking a user sets a demo cookie. Permissions are still enforced on the
            server for every request. All customer data is fictional.
          </p>
        </div>
        <LoginOptions options={options} currentId={current?.id ?? null} />
      </div>
    </div>
  );
}
