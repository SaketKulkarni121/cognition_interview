"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { apiPost } from "@/lib/api-client";

export function RetryPaymentButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await apiPost(`/api/refunds/cases/${caseId}/payment/retry`, {});
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Retry sending refund
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
