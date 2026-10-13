# Google advertising connections

## Candidate status and ownership

This is an install-only, default-disabled release candidate. It has not enabled
Google APIs, granted OAuth scopes, changed an advertising action, deployed a
schedule, uploaded a customer record or demonstrated attributed production sales.
Jordan approved the deposit/full accepted-scope value definition and staged
production rollout on 13 October 2026. This records approval, not completed
activation. Release spending, exact deployment and live verification remain
coordinated by the owning task. Browser access is setup and
diagnostic access; the ongoing collectors are server-owned.

`lib/marketingIntegrations/googleAds` owns the source credential adapter, provider
contracts, sale preparation, delivery and report collection. It reuses the tested
GA4 vault adapter with a **separate advertising item and grant**. It never changes
the existing GA4 credential. The forward `20261013000001` and `000002` migrations
own source facts, control, lease fencing, delivery receipts, suppression and saved
reports. Application roles have no direct private-table rights. Authenticated
confirmed developer access owns the staff read, using the existing Portal guard.
Forward migration `20261013000003` extends the immediate source fingerprint check
to claimed retractions; the first two installed migrations remain unchanged.
The exact Google store module is registered in both service-role architecture and
Portal boundary allowlists; no directory-wide exception is granted.

The existing Marketing & Sales Data sources drawer provides campaign and keyword
inspection and a separate delivery-coverage section. No ad-management, campaign,
bidding or public-site tracking-policy changes are included. The privacy page and
enquiry notices disclose the new sale-measurement sharing. Velt remains a potential
consumer of Sanctuary-owned evidence; it is not a second collector or sale owner.

## Business and privacy contract

The approved Closed Sale is one currently accepted **quote family/commercial
scope** with a verified first-instalment deposit. An unreversed positive Xero
deposit match counts even when the invoice remains OPEN; a PAID positive
first-instalment invoice also counts. Multiple payment rows and duplicate first
invoices cannot produce multiple scope sales. A later accepted revision uses the
same family identity and updates its full accepted value. Paid prior versions
within that family preserve the original deposit evidence. Distinct add-ons are
separate scopes. CANCELLED projects and withdrawn current acceptances are not
current sales. Pipeline labels are not proof of payment.
Only current paid scopes and previously assessed delivery records enter delivery
coverage. Never-paid drafts and unaccepted scopes are not counted as missed sales.

Occurrence is the earliest applicable payment-ledger timestamp, falling back to
the invoice's saved `paid_at` only where there is no unreversed ledger payment.
Only NZD invoices are eligible. The amount is the current accepted scope's stored
GST-inclusive NZD value, **not** the deposit amount or banked revenue. Jordan
approved these date/value and first-deposit semantics on 13 October 2026. Existing
explicit test project/receipt exclusions match the marketing owner.

The first non-test linked enquiry supplies the original submitted email, phone,
click identifiers and saved consent provenance. Current contact records are not
substituted. Consent must be JSON boolean true. A separately approved control
lists accepted consent bases and the earliest enquiry date covered by the reviewed
advertising-data policy. Empty policy, unknown basis, older receipts and known
opt-outs cannot dispatch. The original receipt must also contain the exact current
`advertisingDisclosureVersion` emitted by the form bundle that displays the notice
(`2026-10-sale-measurement-v1`). The intake normalizes missing, unknown and malformed
versions to null; it never adds the current version based on server time. A tab
opened before release remains ineligible after release. This is disclosure provenance,
not an extra opt-in or proof that someone read a policy. Both preparation and the
database freeze enforce it. This does not redefine the website's existing NZ
regional tracking policy or claim that a regional default was an explicit click.
The approved policy may include that existing basis; the original basis remains
unchanged. A further default-off control is required before hashed contact data
is included. Missing historical permission cannot be repaired by hashing.

Known later withdrawals are recorded in `private.google_ads_suppressions` against
the project, with operator/reason/time. Original enquiry consent is a snapshot,
not a current global preference registry. Before activation the operator must
establish how customer opt-outs reach this suppression record. Do not infer later
consent from an unrelated browser session. Every dispatch rechecks current source
and suppression facts. A request already in flight can finish after revocation;
the next reconciliation preserves its identity and correction requirement.

