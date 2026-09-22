# Marketing Performance - working agreement and delivery evidence

Owning task: Marketing Performance, 22 September 2026.
Workspace: `C:/Dev/sanctuary-marketing-performance-20260922`, branch
`codex/marketing-performance-20260922`, base main `b465222b` (updated 22 September).
Current: date shortcuts, source ranking, prior-period comparison and weekly trend
implemented. 29 focused tests, lint, Portal typecheck, architecture/docs/brand guards
pass. Hosted Preview build Ready (27s). Independent trend review and exact hosted
browser verification pass. UI ready for owner review; no production release.
Historical data cleanliness remains unresolved: the report excludes only the known
exact test IDs, not all historical tests. The owner approved the two specific
receipt-link corrections, now committed in production and verified by a separate
read at 04:20 UTC on 22 September. All other receipt fields and both project rows
were preserved; the ambiguous match remains unlinked. The private backfill review
retains the evidence and staff qualification queue. Historical test exclusions
still need an auditable agreed approach. Physical-phone/human acceptance remains
unverified. This correction does not release the reporting feature.
Current next stage: execute the owner-approved developer-only release. Page/API/current database
identity now restrict reporting to verified `jordan@sanctuarypergolas.co.nz` with
Portal access; other staff/admins have no Marketing menu entry. Staging migration
rehearsal and installation passed; hosted allow/deny checks and independent access
review passed. 118 focused tests, lint, typecheck and architecture/docs/text guards
pass. Updated hosted Preview is Ready on current main, with staging data only.
Owner approved this exact restricted production release on 22 September. Release
and production verification are in progress; do not treat preview evidence as live.

Current restricted preview:
https://sanctuary-portal-lku3rfpq1-jordans-projects-43df95bd.vercel.app/staff/marketing-performance
Sign in with Jordan's existing staging account; this supersedes earlier preview
URLs below. Production account access is not a promise of shared staging credentials.

## Agreement, decisions and authority

- Owner **yes** to the explicit restricted production release question
  (22 September): authorizes publishing this reviewed feature and installing its
  two report migrations, with access limited to Jordan. This supersedes the
  original no-release boundary for this feature only. No additional business data
  corrections, test exclusion decisions, qualification writes, spending or customer
  communications are included.

- Owner latest request (22 September): consider production release, but restrict
  this page to `jordan@sanctuarypergolas.co.nz` for now. Developer-only access is
  implemented; broader staff access is superseded. Existing Portal access and
  email verification remain required. Preparing/reviewing the release does not
  supersede the original explicit production release prohibition.

- Original owner request: a bounded staff report connecting observed marketing
  activity to authoritative enquiries/projects, with drill-down, unknown attribution,
  explicit definitions and reliable costs only. No advertising management, tracking
  persistence, customer-form changes, CAPI repair or automated vendor integration.
- Owner spend reply: **Show unavailable costs; propose CSV import.** No spend ledger
  or persistence added. Missing spend never means zero.
- Owner screenshot feedback: add fast7/30/90-day and year-to-date choices; remove
  warning banners. Implemented also12months and previousYTD, retaining custom dates.
  PreviousYTD means1January to the same calendar date last year, with leap-day clamp.
  Informational banners superseded by quiet preview labels and metric-local notes.
  Actionable failed-read errors retain Retry. Added ranking/rates and awaiting-review.
- Latest owner reply: **yes** to previous-period comparisons and weekly enquiry
  trend; asks whether backfill is possible. UI/read implementation and investigation
  authorized; production import or historical mutation was not authorized then.
- Subsequent **go ahead** (22 September) progressed the backfill investigation and
  concrete review batch. The original explicit production-mutation prohibition
  remained the boundary pending approval of the exact proposed correction.
  Private evidence and review: `.local-evidence/backfill-review.md` (ignored,
  untracked, excluded from deployment). Two proposed links pass read-only contact,
  null-link, same-Auckland-day origin and attachment checks. No writes rehearsed.
  Test-labelled historical submissions materially limit interpretation of totals;
  no automatic classification, deletion, qualification or attribution reconstruction.
