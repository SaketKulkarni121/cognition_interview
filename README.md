# Northstar Ops — Internal Operations Platform

A production-inspired internal tools platform for a fictional fintech. It currently ships two apps on shared infrastructure (navigation, design system, role-based authorization, audit log):

- **KYC Review Queue**: reviewers open one page with the customer's profile, identity documents, history and notes, then record a human decision (Approve / Reject / Request info / Escalate) with a required explanation.
- **Refunds Dashboard**: operations staff investigate refund requests passed on by support (purchase, receipt, complaint, support notes, eligibility facts) and Approve / Reject / Escalate them. Approved refunds go to a **simulated** payment provider through an adapter, with several layers of duplicate-refund protection.

Every action is written to a single append-only audit log.

> **Authentication is simulated.** You "sign in" by picking a demo user. There are no passwords and the session cookie is not signed. All customer data and documents are **fictional**.
>
> **All KYC decisions are human-driven.** There is no OCR, automated identity verification, or risk scoring.
>
> **No real payments.** Refunds go to a mock payment provider that never contacts a network or moves money.

![KYC review page](docs/screenshots/review-approved.png)

## Tech stack

- **Next.js 16** (App Router, Server Components, Route Handlers) + **TypeScript**
- **Prisma 6** + **SQLite**
- **Tailwind CSS v4** with a small in-repo component library (`src/components/ui`) and `lucide-react` icons
- **Zod** for request validation
- **Vitest** for tests

## Quick start

Requirements: Node.js 20+ (tested on Node 24) and npm.

```bash
git clone https://github.com/SaketKulkarni121/cognition_interview.git
cd cognition_interview
npm install          # also runs `prisma generate`
npm run setup        # creates .env from .env.example, applies migrations, seeds fictional data
npm run dev          # http://localhost:3000
```

Open http://localhost:3000, pick a demo user, and go to **KYC Review**.

To reset the database to the original seed data at any time:

```bash
npm run db:reset     # drops prisma/dev.db, re-applies migrations, re-seeds
```

### Demo users

| User | Role | What they can do |
| --- | --- | --- |
| Priya Raman | Admin | Everything: assign any KYC reviewer, decide any open case (including escalated ones), retry failed refund payments, view the audit log |
| Marcus Chen, Elena Novak, Jordan Ellis | Analyst | KYC: claim, add notes, decide applications assigned to them. Refunds: add notes, approve/reject/escalate pending cases |
| Sam Okafor | Viewer | Read-only access to both apps and the audit log |

Use **Switch user** in the sidebar to change roles.

## Using the KYC Review Queue

1. **Queue** (`/kyc`) — summary cards (New, In review, Awaiting customer, Escalated, Assigned to me), search by name/email/reference, filter by status and reviewer, sort, paginate. Each row shows customer, reference, submission date, status and assigned reviewer.
2. **Review page** (`/kyc/[id]`) — a status banner telling you what happens next, then:
   - Customer profile: personal details, contact/address, employment and account use
   - Identity documents (fictional SVG specimens) — click to enlarge and compare against the profile
   - Application history (from the audit log), previous decisions with reasons, internal reviewer notes
   - Assignment control (Admins assign anyone; Analysts claim/release)
   - Decision panel — unavailable actions are disabled with a plain-language reason; choosing an action asks for an explanation (min. 10 characters) before confirming
3. **Audit log** (`/audit`, Admin & Viewer): every submission, assignment, note and decision across all apps, with actor, timestamp, status change and reason. You can filter by app and action.

### Workflow

```
SUBMITTED ──assign──▶ IN_REVIEW ──approve──▶ APPROVED (final)
                        │  ├─reject──────▶ REJECTED (final)
                        │  ├─request info▶ INFO_REQUESTED ──info received──▶ IN_REVIEW
                        │  │                 ├─reject──▶ REJECTED
                        │  │                 └─escalate▶ ESCALATED
                        │  └─escalate────▶ ESCALATED ──(Admin only) approve / reject / request info
```