Email is normalized and SHA-256 hashed; Gmail/googlemail dots and plus suffixes
are removed according to current Google formatting guidance. Phones are hashed
only when already unambiguous E.164 after punctuation removal. Local NZ-looking
numbers are not silently assigned a country. A valid email can match without a
phone. Only hashed contact values and permitted click IDs enter the frozen private
event. No names, addresses, notes or CRM raw payload are exported. New events older
than 90 days are held; enhanced-only origin enquiries older than 63 days are held.
A recent enquiry does not establish the original click date or guarantee matching.
Provider lookback limits and account eligibility can reject additional records.

## Delivery and recovery

The runtime and operator preflight share `ingestWire.mjs` for the Data Manager
request envelope. Each destination has the stable request-local reference
`sanctuary_closed_sale`; each event names that reference explicitly. Live validation
reported `NOT_FOUND` on the destination-reference field. Explicit routing removes
reliance on the documented all-destinations fallback; a successful live validation
is still required to distinguish routing from new-action availability. Routing
metadata is added only at the wire boundary, leaving frozen source events and
destination identity unchanged. Status reads still
verify the account, manager and action; an echoed reference must match, while its
absence alone does not contradict the pinned account/action identity.

`sanctuary-scope-<quote UUID>` is the stable transaction/order ID. Small hourly runs
freeze authoritative eligible facts, dispatch at most five rows and later inspect
one-event Data Manager request diagnostics. Retry uses that same identity, date
and value. Data Manager duplicate transaction IDs support value restatement.
Transport/429/server failures retry with a bounded attempt ceiling; explicit
provider errors remain visible. A processing response is not success. An ingestion
SUCCESS must match the pinned destination and record count. It still does not
prove matching or advertising credit, which remain separate report evidence.

Credential refresh and possible rotation have a durable uncertainty checkpoint.
An uncertain token or vault write quarantines subsequent runs. Operators reconcile
the specific run and vault item; lease expiry does not make a credential retry
safe. Disabling control takes effect immediately through generation fences and
preserves frozen event/destination evidence. A provider request in flight cannot
be unsent. Changed account/credential bindings hold existing deliveries for review.

Before initial sending, cancellation suppresses the event. After possible sending,
real retractions use Google Ads `uploadConversionAdjustments` with RETRACTION and
the original transaction ID, separately enabled. Zero-value restatement is never
called a cancellation. Indexed/partial failures and uncertain adjustment results
require review; WBRAID retractions require operator handling. Data Manager-origin
to Ads-retraction portability remains a post-approval live verification item.
Manual correction using Google's supported import workflow is the fallback.
Restoring a terminally retracted family cannot silently reuse that irrecoverable
order ID; it requires a reviewed new legitimate sale cycle. Merely ageing beyond
an upload window never retracts a valid sale. Identity/date changes after sending
are held rather than silently rewritten.

Any possibly attempted dispatch, including a timeout before Google returns a
request ID or an expired sending lease, keeps its original event and destination.
Unconfirmed value changes also require reconciliation. Only a confirmed accepted
event permits an automatic value-only restatement with the same identity/date.
Eight ingestion attempts exhaust the automatic delivery budget. Cancellation has
its own single automatic attempt, independent of the ingestion count; an uncertain
retraction goes to operator review rather than being retried blindly.
A claimed retraction rechecks the current source fingerprint immediately before
the provider call. Restored cancellation, reversed opt-out, changed facts or missing
source denies dispatch. The worker retains the original event, destination and
attempt count in `REVIEW_REQUIRED` (`DELIVERY_UNCONFIRMED`); it does not silently
reset the retraction budget. This fence cannot recall a request already in flight.

Recovery states retain the original evidence. Operators follow these steps:

