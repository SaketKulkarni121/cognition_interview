"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, CheckCircle2, HelpCircle, Loader2, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, Label, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { ACTION_META, MAX_REASON_LENGTH, MIN_REASON_LENGTH, type ActionAvailability, type KycAction, type KycStatus } from "@/modules/kyc/workflow";
import { apiPost } from "./api-client";

const STYLE: Record<KycAction, { icon: LucideIcon; button: "success" | "danger" | "warning" | "purple" | "secondary"; ring: string; text: string }> = {
  APPROVE: { icon: CheckCircle2, button: "success", ring: "hover:border-emerald-300 hover:bg-emerald-50/50", text: "text-emerald-600" },
  REJECT: { icon: XCircle, button: "danger", ring: "hover:border-red-300 hover:bg-red-50/50", text: "text-red-600" },
  REQUEST_INFO: { icon: HelpCircle, button: "warning", ring: "hover:border-amber-300 hover:bg-amber-50/50", text: "text-amber-600" },
  ESCALATE: { icon: ArrowUpCircle, button: "purple", ring: "hover:border-violet-300 hover:bg-violet-50/50", text: "text-violet-600" },
  RESUME_REVIEW: { icon: RotateCcw, button: "secondary", ring: "hover:border-blue-300 hover:bg-blue-50/50", text: "text-blue-600" },
};

export function DecisionPanel({ applicationId, status, actions }: { applicationId: string; status: KycStatus; actions: ActionAvailability[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<KycAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Primary four actions are always shown; "Info received" only when relevant.
  const visible = actions.filter((a) => a.action !== "RESUME_REVIEW" || status === "INFO_REQUESTED");
  const anyAllowed = visible.some((a) => a.allowed);
  const blockedReason = visible.find((a) => !a.allowed)?.reason;
  const trimmed = reason.trim();
  const tooShort = trimmed.length < MIN_REASON_LENGTH;

  async function submit() {
    if (!selected || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/kyc/applications/${applicationId}/decisions`, { action: selected, reason: trimmed, expectedStatus: status });
      setSuccess(`${ACTION_META[selected].pastTense}. The decision and your explanation were saved to the audit log.`);
      setSelected(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Decision" description={anyAllowed ? "Choose an outcome. You'll be asked to explain it." : undefined} />
      <CardBody className="space-y-4">
        {success && (
          <Alert tone="success" title="Saved">
            {success}
          </Alert>
        )}
        {!anyAllowed && blockedReason && <Alert tone="neutral">{blockedReason}</Alert>}

        {!selected && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {visible.map(({ action, allowed, reason: why }) => {
              const s = STYLE[action];
              const Icon = s.icon;
              return (
                <button
                  key={action}
                  type="button"
                  disabled={!allowed}
                  onClick={() => {
                    setSelected(action);
                    setSuccess(null);
                    setError(null);
                  }}
                  title={allowed ? ACTION_META[action].help : why}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition",
                    allowed ? s.ring : "cursor-not-allowed opacity-50",
                  )}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.text)} />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{ACTION_META[action].label}</span>
                    <span className="block text-xs text-slate-500">{ACTION_META[action].help}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className={cn("flex items-center gap-2 text-sm font-medium", STYLE[selected].text)}>
              {(() => {
                const Icon = STYLE[selected].icon;
                return <Icon className="h-4 w-4" />;
              })()}
              {ACTION_META[selected].label}
            </div>
            <p className="text-sm text-slate-600">{ACTION_META[selected].help}</p>
            <div>
              <Label htmlFor="reason">
                Explain your decision <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="reason"
                autoFocus
                rows={5}
                value={reason}
                maxLength={MAX_REASON_LENGTH}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ACTION_META[selected].placeholder}
                aria-describedby="reason-help"
              />
              <p id="reason-help" className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Required. Visible to other reviewers and recorded in the audit log.</span>
                <span className={cn(tooShort && "text-amber-600")}>{tooShort ? `${MIN_REASON_LENGTH - trimmed.length} more characters` : `${trimmed.length} characters`}</span>
              </p>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant={STYLE[selected].button} disabled={busy || tooShort}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm: {ACTION_META[selected].label}
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
