# Meta offline sales and advertising capture

Local candidate, 14 October 2026. Jordan approved implementation, testing and
independent review. New Meta production release and any historical batch return
to Jordan for their concrete approval. Existing Google production authorization
continues separately. No Meta upload, new production migration, credential grant,
campaign change or live matching is established by this candidate.

## Source and eligibility

`private.advertising_scope_facts()` owns the shared accounting source. A sale is
one currently accepted quote family after a verified positive first-instalment
deposit, including a partial Xero match. Full accepted NZD value includes GST;
it is not the deposit cash amount. Revisions retain family identity. Reversed
payments, void invoices and cancelled scopes remove eligibility. The existing
Google source projection and fingerprint remain equivalent when the new shared
suppression table is empty. Applied Google migrations are unchanged.

Meta sends `Purchase`, `action_source=other`, actual payment Unix seconds and
`sanctuary-scope-<quote-family-uuid>` as both `event_id` and `order_id`. A bank
deposit is not labelled a physical-store purchase. These events must be less
than seven days old when sent. The 62-day physical-store exception is inapplicable.
No event timestamp is advanced to fit a provider window.

New enquiries must retain notice `2026-10-sale-measurement-v2`, a permitted saved
marketing basis, a release cutoff and the separate source policy approval. The
new notice names Google and Meta; older open tabs preserve v1 or missing evidence.
No historical receipt is rewritten. Contact matching has its own default-off
approval. A saved false setting with `basis=user_choice` is explicit refusal;
false with missing/default/none basis is insufficient authority but is not
invented evidence of a refusal. It can qualify only through the separate exact
historical rights evidence and approved batch. Email uses Meta lowercase/trim rules; phone requires an explicit E.164
country code. A usable email works independently of a missing/local-format phone.
Original submitted contact takes precedence. CRM contact presence is assessed
but does not grant sharing permission.

`meta_sale_assessments` retains each scope's fingerprint, all exclusion codes and
normalized-identity availability. Counts overlap and must not be summed. The
source-only `npx tsx scripts/meta-sales-assess.ts --plan` explains its required
private environment. `--assess` uses the existing actor and binding, records
assessment results, and exports per-scope IDs/reasons only into a new ignored
`.local-evidence/meta-assessments` file. It has no Meta transport and cannot claim
delivery. No source receipt/contact fields enter this output.

Historical release is separately controlled by `historical_enabled`, mode
`historical`, and `meta_sale_history_approvals` for each exact source fingerprint.
The privileged operator records a private consent/disclosure evidence reference,
Jordan's concrete batch approval reference, original-versus-CRM identity source,
who reviewed it and when. Missing evidence is an exclusion. An explicit saved
marketing refusal, known suppression or expired event cannot be overridden.
Revocation or a changed fingerprint invalidates the approval before dispatch.
Routine mode does not implicitly approve historical records. A historical batch
must be assessed again just before release because the seven-day window advances.

## Capture and Google contact matching

The existing tab-local UTM/landing context remains 30 minutes. A separate
`sanctuary.ad-identifiers.v1` first-party store keeps Google click IDs and Meta
`fbc`/`fbp` for at most 90 days from their own observation/creation time. Untagged
returns and the same active identifier do not extend that deadline. Google and
Meta arrivals do not overwrite each other. Meta fbc is built only from a genuine
URL fbclid using its first-observed timestamp; fbp is never invented. Actual
cookies preserve their creation time. Expired/future/malformed values are erased
or omitted. Storage failure never prevents an enquiry. Withdrawal clears this
store, session context and known first-party Meta cookies. Submission rechecks
cross-tab withdrawal and the server independently strips unpermitted identifiers.

`NEXT_PUBLIC_GOOGLE_ENHANCED_LEADS_ENABLED` is false unless explicitly enabled.
On a successful enquiry only, `googleEnhancedLead.ts` can expose already-hashed
`window.sanctuaryGoogleEnhancedLead` containing `sha256_email_address` and/or
`sha256_phone_number`. Its Google normalization matches the offline adapter.
The property checks current marketing withdrawal each time it is read and expires
within 2.5 seconds. The existing `lead_submitted` event carries no contact or
hashed-contact properties into the generic data layer or GA4. A callback clears
the object after the tags finish; a deadline covers missing/failed tags. An
idempotent replay omits this contact object because edited retry fields are not
the original accepted receipt. Existing success/replay messages remain intact.
This controls the deterministic handoff; it does not prove that inherited GTM
automatic collection is absent.

