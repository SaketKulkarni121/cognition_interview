"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { Avatar, Button, Select } from "@/components/ui";
import { apiPost } from "@/lib/api-client";

type Reviewer = { id: string; name: string; title: string | null };

export function AssignmentControl({
  applicationId,
  selfId,
  current,
  reviewers,
  canAssignAny,
  canClaim,
  canRelease,
  closed,
}: {
  applicationId: string;
  selfId: string;
  current: Reviewer | null;
  reviewers: Reviewer[];
  canAssignAny: boolean;
  canClaim: boolean;
  canRelease: boolean;
  closed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(reviewerId: string | null) {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/kyc/applications/${applicationId}/assign`, { reviewerId });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned reviewer</p>
      <div className="flex flex-wrap items-center gap-2">
        {canAssignAny && !closed ? (
          <Select aria-label="Assigned reviewer" value={current?.id ?? ""} disabled={busy} onChange={(e) => assign(e.target.value || null)} className="w-56">
            <option value="">Unassigned</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.title ? ` — ${r.title}` : ""}
              </option>
            ))}
          </Select>
        ) : current ? (
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Avatar name={current.name} size="xs" /> {current.name}
          </span>
        ) : (
          <span className="text-sm text-slate-500">Unassigned</span>
        )}
        {!canAssignAny && canClaim && (
          <Button size="sm" onClick={() => assign(selfId)} disabled={busy} data-claim>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Assign to me
          </Button>
        )}
        {canAssignAny && canClaim && !current && (
          <Button size="sm" variant="secondary" onClick={() => assign(selfId)} disabled={busy}>
            <UserPlus className="h-4 w-4" /> Assign to me
          </Button>
        )}
        {!canAssignAny && canRelease && (
          <Button size="sm" variant="secondary" onClick={() => assign(null)} disabled={busy}>
            <UserMinus className="h-4 w-4" /> Unassign me
          </Button>
        )}
        {busy && canAssignAny && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
