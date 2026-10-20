import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { INTERNAL_APPS } from "@/config/apps";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getQueueStats } from "@/modules/kyc/service";
import { getDashboardStats } from "@/modules/refunds/service";
import { getFlagStats } from "@/modules/flags/service";

export default async function HomePage() {
  const user = await requireUser();
  const [stats, refundStats, flagStats] = await Promise.all([
    getQueueStats(user),
    can(user, "refunds:read") ? getDashboardStats(user) : null,
    can(user, "flags:read") ? getFlagStats(user, "PRODUCTION") : null,
  ]);
  const pending = (stats.byStatus.SUBMITTED ?? 0) + (stats.byStatus.IN_REVIEW ?? 0);
  const apps = INTERNAL_APPS.filter((a) => a.id !== "home");

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description="Pick a tool to get started. Each tool shows only what your role is allowed to see and do."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => {
          const allowed = app.status === "live" && (!app.permission || can(user, app.permission));
          const body = (
            <Card className={allowed ? "h-full p-5 transition hover:border-slate-300 hover:shadow-md" : "h-full p-5 opacity-60"}>
              <div className="flex items-start justify-between">
                <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
                  <app.icon className="h-5 w-5" />
                </span>
                {app.status === "coming-soon" ? (
                  <Badge>Coming soon</Badge>
                ) : !allowed ? (
                  <Badge>No access</Badge>
                ) : app.id === "kyc" ? (
                  <Badge tone="info">{pending} awaiting review</Badge>
                ) : app.id === "refunds" && refundStats ? (
                  <Badge tone="info">{refundStats.pending + refundStats.escalated} open</Badge>
                ) : app.id === "flags" && flagStats ? (
                  <Badge tone="info">{flagStats.enabled} on in production</Badge>
                ) : null}
              </div>
              <h2 className="mt-4 font-semibold text-slate-900">{app.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{app.description}</p>
              {allowed && (
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Open <ArrowRight className="h-4 w-4" />
                </p>
              )}
            </Card>
          );
          return allowed ? (
            <Link key={app.id} href={app.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={app.id}>{body}</div>
          );
        })}
      </div>
    </>
  );
}