- Owner **approved** the exact two links in the immediately preceding review
  request (22 September). This supersedes the mutation prohibition only for those
  links. A guarded transaction revalidated contacts, null links, prior origins,
  same NZ date and zero attachments, changed exactly two project_id fields, and
  asserted complete preservation of other receipt fields and project rows.
  Separate post-commit read confirmed persisted links and origins; the held match
  remains unlinked. Private audit: `backfill-approved-links-result.json` and
  `backfill-postcommit.json` under `.local-evidence`; ignored and untracked.
- No production release, other database mutation, spending increase or customer messages.
  Staging received only the read RPC/migration ledger after rollback rehearsal.
  Existing Vercel Preview project is used with deployment-specific staging credentials;
  staff access remains authoritative. No Git commits/history/PR were published.
- Overlap check: separate business-overview lane owns Praxis overview/workload and
  its dirty files. This worktree does not change that work.

Authoritative docs: `platform-workflow.md`, `security-privacy-quality.md`,
`automation-email-audit.md`, `supabase-schema-map.md`, `quotes-invoices-job-packs.md`,
`staff-api-auth-contracts.md`, `ui-foundation.md`, `testing-and-qa.md`.

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
| Money/spend | Counts only; quoted value, accepted value and receipts are not labelled revenue. Spend/costs unavailable. | UI and owner decision |
| Prior period | Adjacent equal inclusive day count, same source/campaign. Received/current qualified counts only; no wins comparison. Zero baseline has no invented growth%. | Date/zero tests; qualified-as-of/age caveat beside comparison |
| Weekly trend | Monday-Sunday buckets clipped to selected dates; bar height enquiries per included day. Exact count/day table includes empty weeks and retains expanded choice. | Sums and Auckland boundary tests; browser review |
| Failures/privacy | Each current/prior read independently verified; missing prior never zero. Current failure shows no totals. Abort/sequence guards. Staff RPC/API, private no-store, minimal fields. | Permission/API and paired-read race/failure tests |

Read path: `marketing_performance_read(date,date)` is one bounded statement per
period (up to366days,2000receipts; overflow fails closed). New UI uses two parallel
calls through the unchanged staff API. Source/campaign filtering reuses both complete
snapshots, including options present only in prior data. No business writes.
Named owners: `lib/marketingPerformance/{contract,dateRanges,trends}.ts`,
`components/marketingPerformance/`, staff route and API, migration
`20260922000002_marketing_performance_read.sql`. Existing large shell/proxy receive
only exact QA-path allowlist additions; extraction would broaden risk/scope.

Main revalidation: campaignSession retains30-minute consent-gated tab context;
ContactEnquiryForm posts `/api/enquiry` and emits browser Meta Lead after success.
Server Meta lead remains on legacy `/api/contact`. Downstream GA4 deliveries are
not authoritative outcome evidence. Earlier research visits cannot be reconstructed.

## Checks and independent review

- 29 current focused tests pass: SQL/API boundaries; dates/ranking; weekly sums,
 partial/empty buckets; comparison zero/failure and stale paired reads; return scroll.
 Prior94-test permission/navigation/shell run remains valid for unchanged shared code.
 Focused lint, Portal TypeScript, optimized hosted build and architecture/docs/brand
 guards pass. Earlier package/cache/text guards also passed; final diff checked.
- Actual staging schema: full rollback rehearsal, then exact read RPC installed.
 Missing confirmed_at is disclosed; no staged business records altered. Production
 receipt/older-period reconciliation and backfill coverage audit use BEGIN READ ONLY /
 ROLLBACK, aggregate output only. Synthetic positives complement actual read evidence.
