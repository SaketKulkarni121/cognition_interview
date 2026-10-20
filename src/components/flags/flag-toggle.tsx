"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, Button, Input, Label, Switch, Textarea } from "@/components/ui";
import { Dialog } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api-client";
import { MIN_REASON_LENGTH } from "@/lib/validation";

type Props = {
  flagKey: string;
  flagName: string;
  environment: string;
  environmentLabel: string;
  enabled: boolean;
  version: number;
  allowed: boolean;
  blockedReason?: string;
  needsConfirmation: boolean;
  stagingEnabled: boolean;
  showLabel?: boolean;
};

/**
 * Toggle for one flag in one environment. Non-production changes apply
 * immediately; production opens a confirmation dialog (type the key + reason).
 */
export function FlagToggle(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const next = !p.enabled;

  async function send(extra: { reason?: string; confirmation?: string } = {}) {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/flags/${p.flagKey}/environments/${p.environment}`, { enabled: next, expectedVersion: p.version, ...extra });
      setOpen(false);
      setReason("");
      setConfirmation("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canConfirm = confirmation.trim() === p.flagKey && reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <Switch
          checked={p.enabled}
          disabled={!p.allowed || busy}
          title={p.allowed ? `Turn ${next ? "on" : "off"} in ${p.environmentLabel}` : p.blockedReason}
          aria-label={`${p.flagName} in ${p.environmentLabel}`}
          onClick={() => {
            setError(null);
            if (p.needsConfirmation) setOpen(true);
            else send();
          }}
        />
        {busy && !open && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
        {p.showLabel && <span className="text-sm font-medium text-slate-700">{p.enabled ? "On" : "Off"}</span>}
      </div>
      {error && !open && <p className="max-w-56 text-xs text-red-600">{error}</p>}

      <Dialog open={open} onClose={() => !busy && setOpen(false)} title={`Turn ${next ? "on" : "off"} “${p.flagName}” in Production?`} className="max-w-lg">
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) send({ reason: reason.trim(), confirmation: confirmation.trim() });
          }}
        >
          <Alert tone="danger" title="This affects live customers immediately">
            {next ? "The feature will be enabled for every production user as soon as you confirm." : "The feature will be switched off for every production user as soon as you confirm."}
          </Alert>
          {next && !p.stagingEnabled && (
            <p className="flex gap-2 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> This flag is off in Staging. Production can only be enabled after it is on in Staging.
            </p>
          )}
          <div>
            <Label htmlFor="flag-reason">
              Why are you making this change? <span className="text-red-600">*</span>
            </Label>
            <Textarea id="flag-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Staging verified for a week with no errors; launching to all customers." />
            <p className="mt-1 text-xs text-slate-500">Recorded in the audit log. At least {MIN_REASON_LENGTH} characters.</p>
          </div>
          <div>
            <Label htmlFor="flag-confirm">
              Type <code className="rounded bg-slate-100 px-1 font-mono text-slate-900">{p.flagKey}</code> to confirm
            </Label>
            <Input id="flag-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={next ? "success" : "danger"} disabled={!canConfirm || busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Turn {next ? "on" : "off"} in Production
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
