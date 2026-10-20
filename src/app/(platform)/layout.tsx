import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { INTERNAL_APPS } from "@/config/apps";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const allowed = INTERNAL_APPS.filter((a) => !a.permission || can(user, a.permission)).map((a) => a.id);
  return (
    <AppShell user={user} allowedAppIds={allowed}>
      {children}
    </AppShell>
  );
}