- Reference: owner-endorsed Portal Foundation, Projects Index filters/record links.
 Reused StaffPageHeader, PageLayout, Card, MetricGrid, Input/Select/Button and tables.
 No shared tokens, marketing styling or chart dependencies introduced.
- Initial independent review caught lost reading position; two bounded corrections
 preserved footprint and scroll during/after Back. Source/filter/evidence retained.
 Owner feedback then identified banner clutter/date effort missed by the initial
 review; quiet contextual notes and one-click ranges addressed it. Independent
 refinement review passed with no material findings, including390px and keyboard.
- Latest trend source identity: `.local-evidence/trends-review-version.json`,20files,
 zero drift at deployment. Independent trend review passed with no material findings. Builder
 ratings do not substitute for independent evidence or owner acceptance.

Private evidence is ignored by Git info/exclude and explicit Vercel exclusions:
`.local-evidence/` includes SQL rehearsals/aggregates, logs and frozen manifests.
Latest upload manifest has4316files and zero private-evidence/credential files.
No new media: unchanged public-main assets only. One-time staging staff login tokens
are consumed/deleted; no auth email, permission/password change or credential output.
The root local build wrapper misidentifies another active dev/Codex process as a
conflicting build despite isolated output; direct isolated and hosted optimized
builds pass without interrupting other work. Do not report the wrapper itself passed.

## Review access and remaining limits

