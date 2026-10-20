/**
 * Fictional refund cases for the Refunds module. Customers, merchants,
 * transactions and support agents are invented. Amounts are in cents.
 */
import type { PrismaClient } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

type Actor = { id: string; name: string; role: string; title?: string | null };
type ReviewerKey = "admin" | "marcus" | "elena" | "jordan";

const agents = {
  nadia: { name: "Nadia Brooks", team: "Customer Support · Tier 1" },
  owen: { name: "Owen Price", team: "Customer Support · Tier 2" },
  ravi: { name: "Ravi Patel", team: "Payments Support" },
  chloe: { name: "Chloé Martin", team: "Customer Support · Tier 1" },
} as const;
type AgentKey = keyof typeof agents;

type Step =
  | { kind: "note"; by: ReviewerKey; body: string; at: number }
  | { kind: "decide"; by: ReviewerKey; action: "APPROVE" | "REJECT" | "ESCALATE"; reason: string; at: number; payoutError?: string };

type CaseSeed = {
  customer: [name: string, email: string, sinceDaysAgo: number];
  merchant: string;
  description: string;
  items: [name: string, qty: number, unitCents: number][];
  taxRate?: number;
  method: string;
  purchasedDaysAgo: number;
  requestedCents?: number; // defaults to full amount
  reason: string;
  channel: "EMAIL" | "CHAT" | "PHONE";
  agent: AgentKey;
  complaint: string;
  supportNotes: string[];
  eligibilityNote?: string;
  submittedHoursAgo: number;
  steps?: Step[];
  sameTransactionAs?: number; // index of an earlier case (second refund on one purchase)
};

