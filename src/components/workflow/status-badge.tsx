import { Badge, type BadgeTone } from "@/components/ui";
import { STATUS_META as KYC_STATUS_META } from "@/modules/kyc/workflow";
import { STATUS_META as REFUND_STATUS_META } from "@/modules/refunds/workflow";

type StatusMeta = Record<string, { label: string; description: string; tone: BadgeTone }>;

/** Status vocabularies per internal app, keyed by audit-log module name. */
const STATUS_REGISTRY: Record<string, StatusMeta> = {
  kyc: KYC_STATUS_META,
  refunds: REFUND_STATUS_META,
};

export function ModuleStatusBadge({ module, status }: { module: string; status: string }) {
  const meta = STATUS_REGISTRY[module]?.[status];
  if (!meta) return <Badge>{status}</Badge>;
  return (
    <Badge tone={meta.tone} dot title={meta.description}>
      {meta.label}
    </Badge>
  );
}
