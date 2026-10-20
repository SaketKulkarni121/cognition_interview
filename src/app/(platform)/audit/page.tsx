import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock, ScrollText } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, TBody, TD, TH, THead, TR, Table, buttonClasses } from "@/components/ui";
import { ModuleStatusBadge } from "@/components/workflow/status-badge";
import { AUDIT_MODULES, ENTITY_LINKS, describeAuditAction } from "@/components/audit/events";
import { AuditFilters } from "./audit-filters";
import { requireUser } from "@/lib/auth/session";
import { can, ROLE_LABELS, isRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { listAuditLog } from "@/lib/audit";
import { cn, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Audit Log" };

export default async function AuditPage(props: PageProps<"/audit">) {
  const user = await requireUser();
  if (!can(user, "audit:read")) {
    return (
      <Card>
        <EmptyState icon={Lock} title="You don't have access to the audit log" description="Ask an Admin if you need access. Your role can still see each application's own history." />
      </Card>
    );
  }
  const sp = await props.searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { items, total, page, pageSize } = await listAuditLog(db, { module: get("module"), action: get("action"), q: get("q"), page: Number(get("page") ?? 1) || 1 });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    next.set("page", String(p));
    return `/audit?${next}`;
  };

  return (
    <>
      <PageHeader title="Audit Log" description="A permanent, append-only record of every action across internal tools: who did it, when, and the reason they gave." />
      <Card>
        <AuditFilters />
        {items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries match" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>What</TH>
                <TH className="hidden md:table-cell">Status change</TH>
                <TH className="hidden lg:table-cell">Reason</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((e) => (
                <TR key={e.id} className="align-top">
                  <TD className="whitespace-nowrap text-xs text-slate-500">{formatDateTime(e.createdAt)}</TD>
                  <TD>
                    <p className="whitespace-nowrap font-medium text-slate-900">{e.actorName}</p>
                    <Badge className="mt-1">{isRole(e.actorRole) ? ROLE_LABELS[e.actorRole] : e.actorRole === "CUSTOMER" ? "Customer" : e.actorRole === "SUPPORT" ? "Support" : e.actorRole}</Badge>
                  </TD>
                  <TD>
                    <p className="text-slate-700">
                      {describeAuditAction(e.action)}
                      {(() => {
                        const env = e.metadata ? (JSON.parse(e.metadata) as { environmentLabel?: unknown }).environmentLabel : undefined;
                        return typeof env === "string" ? <span className="text-slate-500"> in {env}</span> : null;
                      })()}
                    </p>
                    <p className="text-xs text-slate-400">
                      {AUDIT_MODULES[e.module] ?? e.module}
                      {e.entityRef && " · "}
                      {e.entityRef &&
                        (ENTITY_LINKS[e.entityType] ? (
                          <Link href={ENTITY_LINKS[e.entityType](e.entityId, e.entityRef)} className="font-mono text-indigo-600 hover:underline">
                            {e.entityRef}
                          </Link>
                        ) : (
                          <span className="font-mono">{e.entityRef}</span>
                        ))}
                    </p>
                  </TD>
                  <TD className="hidden md:table-cell">
                    {e.fromStatus && e.toStatus && e.fromStatus !== e.toStatus ? (
                      <span className="flex flex-wrap items-center gap-1">
                        <ModuleStatusBadge module={e.module} status={e.fromStatus} /> → <ModuleStatusBadge module={e.module} status={e.toStatus} />
                      </span>
                    ) : e.toStatus && !e.fromStatus ? (
                      <ModuleStatusBadge module={e.module} status={e.toStatus} />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TD>
                  <TD className="hidden max-w-md text-slate-600 lg:table-cell">{e.reason ?? <span className="text-slate-400">—</span>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>{total} entries</span>
          {pages > 1 && (
            <div className="flex gap-2">
              <Link href={href(page - 1)} className={cn(buttonClasses("secondary", "sm"), page <= 1 && "pointer-events-none opacity-50")}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
              <span className="self-center">
                Page {page} of {pages}
              </span>
              <Link href={href(page + 1)} className={cn(buttonClasses("secondary", "sm"), page >= pages && "pointer-events-none opacity-50")}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