| Review reason | Required reconciliation |
| --- | --- |
| Identity/date changed or value changed while unconfirmed | Compare the frozen event, source change, original destination and returned request ID if available. Resolve the original outcome before approving a corrected event. Do not overwrite the retained evidence. |
| Delivery attempts exhausted | Inspect the recorded requests and provider status. Any approved retry uses the same transaction and frozen facts; never create another ID to escape the retry ceiling. |
| Sale restored before retraction | Verify that no adjustment was dispatched, reconcile the original conversion, then explicitly restore the appropriate accepted or pending state. |
| Retraction source check denied after claim | Compare current source/suppression facts with the frozen fingerprint and original conversion. Confirm the pre-dispatch denial in the private run evidence before restoring an accepted state. `DELIVERY_UNCONFIRMED` alone is not proof of no provider effect; never reset the attempt count without reconciliation. |
| Retraction outcome uncertain | Inspect the original order ID, adjustment time and Google adjustment outcome. Confirm cancellation or use the supported manual correction flow; do not simply reset its attempt counter. |
| Restored sale after confirmed retraction | Review a genuinely new sale cycle. Google cannot restore the retracted order ID. |
| Credential quarantine | Reconcile the specific OAuth operation and dedicated vault version before settling the checkpoint. A successful run from the other capability cannot remove the quarantine. |

Data Manager diagnostics retain bounded allowlisted error/warning codes and
single-event counts alongside the private request/destination. Unknown provider
strings become `UNKNOWN_PROVIDER_REASON`; messages and echoed customer data are
never persisted. Only explicit temporary internal, recent-click or newly-created
destination errors receive bounded three-hour retries of the same event. Other
errors, missing diagnostics and unknown codes require review. Successful warnings
remain visible without resending an accepted sale. These counts describe provider
processing, not successful matches, unique sales or attribution.

## Reporting meaning and bounds

Google Ads v25 supplies the preceding 90 completed account-timezone days. Search
pagination is complete, cursor-checked and bounded to 20 pages/100,000 rows per
query. Responses and final saved reports have byte limits. Incomplete, duplicate,
malformed or failed reads never replace a saved complete report. The snapshot is
retained for seven days, labelled stale after 30 hours and withheld on expiry.
It is not a permanent historic spend ledger. Earlier periods remain unavailable.

Costs/clicks/impressions are collected separately from conversion-action rows,
avoiding repeated spend. Campaign/day and keyword/day are distinct grains, never
summed together. Both interaction-date and conversion-date outcome projections
are explicit. Conversion-date outcomes and dated spend are different cohorts.
Configured submitted-enquiry actions exclude design starts/reviews. The pinned
Closed Sale action is separate. Unmapped metrics stay unavailable; confirmed
mapped actions with no returned activity may show zero. Google can return
fractional attribution. Currency/timezone/source dates always belong to Google,
not an assumed CRM period. No cost-per-CRM-sale, causal ROI or person-level match
is inferred from these aggregate reports.

Report collection, sale delivery and setup each retain their own last completed
outcome, pending/expired lease and credential uncertainty. A success in one lane
does not erase another lane's failure. Shared credential quarantine prevents both
capabilities. The Portal shows a compact attention notice beside the report for
these failures, sale reviews, cancellations and provider diagnostics, with details
in the existing recovery disclosure.

## Post-approval connection and activation

These are concrete operator steps, not instructions to execute before approval.

1. Apply the two forward migrations to the approved database after the release
   checks. They seed only a disabled control. Keep both application feature flags
   off. Verify source row counts, privacy exclusions and database role tests.
2. In the approved Google Cloud project, enable Google Ads API and Data Manager
   API. Configure a **dedicated advertising Web OAuth client** with redirect
   `http://127.0.0.1:8756/google-ads/callback`, correct production OAuth publishing/
   user access status and the two exact scopes below. This is a new grant, not
   scope expansion of GA4's existing refresh token. No retired developer-token
   header is used. Confirm Cloud project Ads access eligibility.
3. Provision a dedicated 1Password API credential item containing exactly one
   concealed `refresh_token` field, initially empty. Scope its service account to
   that approved vault/item. Set server-only variables listed below in private
   operator/deployment storage. Pin `actor_id` to the approved active Portal
   identity and the exact computed credential binding in the disabled control.
