# Commercial Truth Audit

Last verified: 2026-08-13.

## Invariants

- Money is persisted and calculated in integer cents. A quote or invoice stores inclusive GST, exclusive GST, and GST; `ex GST = round(inc GST / 1.15)` and `GST = inc GST - ex GST`.
- An estimate is editable pricing work, never a contract. A quote version is an immutable commercial snapshot after send.
- Each project has one base quote family and at most one quote family per add-on scope. The current accepted contract for a family is the latest version that entered the accepted lifecycle. If that version is later declined or superseded, an older accepted version must not revive.
- Accepted job value is the sum of current accepted base and add-on quote versions. Historical quote versions remain visible but do not add to the current contract.
- Fixed-dollar payment terms are removed first. Percentage terms apply to the balance after all fixed terms and must allocate exactly 100% of that balance. The last percentage row absorbs integer-cent rounding.
- An invoice is version-bound, has one immutable whole amount, and is only `OPEN`, `PAID`, or `VOID`. Acceptance may create an open invoice; it never records payment. An invoice is never partly paid.
- Actual money is the net sum of `project_payment_entries`, including negative adjustments and reversals. Allocations explain which quote stage consumed credit; they do not create or change money.
- Open exposure is the sum of all whole `OPEN` invoices for the project, including historical quote versions. Paid and void invoices are not open exposure.
- Available to invoice is `max(0, accepted job value - net paid - open exposure)`. A selected quote also has a scope balance. New invoice availability is the lower of the job-wide and selected-scope balances unless an admin supplies an explicit over-invoice reason.
- Quote acceptance uses the same job-wide ceiling for its automatically created first invoice. If existing credit would make that invoice contradictory, acceptance rolls back visibly instead of over-invoicing.
- Quote acceptance returns the accepted version and prepared invoice snapshot from the same locked database command. Once it commits, artifact refreshes, delivery, marketing attribution, or work-cadence follow-ups cannot make the response claim acceptance failed; a safe retry repairs idempotent side effects.
- The legacy staff first-invoice endpoint is an admin-only compatibility adapter to the same idempotent, capped database command; it no longer inserts invoice rows directly.
- Over-committed value is `max(0, net paid + open exposure - accepted job value)` and must be shown rather than hidden behind a zero remaining balance.
- Project completion requires a current accepted commercial scope, no open invoices, and net paid greater than or equal to accepted job value. Legacy `deposit_paid_date` and `final_payment_date` are projections/compatibility fields, not payment owners.
- `PAID` is also a projection. A later reversal, negative adjustment, reopened/new invoice, or accepted-scope lifecycle change that invalidates settlement moves the project back to `COMPLETED`, clears the compatibility final-paid date, and records the transition.

## Truth matrix

| Displayed fact | Authoritative owner | Formula / binding | Recovery behaviour |
| --- | --- | --- | --- |
| Estimate price | Persisted estimate output produced by `@sp/costing` | Exact estimate version | Recalculate/save the estimate; never substitute a quote total. |
| Quote line and total | `quote_line_items` and stored `quote_versions` cents | Exact quote version; GST reconciles to stored total | Reject malformed totals; sent history stays immutable. |
| Quote status | `quote_versions.status` plus `accepted_at` lifecycle evidence | Exact quote version | Decline/supersede is transactional and audited; a terminal accepted version tombstones older acceptance. |
| Current accepted scope | `commercial_current_accepted_quote_versions` | Latest accepted-lifecycle version per quote family, included only while status is `ACCEPTED` | No fallback to an older acceptance after terminal action. |
| Accepted job total | `commercial_project_financial_truth` | Sum of current accepted base and add-on versions | If no current accepted scope, show historical money separately and block new invoices. |
| Payment-stage amount | `quote_versions.payment_terms` | Fixed amounts first; percentages of remainder; exact cents | Missing legacy terms may use compatibility 50/50. Present-but-malformed terms fail visibly for repair. |
| Invoice amount/status | `deposit_invoices` | Exact invoice and quote version; one whole status | Void preserves the invoice number/history. Mark paid creates one whole matching ledger payment idempotently; reversing that invoice-owned payment reopens the whole invoice. |
| Paid | `project_payment_entries` | Net sum for project | Admin adjustments/reversals require reasons; allocations never change this figure. |
| Open | `deposit_invoices` where status `OPEN` | Whole project, all versions | Historical open invoices remain visible until paid or voided. |
| Remaining to invoice | `commercial_project_financial_truth` | `max(0, accepted - paid - open)` | UI and invoice command use the same job cap; over-invoice requires reason. |
| Over committed | `commercial_project_financial_truth` / matching projection | `max(0, paid + open - accepted)` | Warning remains until invoices, payments, or accepted scope are reconciled. |
| Unallocated credit | Payment projection | Positive net paid not allocated to current schedule | Remains visible as credit; it still reduces job-wide invoice availability. |
| Completion eligibility | `commercial_complete_project_operational_state_command` | Schedule complete, accepted total > 0, open = 0, paid >= accepted | Command rejects with an explicit commercial reason; Running Jobs dates can only project already-proven payment truth. |

## Audited flows

- 50/50 and consent-fees-upfront schedules reconcile to the exact accepted total, including odd-cent rounding.
- Custom fixed and percentage terms are evaluated against the remainder after fixed terms.
- Base and add-on-only quote families contribute independently to accepted job value.
- Superseded and declined accepted versions retain history without reactivating older accepted versions, and their open invoices are voided atomically with the terminal lifecycle change.
- Historical paid invoices remain job credit; historical open invoices remain exposure.
- Manual admin payments, adjustments, reversals, and allocations remain independently auditable.
- Quotes and invoices can be viewed without a current accepted scope; financial history is not hidden and new invoice creation is disabled.

The forward owner migration is `20260813000003_commercial_truth_invariants.sql`. It must be applied through the normal reviewed migration/deployment process; this audit does not apply it to a shared environment.