All regular, acrylic, compact and mobile forms use the same visible provider
notice. Original v1 receipts remain v1. Google's explicitly selected v1 policy
accepts only v1; a release-selected v2 policy accepts v1 and v2. Missing and unknown
versions fail closed. The forward compatibility migration changes no live policy
value, original receipt, fingerprint or cutoff. The approved Google transition
sets its policy to v2 without moving the existing cutoff. Meta's new-enquiry path
remains exact v2; historical evidence is separately reviewed.

Required GTM work before enabling this flag:

1. Create a Custom JavaScript variable returning
   `window.sanctuaryGoogleEnhancedLead || undefined` synchronously.
2. Create a **User-Provided Data** variable, **Type: Code**, using that variable as
   its data source. Use the provider's documented prehashed keys above.
3. On each of the three existing submitted-enquiry Google Ads tags, add
   **Event Parameters → user_data → {{UPD - Sanctuary enhanced enquiry}}**.
   This is the current documented event-specific Code path; do not infer its
   behavior from a legacy exported enhanced-conversion checkbox. Do not map it to GA4,
   Meta, design starts, review, submit attempts or arbitrary tags.
4. In a protected preview with vendor requests intercepted, verify accepted-form
   event timing, exact hash-only Ads payload, no GA4 contact payload, disabled and
   withdrawal cases, failed/replayed submission behavior and return navigation.
   Reconcile the published GTM version with the reviewed draft before release.
5. Only after the website path, source receipt and offline hash have been verified
   together may the separate Google enhanced-matching runtime/source controls be
   considered for the existing approved genuine-sale canary. This candidate does
   not change those live controls or prove an eventual advertising match.

The existing linked Google tag already allows user-provided-data capabilities
and automatic email detection. Those live settings remain unchanged. This
candidate adds a deterministic event-specific path; it does not establish that
production previously had no potential automatic matching.

## Delivery, recovery and access

`metaSales/config.ts` uses dedicated `SANCTUARY_META_SALES_*` actor, dataset,
access-token, expiry and binding fields. The binding is SHA256 of the documented
ordered object `{actorId,datasetId,token,expiresAt}`. Provision private server-only
values through existing hosting/vault operations, never CLI arguments or logs.
This finite, manually provisioned path remains available until the separately
approved vault mode below is activated. Reporting retains its exact `ads_read`
and optional `public_profile` boundary; it never borrows the sale credential.
Dataset assignment and event-send authority must be established independently;
a successful `/me` read or a receiving browser pixel is insufficient.

Source control pins dataset, actor, binding, credential expiry, verified assignment,
disclosure version, cutoff, permitted bases, contact policy and rollout mode.
All capabilities install off. Confirmed unbanned staff/admin authority, a bounded
four-minute generation lease and the exact current source are checked again
immediately before each request. One event is claimed at a time, at most five per
run. The hourly `23` minute cron exits disabled before credential access unless
the environment flag and source authority both allow it.

Meta documents first-copy deduplication for equal `event_id` and `event_name`.
Retries retain the identical frozen payload, including time, value and matching
data. Five attempts and 24 hours from the first attempt are local conservative
limits, still subject to the seven-day event window. No claim of a perpetual
provider dedup guarantee is made. Expired dispatch leases retain the same event;
changed source, binding or exhausted budgets become review states. Matching data
is revalidated against current authority at freeze, recovered claim and the final
pre-request check. Revoking contact authority quarantines an uncertain frozen
contact-bearing event without rewriting its identity or resetting attempts.
Accepted unchanged sales remain accepted after the import deadline; actual source,
value, suppression and matching-permission changes still require review. HTTP success
alone is insufficient: one received event and a bounded provider trace are needed.
Only numeric error codes/subcodes, HTTP status and warning counts are retained;
provider messages and customer identifiers never enter diagnostics or logs.

Recovery actions:

- `TRANSPORT_UNCERTAIN`/`DISPATCH_OUTCOME_UNCERTAIN`: retain the event and original
  first-attempt time; the bounded identical-event retry can resume. After the
  limit, inspect the saved trace/attempts and Events Manager without generating
  another ID or resetting attempts.
- `SOURCE_CHANGED_BEFORE_DISPATCH`/`SOURCE_CHECK_FAILED`: inspect the current paid
  scope, consent and suppression. No provider request follows a failed check.