4. `node scripts/google-ads-setup.mjs --plan` is safe without credentials. After
   access approval, set `SANCTUARY_GOOGLE_ADS_SETUP_APPROVED=true` in the private
   operator environment and run `--connect`. The script uses state and PKCE,
   receives the callback only on loopback, checks exact scopes, verifies vault
   version advancement and reads the pinned Ads customer. It never prints tokens.
   The disabled-control `verify` lease prevents concurrent collection. A failure
   leaves any uncertain credential operation quarantined for reconciliation.
   The void `google_ads_credential_settled` RPC returns successful HTTP204 with
   no JSON body; the setup transport accepts that response only for settlement.
   Token/account reads and all JSON-returning RPCs still require valid JSON.
   If a prior setup stopped after the credential was saved and settlement cleared
   uncertainty, reconcile the existing item/run and continue verification with the
   saved credential. Do not repeat OAuth solely because later verification failed.
5. Resolve `customer.conversion_tracking_setting.google_ads_conversion_customer`.
   Pin it separately from reporting customer `6328516633` and optional login
   manager `6596874249`. Provision/review a reporting-only Closed Sale action in
   that conversion-owner account: UPLOAD_CLICKS, ENABLED, PURCHASE,
   `primary_for_goal=false`, MANY_PER_CLICK, varying uploaded values (not always
   default), approved click lookback. Verify it is not used by custom campaign
   goals. Record its ID and the exact submitted-enquiry action IDs. Do not alter
   existing bidding or conversion actions as incidental setup.
6. Run `--preflight` while collection/uploads remain off. It refreshes the separate
   credential, reads account/action metadata and sends only a fictional identifier
   with `validateOnly:true`. No real customer data is sent and no sale is ingested.
   This validates syntax/access, not matching, diagnostics or real cancellation.
7. Reconcile the approved sale/date/value contract, consent bases/cutoff, disclosure,
   enhanced-data authority, opt-out handling and current eligible inventory. Pin
   the approved policy in the control; no default date or retrospective consent
   is supplied. Enable reports first and verify exact campaign/keyword/action
   totals and both date bases against Google UI. Inspect the Portal report.
8. Within the approved staged rollout, verify one genuine eligible sale. Keep the
   default `upload_mode='canary'`, pin `canary_quote_id` to that family, then enable
   the required upload authority. Enabling without a pinned family is rejected.
   The database constrains sources, freezing, claiming and dispatch checks to this
   family, including concurrent scheduled runs. Dispatch once and inspect request
   diagnostics plus later Ads credit.
   Reconcile source date/value/order ID and replay the same sale to confirm no
   duplicate. A genuine eligible source record is required; never upload synthetic
   conversions to a live action. Only after this evidence, promote the private
   control to `upload_mode='routine'` and the separately tested retraction capability.
   The hourly schedule may run during canary mode but cannot dispatch another family.
   No eligible recent record means this
   last proof remains pending, not a reason to manufacture data.

The initial rollout covers new eligible enquiries only. Publish and verify the
privacy page and every enquiry notice (contact, embedded and compact configured)
before pinning `consent_effective_from` to
that verified release time (or a later time). Preserve `regional_default` versus
`user_choice` provenance and the existing tracking preference rules. Keep earlier
enquiries excluded, including older sales that later receive a payment or revision.
An email request to withdraw permission must be matched to its project and recorded
in `private.google_ads_suppressions` before another dispatch; cookie changes alone
are not a CRM opt-out signal. Do not infer historical permission from the new copy.

### Exact database release and verification

The production target is Supabase project `iytanftukulcnavossmd`. Its migration
ledger is sparse; do not run an unbounded `db push`, `migration up`, or repair
unrelated migration versions. Verify no collisions for these two versions or
`google_ads_*` objects and inspect all required source columns/functions first.
The production membership contract is `portal_users.role in ('admin','staff')`,
not an `is_active` column. Confirm the pinned actor is confirmed, not deleted or
banned, and still has that membership. No role or identity is created by setup.

Run only the two reviewed SQL files, in order, in one bounded transaction after
release dispatch. Rehearse with ROLLBACK first against the actual schema, inspect
dark defaults and grants, then apply with COMMIT and record those two exact
versions in the migration ledger using the reviewed source bytes. Notify
PostgREST to reload its schema after successful installation. There must still be
no actor/binding, enabled capability, conversion action, contact-match approval,
consent basis/cutoff, canary family, report or delivery row in the install seed.