const cases: CaseSeed[] = [
  // ---- Pending ----
  {
    customer: ["Isabel Fonseca", "isabel.fonseca@mail.example", 640], merchant: "Brightwave Electronics", description: "Online order",
    items: [["Aria Noise-Cancelling Headphones", 1, 18900]], taxRate: 0.08, method: "Visa •••• 4417", purchasedDaysAgo: 12,
    reason: "NOT_RECEIVED", channel: "CHAT", agent: "nadia", submittedHoursAgo: 5,
    complaint: "My headphones were supposed to arrive last Tuesday. Tracking has said 'in transit' for 9 days and the courier says they can't find the parcel. I'd like my money back please.",
    supportNotes: ["Checked courier portal: last scan 9 days ago at the regional depot, no delivery attempt recorded.", "Merchant confirmed they will not reship; asked us to process refund via our side."],
  },
  {
    customer: ["Kenji Watanabe", "kenji.watanabe@mail.example", 1210], merchant: "Stillwater Coffee Co.", description: "In-store purchase",
    items: [["Flat white", 1, 525]], method: "Mastercard •••• 9032", purchasedDaysAgo: 2, reason: "DUPLICATE_CHARGE", channel: "EMAIL", agent: "ravi", submittedHoursAgo: 9,
    complaint: "I was charged twice for the same coffee on the same morning. Statement shows two identical $5.25 charges two minutes apart. Please refund one of them.",
    supportNotes: ["Confirmed two authorisations from the same terminal 2 minutes apart. Second one has the same order number — looks like a terminal retry."],
  },
  {
    customer: ["Priscilla Mensah-Ford", "priscilla.mf@mail.example", 95], merchant: "Fernhill Home Goods", description: "Online order",
    items: [["Ceramic dinner set (12 pc)", 1, 14500], ["Linen napkins (set of 6)", 1, 3200]], taxRate: 0.07, method: "Visa •••• 2290", purchasedDaysAgo: 8,
    requestedCents: 15515, reason: "DAMAGED", channel: "EMAIL", agent: "chloe", submittedHoursAgo: 20,
    complaint: "The dinner set arrived with four plates smashed and the box was crushed. The napkins are fine so I'm only asking for the dinner set to be refunded. Photos attached to my email.",
    supportNotes: ["Customer sent 3 photos showing broken plates and a crushed outer box.", "Partial refund requested for the dinner set only (item + tax)."],
  },
  {
    customer: ["Arjun Mehta", "arjun.mehta@mail.example", 30], merchant: "Pulse Fitness Online", description: "Subscription renewal",
    items: [["Pulse Premium — annual plan", 1, 11999]], method: "Amex •••• 1008", purchasedDaysAgo: 3, reason: "CANCELLED_SUBSCRIPTION", channel: "PHONE", agent: "owen", submittedHoursAgo: 28,
    complaint: "I cancelled my Pulse subscription last month but was still charged for a full year. I have the cancellation confirmation email.",
    supportNotes: ["Customer forwarded cancellation confirmation dated 26 days before renewal.", "Merchant's portal still shows the plan as active — likely a sync issue on their side."],
  },
  {
    customer: ["Lucía Ortega", "lucia.ortega@mail.example", 410], merchant: "Atlas Outdoor Supply", description: "Online order",
    items: [["Trailhead 45L backpack", 1, 16000]], taxRate: 0.0825, method: "Visa •••• 7781", purchasedDaysAgo: 47, reason: "NOT_AS_DESCRIBED", channel: "EMAIL", agent: "nadia", submittedHoursAgo: 40,
    complaint: "The backpack is listed as waterproof but everything inside got soaked in light rain on my first hike. That's not what I paid for.",
    supportNotes: ["Product page does say 'waterproof'. Customer has used the item.", "Request is outside the 30-day window — flagging for reviewer."],
    eligibilityNote: "Customer says she first used the bag on day 40 because the trip was postponed.",
  },
  {
    customer: ["Tobias Engel", "tobias.engel@mail.example", 1800], merchant: "Nimbus Streaming", description: "Monthly subscription",
    items: [["Nimbus Family plan — 1 month", 1, 2299]], method: "Mastercard •••• 5521", purchasedDaysAgo: 6, reason: "UNRECOGNIZED", channel: "CHAT", agent: "ravi", submittedHoursAgo: 52,
    complaint: "I don't recognise this Nimbus charge. I've never had an account with them.",
    supportNotes: ["Customer has no prior Nimbus transactions. Card was not reported lost.", "Advised customer to check with family members; customer says nobody in the household uses Nimbus."],
    steps: [{ kind: "note", by: "jordan", body: "Card has no other suspicious activity. Waiting on merchant to confirm the account email before deciding.", at: 30 * HOUR }],
  },

  // ---- Escalated ----
  {
    customer: ["Grant Holloway", "grant.holloway@mail.example", 22], merchant: "Meridian Jewelers", description: "Online order",
    items: [["14k gold chain bracelet", 1, 128000]], taxRate: 0.06, method: "Visa •••• 0094", purchasedDaysAgo: 18, reason: "NOT_RECEIVED", channel: "PHONE", agent: "owen", submittedHoursAgo: 70,
    complaint: "My bracelet never arrived. The tracking says delivered but I was home all day and nothing came.",
    supportNotes: ["Courier shows 'delivered — left at front door', no signature, no photo.", "Account is 22 days old; this is the customer's first and only purchase."],
    steps: [
      { kind: "note", by: "elena", body: "High value, new account, delivered-without-signature. Asked merchant whether they have a delivery photo.", at: 60 * HOUR },
      { kind: "decide", by: "elena", action: "ESCALATE", reason: "High-value claim ($1,357) on a 3-week-old account with a 'delivered' scan. Needs an Admin to weigh fraud risk against the missing proof of delivery.", at: 58 * HOUR },
    ],
  },
  {
    customer: ["Mei Lin Tan", "meilin.tan@mail.example", 900], merchant: "Brightwave Electronics", description: "Online order",
    items: [["Lumen 27\" 4K monitor", 1, 42900]], taxRate: 0.08, method: "Mastercard •••• 3376", purchasedDaysAgo: 21, reason: "DAMAGED", channel: "EMAIL", agent: "chloe", submittedHoursAgo: 96,
    complaint: "The monitor has a line of dead pixels down the middle. Brightwave told me to ask my card provider for a refund instead of returning it.",
    supportNotes: ["Photo shows a vertical line of dead pixels.", "Merchant refused return citing 'opened box' policy."],
    steps: [{ kind: "decide", by: "marcus", action: "ESCALATE", reason: "Merchant is refusing the return; refunding means we absorb the cost. Want an Admin decision on whether to refund and pursue the merchant.", at: 80 * HOUR }],
  },
  {
    customer: ["Daniel Okafor", "d.okafor@mail.example", 1500], merchant: "Pulse Fitness Online", description: "Subscription renewal",
    items: [["Pulse Premium — annual plan", 1, 11999]], method: "Visa •••• 6620", purchasedDaysAgo: 25, reason: "CANCELLED_SUBSCRIPTION", channel: "CHAT", agent: "nadia", submittedHoursAgo: 120,
    complaint: "Same thing as last year — I was renewed after cancelling. I want this refunded and the subscription closed for good.",
    supportNotes: ["Customer received a refund from Pulse for the same issue last year (outside our records).", "No cancellation email this time; customer says he cancelled in the app."],
    steps: [
      { kind: "note", by: "jordan", body: "No proof of cancellation this time. Customer is frustrated; repeat issue with this merchant.", at: 110 * HOUR },
      { kind: "decide", by: "jordan", action: "ESCALATE", reason: "No cancellation evidence, but this merchant has a pattern of renewal complaints. Need a policy call from an Admin.", at: 108 * HOUR },
    ],
  },

  // ---- Approved (refund sent) ----
  {
    customer: ["Sophie Laurent", "sophie.laurent@mail.example", 720], merchant: "Fernhill Home Goods", description: "Online order",
    items: [["Wool throw blanket", 1, 8900]], taxRate: 0.07, method: "Visa •••• 1185", purchasedDaysAgo: 15, reason: "NOT_RECEIVED", channel: "EMAIL", agent: "chloe", submittedHoursAgo: 150,
    complaint: "Order never arrived and Fernhill isn't answering emails.",
    supportNotes: ["Courier confirms parcel was returned to sender as undeliverable (address label damaged)."],
    steps: [{ kind: "decide", by: "marcus", action: "APPROVE", reason: "Courier confirms the parcel was returned to the merchant undelivered. Full refund is within policy.", at: 140 * HOUR }],
  },
  {
    customer: ["Omar Haddad", "omar.haddad@mail.example", 2300], merchant: "Stillwater Coffee Co.", description: "In-store purchase",
    items: [["Seasonal beans 1kg", 1, 3400]], method: "Mastercard •••• 4402", purchasedDaysAgo: 9, reason: "DUPLICATE_CHARGE", channel: "CHAT", agent: "ravi", submittedHoursAgo: 170,
    complaint: "Charged twice for one bag of coffee beans.",
    supportNotes: ["Duplicate authorisation confirmed, same order number."],
    steps: [{ kind: "decide", by: "elena", action: "APPROVE", reason: "Duplicate authorisation with the same order number. Refunding the second charge.", at: 165 * HOUR }],
  },
  {
    customer: ["Ana Petrović", "ana.petrovic@mail.example", 300], merchant: "Atlas Outdoor Supply", description: "Online order",
    items: [["Summit trekking poles", 1, 7400], ["Merino hiking socks", 2, 2200]], taxRate: 0.0825, method: "Visa •••• 3048", purchasedDaysAgo: 20,
    requestedCents: 4763, reason: "NOT_AS_DESCRIBED", channel: "EMAIL", agent: "nadia", submittedHoursAgo: 200,
    complaint: "The socks are listed as merino wool but the label says 80% acrylic. I'd like a refund for the socks.",
    supportNotes: ["Customer sent a photo of the care label: 80% acrylic, 20% wool.", "Partial refund for socks only (2 × $22 + tax)."],
    steps: [
      { kind: "note", by: "jordan", body: "Label photo clearly contradicts the listing. Partial amount matches the two pairs plus tax.", at: 190 * HOUR },
      { kind: "decide", by: "jordan", action: "APPROVE", reason: "Item is materially different from the listing (label shows 80% acrylic). Partial refund for the socks only.", at: 188 * HOUR },
    ],
  },
  {
    customer: ["Ana Petrović", "ana.petrovic@mail.example", 300], merchant: "Atlas Outdoor Supply", description: "Online order",
    items: [], method: "", purchasedDaysAgo: 0, sameTransactionAs: 11,
    requestedCents: 8011, reason: "DAMAGED", channel: "EMAIL", agent: "nadia", submittedHoursAgo: 14,
    complaint: "Now one of the trekking poles has snapped at the locking clip after two walks. Please refund the poles too.",
    supportNotes: ["Second refund request on the same order — socks were already refunded last week.", "Photo shows the lower section snapped at the clip."],
  },
  {
    customer: ["Ruth Abernathy", "ruth.abernathy@mail.example", 1100], merchant: "Meridian Jewelers", description: "Online order",
    items: [["Silver hoop earrings", 1, 9500]], taxRate: 0.06, method: "Amex •••• 7713", purchasedDaysAgo: 26, reason: "NOT_RECEIVED", channel: "PHONE", agent: "owen", submittedHoursAgo: 230,
    complaint: "Earrings were a gift and never arrived before the birthday. Still nothing two weeks later.",
    supportNotes: ["Merchant confirms the item was never shipped due to a stock error."],
    steps: [
      { kind: "decide", by: "marcus", action: "ESCALATE", reason: "Merchant admits it never shipped but wants to send a replacement instead; customer wants money back. Admin call.", at: 220 * HOUR },
      { kind: "decide", by: "admin", action: "APPROVE", reason: "Item was never shipped; customer is entitled to a refund rather than a late replacement.", at: 210 * HOUR, payoutError: "Card issuer declined the refund: card account closed (simulated). Try again after confirming with the issuer." },
    ],
  },

  // ---- Rejected ----
  {
    customer: ["Victor Salazar", "victor.salazar@mail.example", 60], merchant: "Brightwave Electronics", description: "Online order",
    items: [["Volt wireless earbuds", 1, 12900]], taxRate: 0.08, method: "Visa •••• 8855", purchasedDaysAgo: 14, reason: "NOT_RECEIVED", channel: "CHAT", agent: "nadia", submittedHoursAgo: 260,
    complaint: "Never got my earbuds.",
    supportNotes: ["Courier has signed proof of delivery and a doorstep photo matching the customer's address.", "Customer did not respond to the photo when shown."],
    steps: [{ kind: "decide", by: "elena", action: "REJECT", reason: "Signed proof of delivery and a doorstep photo at the customer's address. No evidence the item was not received.", at: 250 * HOUR }],
  },
  {
    customer: ["Hannah Kim", "hannah.kim@mail.example", 860], merchant: "Nimbus Streaming", description: "Monthly subscription",
    items: [["Nimbus Standard plan — 1 month", 1, 1599]], method: "Mastercard •••• 6110", purchasedDaysAgo: 40, reason: "CANCELLED_SUBSCRIPTION", channel: "EMAIL", agent: "chloe", submittedHoursAgo: 300,
    complaint: "I forgot to cancel and didn't use the service this month. Can I get the money back?",
    supportNotes: ["No cancellation attempt before renewal. Customer streamed 6 hours during the billing period per merchant.", "Request is 40 days after the charge."],
    steps: [{ kind: "decide", by: "jordan", action: "REJECT", reason: "No cancellation before renewal, service was used during the period, and the request is outside the 30-day window.", at: 290 * HOUR }],
  },
  {
    customer: ["Felix Brandt", "felix.brandt@mail.example", 45], merchant: "Meridian Jewelers", description: "Online order",
    items: [["Diamond stud earrings", 1, 89000]], taxRate: 0.06, method: "Visa •••• 5502", purchasedDaysAgo: 29, reason: "UNRECOGNIZED", channel: "PHONE", agent: "owen", submittedHoursAgo: 340,
    complaint: "I didn't make this purchase.",
    supportNotes: ["Order shipped to the customer's verified home address and was signed for by 'F. Brandt'.", "Device and IP match the customer's previous logins."],
    steps: [
      { kind: "decide", by: "marcus", action: "ESCALATE", reason: "Customer claims unrecognised charge but delivery was signed at his own address. Needs Admin review.", at: 330 * HOUR },
      { kind: "decide", by: "admin", action: "REJECT", reason: "Purchase was made from the customer's usual device and delivered to and signed for at his verified address. Treating as a recognised purchase.", at: 320 * HOUR },
    ],
  },
];

