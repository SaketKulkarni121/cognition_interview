import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui";
import { AssignmentControl } from "@/components/kyc/assignment-control";
import { DecisionPanel } from "@/components/kyc/decision-panel";
import { DocumentsGallery } from "@/components/kyc/documents-gallery";
import { HistoryTimeline } from "@/components/kyc/history-timeline";
import { NotesPanel } from "@/components/kyc/notes-panel";
import { StatusBadge } from "@/components/kyc/status-badge";
import { requireUser } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getApplication, listReviewers } from "@/modules/kyc/service";
import { DOCUMENT_TYPE_LABELS } from "@/modules/kyc/documents";
import { ACTION_META, STATUS_META, isTerminal, type KycAction, type KycStatus } from "@/modules/kyc/workflow";

export const metadata = { title: "Review application" };

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-900 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

function age(dob: Date) {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

type DocRow = { id: string; type: string; fileName: string; documentNumber: string | null; issuingCountry: string | null; issuedAt: Date | null; expiresAt: Date | null; uploadedAt: Date };

function toDocumentViews(docs: DocRow[], now = Date.now()) {
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    typeLabel: DOCUMENT_TYPE_LABELS[d.type] ?? d.type,
    fileName: d.fileName,
    documentNumber: d.documentNumber,
    issuingCountry: d.issuingCountry,
    issuedAt: d.issuedAt?.toISOString() ?? null,
    expiresAt: d.expiresAt?.toISOString() ?? null,
    uploadedAt: d.uploadedAt.toISOString(),
    expired: !!d.expiresAt && d.expiresAt.getTime() < now,
  }));
}

export default async function ReviewPage(props: PageProps<"/kyc/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  let data;
  try {
    data = await getApplication(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const reviewers = await listReviewers(user);
  const { application: app, history, permissions } = data;
  const status = app.status as KycStatus;
  const lastDecision = app.decisions[0];
  const isMine = app.assignedReviewerId === user.id;

  let banner: { tone: "info" | "warning" | "success" | "danger" | "purple" | "neutral"; title: string; body: string };
  if (status === "APPROVED" || status === "REJECTED") {
    banner = {
      tone: status === "APPROVED" ? "success" : "danger",
      title: `${STATUS_META[status].label} by ${lastDecision?.reviewer.name ?? "a reviewer"} on ${formatDate(app.decidedAt)}`,
      body: "This application is closed. No further action is needed.",
    };
  } else if (status === "SUBMITTED") {
    banner = { tone: "neutral", title: "Not started", body: "Assign this application to a reviewer to begin the review." };
  } else if (status === "ESCALATED") {
    banner = { tone: "purple", title: "Escalated — waiting for an Admin", body: "A reviewer asked for a second opinion. Only Admins can make the final decision." };
  } else if (status === "INFO_REQUESTED") {
    banner = { tone: "warning", title: "Waiting on the customer", body: "More information was requested. When the customer replies, mark it as received to continue, or reject if they don't respond." };
  } else {
    banner = isMine
      ? { tone: "info", title: "This application is assigned to you", body: "Compare the documents with the customer profile, then record a decision on the right." }
      : { tone: "info", title: `In review${app.assignedReviewer ? ` by ${app.assignedReviewer.name}` : ""}`, body: "Only the assigned reviewer or an Admin can record a decision." };
  }

  const documents = toDocumentViews(app.documents);

  return (
    <>
      <Link href="/kyc" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {app.firstName} {app.lastName}
            </h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-mono">{app.reference}</span> · Submitted {formatDateTime(app.submittedAt)}
          </p>
        </div>
        <AssignmentControl
          applicationId={app.id}
          selfId={user.id}
          current={app.assignedReviewer}
          reviewers={reviewers}
          canAssignAny={permissions.canAssignAny}
          canClaim={permissions.canClaim}
          canRelease={permissions.canRelease}
          closed={isTerminal(status)}
        />
      </div>

      <Alert tone={banner.tone} title={banner.title} className="mb-6">
        {banner.body}
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer profile" description="Information the customer entered on their application." />
            <CardBody className="space-y-6">
              <Section title="Personal details">
                <Field label="Full name" value={`${app.firstName} ${app.lastName}`} />
                <Field label="Date of birth" value={`${formatDate(app.dateOfBirth)} (age ${age(app.dateOfBirth)})`} />
                <Field label="Nationality" value={app.nationality} />
                <Field label="Tax ID" value={`•••• ${app.taxIdLast4}`} mono />
              </Section>
              <Section title="Contact & address">
                <Field label="Email" value={app.email} />
                <Field label="Phone" value={app.phone} />
                <Field
                  label="Residential address"
                  value={
                    <>
                      {app.addressLine1}
                      {app.addressLine2 && <>, {app.addressLine2}</>}
                      <br />
                      {app.city}, {app.region} {app.postalCode}
                      <br />
                      {app.country}
                    </>
                  }
                />
              </Section>
              <Section title="Employment & account use">
                <Field label="Occupation" value={app.occupation} />
                <Field label="Employer" value={app.employer ?? "Self-employed / not provided"} />
                <Field label="Source of funds" value={app.sourceOfFunds} />
                <Field label="Expected monthly volume" value={app.expectedMonthlyVolume} />
                <Field label="Purpose of account" value={app.accountPurpose} />
              </Section>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`Identity documents (${documents.length})`} description="Fictional sample documents. Click to enlarge and compare with the profile above." />
            <CardBody>
              <DocumentsGallery documents={documents} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Application history" description="Every action taken on this application, newest first. This is read from the audit log." />
            <CardBody>
              <HistoryTimeline entries={history} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6 xl:sticky xl:top-12 xl:self-start">
          <DecisionPanel applicationId={app.id} status={status} actions={permissions.actions} />

          {app.decisions.length > 0 && (
            <Card>
              <CardHeader title="Previous decisions" />
              <CardBody>
                <ul className="space-y-3">
                  {app.decisions.map((d) => (
                    <li key={d.id} className="text-sm">
                      <p className="text-slate-900">
                        <span className="font-medium">{ACTION_META[d.action as KycAction]?.pastTense ?? d.action}</span>
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
            applicationId={app.id}
            canNote={permissions.canNote}
            notes={app.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), author: { name: n.author.name, title: n.author.title } }))}
          />
        </div>
      </div>
    </>
  );
}
