# Marketing Performance and Marketing & Sales hub

Connection ownership follow-on (23 September 2026): Jordan approved a
marketing-first inventory and migration scope under the
[business connection ownership decision](target-architecture.md#business-connection-ownership-owner-decision-23-september-2026).
The first implemented provider move is the existing bounded Meta campaign reader
from Velt to Sanctuary. It does not change this hub's populations, definitions,
Jordan-only audience or current unavailable-spend behavior. Platform-attributed
leads stay separate from verified business outcomes. Matching spend to enquiry
cohorts requires explicit evidence; a provider report is not sufficient to
enable cost-per-qualified-enquiry or cost-per-win. The paired Velt delivery
record owns migration progress. PR187 deployed the source path; PR188 corrected
snapshot cleanup while preserving the production safeupdate guard. On 23 September
Jordan subsequently approved step 4, and Velt's active Meta source switched to
Sanctuary after parity/lifecycle proof. Normal Analytics and the built-in Praxis
review were verified against the source report. Source authority expires with the
existing credential on 9 October; direct Velt authority remains for rollback.
This hub's UI and existing business measures remain unchanged.

## Current working record — visual follow-on handoff (23 September 2026)

Status: first batch implemented; technical/browser checks passing, independent review pending. Not released.
The existing hub is live; the prior PR178 rollout paragraph is superseded by the
reported 23 September live inspection. Fresh API/RPC coverage and local browser validation passed for this batch;
protected hosted review and independent acceptance remain pending.
Owning task: existing Marketing Performance task. Sole writer: root, isolated
`C:/Dev/sanctuary-marketing-visuals-20260923`, branch
`codex/marketing-visuals-20260923`, based on current main `c6c1c62c`.
Open PRs checked: no marketing visual owner overlaps. Work Queue and recorded
commitments belong to the separate Review Sanctuary and Velt OS task.

Authority: Jordan approved implementation and review of this bounded batch on
23 September. Production release, provider adapters, spending, customer messages
and business-data mutations remain outside this approval. Next action: independently review the hosted preview and fix material findings. Fresh authenticated live API
and RPC reconciliation passed for the 366-day read ending 23 September; private
counts/coverage/payload evidence is in `.local-evidence/coverage.local.json`.
Qualification is wholly unassessed/unavailable in this read; source coverage is
sparse. Synthetic cases must additionally cover reversals and assessed enquiries.
No new business definition is proposed. Relevant review dimensions: correctness,
journey, clarity, visual/accessibility, fit, maintainability, recovery/security,
performance and handover; no commercial or write-workflow acceptance is claimed.

Implementation evidence: shared `SalesActivity` owns Overview/Sales rendering;
`salesActivity` owns clipped Monday-Sunday/monthly aggregation. `salesBucket`
round-trips in URLs/saved views. `SourceOutcomes` reuses `sourceMeasures` and
summarize; aligned bars show the displayed population percentage, not a funnel.
Existing detailed source measure controls and source/campaign comparison remain.
Live read schema and source reconciliation passed (264 date/source buckets and
20 source/outcome cells). Fixture journeys passed: bucket switching and stable
chart size, keyboard selection, repeated-submission exclusion from project
outcomes, reversals, saved views, project/Back/reload, failed reads and 390px
reduced-motion containment. No real financial actions or customer writes tested.
Hosted fixture access is explicitly opt-in on Vercel Preview and remains forbidden
in production. Its project drill-through is synthetic and read-only; it cannot
establish live editing capability. No snapshot/customer data is packaged.
Publication review: all changed source/docs/fixtures inspected; private capture,
credentials and evidence are git-ignored, untracked and excluded by .vercelignore.
Only fictional fixtures leave the private workspace. No shared UI owner changed.

### First batch and acceptance criteria

- Sales activity: reuse the Overview's quote-version sent/accepted count and net
  recorded receipt trends in the Sales view. Use weekly/monthly buckets, clipped
  to inclusive Auckland dates, with empty buckets and partial-period boundaries
  handled explicitly. Counts and money use separate axes/charts. Payment reversals
  and unavailable amounts retain the existing contract; never label this revenue.
- Enquiries: aligned source/outcome comparison for submissions, eligible
  qualification, sent-quote projects, current accepted scope and payment-verified
  projects. Show each population/denominator through compact contextual detail,
  with explicit unknown coverage. These are not unique people or a shrinking
  funnel; skipped stages and absent evidence do not establish losses.
- Reconciliation: each bucket/series total matches its selected underlying records;
  chart selection opens exactly the dated events or source cohort represented.
  Verify repeated submissions, multiple quote versions, withdrawn acceptance,
  reversals, missing amounts/source, date boundaries and zero/unavailable states.
- Journey: retain source/campaign/date filters, saved views, keyboard equivalents,
  record-to-project drill-through and Back selections/reading position. Verify
  changes, loading, errors and return in stable chart regions without layout jumps.
- Reference/owners: preserve the owner-endorsed dominant visuals and compact
  controls; current Portal Foundation tokens/drawers and Recharts remain owners.
  Reuse `BusinessOverview.tsx`, `EnquiryCharts.tsx`, `HubRecords.tsx` and
  `lib/marketingPerformance/{overview,charts,contract}`. No new chart library or
  copied aggregation policy. Extract a shared trend owner only if reuse needs it.
- Readiness: focused calculation/contract tests, required repository checks and
  independent delivery review of normal entry through records/project/return.
  Provide protected hosted review access using existing agent-managed facilities;
  distinguish synthetic preview evidence, real-data reconciliation and physical
  phone acceptance. Do not ask Jordan to arrange sign-in. Review complete outgoing
  commits and rendered artifacts: public GitHub receives synthetic examples only.

Meta campaign visuals remain a separate proposal requiring a Jordan-authorized
Portal adapter. The received cutover record reports source production `c6c1c62c`
and Velt verified code `8c07b538`; authority expires
`2026-10-09T03:14:00.250Z`. This batch changes neither source/credential controls
nor retained direct-Velt rollback authority. No provider conversions or spend are
joined to business outcomes without separately established evidence.

Continuity sources: architecture-task handoff received 23 September; source note
`2ccff233` in `C:/Dev/sanctuary-connection-ownership-20260923` and paired migration
record `de0f7fe` in `C:/Dev/velt-sanctuary-ownership-20260923`.
Their cutover status is carried forward as reported evidence, not a fresh runtime
verification. Only the relevant source-note facts are reconciled here; no branch
cherry-pick. This document remains the single working record for the visual batch.

Live route: https://portal.sanctuarypergolas.co.nz/staff/marketing-performance . Access remains restricted to verified `jordan@sanctuarypergolas.co.nz` plus existing Portal membership, independently enforced by page, API and database. Other staff/admins are denied. No business-record cleanup, tracking changes, vendor integrations, spending or customer messages are authorized.

## Agreement and current experience

- Original outcome: connect observed marketing activity to authoritative enquiries and projects, with checkable records, unknown attribution and reliable costs only.
- Owner approved unavailable costs and a proposed CSV import, rather than new spend persistence or integrations.
- Owner requested quick 7/30/90-day, year-to-date, previous year-to-date and 12-month ranges; custom dates remain. No informational warning banners; definitions and missing-evidence explanations are contextual.
- Owner comparison against the project pipeline exposed different populations. Four explicit views now separate current Business overview, receipt-date Enquiries, event-date Sales activity and current Project portfolio. No synthetic receipts or attribution are invented to reconcile them.
- Owner approved a flexible visual hub: source/rate charts, weekly and monthly trends, current stage composition, open-project age, evidence filters, optional project-created dates and browser-local saved views.
- Owner requested major UI simplification using the Sanctuary configurator's ethos: dominant visuals, compact choices and contextual detail. The reference was inspected at `/configurator-preview` (ConfiguratorDialog/previewShell owners), including Plan recovery, Pitched/Gable changes and closing. Portal Foundation controls, cards, typography, tokens and Drawer remain authoritative. No marketing styling was imported.
- The compact toolbar, filter/saved-view drawers, fixed filter-chip row and chart help compose existing owners. Counts still lead to records; project navigation and Back preserve choices and reading position.
- Earlier backfill approval covered exactly two evidenced receipt-to-project links, completed and privately audited. An ambiguous candidate remains untouched. This release authorizes no additional historical mutations. Earlier preview-only release boundaries are superseded only by the latest "push live" instruction.

## Metric contract and implementation

| Requirement | Definition / owner | Status and evidence |
| --- | --- | --- |
| Dates | Inclusive Auckland enquiry dates; subsequent current outcomes, not period sales. Quick ranges/custom dates persist in URL. | Verified date/leap/DST tests and browser journeys |
| Enquiries/repeats/projects | Saved receipt IDs; intake retry IDs deduplicate. Distinct submissions remain distinct; project outcomes credited only to earliest recorded receipt by created_at,id. Manual projects without a receipt excluded. | SQL/API tests and direct receipt reconciliation |
| Qualification | Existing enquiry_qualification_read / configured-enquiry-v1; eligible configured residential only. Latest explicit staff assessment; eligible includes qualified/not-qualified/unreviewed. | Tests for correction; actual Original enquiry walkthrough |
| Visits | Persisted confirmed_at or current CONFIRMED legacy status. Confirmation is not attendance. Missing timestamp column explicitly uses current status and says so beside metric. | Staging schema rehearsal, SQL tests and UI |
| Quotes/acceptance | Projects with sent/accepted quote versions; no drafts. Acceptance uses commercial_current_accepted_quote_versions, honoring withdrawn scope. | Existing owner reused, tombstone tests |
| Wins | Unreversed positive Xero payment match, or PAID first-instalment invoice on current accepted scope. Stage/analytics delivery not proof. | Reversal/current-scope tests; read-only older production cohort includes actual outcomes |
| Source/coverage | Consent-permitted saved UTM, never reconstructed. Source-known receipts / included receipts. Campaign-only stays unknown source. Customer-reported source and platform claims remain distinct/unavailable. | Consent/missing-source tests; visible unknown group |
| Exclusions | Exact existing Praxis labelled-test IDs reused. No universal spam/test classifier; others remain included. Lost/not-qualified are not automatically spam. | SQL tests and disclosure |
| Drop-off | Missing stage evidence and recorded lost projects; open or skipped-stage journeys are not inferred losses. | Source and supporting-record views |
| Money/spend | Receipt-cohort outcomes are counts; sales money is net recorded receipts. Quoted value, accepted value and receipts are not labelled revenue. Spend/costs unavailable. | UI and owner decision |
| Prior period | Adjacent equal inclusive day count, same source/campaign. Received/current qualified counts only; no wins comparison. Zero baseline has no invented growth%. | Date/zero tests; qualified-as-of/age caveat beside comparison |
| Weekly trend | Monday-Sunday buckets clipped to selected dates. Source chart counts receipts; the supporting historical trend uses enquiries per included day. Exact count/day tables include empty weeks. | Sums and Auckland boundary tests; browser review |
| Failures/privacy | Each current/prior read independently verified; missing prior never zero. Current failure shows no totals. Abort/sequence guards. Staff RPC/API, private no-store, minimal fields. | Permission/API and paired-read race/failure tests |


## Hub populations and sources

`marketing_sales_hub_read(date,date)` first calls the existing guarded receipt reader. It returns the whole current project portfolio (maximum 5,000) and selected-period dated commercial events (maximum 10,000); overflow fails unavailable. Receipt reads remain bounded to 366 inclusive Auckland dates and 2,000 receipts. Browser filters operate over the complete bounded response, never a silently truncated set.

Portfolio stage comes from `projects.pipeline_stage`; owner from `project_owner_assignments`; state from `project_operational_states`, with archive precedence. Manual and older projects are included even without receipts. The known test project remains labelled in the portfolio for reconciliation; receipt/sales populations retain established exclusions. Suspected tests are evidence candidates, not automatic exclusions.

Overview age means Auckland calendar days from project creation to the read timestamp for ACTIVE/WAITING projects. It is not inactivity, time in stage or overdue work. Buckets partition those projects, including future-date evidence when present. Age inspection sorts oldest first and disables the optional project-created date restriction.

Sales activity counts dated quote-version sends/acceptances, including later superseded history. These are not current accepted-scope project counts. Net recorded receipts sum dated PAYMENT and REVERSAL ledger entries; adjustments and invoice-paid status events are separate, not additional money. Unknown amounts remain unavailable. Quoted value, accepted value and receipts are never combined as revenue.

Source evidence is the original consent-permitted saved receipt. Customer-reported source and Google/Meta attribution claims remain separate from verified business outcomes. Main revalidation found the existing 30-minute consent-gated tab context, `/api/enquiry` browser Meta Lead and legacy `/api/contact` server Lead; none establishes earlier research visits or current CAPI parity. Analytics delivery is not outcome evidence.

Owners: `lib/marketingPerformance/` (contracts, selectors, charts, overview and dates), `components/marketingPerformance/` (views and controls), the staff page/two protected APIs, and migration `20260922070001_marketing_sales_hub.sql`. Recharts is reused consistently through a bounded feature chart layer; Portal components own surrounding UI. Chart alternatives expose exact counts, dates and denominators to keyboard users. Stable plot heights and disabled entrance animation preserve layout.

## Verification and review

Implemented and verified before release: 94 focused tests across reporting, exact SQL, fixtures and shared overlay owners, full lint, Portal typecheck, architecture/docs checks and optimized hosted build. Earlier exact-SQL tests and staging full-schema rehearsal cover the forward function, access denial, dates, reversals and portfolio bounds. Current-main architecture, strict decomposition and documentation guards also pass. Final CI/deployment evidence is attached to PR178.

Builder verification used a private frozen production snapshot and independently reconciled receipt/project populations, all age buckets and monthly quote/payment values. Both protected APIs matched the captured payload; other staff and anonymous identities were denied, private/no-store headers were present, and artifact/fixture routes exposed no data. Real chart -> live project -> Back passed. Real records, SQL outputs, screenshots and authentication evidence remain in ignored private storage, not source fixtures or public documentation.

The independent delivery reviewer exercised normal entry, locating important figures, all four views, chart/table inspection, editing/cancelling filters, saving/restoring choices, project return, keyboard focus and desktop/mobile-size layouts. Corrections closed: native query writers now allow Next to synchronize return URLs; payment dots remain clickable; shared overlay locking restores reading position and nested styles; backdrop close restores trigger focus. No material finding remained. Drawer/Modal/Schedule consumers retain their lock contract. Physical-phone testing is unverified; viewport checks do not establish physical-device acceptance.

Agent evidence assessment before release: correctness and system fit meet the 8/10 review standard through exact SQL/data reconciliation and existing business owners; clarity/visual/journey/recovery meet it after independent corrections; security, maintainability and performance meet it through guarded bounded reads, focused owners and hosted build. Production handover remains pending live postflight. Ratings do not replace owner acceptance or access checks.

## Preview and publication boundaries

The reviewed private hosted preview uses staging authentication and an explicitly labelled frozen real snapshot, not a live feed. The local development fixture uses fictional records only. Neither is the production data path. `MARKETING_PERFORMANCE_PREVIEW=production-snapshot` is preview-only and fails closed outside Vercel Preview; artifact reads occur after authorization. Packaging copies must be removed after each approved preview. Production uses the database RPC, with snapshot mode absent and no private artifact deployed.

Before publication, inspect the complete outgoing commit/diff, docs, fixtures and deployment manifest. Keep private snapshots, credentials, customer identities, financial values and rendered customer media out of Git/public assets. The private historical working evidence is retained under ignored `.local-evidence/`; this compact record owns current decisions and status.

## Remaining limits and proposed next inputs

Historical receipts, qualification assessments, visit timestamps and payment evidence are incomplete. Current pipeline status is not proof of a dated payment. Missing source stays unknown, never direct traffic. No universal spam classifier or reconstructed attribution is claimed. Previous periods with no saved receipts are not proof of no historical enquiries.

Backfill requires original evidence: review exact existing receipt/project matches; assess eligible enquiries through Original enquiry without backdating; prepare imports with external ID, original received date, project link, provenance and explicit consent-permitted source. Do not replay intake messages, analytics or jobs. Any further write batch needs its own concrete review and authorization.

Proposed spend CSV (not implemented): period start/end, observed source, campaign, currency (NZD), amount and evidence reference. Validate overlapping/duplicate periods, currency and source matching, preview rejected/unmatched rows, and retain provenance before persistence. Costs remain unavailable until reliable spend and a defensible matching denominator exist. No Google/Meta claimed conversions are summed into unique business outcomes.