- `SENT_SALE_SOURCE_CHANGED`/`SENT_SALE_NO_LONGER_ELIGIBLE`: retain the accepted or
  uncertain original. Meta's event endpoint does not support updates/deletes;
  changed-value replay is not a restatement. Do not send a zero or refund event as
  an invented correction. Use current CRM values for corrected business reporting
  and investigate a provider-supported remedy separately.
- `META_REJECTED`: use sanitized codes to repair credentials, dataset permission
  or event configuration. Never change consent or the timestamp to force acceptance.
- `AUTHORITY_CHANGED`: compare retained dataset and frozen receipt to the current
  binding. Do not migrate a previously attempted event to another dataset silently.

The existing customer inbox owner handles withdrawal requests received at
info@sanctuarypergolas.co.nz. This feature does not monitor that inbox. The
authorized operator identifies all affected linked projects, records provider
rows in `private.advertising_sale_suppressions` with reason, actor and time using
the established privileged SQL connection, then reads them back and reconciles all
READY/SENDING/ACCEPTED rows. Use `provider='google'` and `provider='meta'` when the
customer requests both. Service-role direct table writes remain revoked. A request
already in flight can have reached the provider; preserve its result and show the
review state instead of claiming remote erasure. Removing suppression requires
verified new authority and does not automatically revive a suppressed event.

The operator prepares a private, reviewed transaction with an explicit array of
the verified affected project UUIDs and a private intake-reference/actor value.
The following is a parameterized procedure, not a runnable customer fixture:

```sql
begin;
insert into private.advertising_sale_suppressions
  (project_id, provider, recorded_by, reason)
select project_id, provider, :recorded_by, 'CUSTOMER_OPT_OUT'
from unnest(:verified_project_ids::uuid[]) project_id
cross join unnest(:requested_providers::text[]) provider
on conflict(project_id, provider) do update
  set recorded_by=excluded.recorded_by, reason=excluded.reason,
      recorded_at=now();
select provider, reason, count(*) as affected_projects
from private.advertising_sale_suppressions
where project_id=any(:verified_project_ids::uuid[])
  and provider=any(:requested_providers::text[])
group by provider, reason;
-- Commit only after the exact expected project/provider count matches.
commit;
```

Use the management connection that owns these private tables; the service-role
HTTP key cannot perform this write. Preserve the private intake evidence and
transaction receipt. Inspect affected frozen rows through the privileged read,
then use the normal bounded source reconciliation. A source check fences a claimed
event before sending, but cannot recall an already transmitted request. Google
retraction remains governed by its existing separate authority; Meta cancellation
after transmission remains a review state because its endpoint has no deletion.

## Durable Meta credential renewal (default off)

### Creative execution implementation map (21 October 2026, local candidate)

The owner outcome remains cloud evidence -> independently reviewed creative test ->
measured keep/revert/stop, with one acquisition test across both pages and ads.
This tranche supplies durable source ownership, not a working Meta executor.
Runtime execution is still false; no live credential, provider call or SQL install
is part of local verification. Separate Velt enrollment stores the dedicated writer
without changing reports/sales and itself cannot publish.

1. Source ownership: additive `20261021050001_creative_effect_ledger.sql` introduces
   one cross-lane reservation. Existing landing and new creative commands share
   advisory lock819421,1. A landing trigger preserves existing active work and
   maintains reservation through existing states. Creative reservations survive
   uncertain effects and worker expiry; release requires resolved effects and a
   last confirmed pause/end for every registered ad/study.
2. Immutable plan: exact scope, four original ads, budget/control/native-contract
   hashes, independent review and asset/copy/claim catalogue. Source config pins
   scope/originals/budget/control. Original ads cannot enter the owned registry.
   Each created ID binds one exact command/request/readback evidence receipt.
   Title matching is never idempotency or proof of identity.
