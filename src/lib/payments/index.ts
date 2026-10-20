import { MockPaymentProvider } from "./mock-provider";
import type { PaymentProvider } from "./types";

export * from "./types";

const globalForPayments = globalThis as unknown as { paymentProvider?: PaymentProvider };

/** Resolve the configured provider (PAYMENT_PROVIDER, default "mock"). */
export function getPaymentProvider(): PaymentProvider {
  if (globalForPayments.paymentProvider) return globalForPayments.paymentProvider;
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  let provider: PaymentProvider;
  switch (name) {
    case "mock":
      provider = new MockPaymentProvider({ latencyMs: 400 });
      break;
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Only "mock" is available.`);
  }
  globalForPayments.paymentProvider = provider;
  return provider;
}