Latest hosted preview (supersedes the two earlier URLs):
[Marketing Performance preview](https://sanctuary-portal-k0d1d4ako-jordans-projects-43df95bd.vercel.app/staff/marketing-performance)
Exact hosted staff page verified: comparison dates/counts, filtered weekly totals and disclosure; Chrome review tab retained. Preview reads staging test records, not live
business results. Another device needs staging staff sign-in; physical-phone use
has not been verified. Local populated synthetic preview remains at
`http://127.0.0.1:3024/qa/marketing-performance-fixture`; its sample project is not
the actual project workflow. Staging normal project/Original enquiry supplies that
journey evidence. Hosted fixture routes stay disabled in production-mode builds.

Qualification remains configured-residential only. No universal spam classifier,
complete historical attribution or end-of-period qualification snapshot is claimed.
Spend remains unavailable. Legacy CAPI/current-form parity is a recommendation,
not implemented scope. Human acceptance and any production rollout remain separate.

## Backfill recommendation - proposed, not executed

Existing historic receipts/linked outcomes will be read automatically on release;
the staging preview's small totals are not the production dataset. The private
aggregate audit identifies existing unlinked receipts, eligible unreviewed records,
and projects lacking a receipt. Its earliest receipt does not prove complete earlier
history. No source/referral fields exist on contacts/projects, and existing contact/
project import tools do not import authoritative enquiry receipts.

1. Prepare a dry-run match list for existing unlinked receipts -> existing projects,
   keeping receipt IDs, original dates and evidence. Flag ambiguity/duplicates;
   do not match solely on a similar name or create repeat projects silently.
2. Staff assess eligible receipts through Original enquiry. Record decisions now,
   without backdating or forcing legacy/commercial leads into inapplicable criteria.
3. For genuinely missing enquiries, prepare a small import from original emails,
   CRM or CSV exports: stable external ID, received date, target project, provenance,
   review status and any permitted source evidence. Preview each write first.
   Do not replay intake emails, analytics, jobs or customer notifications.
4. Restore observed source only from exact original evidence under applicable
   consent. Customer recollection stays separately labelled. Platform-attributed
   totals do not establish unique receipt attribution; no invented research history.
5. Reconcile visit/quote/acceptance/payment records through existing governed owners,
   not report-specific stage flags. Preserve quoted, accepted and received values.

Recommended first batch: match existing unlinked receipts and perform eligible
qualification reviews. Next input for older history: original enquiry email/export.
Production backfill requires the concrete reviewed batch and separate write authority;
no importer, historical mutation or broader qualification policy was implemented.

Spend CSV proposal remains separate: inclusive Auckland dates, exact source/campaign,
NZD amount, tax basis, evidence reference, preparer/verification time; reject duplicate
or overlapping coverage, mixed currency/tax basis and unverified/partial coverage.
Verified zero differs from absent spend. Cost ratios use covered spend / qualified
enquiries or unique won origin projects; no denominator means unavailable. Period
spend is not necessarily acquisition cost of that enquiry cohort.
Final independent trend review:12vs4 synthetic enquiries and4vs1 qualified reconcile;
weekly5+7+0+0 totals12 over6/7/7/2days. Previous-only source selection, zero baseline,
prior-only failure and both-failed state, rapid/custom periods all passed. Expanded
weekly detail plus filter/evidence choices and scroll survived actual project Back
(y2019) and390px sample Back(y3625.5). No correction round required for this stage.
Reviewer inspected backfill framing, not the private aggregate audit/import batch.

Compact assessment: outcome/correctness8/10 (tests and actual read reconciliation);
usability/clarity8/10 (independent tasks, dates/denominators and unknown history);
visual/accessibility8/10 (Foundation,390px, keyboard disclosure); system fit,
maintainability and reliability8/10 (existing truth owners, bounded named read hook,
independent failures/races and stable return); privacy/security8/10 (staff boundaries,
minimal reads and reviewed payload exclusions); performance/cost8/10 within bounded
scope (two capped reads, client filters, no integration/library; production-scale
latency not independently measured); desktop handover8/10 (working hosted exact
page verified). These are reasoned assessments, not owner acceptance; physical-phone
use remains unverified. This assessment preceded the two subsequently approved
receipt-link corrections recorded above. No reporting production release performed.

## Developer-only release preparation (22 September)

Owner's latest restriction is enforced in three places: verified server identity
on the page and API, current verified auth identity plus Portal access inside the
RPC, and shared sidebar/rail/drawer visibility. Xero reuses the same extracted
developer predicate without changing its access. An admin role alone is insufficient.
The forward migration preserves the previously applied staging migration unchanged.

Verification: 118 focused SQL/API/page/navigation/return/date/trend/shell/proxy tests
pass; the reviewer independently ran 18 boundary tests and inspected the hosted
Dashboard-to-Marketing-to-project-and-Back journey. Date/source selections and
scroll remained intact, including the mobile drawer. Builder observed other-staff
menu omission and direct-page 404. Real hosted HTTP reads with existing staging
identities returned developer 200 with report, other-staff 403 without report,
anonymous 401 without report; every response was private/no-store. Staging full-schema
rollback rehearsal and installed migration both exercised actual authenticated
role allow/deny. Production read-only preflight confirms existing dependencies,
Jordan's verified Portal identity and no report function/migration installation.

Exact private artifacts: `developer-review-version.json`, `developer-http-verification.json`,
`developer-staging-rehearsal.json`, `developer-staging-install.json`,
`developer-production-preflight.json`, and final check logs under `.local-evidence`.
Ignored/untracked evidence stays excluded from Vercel uploads; no private backfill
records or credentials are in the feature source. Shared navigation filtering was
extracted into its existing owner; no new policy branch was added to shell layout.

Independent access-stage assessment: security/correctness and system fit 8/10;
journey/reliability 8/10 with observed hosted evidence. Builder final HTTP checks
close the reviewer's stated API verification limit. Physical-phone and human
acceptance remain unverified; fixture data never establishes production outcomes.

Prepared release: install both reporting migrations atomically (so the temporary
staff-wide version is never committed), then deploy the Portal against existing
production configuration, never promote the staging-configured preview. The exact
guarded SQL batch is `developer-production-install-PENDING-APPROVAL.sql`, not run.
No business-record writes are part of this release. Postflight must verify Jordan's
report plus other-staff/anonymous denial, real period totals and project navigation.
Historical test cleanup and qualification assessment remain separate outstanding
business-data work; costs stay unavailable. No production release, Git push or
merge has been performed for the feature.