The first two versions were installed disabled on 13 October 2026. For that
installation, apply **only** `20261013000003_google_ads_retraction_source_fence.sql`
as a separately reviewed forward correction. Check the first two ledger statement
hashes against the unchanged reviewed files and require version `000003` absent.
Rehearse the correction in a bounded ROLLBACK transaction against the installed
function. It requires exactly one old sending-state clause, preserves the full
function otherwise, and fails on an unexpected baseline. Verify the new source
check, unchanged grants and dark controls; only then apply the same bytes in a
scoped transaction, ledger only the new version and reload PostgREST. Reconcile an
uncertain install from the ledger and function readback before retrying. Keep all
capabilities disabled; recovery is a reviewed forward correction, not reverting
the source fence or replaying the first two migrations.

For actual PostgREST transport proof while application flags remain off, temporarily
pin the existing approved actor and a synthetic non-secret binding only. Leave
conversion metadata null. Service-role RPC must reject `begin` for report/sales.
The verify lane must support `begin`, `check`, `credential_pending`, reject `check`
while uncertain, then `google_ads_credential_settled`, `check`, and `finish`.
These calls do not access Google or 1Password. Anonymous access must fail; a
service-role call with no authenticated user must not read the staff DTO. Restore
the disabled actor/binding after the proof; keep the finished verify run as bounded
operational evidence. A separate administrative rollback transaction exercises
report replacement and binding-change invalidation using synthetic aggregate
content that never commits. This distinguishes SQL transaction proof from actual
HTTP/authenticator proof. After deployment, the existing owner session verifies
the guarded staff DTO. Never grant a test user production access for this check.

### Customer withdrawal operation

Jordan owns the existing `info@sanctuarypergolas.co.nz` contact channel. This release
does not add an inbox monitor. The person handling a withdrawal must immediately
pause uploads in the private control, identify every linked project covered by the
request in the existing CRM, and pass the verified project IDs and request reference
to the authorised database operator. Do not infer a person from an advertising hash.
Only the existing privileged administrative SQL route can change the suppression
table; the service-role HTTP client and ordinary Portal users cannot write it.

The operator uses the established privileged Supabase CLI `db query --linked
--project-ref iytanftukulcnavossmd --output json` route with the following reviewed
SQL after filling the two variables from the verified request. An empty list or
operator reference fails before writing; it neither finds customers automatically
nor grants application roles access. Use a rollback rehearsal first when needed.

```sql
begin;
set local statement_timeout='15s';
do $$
declare
  requested uuid[] := array[]::uuid[]; -- Verified distinct project IDs, all linked projects.
  operator_reference text := ''; -- Operator plus private request reference, no customer text.
begin
  if cardinality(requested)=0 or array_position(requested,null) is not null
    or length(trim(operator_reference))=0 or length(operator_reference)>200
    or (select count(distinct id) from unnest(requested) ids(id))<>cardinality(requested)
    or (select count(*) from public.projects where id=any(requested))<>cardinality(requested)
    then raise exception 'Verify project set and operator reference before suppression'; end if;
  update private.google_ads_control set uploads_enabled=false where singleton=true;
  insert into private.google_ads_suppressions(project_id,suppressed_at,reason,recorded_by)
    select id,clock_timestamp(),'CUSTOMER_OPT_OUT',operator_reference from unnest(requested) ids(id)
    on conflict(project_id) do update set suppressed_at=excluded.suppressed_at,
      reason=excluded.reason,recorded_by=excluded.recorded_by;
  if (select count(*) from private.google_ads_suppressions where project_id=any(requested)
    and reason='CUSTOMER_OPT_OUT' and recorded_by=operator_reference)<>cardinality(requested)
    then raise exception 'Suppression read-back incomplete'; end if;
  raise notice 'Suppressed % verified projects; uploads remain disabled',cardinality(requested);
end $$;
commit;
```

This inserts one
row per project into `private.google_ads_suppressions` with reason
`CUSTOMER_OPT_OUT`, `suppressed_at=clock_timestamp()` and `recorded_by` containing
the operator and private request reference, not the customer's message. On conflict
update those fields for that project. Before commit, read back the requested count
against suppressed count and assert every linked project is covered. Keep the
request-to-project evidence privately; no email or raw message enters this table.
Do not change original enquiry snapshots or delete frozen delivery evidence.