3. Recovery: admission persists `prepared` without dispatch permission. The one-use
   `check` atomically records `uncertain` immediately before dispatch; a lost check
   response cannot be retried. Only an untouched prepared fence plus an exact
   command/request-bound `dispatch_not_started` evidence receipt can become
   `no_effect`. Expiry or an empty provider search alone is never evidence. This
   terminal state cannot dispatch or acquire a fabricated object. Unresolved
   prepared/uncertain effects block release. Confirmation can record already sent
   effects after Stop. Future adapters must check external credential/global
   authority after preparatory awaits and consume the source fence immediately
   before dispatch; SQL does not independently query Meta.
   Normal work has 24 admissions, with three additional terminal cleanup
   admissions reserved for the two owned ads and study. `admit_cleanup` admits only
   exact registered pause/end, disallows duplicate dispatched target cleanup and
   prevents any later normal work. This finite allowance is not unlimited failure
   recovery; exhausted cleanup admissions require operator reconciliation.
   `enabled=false` stops publication. Separately default-off `cleanup_enabled`
   permits terminal cleanup only while `authority_current=true` and
   `global_stop=false`; both default fail closed. Any control change fences old
   generations. These source flags do not replace the future live credential and
   global-Stop checks. No cleanup path bypasses credential revocation.
4. Writer seam: `metaCreatives/journal.ts` declares only creative lease/journal types.
   No token loader or Graph dispatcher exists. The future hosted broker must use
   only dedicated Velt enrollment and its exact principal/asset proof, with source
   admission and existing Stop. Reporting/sales leases cannot satisfy this type.
   No secret crosses browser, model, source ledger or customer data paths.
5. Native contract: official CreativeTests documentation describes same-campaign
   creative cells. Actual account eligibility, exact create/read/stop fields,
   allocation and original-delivery/budget interaction must be proven before wire
   implementation. Internal effect labels do not assert Meta endpoint semantics.
   Missing verified contract hash denies reservation. Preserve NZ400 average and
   NZ2800 weekly total; no budget, audience, offer or Page-post writes.
6. Before activation, extend fixed-four-ad reporting/Clarity/intake validators to
   immutable registered study/ad cohorts. Keep original reporting separate, bind
   campaign/adset/Page/path, effective dates and arm, and preserve late enquiries'
   experienced ad. Unjoined or denied-consent outcomes stay unknown. Current
   consumers remain unchanged and cannot yet report a creative test.
7. Before publishing: actual previews/independent review, scheduled start/end,
   emergency owned-ad pause plus native-study stop, exact readback and no-repeat
   recovery. Cleanup must precede reservation release. Expired access retains the
   lock and alerts; it cannot silently erase uncertainty or permit another test.
8. Bind formal rules only after native allocation/measurement semantics are known.
   Genuine saved enquiries are primary; provider high-performer IDs alone are not
   a business winner. Predeclare window/maturation, uncertainty and separate dated
   suitability guard. Missing denominators/joins/quality mean inconclusive/control.
   Do not transplant landing Wilson intervals onto ad clicks or retry an
   inconclusive study until significant. Persist result and exclusions for next
   selection. No model/provider request is introduced by this tranche.

Bounds:24 admitted effects, at most2 owned ads and1 study per plan; no raw provider
payload, secrets or customer text. Native tests compose actual landing SQL with
reservation/recovery/ACL checks. This is incomplete until remaining hosted paths
and actual budget/permission/measurement semantics pass independent acceptance.

### Earlier pure-policy stage (21 October 2026)

`metaCreatives/contract.ts` and `policy.ts` are pure, local-only policy owners.
The declared credential capability vocabulary includes `creatives`, while
`RuntimeMetaCredentialCapability`, existing credential configuration, loaders,
vault sessions and renewal still admit only `reports` and `sales`. No creative
secret, token scope, environment flag, route, provider request or migration is
introduced. `CREATIVE_RUNTIME_ENABLED` is permanently false in this stage, and
every validation result exposes `executionEnabled:false`.

The internal intent allowlist is a paused variant using exact catalogue keys,
activation of an owned ad, or pausing an owned ad. It contains no Meta wire schema.
Strict parsing refuses extra offer, budget, targeting, destination, Page-post or
provider control fields. Scope binds app/principal/business/account/Page/campaign/
ad set; approved budget and immutable control fingerprint must match fresh source
pre-state. Independent approval binds the exact intent and asset/copy/claim
catalogue. Assets need bounded paid-use evidence and expiry, and claims must be
explicitly approved. The validator does not authenticate supplied evidence or
understand whether arbitrary prose is commercially true; a later source-owned
approval/catalogue reader must establish that provenance.

A matching held creative reservation, generation and unchanged pre-state are
required. This policy check alone is not the atomic cross-lane lock added above. A
command/hash conflict fails; uncertain creation requires reconciliation, never
another create. A confirmed response needs the matching source-owned object
registry before it can be treated as already completed. An existing create-command
registry entry also prevents a stale `not_dispatched` receipt from authorizing a
new create. Conflicting or multiple entries require reconciliation; only one exact
object plus its matching confirmed receipt resolves completion. Name matching is not
provider idempotency. Status effects cannot target the original control ad.

