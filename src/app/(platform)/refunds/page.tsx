import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Pagination, StatCard, TBody, TD, TH, THead, TR, Table, buttonClasses } from "@/components/ui";
import { RefundFilters } from "@/components/refunds/refund-filters";
import { ModuleStatusBadge } from "@/components/workflow/status-badge";
import { requireUser } from "@/lib/auth/session";
import { formatDate, formatMoney, timeAgo } from "@/lib/utils";
import { listQuerySchema } from "@/modules/refunds/schemas";
import { getDashboardStats, listCases } from "@/modules/refunds/service";
import { PAYOUT_STATUS_META, REASON_CATEGORIES } from "@/modules/refunds/workflow";

export const metadata = { title: "Refunds" };

export default async function RefundsPage(props: PageProps<"/refunds">) {
  const user = await requireUser();
  const raw = await props.searchParams;
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = listQuerySchema.safeParse(flat);
  const query = parsed.success ? parsed.data : {};
  const status = query.status ?? "ALL";

  const [{ items, total, page, pageSize }, stats] = await Promise.all([listCases(user, { ...query, status }), getDashboardStats(user)]);
  const pageHref = (p: number) => {
    const sp = new URLSearchParams(flat as Record<string, string>);
    sp.set("page", String(p));
    return `/refunds?${sp.toString()}`;
  };

  const cards = [
    { label: "Pending requests", value: stats.pending, href: "/refunds?status=PENDING", active: status === "PENDING", hint: "Waiting for a decision" },
    { label: "Total requested", value: formatMoney(stats.totalRequested), href: "/refunds", active: false, hint: `${formatMoney(stats.openRequested)} still open` },
    { label: "Approved", value: stats.approved, href: "/refunds?status=APPROVED", active: status === "APPROVED", hint: `${formatMoney(stats.refundedAmount)} refunded` },
    { label: "Rejected", value: stats.rejected, href: "/refunds?status=REJECTED", active: status === "REJECTED", hint: "No refund sent" },
    { label: "Escalated", value: stats.escalated, href: "/refunds?status=ESCALATED", active: status === "ESCALATED", hint: "Needs an Admin decision" },
  ];

  return (
    <>
      <PageHeader
        title="Refunds"
        description="Customers ask support for their money back; support passes the request here. Open a case to see the purchase, the complaint, and the support history, then approve, reject, or escalate it."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>
      <Card>
        <RefundFilters />
        {items.length === 0 ? (
          <EmptyState icon={Inbox} title="No refund cases match" description="Try clearing the search or choosing a different status." action={<Link href="/refunds" className={buttonClasses("secondary", "sm")}>Clear filters</Link>} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Customer</TH>
                <TH className="hidden md:table-cell">Case</TH>
                <TH className="text-right">Amount</TH>
                <TH className="hidden lg:table-cell">Reason</TH>
                <TH>Submitted</TH>
                <TH>Status</TH>
                <TH className="hidden xl:table-cell">Support agent</TH>
                <TH className="w-8" />
              </TR>
            </THead>
            <TBody>
              {items.map((c) => {
                const payout = c.payout ? PAYOUT_STATUS_META[c.payout.status] : null;
                return (
                  <TR key={c.id} className="group relative hover:bg-slate-50">
                    <TD>
                      <Link href={`/refunds/${c.id}`} className="font-medium text-slate-900 after:absolute after:inset-0">
                        {c.customerName}
                      </Link>
                      <p className="text-xs text-slate-500">{c.customerEmail}</p>
                    </TD>
                    <TD className="hidden md:table-cell">
                      <p className="font-mono text-xs text-slate-600">{c.reference}</p>
                      <p className="text-xs text-slate-500">{c.transaction.merchantName}</p>
                    </TD>
                    <TD className="whitespace-nowrap text-right font-medium tabular-nums text-slate-900">{formatMoney(c.amountRequested, c.currency)}</TD>
                    <TD className="hidden lg:table-cell">{REASON_CATEGORIES[c.reasonCategory] ?? c.reasonCategory}</TD>
                    <TD>
                      <p className="whitespace-nowrap">{formatDate(c.submittedAt)}</p>
                      <p className="text-xs text-slate-500">{timeAgo(c.submittedAt)}</p>
                    </TD>
                    <TD>
                      <div className="flex flex-col items-start gap-1">
                        <ModuleStatusBadge module="refunds" status={c.status} />
                        {payout && <Badge tone={payout.tone}>{payout.label}</Badge>}
                      </div>
                    </TD>
                    <TD className="hidden whitespace-nowrap xl:table-cell">{c.supportAgentName}</TD>
                    <TD>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <Pagination total={total} page={page} pageSize={pageSize} hrefFor={pageHref} />
      </Card>
    </>
  );
}
