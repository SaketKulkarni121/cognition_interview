"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, CheckCircle2, HelpCircle, Loader2, RotateCcw, XCircle, type LucideIcon } from "lucide-react";
import { Alert, Button, Card, CardBody, CardHeader, Label, Textarea } from "@/components/ui";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MAX_REASON_LENGTH, MIN_REASON_LENGTH } from "@/lib/validation";

export type DecisionTone = "success" | "danger" | "warning" | "purple" | "neutral";

export type DecisionOption = {
  action: string;
  label: string;
  pastTense: string;
  help: string;
  placeholder: string;
  tone: DecisionTone;
  allowed: boolean;
  /** Why the action is unavailable (shown when not allowed). */
  reason?: string;
  /** Extra consequence shown on the confirmation step. */
  confirmNote?: string;
};

const TONES: Record<DecisionTone, { icon: LucideIcon; button: "success" | "danger" | "warning" | "purple" | "secondary"; ring: string; text: string }> = {
  success: { icon: CheckCircle2, button: "success", ring: "hover:border-emerald-300 hover:bg-emerald-50/50", text: "text-emerald-600" },
  danger: { icon: XCircle, button: "danger", ring: "hover:border-red-300 hover:bg-red-50/50", text: "text-red-600" },
  warning: { icon: HelpCircle, button: "warning", ring: "hover:border-amber-300 hover:bg-amber-50/50", text: "text-amber-600" },
  purple: { icon: ArrowUpCircle, button: "purple", ring: "hover:border-violet-300 hover:bg-violet-50/50", text: "text-violet-600" },
  neutral: { icon: RotateCcw, button: "secondary", ring: "hover:border-blue-300 hover:bg-blue-50/50", text: "text-blue-600" },
};

/**
 * Shared "record a human decision" panel: pick an action, explain it (required),
 * confirm. POSTs { action, reason, expectedStatus } to `endpoint`; the server
 * re-checks every rule.
 */
export function DecisionPanel({ endpoint, status, options }: { endpoint: string; status: string; options: DecisionOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const current = options.find((o) => o.action === selected) ?? null;
  const anyAllowed = options.some((o) => o.allowed);
  const blockedReason = options.find((o) => !o.allowed)?.reason;
  const trimmed = reason.trim();
  const tooShort = trimmed.length < MIN_REASON_LENGTH;

  async function submit() {
    if (!current || tooShort) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(endpoint, { action: current.action, reason: trimmed, expectedStatus: status });
      setSuccess(`${current.pastTense}. The decision and your explanation were saved to the audit log.`);
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

        {!current && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {options.map((o) => {
              const s = TONES[o.tone];
              const Icon = s.icon;
              return (
                <button
                  key={o.action}
                  type="button"
                  disabled={!o.allowed}
                  onClick={() => {
                    setSelected(o.action);
                    setSuccess(null);
                    setError(null);
                  }}
                  title={o.allowed ? o.help : o.reason}
                  className={cn("flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition", o.allowed ? s.ring : "cursor-not-allowed opacity-50")}
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.text)} />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{o.label}</span>
                    <span className="block text-xs text-slate-500">{o.help}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {current && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className={cn("flex items-center gap-2 text-sm font-medium", TONES[current.tone].text)}>
              {(() => {
                const Icon = TONES[current.tone].icon;
                return <Icon className="h-4 w-4" />;
              })()}
              {current.label}
            </div>
            <p className="text-sm text-slate-600">{current.help}</p>
            {current.confirmNote && <Alert tone="warning">{current.confirmNote}</Alert>}
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
                placeholder={current.placeholder}
                aria-describedby="reason-help"
              />
              <p id="reason-help" className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Required. Visible to other reviewers and recorded in the audit log.</span>
                <span className={cn(tooShort && "text-amber-600")}>{tooShort ? `${MIN_REASON_LENGTH - trimmed.length} more characters` : `${trimmed.length} characters`}</span>
              </p>
            </div>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant={TONES[current.tone].button} disabled={busy || tooShort}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm: {current.label}
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