Remaining implementation prerequisites are deliberately explicit: authoritative
native CreativeTests and permission contracts, independent Page/ad-account/app
assignment and a separate vault capability, durable global landing/creative
reservation, study/ad registry and compatible reporting/Clarity/intake consumers,
actual ad previews, delivery/cleanup recovery and a reviewed end-decision rule.
The current four-ad report schemas cannot accept extra ads unchanged. No native
study fields, eligibility, budget allocation or automatic end-stop are assumed.
No provider effects or credential operations are possible through this policy.

`metaCredentials` owns separate report and sale vault sessions, provider checks,
renewal and reconciliation. It does not modify Google access or the Velt legacy
Meta item. Use dedicated Sanctuary items with one concealed `meta_credential`
field containing `{version:1,binding,accessToken,expiresAt,dataAccessExpiresAt}`.
Actual provider expiration comes from `debug_token`; verified zero token or
data-access expiry is stored as null, never an invented date. A verified
nonexpiring token can be used under current source approval without exchange;
local approval and any data-access expiry still apply. Only a still-valid
expiring SYSTEM_USER token is renewable here.
The legacy website CAPI token's issuer/renewability is not established.

For reports use prefix `SANCTUARY_META`; for sales use `SANCTUARY_META_SALES`.
Each needs `_VAULT_ENABLED`, `_RENEWAL_ENABLED` (both false initially), `_ACTOR_ID`,
`_APP_ID`, `_PRINCIPAL_ID`, `_BUSINESS_ID`, `_ACCOUNT_ID` (reports) or `_DATASET_ID`
(sales), `_EXPECTED_SCOPES` (exact space-separated set, explicitly empty allowed
only for a verified sale capability), `_VAULT_ID`, `_CREDENTIAL_ITEM_ID`,
`_SERVICE_ACCOUNT_TOKEN`, `_APP_SECRET`, and `_BINDING_SHA256`. Secrets are server
only and must not enter command arguments, logs or public configuration.
`credentialConfig` computes the stable binding from the ordered identity object
`{capability,actorId,appId,principalId,businessId,targetId,scopes,vaultId,itemId}`
with sorted scopes. Changing token, expiry or vault access secret does not change
this identity. App/principal/target/scope changes do, and are not routine renewal.

Migration `20261014000005` creates no credential rows or approval. Provisioning is
an operator-reviewed transaction after the production decision: verify the exact
actor and source control, pin the identity and matching stable binding, and record
provider token hash/version/expiry from a strict private vault/provider read. Pin
asset assignment evidence and verification date, approval reference, and either a
finite `approval_expires_at` or explicit `ongoing_approved_at`. Keep `enabled` and
`renewal_enabled` false until readback and grant verification. Never overwrite the
existing Velt item, transplant its local expiry as provider expiry, or broaden a
report token's scopes. A dedicated sale SYSTEM_USER must have independently
verified dataset Use-events assignment; no ad-account write asset is required by
this design. An identity read or dataset GET alone does not prove event access.
Select `private.meta_sale_control.credential_mode='vault'` in that reviewed
transaction when binding the sales capability. It allows a verified nonexpiring
provider token without weakening the original finite legacy mode.

The release packet must ask Jordan to approve ongoing, revocable renewal/use for
these exact two connections and the necessary restricted vault service access.
The implementation does not extend the existing finite policy automatically.
Revocation uses `private.meta_credentials.enabled=false` or records
`asset_revoked_at`; this advances the credential generation and fences work.
Stopping sale uploads remains separate from revoking credential maintenance.
Asset evidence is preserved with its original verification date and remains valid
only while the pinned assignment is unrevoked. Renewal is not a new asset grant.
Exact app, principal and scopes are checked on use and renewal. The report read
checks the pinned account, active status, currency format and valid timezone using
the existing `ads_read` projection. Business assignment remains separately pinned
source evidence; it does not require Graph access to the account's `business`
field. Any supplied granular targets must contain the pinned asset.
Empty granular targets are not misrepresented as proof of assignment. The genuine
canary remains required to establish actual sale-send capability.

