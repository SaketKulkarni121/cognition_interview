import { randomUUID } from "node:crypto";
import { PaymentProviderError, type PaymentProvider, type RefundRequest, type RefundResult } from "./types";

/**
 * SIMULATED payment provider. Never contacts a network or moves money.
 * Mirrors real provider semantics that matter to us: amount validation and
 * idempotency (replaying a key returns the original refund, never a new one).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  readonly simulated = true;
  private readonly processed = new Map<string, RefundResult>();

  constructor(private readonly options: { latencyMs?: number } = {}) {}

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    if (!Number.isInteger(request.amount) || request.amount <= 0) {
      throw new PaymentProviderError("Refund amount must be a positive whole number of cents", false);
    }
    const existing = this.processed.get(request.idempotencyKey);
    if (existing) return existing;
    if (this.options.latencyMs) await new Promise((r) => setTimeout(r, this.options.latencyMs));
    const result: RefundResult = { providerRefundId: `mock_re_${randomUUID().replace(/-/g, "").slice(0, 18)}`, status: "succeeded" };
    this.processed.set(request.idempotencyKey, result);
    return result;
  }
}
