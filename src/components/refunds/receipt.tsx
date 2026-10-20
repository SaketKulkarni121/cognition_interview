import { formatDateTime, formatMoney } from "@/lib/utils";

type Transaction = {
  reference: string;
  merchantName: string;
  description: string;
  orderNumber: string | null;
  amount: number;
  taxAmount: number;
  currency: string;
  paymentMethod: string;
  purchasedAt: Date;
  lineItems: string;
};

type LineItem = { name: string; quantity: number; unitAmount: number };

/** Itemised receipt for the original purchase (fictional sample data). */
export function Receipt({ transaction: t }: { transaction: Transaction }) {
  const items = JSON.parse(t.lineItems) as LineItem[];
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitAmount, 0);
  const money = (c: number) => formatMoney(c, t.currency);
  return (
    <div className="mx-auto max-w-md rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-5 font-mono text-xs text-slate-700">
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-900">{t.merchantName}</p>
        <p className="text-slate-500">{t.description}</p>
        <p className="mt-2 text-slate-500">{formatDateTime(t.purchasedAt)}</p>
        {t.orderNumber && <p className="text-slate-500">Order {t.orderNumber}</p>}
      </div>
      <table className="mt-4 w-full">
        <tbody>
          {items.map((i) => (
            <tr key={i.name}>
              <td className="py-0.5 pr-2">
                {i.quantity > 1 && `${i.quantity} × `}
                {i.name}
              </td>
              <td className="py-0.5 text-right tabular-nums">{money(i.quantity * i.unitAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-0.5 border-t border-dashed border-slate-300 pt-3">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">{money(subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span>Tax</span>
          <span className="tabular-nums">{money(t.taxAmount)}</span>
        </p>
        <p className="flex justify-between text-sm font-semibold text-slate-900">
          <span>Total charged</span>
          <span className="tabular-nums">{money(t.amount)}</span>
        </p>
      </div>
      <div className="mt-3 border-t border-dashed border-slate-300 pt-3 text-slate-500">
        <p>Paid with {t.paymentMethod}</p>
        <p>Transaction {t.reference}</p>
      </div>
      <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-slate-400">Fictional sample receipt</p>
    </div>
  );
}
