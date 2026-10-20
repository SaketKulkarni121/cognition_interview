import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Avatar, Card, EmptyState, PageHeader, TBody, TD, TH, THead, TR, Table, buttonClasses } from "@/components/ui";
import { QueueFilters } from "@/components/kyc/queue-filters";
import { StatusBadge } from "@/components/kyc/status-badge";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { getQueueStats, listApplications, listReviewers } from "@/modules/kyc/service";
import { listQuerySchema } from "@/modules/kyc/schemas";

export const metadata = { title: "KYC Review Queue" };

function StatCard({ label, value, href, active, hint }: { label: string; value: number; href: string; active: boolean; hint: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md",
        active ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200",
      )}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </Link>
  );
}

export default async function KycQueuePage(props: PageProps<"/kyc">) {
  const user = await requireUser();
  const raw = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = listQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : {};
  const status = query.status ?? "OPEN";

  const [{ items, total, page, pageSize }, stats, reviewers] = await Promise.all([
    listApplications(user, { ...query, status }),
    getQueueStats(user),
    listReviewers(user),
  ]);
  const canWork = can(user, "kyc:decide");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(flat as Record<string, string>);
    sp.set("page", String(p));
    return `/kyc?${sp.toString()}`;
  };

  const cards = [
    { label: "New", value: stats.byStatus.SUBMITTED ?? 0, href: "/kyc?status=SUBMITTED", active: status === "SUBMITTED", hint: "Waiting for a reviewer" },
    { label: "In review", value: stats.byStatus.IN_REVIEW ?? 0, href: "/kyc?status=IN_REVIEW", active: status === "IN_REVIEW", hint: "Being worked on" },
    { label: "Awaiting customer", value: stats.byStatus.INFO_REQUESTED ?? 0, href: "/kyc?status=INFO_REQUESTED", active: status === "INFO_REQUESTED", hint: "More info requested" },
    { label: "Escalated", value: stats.byStatus.ESCALATED ?? 0, href: "/kyc?status=ESCALATED", active: status === "ESCALATED", hint: "Needs an Admin decision" },
    canWork
      ? { label: "Assigned to me", value: stats.assignedToMe, href: "/kyc?reviewer=me", active: query.reviewer === "me" && status === "OPEN", hint: "Your open applications" }
      : { label: "Decided", value: (stats.byStatus.APPROVED ?? 0) + (stats.byStatus.REJECTED ?? 0), href: "/kyc?status=ALL", active: status === "ALL", hint: "Approved or rejected" },
  ];

  return (
    <>
      <PageHeader
        title="KYC Review Queue"
        description="New customers must pass an identity review before their account opens. Click any application to see everything the customer submitted and record a decision."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
      <Card>
        <QueueFilters reviewers={reviewers} showMine={canWork} />
        {items.length === 0 ? (
          <EmptyState icon={Inbox} title="No applications match" description="Try clearing the search or choosing a different status." action={<Link href="/kyc" className={buttonClasses("secondary", "sm")}>Clear filters</Link>} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Reference</TH>
                <TH>Submitted</TH>
                <TH>Status</TH>
                <TH className="hidden sm:table-cell">Assigned reviewer</TH>
                <TH className="w-8" />
              </TR>
            </THead>
            <TBody>
              {items.map((a) => {
                const href = `/kyc/${a.id}`;
                const mine = a.assignedReviewer?.id === user.id;
                return (
                  <TR key={a.id} className="group relative hover:bg-slate-50">
                    <TD>
                      <Link href={href} className="font-medium text-slate-900 after:absolute after:inset-0">
                        {a.firstName} {a.lastName}
                      </Link>
                      <p className="text-xs text-slate-500">{a.email}</p>
                    </TD>
                    <TD className="hidden font-mono text-xs text-slate-600 md:table-cell">{a.reference}</TD>
                    <TD>
                      <p className="whitespace-nowrap">{formatDate(a.submittedAt)}</p>
                      <p className="text-xs text-slate-500">{timeAgo(a.submittedAt)}</p>
                    </TD>
                    <TD>
                      <StatusBadge status={a.status} />
                    </TD>
                    <TD className="hidden sm:table-cell">
                      {a.assignedReviewer ? (
                        <span className="flex items-center gap-2">
                          <Avatar name={a.assignedReviewer.name} size="xs" />
                          <span className="whitespace-nowrap">{a.assignedReviewer.name}</span>
                          {mine && <span className="text-xs text-indigo-600">(you)</span>}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unassigned</span>
                      )}
                    </TD>
                    <TD>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
          <span>
            {total === 0 ? "0 results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
          {pages > 1 && (
            <div className="flex gap-2">
              <Link aria-disabled={page <= 1} href={pageHref(page - 1)} className={cn(buttonClasses("secondary", "sm"), page <= 1 && "pointer-events-none opacity-50")}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
              <Link aria-disabled={page >= pages} href={pageHref(page + 1)} className={cn(buttonClasses("secondary", "sm"), page >= pages && "pointer-events-none opacity-50")}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