Before resuming uploads, inspect any active/uncertain run and retained delivery
states for those projects. Unattempted sales must be skipped, submitted requests
must settle against their original ID, and accepted or possibly sent sales require
the documented retraction reconciliation. A request already in flight cannot be
unsent. Preserve a review hold when the provider outcome is uncertain. Verify no
suppressed project can produce a new event, then restore the previously approved
canary/routine authority only after the withdrawal and in-flight checks are recorded.

Variables: `SANCTUARY_GOOGLE_ADS_REPORTS_ENABLED` and
`SANCTUARY_GOOGLE_ADS_UPLOADS_ENABLED` default off. Credential authority uses
`SANCTUARY_GOOGLE_ADS_ACTOR_ID`, `_CLIENT_ID`, `_CLIENT_SECRET`, `_VAULT_ID`,
`_CREDENTIAL_ITEM_ID`, `_SERVICE_ACCOUNT_TOKEN`, `_BINDING_SHA256` (same prefix).
The binding is SHA-256 of the ordered config object in `config.ts`, including
actor/client/vault authority, excluding the mutable refresh token. The operator
tool also needs the approved Supabase origin/service key. Google scopes are
`https://www.googleapis.com/auth/adwords` and
`https://www.googleapis.com/auth/datamanager`. Scopes grant provider capabilities;
application code and source controls restrict actual actions.

Candidate cron paths reuse the existing `CRON_SECRET` boundary: report at 02:43
UTC daily, sales at minute 13 hourly. Verify the deployment plan supports these
schedules and the 300-second route limit before release. Disabled flags perform
no provider calls. There is no chat timer, second external subscription or new
service purchase. Keep QA fixtures disabled in production.

## Stop, rollback and private retention

First disable both database capabilities and application flags. Generation fencing
prevents subsequent effects; inspect in-flight operation and delivery states.
Revert the application/cron change if required, but retain the private tables and
original destinations/transactions for reconciliation. Do not drop this migration
to undo sent customer data. Google credential revoke, true conversion corrections
and any provider deletion requests are separate explicit actions. After credential
rotation, reconcile uncertain vault state before updating binding; never clear an
uncertainty flag on a timer. Raw API payloads/tokens/customer identities do not
belong in source control, browser logs, fixtures or public release evidence.

The saved aggregated report expires after seven days; durable sale receipts and
hashed matching evidence currently remain in the restricted source store for
correction/reconciliation. Approve and implement a business retention policy before
activation if that evidence must be automatically purged. Purging identifiers must
retain non-identifying transaction/destination/state evidence required for genuine
corrections; no automatic retention period is invented by this integration.

## Verification

Focused PGlite tests execute the real forward migrations and canonical accepted
quote helper, covering multiple invoices, revisions, partial deposits/reversal,
typed consent, suppression, freeze/replay, immediate revocation and credential
uncertainty. Provider tests cover pagination, separate metric grains, policy-aware
hashing, diagnostics and true retractions. The existing guarded marketing fixture
uses only invented Google reports; `?google=failure|missing|disabled|stale|unmapped`
exercises evidence states. These checks do not establish live OAuth, API eligibility,
provider matching, conversion-action configuration or production rollout.

`node scripts/test-google-ads-db.mjs` repeats the source lifecycle tests on a
disposable local PostgreSQL 17 instance using existing binaries selected by
`PRAXIS_DISPOSABLE_POSTGRES_BIN`. It uses all three ordered migrations and synthetic
prerequisites, including precision-preserving timestamps and the staff DTO. The
authority trigger uses a qualified singleton deletion compatible with the known
safeupdate rule. The safeupdate extension, actual PostgREST authenticator session
and complete production schema are not exercised by this local harness and remain
explicit rollout checks. `.local-evidence/**` is excluded from Vitest discovery so
archived build copies cannot duplicate test counts.

Primary contracts: [Data Manager offline conversions](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline),
[event routing](https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest#Event),
[conversion adjustments](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/conversion-adjustments),
[Google Ads conversion setup](https://developers.google.com/google-ads/api/docs/conversions/getting-started),
[reporting](https://developers.google.com/google-ads/api/docs/reporting/overview),
[customer data policies](https://support.google.com/google-ads/answer/7475709).
