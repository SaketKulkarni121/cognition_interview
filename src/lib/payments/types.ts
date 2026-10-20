/**
 * Payment-provider adapter interface. Business logic only talks to this
 * interface, so a real provider (Stripe, Adyen, ...) can be added later by
 * implementing it and registering it in ./index.ts.
 */
export type RefundRequest = {
  /** Same key => same refund. Providers must not refund twice for one key. */
  idempotencyKey: string;
  /** Integer minor units (cents). */
  amount: number;
  currency: string;
  transactionReference: string;
  metadata?: Record<string, string>;
};

export type RefundResult = {
  providerRefundId: string;
  status: "succeeded" | "pending";
};

export interface PaymentProvider {
  readonly name: string;
  readonly simulated: boolean;
  createRefund(request: RefundRequest): Promise<RefundResult>;
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable = true,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
