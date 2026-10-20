import { Badge } from "@/components/ui";
import { STATUS_META, isKycStatus } from "@/modules/kyc/workflow";

export function StatusBadge({ status }: { status: string }) {
  if (!isKycStatus(status)) return <Badge>{status}</Badge>;
  const meta = STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot title={meta.description}>
      {meta.label}
    </Badge>
  );
}
