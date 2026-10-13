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
approval. Email uses Meta lowercase/trim rules; phone requires an explicit E.164
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
the object after the tags finish; a deadline covers missing/failed tags.

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
The existing Meta reporting token and `ads_read` verifier remain unchanged.
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
changed source, binding or exhausted budgets become review states. HTTP success
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

## Release sequence and acceptance

1. Freeze reviewed source; verify existing Google migration hashes and current
   schema/role/contact columns. A transactional ROLLBACK rehearsal of migrations
   `20261014000001` through `000003` may precede the production decision; no
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
  `metaSales=attention|active|failure`; no customer fixtures.

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
