# Marketing Performance and Marketing & Sales hub

Current stage: **approved production rollout; database ready** (22 September 2026). Owning task: Marketing Performance. Release PR178 extends the Jordan-only report released in PR174. The owner's latest "push live" authorizes publishing this reviewed batch and installing its read-only hub function. Exact production rollback rehearsal, installation, reconciliation and identity-denial assertions passed; postflight confirms the installed function matches the reviewed body and migration ledger. No business records changed. The application rollout and canonical-domain postflight are tracked in [PR178](https://github.com/velt-design/sanctuary/pull/178); merge only after all required checks pass. The verified review preview remains available while release completes.

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