Rules enforced on the server (`src/modules/kyc/workflow.ts`, `src/modules/kyc/service.ts`):

- Only the transitions above are allowed; `APPROVED` and `REJECTED` are terminal.
- A decision requires an explanation of 10–2000 characters.
- Analysts can only act on applications assigned to them, and can only assign/release themselves.
- Escalated applications can only be decided by an Admin.
- Viewers cannot assign, add notes, or decide.
- Assigning a `SUBMITTED` application moves it to `IN_REVIEW` automatically.
- Each mutation runs in a transaction together with its audit-log entry, and checks the status the reviewer was looking at (`expectedStatus`) to reject stale/concurrent updates with `409`.

## Refunds Dashboard

![Refund case page](docs/screenshots/refund-approved.png)

1. **Dashboard** (`/refunds`): cards for pending requests, total amount requested (and how much is still open), approved (with the amount refunded), rejected, and escalated. Below them is a table you can search by customer, email, case `RFD-…`, transaction `TXN-…` or merchant, filter by status and reason, sort by date or amount, and page through.
2. **Case page** (`/refunds/[id]`):
   - Customer complaint and reason category
   - Customer and transaction details (merchant, purchase date, amount, payment method)
   - Itemised receipt
   - Support case: the agent who handled it, the ticket, the channel, and the agent's notes
   - Case history from the audit log
   - Decision panel: Approve, Reject or Escalate, each with a required explanation of at least 10 characters. Approving shows exactly what will be refunded and to which card before you confirm.
   - Refund payment card: provider status, provider refund ID, idempotency key, attempts and last error, plus a **Retry** button for Admins when a payment failed
   - Refund eligibility: whether the request is within the 30-day window, whether the amount is within what's still refundable, and whether the purchase was refunded before. These are informational only and never decide anything.
   - Decision history and reviewer notes

### Refund workflow

```
PENDING ──approve──▶ APPROVED (final) ──▶ payout: PROCESSING → SUCCEEDED | FAILED ─(Admin retry)─▶ SUCCEEDED
   │  ├──reject───▶ REJECTED (final, no payout)
   │  └─escalate──▶ ESCALATED ──(Admin only) approve / reject
```

These rules are enforced on the server (`src/modules/refunds/workflow.ts`, `src/modules/refunds/service.ts`):

- Analysts and Admins decide pending cases. Only Admins decide escalated cases. Viewers can't decide or add notes.
- Approval runs in one database transaction: a conditional status update, the decision, the audit entry, and a `RefundPayout` row. The refund is then sent to the provider and the result is recorded and audited.

#### Duplicate-refund protection

- **State machine:** `APPROVED` is final, so a second approve returns `409`.
- **Conditional update:** `updateMany where status = current`. Only one of two concurrent approvals can change the status. The other gets `409`, and the provider is never called for it.
- **Database constraints:** `RefundPayout.caseId` and `RefundPayout.idempotencyKey` are both `@unique`. A second payout row for the same case can't exist.
- **Idempotency key:** `refund:<caseId>` goes to the provider on every attempt, including retries. A real provider would return the original refund instead of creating a new one, and the mock does the same.
- **Retry claim:** a retry first claims the payout atomically (`FAILED → PROCESSING`). Retrying a payout that succeeded or is in flight returns `409`.

### Payment provider adapter

`src/lib/payments/types.ts` defines `PaymentProvider.createRefund({ idempotencyKey, amount, currency, transactionReference })`. `getPaymentProvider()` (`src/lib/payments/index.ts`) picks the implementation from `PAYMENT_PROVIDER`. The default, and the only option today, is `mock` (`MockPaymentProvider`). It validates the amount, honours idempotency keys, adds a small delay, and returns a `mock_re_…` ID. To connect a real provider, implement the interface and add a case to `getPaymentProvider()`. Business logic doesn't change.

Seed data: 17 fictional cases. 7 pending (one outside the 30-day window, one a second refund on an already partly refunded purchase), 3 escalated, 4 approved (one with a **failed** payout, so you can try the Admin retry), and 3 rejected.

## API