The protected `/api/integrations/meta-credentials` daily cron runs at 01:31 UTC.
Both environment and source renewal switches are required. It skips a valid token
until 14 days before expiry. Existing Velt Sanctuary-source calls continue using
their revocable per-operation delegation and unchanged Portal bearer. That source
path has no monthly token deadline; Velt's separate 30-day direct-Meta broker is
not used or changed. Report retention stays seven days, including during renewal.

A source-owned, five-minute exclusive lease separates credential use from renewal
for each capability. Durable checkpoints precede exchange and vault write. The
only refresh transport is Meta's documented GET, implemented with native HTTPS
to avoid Next fetch URL tracing: fixed host/path, no redirects/retries, bounded
response/time, no raw error, request URL, body or request telemetry. The repository
has no custom server tracing wrapper. The current hosting metadata has no tracing
environment keys or drains; this is not observation of provider-internal Node
instrumentation. Before enabling exchange, retain that boundary and confirm any
new HTTP tracing excludes or redacts OAuth query parameters. Account/debug reads
retain the existing fixed-URL batch transport.
Source rows hold hashes, versions and safe states, never tokens or app secrets.

Recovery is automatic only where evidence resolves the outcome:

- `EXCHANGE_PENDING`: read the unchanged vault version and verify the old token
  still has the exact identity/expiry. Meta keeps it valid to original expiry.
  Record reconciliation and wait one day before another exchange. No claim that
  exchange itself is idempotent is made.
- `VAULT_PENDING`: read the vault in a fresh session. Activate only the exact
  candidate hash/expiry at a greater version. An old read does not prove a timed
  out write cannot still complete. Keep that ambiguity quarantined; do not retry
  the put, reset the row or clear evidence. Inspect the vault version/history and
  private operation receipt before an explicitly reviewed recovery.
- Identity drift, revoked authority, expired original token or unknown version:
  stop use and show review status. Restore the correctly bound grant through the
  existing operator path. Never generate another sale ID or reset attempts.
- `REVIEW_REQUIRED` after a returned replacement fails verification: retain its
  operation evidence and resolve identity/expiry privately. Do not automatically
  exchange again or treat this as a lost response.

Same-identity rotation changes only credential revision. Source generations,
frozen sale bodies, accepted receipts, event times, first-attempt times and retry
budgets remain unchanged. The normal sale source/matching checks still run before
any event. Credential health, finite approval deadline and assignment verification
date appear in the existing Meta status; a successful report is not sale proof.

Local mocks and native PostgreSQL tests cover rotation, revocation, exclusivity,
lost responses, exact candidate reconciliation, source compatibility and retention.
Release still requires exact-target transactional rehearsal, actual PostgREST
proof, independent review, a privately verified vault bootstrap, hosted scheduled
readback and eventual real renewal. A not-due result is not evidence that a token
was refreshed. No synthetic Purchase, including test_event_code, is used here.

## Release sequence and acceptance

1. Freeze reviewed source; verify existing Google migration hashes and current
   schema/role/contact columns. A transactional ROLLBACK rehearsal of migrations
   `20261014000001` through `000005` may precede the production decision; no
   production schema change is committed at this stage. Compare old/new Google
   source aggregates and fingerprints. A staging install can verify grants and
   PostgREST behavior without authorizing a production install.
2. Prepare the exact public v2 notice and captured-field preview for Jordan, plus
   existing dataset/send-token evidence, Google GTM draft and current historical
   per-scope assessment. Obtain the new production release decision. A historical
   batch is a separate concrete approval, never inferred from the release. Finish
   the intercepted browser proof against the reviewed GTM draft before claiming
   the Google website handoff is verified; unit tests are not network evidence.
3. Only after Jordan's production approval, install off using the established
   scoped transaction and migration ledger, never an unbounded database push.
   Verify grants/defaults and actual PostgREST `authenticator`/safeupdate behavior:
   denied disabled send, bounded assess begin/source/assessment/finish, staff
   aggregate read, revoked actor and current-generation invalidation. Synthetic
   PostgreSQL tests do not replace this release proof.
4. Release Portal and marketing coherently with all new send flags off, record the
   actual notice publication cutoff, and verify new versus old-tab receipt evidence
   using intercepted test intake before any real customer send.
   The task branch `codex/meta-offline-sales-20261014` alone suppresses automatic
   Vercel Git builds in both apps. Root provisions branch-specific staging and
   provider/email-off environment before one explicit protected preview per app.
   Main and production deployment behavior are unchanged.
