import { DecisionPanel as SharedDecisionPanel, type DecisionTone } from "@/components/workflow/decision-panel";
import { ACTION_META, type ActionAvailability, type KycAction, type KycStatus } from "@/modules/kyc/workflow";

const TONE: Record<KycAction, DecisionTone> = { APPROVE: "success", REJECT: "danger", REQUEST_INFO: "warning", ESCALATE: "purple", RESUME_REVIEW: "neutral" };

export function DecisionPanel({ applicationId, status, actions }: { applicationId: string; status: KycStatus; actions: ActionAvailability[] }) {
  // Primary four actions are always shown; "Info received" only when relevant.
  const visible = actions.filter((a) => a.action !== "RESUME_REVIEW" || status === "INFO_REQUESTED");
  return (
    <SharedDecisionPanel
      endpoint={`/api/kyc/applications/${applicationId}/decisions`}
      status={status}
      options={visible.map((a) => ({ ...ACTION_META[a.action], action: a.action, tone: TONE[a.action], allowed: a.allowed, reason: a.reason }))}
    />
  );
}