All endpoints require a (simulated) session cookie and return JSON errors as `{ "error": { "code", "message", "details?" } }` with `401` / `403` / `404` / `400` / `409` status codes.

| Method & path | Description | Allowed roles |
| --- | --- | --- |
| `GET /api/kyc/applications?q=&status=&reviewer=&sort=&page=` | List/search applications | All |
| `GET /api/kyc/applications/:id` | Full application with documents, notes, decisions, history | All |
| `POST /api/kyc/applications/:id/assign` `{ reviewerId: string \| null }` | Assign, claim or release | Admin (anyone), Analyst (self) |
| `POST /api/kyc/applications/:id/decisions` `{ action, reason, expectedStatus? }` | `APPROVE`, `REJECT`, `REQUEST_INFO`, `ESCALATE`, `RESUME_REVIEW` | Admin, assigned Analyst |
| `POST /api/kyc/applications/:id/notes` `{ body }` | Add an internal note | Admin, Analyst |
| `GET /api/kyc/reviewers` | Users who can be assigned | All |
| `GET /api/kyc/documents/:id/image` | Fictional document image (SVG) | All |
| `GET /api/refunds/cases?q=&status=&reason=&sort=&page=` | List/search refund cases (`status`: `PENDING`, `ESCALATED`, `APPROVED`, `REJECTED`, `OPEN`, `ALL`; `sort`: `newest`, `oldest`, `amount`) | All |
| `GET /api/refunds/cases/:id` | Case with transaction, notes, decisions, payout, history, eligibility | All |
| `POST /api/refunds/cases/:id/decisions` `{ action, reason, expectedStatus? }` | `APPROVE` (also sends the refund), `REJECT`, `ESCALATE` | Admin, Analyst (pending cases only) |
| `POST /api/refunds/cases/:id/notes` `{ body }` | Add a reviewer note | Admin, Analyst |
| `POST /api/refunds/cases/:id/payment/retry` | Retry a `FAILED` payout with the same idempotency key | Admin |
| `GET /api/refunds/stats` | Dashboard totals | All |
| `GET /api/audit-log?module=&action=&q=&page=` | Audit log | Admin, Viewer |
| `GET / POST / DELETE /api/session` | Current user / sign in as a demo user / sign out | — |

Example (after signing in as Marcus Chen in the browser, or with a cookie jar):

```bash
curl -b cookies.txt -X POST localhost:3000/api/kyc/applications/<id>/decisions \
  -H 'content-type: application/json' \
  -d '{"action":"APPROVE","reason":"Passport and utility bill match the profile."}'
```

## Architecture

```
prisma/
  schema.prisma          User, AuditLog, Kyc* models, PaymentTransaction, RefundCase/Note/Decision/Payout
  seed.ts                Users + 22 fictional KYC applications with history
  seed-refunds.ts        17 fictional refund cases, transactions, support notes, decisions, payouts
src/
  config/apps.ts         Registry of internal apps → drives the sidebar and home page
  lib/
    auth/permissions.ts  Role → permission map, can()/assertCan()
    auth/session.ts      Simulated session (cookie holding a user id)
    api.ts               apiHandler(): auth, Zod parsing, consistent error responses
    audit.ts             recordAudit()/listAuditLog() — shared, module-agnostic audit log
    errors.ts            Typed errors mapped to HTTP status codes
    validation.ts        Shared decision-reason / note schemas, parseInput()
    payments/            PaymentProvider adapter interface + MockPaymentProvider
    api-client.ts        Browser fetch helper for the JSON APIs
    db.ts                Prisma client singleton
  modules/kyc/
    workflow.ts          Pure state machine + rules (shared by UI and server)
    service.ts           Data access + authorization + transactions + audit writes
    schemas.ts           Zod request schemas
    documents.ts         Fictional SVG document renderer
  modules/refunds/       workflow.ts (state machine + eligibility facts), service.ts, schemas.ts
  components/ui/         Button, Badge, Card, Table, Form fields, Dialog, Alert, Avatar,
                         StatCard, DetailSection/DetailField, Pagination
  components/workflow/   Shared across apps: FilterBar (URL-synced search/filters), DecisionPanel
                         (action + required reason), NotesPanel, ModuleStatusBadge
  components/audit/      Audit event registry (labels/icons for every app) + HistoryTimeline
  components/shell/      App shell, sidebar, simulated-auth banner
  components/kyc/        KYC-specific: assignment, documents, thin wrappers over shared components
  components/refunds/    Refund-specific: filters, receipt, retry-payment button
  app/(platform)/        Authenticated pages: home, /kyc, /kyc/[id], /refunds, /refunds/[id], /audit
  app/api/               Route handlers (thin: parse → call service → JSON)
```