5. Bind one genuine eligible scope in canary mode. Enabling the scheduler cannot
   authorize other scopes because source, freeze, claim and pre-request checks all
   enforce that same ID. Observe one real received event and its diagnostics, then
   separately inspect matching/reporting. No synthetic Purchase goes to production:
   **Meta test_event_code is not a dry run; its events can affect measurement.**
6. Only after verified canary evidence enable the approved routine policy. Recovery
   is immediate environment/source disable, preserving events and receipts. Rollback
   application code without deleting source evidence or disabling existing Google
   reporting. Credential revocation and customer withdrawal remain separate actions.

## Incremental implementation map and checks

- Marketing: `campaignPersistence`, `CampaignAttribution`, `attribution`,
  `googleEnhancedLead`, recognized disclosure versions and both existing forms.
- Shared source: `advertising_scope_facts`; provider-specific projections retain
  privacy policy, identity mapping and suppression outside accounting truth.
- Meta delivery: `marketingIntegrations/metaSales/{sales,delivery,worker,store,config}`;
  dedicated command RPC, assessment CLI, private cron and developer-only status API.
- Portal: `MetaSaleDelivery` in the existing Data sources drawer. Aggregate reasons
  remain distinguishable from Meta advertising credit. Fictional fixture parameter
  `metaSales=attention|active|failure|expired|renewal`; no customer fixtures. Staff status
  computes current actor and credential authority even when a failed begin cannot
  create a run. Expired credentials/revoked actors are inactive with visible
  recovery guidance, independent of the configured upload switch.

Focused commands: `npx vitest run test/meta-sales-source.test.ts
apps/portal/lib/marketingIntegrations/metaSales apps/marketing/lib/campaignPersistence.test.ts
apps/marketing/lib/attribution.test.ts apps/marketing/lib/googleEnhancedLead.test.ts
apps/portal/components/marketingPerformance/MetaSaleDelivery.test.tsx`.
Native PostgreSQL: existing `PRAXIS_DISPOSABLE_POSTGRES_BIN`, then
`node scripts/test-google-ads-db.mjs --meta`. Required app typechecks, focused
lint, service-role boundaries, docs/architecture guards and independent rendered
review complete the candidate. Live access, PostgREST and actual matching remain
separate release evidence.

Provider sources (reviewed 14 October 2026):
[Meta server parameters](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/server-event),
[API delivery and test events](https://developers.facebook.com/documentation/ads-commerce/conversions-api/using-the-api),
[customer information](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/customer-information-parameters),
[fbc and fbp](https://developers.facebook.com/documentation/ads-commerce/conversions-api/parameters/fbp-and-fbc),
[event endpoint](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ads-pixel/events),
[Google prehashed Code setup](https://support.google.com/google-ads/answer/13262500?hl=en),
[Enhanced conversions for leads](https://support.google.com/google-ads/answer/11347292?hl=en).

## Dedicated paused creative capability candidate (21 October 2026)

This source boundary is separate from report and offline-sale credentials. Velt
keeps the only dedicated writer credential; Source receives a signed fixed-scope
plan, never the token. `creative-executor/{contract,intent,authority}` and the
private `/api/landing-experiment/creative` route own exact media/tracking intent,
the shared acquisition reservation and immutable effect receipts. Formal
preparation/non-cleanup execution is refused; only an unchanged creative plus one
owned PAUSED ad can be proved in this milestone. Cleanup retains the ad PAUSED.
A provider-reused donor creative remains a reference and is never deleted.

Migrations `20261021050001` (effect ledger), `20261021050002` (executor/registry)
and `20261021050003` (consented measurement joins) follow accepted existing history.
Register each in the normal migration ledger; controls default off. Install only
after compatible Velt/Portal/Marketing contracts. Preserve current canonical
intake, original ads, consent/idempotency and offline switches. Unknown writes
retain the lock; known no-effect transitions require exact evidence. Compiled
template mismatch refuses new effects and emits bounded authenticated hashes and
release provenance. Exact owned cleanup remains available across template changes,
under current credential/Stop/lease authority.

Paused capability is not an experiment: no study, activation or genuine exposure.
Formal registry measurement is staged, consented and explicitly incomplete for
all-saved-enquiry CPE. Full author/reviewer/activation, provider window proof, formal
cohort freeze/evaluation and retained-creative adoption remain required before
unattended commercial creative tests can be claimed complete.
