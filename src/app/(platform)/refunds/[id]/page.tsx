import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Alert, Avatar, Badge, Card, CardBody, CardHeader, DetailField, DetailSection } from "@/components/ui";
import { HistoryTimeline } from "@/components/audit/history-timeline";
import { Receipt } from "@/components/refunds/receipt";
import { RetryPaymentButton } from "@/components/refunds/retry-payment-button";
import { DecisionPanel } from "@/components/workflow/decision-panel";
import { NotesPanel } from "@/components/workflow/notes-panel";
import { ModuleStatusBadge } from "@/components/workflow/status-badge";
import { requireUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { cn, formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { getCase } from "@/modules/refunds/service";
import { ACTION_META, CHANNEL_LABELS, PAYOUT_STATUS_META, REASON_CATEGORIES, REFUND_WINDOW_DAYS, type RefundAction } from "@/modules/refunds/workflow";

export const metadata = { title: "Refund case" };

export default async function RefundCasePage(props: PageProps<"/refunds/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  let data;
  try {
    data = await getCase(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { refundCase: c, history, eligibility, permissions } = data;
  const t = c.transaction;
  const money = (cents: number) => formatMoney(cents, c.currency);
  const lastDecision = c.decisions[0];
  const payout = c.payout;
  const supportNotes = c.notes.filter((n) => n.kind === "SUPPORT");
  const reviewerNotes = c.notes.filter((n) => n.kind === "REVIEWER");

  let banner: { tone: "info" | "warning" | "success" | "danger" | "purple" | "neutral"; title: string; body: string };
  if (c.status === "APPROVED") {
    const by = `${lastDecision?.reviewer.name ?? "a reviewer"} on ${formatDate(c.decidedAt)}`;
    if (payout?.status === "FAILED") {
      banner = { tone: "danger", title: `Approved by ${by}, but the refund failed to send`, body: "The payment provider returned an error. An Admin can retry — the original idempotency key is reused, so the customer can never be refunded twice." };
    } else if (payout?.status === "PROCESSING") {
      banner = { tone: "info", title: `Approved by ${by} — refund is being sent`, body: "Waiting for the payment provider to confirm." };
    } else {
      banner = { tone: "success", title: `Approved by ${by} — ${money(c.amountRequested)} refunded`, body: "The payment provider confirmed the refund. It cannot be sent again." };
    }
  } else if (c.status === "REJECTED") {
    banner = { tone: "danger", title: `Rejected by ${lastDecision?.reviewer.name ?? "a reviewer"} on ${formatDate(c.decidedAt)}`, body: "No refund was sent. Support will explain the decision to the customer." };
  } else if (c.status === "ESCALATED") {
    banner = { tone: "purple", title: "Escalated — waiting for an Admin", body: "A reviewer asked for a second opinion. Only Admins can approve or reject escalated cases." };
  } else {
    banner = { tone: "info", title: "Waiting for a decision", body: "Read the complaint and support notes, compare with the receipt and eligibility checks, then record a decision on the right." };
  }

  const options = permissions.actions.map((a) => ({
    ...ACTION_META[a.action as RefundAction],
    action: a.action,
    allowed: a.allowed,
    reason: a.reason,
    confirmNote:
      a.action === "APPROVE"
        ? `Confirming sends a refund of ${money(c.amountRequested)} to ${t.paymentMethod} through the payment provider (simulated — no real money moves). A case can only be refunded once.`
        : undefined,
  }));

  return (
    <>
      <Link href="/refunds" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to refunds
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{c.customerName}</h1>
            <ModuleStatusBadge module="refunds" status={c.status} />
            {payout && <Badge tone={PAYOUT_STATUS_META[payout.status]?.tone}>{PAYOUT_STATUS_META[payout.status]?.label ?? payout.status}</Badge>}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{c.reference}</span> · Submitted {formatDateTime(c.submittedAt)}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Refund requested</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900">{money(c.amountRequested)}</p>
          <p className="text-xs text-slate-500">of {money(t.amount)} paid</p>
        </div>
      </div>

      <Alert tone={banner.tone} title={banner.title} className="mb-6">
        {banner.body}
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer complaint" description={`Reported to support by ${CHANNEL_LABELS[c.channel]?.toLowerCase() ?? c.channel}.`} />
            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge tone="warning">{REASON_CATEGORIES[c.reasonCategory] ?? c.reasonCategory}</Badge>
              </div>
              <blockquote className="whitespace-pre-wrap rounded-md border-l-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">{c.complaint}</blockquote>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Customer & transaction" description="Who is asking, and the purchase they want refunded." />
            <CardBody className="space-y-6">
              <DetailSection title="Customer">
                <DetailField label="Name" value={c.customerName} />
                <DetailField label="Email" value={c.customerEmail} />
                <DetailField label="Customer ID" value={c.customerId} mono />
                <DetailField label="Customer since" value={formatDate(c.customerSince)} />
              </DetailSection>
              <DetailSection title="Original purchase">
                <DetailField label="Merchant" value={t.merchantName} />
                <DetailField label="Purchase date" value={formatDateTime(t.purchasedAt)} />
                <DetailField label="Amount paid" value={money(t.amount)} />
                <DetailField label="Payment method" value={t.paymentMethod} />
                <DetailField label="Transaction ID" value={t.reference} mono />
                <DetailField label="Order number" value={t.orderNumber} mono />
              </DetailSection>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Receipt" description="Itemised receipt for the original purchase." />
            <CardBody>
              <Receipt transaction={t} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Support case" description="The support agent who handled the complaint and what they recorded." />
            <CardBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={c.supportAgentName} />
                <div>
                  <p className="text-sm font-medium text-slate-900">{c.supportAgentName}</p>
                  <p className="text-xs text-slate-500">{c.supportAgentTeam}</p>
                </div>
                <div className="ml-auto text-right text-xs text-slate-500">
                  <p>
                    Ticket <span className="font-mono text-slate-700">{c.supportTicketRef}</span>
                  </p>
                  <p>via {CHANNEL_LABELS[c.channel] ?? c.channel}</p>
                </div>
              </div>
              {supportNotes.length === 0 ? (
                <p className="text-sm text-slate-500">The support agent didn&apos;t leave notes.</p>
              ) : (
                <ol className="space-y-3 border-l border-slate-200 pl-4">
                  {[...supportNotes].reverse().map((n) => (
                    <li key={n.id}>
                      <p className="text-xs text-slate-500">
                        <span className="font-medium text-slate-900">{n.authorName}</span> · {formatDateTime(n.createdAt)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{n.body}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Case history" description="Every action taken on this case, newest first. This is read from the audit log." />
            <CardBody>
              <HistoryTimeline entries={history} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-12 xl:self-start">
          <DecisionPanel endpoint={`/api/refunds/cases/${c.id}/decisions`} status={c.status} options={options} />

          {payout && (
            <Card>
              <CardHeader title="Refund payment" description="Simulated payment provider — no real money moves." />
              <CardBody className="space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <DetailField label="Status" value={<Badge tone={PAYOUT_STATUS_META[payout.status]?.tone}>{PAYOUT_STATUS_META[payout.status]?.label ?? payout.status}</Badge>} />
                  <DetailField label="Amount" value={money(payout.amount)} />
                  <DetailField label="Provider" value={payout.provider === "mock" ? "Mock provider" : payout.provider} />
                  <DetailField label="Attempts" value={payout.attempts} />
                  <DetailField label="Provider refund ID" value={payout.providerRefundId} mono className="col-span-2 break-all" />
                  <DetailField label="Idempotency key" value={payout.idempotencyKey} mono className="col-span-2 break-all" />
                  <DetailField label="Sent by" value={payout.requestedBy.name} />
                  <DetailField label="Completed" value={payout.completedAt ? formatDateTime(payout.completedAt) : "—"} />
                </dl>
                {payout.lastError && <Alert tone="danger" title="Last error">{payout.lastError}</Alert>}
                {permissions.canRetryPayment && <RetryPaymentButton caseId={c.id} />}
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Refund eligibility" description="Policy facts to help you decide. Nothing here approves or rejects a case automatically." />
            <CardBody className="space-y-3">
              <ul className="space-y-3">
                {eligibility.map((e) => (
                  <li key={e.label} className="flex gap-2 text-sm">
                    {e.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                    <span>
                      <span className={cn("block font-medium", e.ok ? "text-slate-900" : "text-amber-800")}>{e.label}</span>
                      <span className="block text-xs text-slate-500">{e.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {c.eligibilityNote && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Support note on eligibility:</span> {c.eligibilityNote}
                </p>
              )}
              <p className="text-xs text-slate-400">Policy: refunds within {REFUND_WINDOW_DAYS} days of purchase, up to the amount paid.</p>
            </CardBody>
          </Card>

          {c.decisions.length > 0 && (
            <Card>
              <CardHeader title="Decision history" />
              <CardBody>
                <ul className="space-y-3">
                  {c.decisions.map((d) => (
                    <li key={d.id} className="text-sm">
                      <p className="text-slate-900">
                        <span className="font-medium">{ACTION_META[d.action as RefundAction]?.pastTense ?? d.action}</span>
                        <span className="text-slate-500"> · {d.reviewer.name} · {formatDate(d.createdAt)}</span>
                      </p>
                      <p className="mt-0.5 text-slate-600">{d.reason}</p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          <NotesPanel
            endpoint={`/api/refunds/cases/${c.id}/notes`}
            canNote={permissions.canNote}
            notes={reviewerNotes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: { name: n.authorName, title: n.authorTitle } }))}
          />
        </div>
      </div>
    </>
  );
}