**Adding another internal app** (e.g. Disputes, already shown as "coming soon"). Refunds was built exactly this way:

1. Add Prisma models.
2. Create `src/modules/<app>/` with a workflow and a service that call `assertCan()` and `recordAudit({ module: "<app>", … })`.
3. Add permissions in `permissions.ts`.
4. Register the app's statuses in `components/workflow/status-badge.tsx` and its audit events in `components/audit/events.ts`.
5. Add pages under `src/app/(platform)/<app>` built from `FilterBar`, `StatCard`, `DecisionPanel`, `NotesPanel` and `HistoryTimeline`.
6. Add an entry to `src/config/apps.ts`.

## Tests

```bash
npm test             # Vitest — uses an isolated prisma/test.db, reset per run
npm run lint
npm run typecheck
npm run build
```

Test suites (`tests/`):

- `permissions.test.ts` — role → permission matrix
- `workflow.test.ts` — allowed/blocked transitions, terminal states, required reasons, assignment rules, Admin-only escalated decisions
- `kyc-service.test.ts` — against a real SQLite DB: claim → approve with audit entries; request info → resume → escalate → Admin reject; missing reason; invalid and stale transitions; Viewer and cross-Analyst restrictions; Admin reassignment; notes audited
- `refunds.test.ts`, run against a real SQLite DB with a spy payment provider:
  - Permissions matrix, state-machine transitions, and eligibility facts
  - Approving sends exactly one refund and writes three audit entries
  - A second approve is blocked and the provider is called only once
  - Of two concurrent approvals, only one succeeds
  - The database rejects a second payout for the same case
  - A failed payout can be retried by an Admin only, reuses the same idempotency key, and returns `409` once it has succeeded
  - The mock provider is idempotent
  - Rejection needs a reason and never contacts the provider
  - Escalated cases can only be decided by an Admin
  - Viewers are blocked, and stale updates are detected
  - Notes are audited and the dashboard totals are correct

## Limitations

- **Simulated authentication** — unsigned cookie, no passwords, no SSO. Replace `src/lib/auth/session.ts` with a real identity provider before any real use.
- **No document upload or customer-facing flow** — documents are generated fictional SVGs; "Info received" is recorded manually by a reviewer.
- **No OCR, identity verification, sanctions screening or risk scoring** — by design; decisions are entirely human.
- **SQLite** is single-writer and file-based; fine for a demo, use Postgres for production (Prisma makes this a datasource change). Enum-like fields are stored as strings because SQLite has no native enums; values are validated in code.
- Audit log is append-only by convention (no update/delete code paths), not enforced at the database level.
- No real-time updates — concurrent edits are caught with a `409` and the reviewer is asked to refresh.
- Tests cover domain logic, authorization and the service layer; there are no automated browser (E2E) tests.
- **Refunds:**
  - The payment provider is a mock. No refund is sent anywhere, and its idempotency memory lasts only for the life of the server process. The database constraints are the durable guard.
  - Refund requests arrive through seed data only; there is no intake form or support-tool integration.
  - If the server crashes after a payout is claimed (`PROCESSING`) but before the provider answers, the payout stays `PROCESSING`. A real system would reconcile with the provider using the idempotency key; this demo has no reconciliation job.
  - Eligibility checks cover a single 30-day, up-to-amount-paid policy and are informational only. There are no approval limits by amount.