export async function seedRefunds(prisma: PrismaClient, users: Record<ReviewerKey, Actor>) {
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms);
  const transitions: Record<string, Record<string, string>> = {
    APPROVE: { PENDING: "APPROVED", ESCALATED: "APPROVED" },
    REJECT: { PENDING: "REJECTED", ESCALATED: "REJECTED" },
    ESCALATE: { PENDING: "ESCALATED" },
  };
  const auditName: Record<string, string> = { APPROVE: "refunds.case.approved", REJECT: "refunds.case.rejected", ESCALATE: "refunds.case.escalated" };

  const txnIds: string[] = [];
  const txnRefs: string[] = [];
  const txnAmounts: number[] = [];
  // Oldest first so references increase with submission time.
  const order = cases.map((c, i) => ({ c, i })).sort((a, b) => b.c.submittedHoursAgo - a.c.submittedHoursAgo);
  const refFor = new Map(order.map(({ i }, n) => [i, `RFD-${20401 + n}`]));

  for (const [i, c] of cases.entries()) {
    let transactionId: string;
    let txnAmount: number;
    let txnRef: string;
    if (c.sameTransactionAs !== undefined) {
      transactionId = txnIds[c.sameTransactionAs];
      txnAmount = txnAmounts[c.sameTransactionAs];
      txnRef = txnRefs[c.sameTransactionAs];
    } else {
      const subtotal = c.items.reduce((s, [, q, u]) => s + q * u, 0);
      const tax = Math.round(subtotal * (c.taxRate ?? 0));
      txnAmount = subtotal + tax;
      txnRef = `TXN-${(7_310_000 + i * 4_391).toString(36).toUpperCase()}`;
      const txn = await prisma.paymentTransaction.create({
        data: {
          reference: txnRef,
          merchantName: c.merchant,
          description: c.description,
          orderNumber: c.description === "In-store purchase" ? null : `ORD-${48200 + i * 37}`,
          amount: txnAmount,
          taxAmount: tax,
          paymentMethod: c.method,
          purchasedAt: ago(c.purchasedDaysAgo * DAY + c.submittedHoursAgo * HOUR),
          lineItems: JSON.stringify(c.items.map(([name, quantity, unitAmount]) => ({ name, quantity, unitAmount }))),
        },
      });
      transactionId = txn.id;
    }
    txnIds[i] = transactionId;
    txnAmounts[i] = txnAmount;
    txnRefs[i] = txnRef;

    const reference = refFor.get(i)!;
    const submittedAt = ago(c.submittedHoursAgo * HOUR);
    const agent = agents[c.agent];
    const [customerName, customerEmail, sinceDays] = c.customer;
    const refundCase = await prisma.refundCase.create({
      data: {
        reference,
        customerName,
        customerEmail,
        customerId: `CUS-${customerEmail.length * 1031 + sinceDays}`,
        customerSince: ago(sinceDays * DAY),
        amountRequested: c.requestedCents ?? txnAmount,
        reasonCategory: c.reason,
        complaint: c.complaint,
        channel: c.channel,
        supportAgentName: agent.name,
        supportAgentTeam: agent.team,
        supportTicketRef: `SUP-${61000 + i * 113}`,
        eligibilityNote: c.eligibilityNote,
        submittedAt,
        transactionId,
      },
    });

    for (const [n, body] of c.supportNotes.entries()) {
      await prisma.refundNote.create({
        data: { caseId: refundCase.id, kind: "SUPPORT", authorName: agent.name, authorTitle: agent.team, body, createdAt: new Date(submittedAt.getTime() - (c.supportNotes.length - n) * 20 * 60 * 1000) },
      });
    }
    await prisma.auditLog.create({
      data: {
        actorName: `${agent.name} (support)`, actorRole: "SUPPORT", module: "refunds", action: "refunds.case.created",
        entityType: "RefundCase", entityId: refundCase.id, entityRef: reference, toStatus: "PENDING", createdAt: submittedAt,
        metadata: JSON.stringify({ ticket: `SUP-${61000 + i * 113}`, amount: refundCase.amountRequested }),
      },
    });

    let status = "PENDING";
    let decidedAt: Date | null = null;
    for (const s of c.steps ?? []) {
      const at = ago(s.at);
      const actor = users[s.by];
      const base = { actorId: actor.id, actorName: actor.name, actorRole: actor.role, module: "refunds", entityType: "RefundCase", entityId: refundCase.id, entityRef: reference, createdAt: at };
      if (s.kind === "note") {
        const note = await prisma.refundNote.create({ data: { caseId: refundCase.id, kind: "REVIEWER", authorId: actor.id, authorName: actor.name, authorTitle: actor.title ?? null, body: s.body, createdAt: at } });
        await prisma.auditLog.create({ data: { ...base, action: "refunds.note.added", metadata: JSON.stringify({ noteId: note.id }) } });
        continue;
      }
      const to = transitions[s.action][status];
      if (!to) throw new Error(`Invalid seed transition ${status} -> ${s.action} for ${reference}`);
      const decision = await prisma.refundDecision.create({ data: { caseId: refundCase.id, reviewerId: actor.id, action: s.action, fromStatus: status, toStatus: to, reason: s.reason, createdAt: at } });
      await prisma.auditLog.create({ data: { ...base, action: auditName[s.action], fromStatus: status, toStatus: to, reason: s.reason, metadata: JSON.stringify({ decisionId: decision.id }) } });
      status = to;
      if (to === "APPROVED" || to === "REJECTED") decidedAt = at;

      if (s.action === "APPROVE") {
        const idempotencyKey = `refund:${refundCase.id}`;
        const failed = !!s.payoutError;
        const providerRefundId = failed ? null : `mock_re_seed${String(i).padStart(2, "0")}${reference.slice(-3)}`;
        const payout = await prisma.refundPayout.create({
          data: {
            caseId: refundCase.id, idempotencyKey, provider: "mock", amount: refundCase.amountRequested, currency: refundCase.currency,
            status: failed ? "FAILED" : "SUCCEEDED", attempts: 1, lastError: s.payoutError ?? null, providerRefundId,
            requestedById: actor.id, createdAt: at, completedAt: failed ? null : new Date(at.getTime() + 2000),
          },
        });
        await prisma.auditLog.create({ data: { ...base, createdAt: new Date(at.getTime() + 1000), action: "refunds.payment.requested", metadata: JSON.stringify({ payoutId: payout.id, provider: "mock", idempotencyKey, amount: payout.amount }) } });
        await prisma.auditLog.create({
          data: {
            ...base, createdAt: new Date(at.getTime() + 2000),
            action: failed ? "refunds.payment.failed" : "refunds.payment.succeeded",
            metadata: JSON.stringify(failed ? { payoutId: payout.id, provider: "mock", error: s.payoutError } : { payoutId: payout.id, provider: "mock", providerRefundId }),
          },
        });
      }
    }
    await prisma.refundCase.update({ where: { id: refundCase.id }, data: { status, decidedAt } });
  }
  return cases.length;
}
