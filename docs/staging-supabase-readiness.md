# Staging Supabase Readiness

Status: Current evidence for `SP-Staff-Portal-Staging`.

Target project ref: `tnsiprehuldksnuowubv`.

Production ref `iytanftukulcnavossmd` is a refusal value in this workflow. Nothing in this record authorises a production query, migration, deployment, or data change.

## 2026-09-11 Delivery And Invoice Rollout

The eight 20260911 delivery/invoice migrations passed a combined rollback rehearsal and were applied with exact canonical-LF bodies recorded under their unambiguous versions. Postflight matched every stored body to source. Existing commercial row counts were unchanged by migration. Authenticated browser verification then created a labelled synthetic project and verified delivery completion, persistent draft editing, standalone issue/value and audited void. See quotes-invoices-job-packs.md for the retained QA record and deployment evidence.

The apparent missing 20260724/20260728/20260731 versions are the existing underscore-named repository families; their stored SQL matches after statement/line-ending normalization. The separate marketing email-correlation entry 20260909000001 is retained without alteration. No historical ledger repair or blanket push was performed.

## 2026-08-18 Alignment

### 2026-09-08 Schedule Guarded Commands

The exact `20260908000001_schedule_guarded_commands.sql` file passed rollback rehearsal and application on this staging project. Canonical-LF SHA-256: `b1f10de448f0c2d58d8fa3816a6fe0113c425d9a06c61529a4f8acdf9ff91a3e`. The unambiguous ledger version stores the exact body; MD5 `91ee11fc5626ad713b37534bfa27846f`. Postflight verified all five function bodies, six revision triggers, denied anonymous/authenticated command execution and service-role command access.

Two distinct existing staff identities used separate authenticated sessions against the branch app and migrated staging. Board order and atomic Gantt start/duration persisted; dates survived reload and a second-session read; Unpin persisted. Simultaneous changes returned one 200 and one 409 without a mixed final date/duration. Reusing a stale RPC snapshot returned PT409 and did not overwrite the accepted state. The two test jobs/items and test crew were removed; staging returned to its initial zero scheduled jobs and one crew. No production job was used for this check.

The review correction `20260908000002_schedule_browser_write_boundary.sql` was also rollback-rehearsed and applied. SHA-256: `34978f3d2826b97662cf5c15b9cff63c8ab8b5a7bb7935e4498d74c1ce20b865`; ledger-body MD5: `53307df9bb13682e9bf9cfbd4ece11e2`. The authenticated persistence/concurrency check passed again after real staff direct table writes, legacy RPC calls and revision resets were denied. Temporary schedule rows were again removed.

The staging project had current Project Work tables and 11 projects, but its durable-job, Design Booklet, commercial reconciliation/scope, and Sanctuary AI schema was behind current `main`. The exact missing files were rehearsed in rollback transactions before application. A structurally present payment-schedule migration was not replayed after the rehearsal correctly detected its existing `commercial_quote_create_draft` function. The production-only `20260818000001_rehome_sent_manual_variation.sql` data correction was excluded.

Preflight application counts were 11 projects, 11 contacts, 6 estimates, 3 quotes, 3 quote versions, 0 deposit invoices, and 4 audit events. Six projects use the deterministic `[Agent Scenario]` prefix and five are other staging records.

### Durable Jobs

The following exact files were rollback-rehearsed as one transaction, verified to leave no `pgmq`, queue, job-table, private-payload, or provider-receipt residue, then applied once to staging:

| File | SHA-256 |
| --- | --- |
| `20260720_000001_background_job_foundation.sql` | `a1d3734d82c44b8a7f73dd153d1d5e839d27efa3bf44e5f95f5bc63d2d59fc46` |
| `20260720_000002_background_job_enqueue_claim.sql` | `6ff24d633fcf657ff84bfc9a4c5e45c3e749887d43e3386aa3686ccfc1c2613a` |
| `20260720_000003_background_job_lifecycle.sql` | `62c55d5935b440b7ca8b00a832d73f6b23419dc6b2f3d6b0d0b089f1a16e8a10` |
| `20260720_000004_background_job_reconciliation.sql` | `a026bf2bfc495bd3c3433fe640b3a574d8c7d65475f02476494b24a551a93421` |
| `20260720_000005_background_job_contract_hardening.sql` | `39e3c529eab718db5a9281f6972aae197bf19e099c34fe75144e9bd57b5b7f8e` |
| `20260720_000006_background_job_worker_runtime.sql` | `ed698bf6279b3dc087d601f76ea553b0e80bb4b624a3b734d2bba3f1ff791c9e` |
| `20260720_000007_background_job_provider_reconciliation.sql` | `e4920ca5a4421e9e7c99c872264d8480186b59af67282c2c5c43fe22a12971a8` |

Postflight found one logged `portal_background_jobs` queue, six initial job kinds, zero jobs/events/effects/workers/provider receipts, zero queue depth, service-role claim access, and denied authenticated claim access. The later AI synthetic migration adds a seventh effect-free kind. No producer or worker was enabled.

The seven files share the CLI version `20260720`; their colliding migration-ledger entry was not created or repaired.

### Design Booklets, Commercial Schema, And Sanctuary AI

The following genuinely absent files passed a second atomic rollback rehearsal and were then applied once:

| File | SHA-256 | Ledger |
| --- | --- | --- |
| `20260731_000001_project_design_booklets.sql` | `dbcf79312a7737e2d58d3e38acee63a670eb64b03251069ee7d5c9dab6970a37` | Exact body recorded as `20260731`. |
| `20260810_000001_project_design_booklet_pdf_drawings.sql` | `ac91589c40b4cfd8ead5e3201469847ab09ddd099411fb6a14ad044820ff0e10` | Not recorded; collides with another `20260810` file. |
| `20260810000003_manual_quote_superseded_status.sql` | `23901c802bf086661d867c3e43607aa847ede678fe43c004a6f2df1dd151d160` | Exact body recorded. |
| `20260810000004_admin_payment_reconciliation.sql` | `5850c0faff4206b59e5b9aed8c647255550a413ac4e9336d5da9d57182beee64` | Exact body recorded. |
| `20260811000001_commercial_internal_names.sql` | `e99d69f95c60650d2b87717cf28089f2bd4a843156a0b65bcbdfd87cddd791d3` | Exact body recorded. |
| `20260811000002_project_commercial_add_on_scopes.sql` | `6c312586dab32a10e19351f72e32b9e7fd827010724e49609ec7c42df66d6c5d` | Exact body recorded. |
| `20260813000001_manual_quotes_without_estimates.sql` | `a60d736ebafdd9e344cb7b4466078fbaccba4301bd5d44b62e1428c76d0590a5` | Exact body recorded. |
| `20260813000002_commercial_admin_action_idempotency.sql` | `a2fc31d070fece1c455895cadf65f31cffb1459fe7d038a1831336e2acac0626` | Exact body recorded. |
| `20260813000003_commercial_truth_invariants.sql` | `5e1a5a84ade2298d164a9b712524d6bc01662754f53452f869569593260f4018` | Exact body recorded. |
| `20260818000002_ai_task_ledger.sql` | `f11dc0e4677992ebe46354d602843037611d39a42dc5b219fcfcebb87fb7d847` | Exact body recorded. |
| `20260818000003_ai_approval_envelopes.sql` | `bd29822096217ecc22f310529282917494cfb86d8a167b928587b7ad1d50751b` | Exact body recorded. |
| `20260818000004_ai_synthetic_execution.sql` | `fce156168c3d866d245b3c1d81c4c1cb9a65ef93ecc7b58d05594e40f535b4a5` | Exact body recorded. |

`20260810_000002_quote_payment_schedules_and_invoice_payments.sql` was already structurally present. Its replay was refused after the rollback rehearsal encountered the existing same-signature function; the colliding `20260810` ledger family was left untouched.

Postflight verified:

- the preflight project/contact/estimate/quote/quote-version/invoice/audit counts were unchanged;
- the private `design-booklet-assets` bucket, both Design Booklet tables, PDF `page_count`, RLS, and policies exist with zero booklet rows;
- payment-reconciliation tables exist with zero payment rows;
- estimate/quote internal names and commercial scope IDs exist;
- guarded quote acceptance is service-role-only and denied to authenticated users;
- eleven new public business/AI tables have RLS enabled;
- AI task, approval, job-link, usage, and evaluation tables contain zero rows;
- authenticated users own the bounded synthetic create/cancel/approval commands, while only service role can enqueue the synthetic durable job; and
- all eleven unambiguous migration-ledger bodies hash exactly to their reviewed files.

## Deterministic QA Data

No existing staging project, contact, estimate, quote, invoice, audit, or scenario row was created, updated, or deleted during this alignment. Scenario provisioning remains explicit through `PORTAL_TEST_SCENARIO_TARGET=staging`; the script rejects production and derives stable IDs from prefix, scenario ID, and entity type. The test-user and scenario target/refusal suites pass 21 tests.

The subsequent CI-baseline reconciliation added exactly one deterministic `[Agent Scenario] Job Pack Ready` contact/project/estimate/quote/job-pack chain. The first guarded attempt stopped at the current quote payment-term constraint after the deterministic shell upserts; the corrected rerun supplied a reconciling two-term schedule and completed idempotently. Postflight found exactly one `portal-agent-scenario` job-pack row and one matching project, and the expanded target/test-user/scenario suite passes 27 tests. No customer row or production target was read or changed.

Use `npm run portal:scenarios:ensure` only when the staging credentials are intentionally available and a scenario revision requires reconciliation. Staging provisioning now requires distinct exact staging and production refs and an exact URL/ref match; local provisioning accepts only a local HTTP origin. Routine CI reads existing staging scenarios and must never provision production.

## 2026-09-14 Configurator enquiry rollback rehearsal

The authenticated project inventory positively identified `tnsiprehuldksnuowubv`
as healthy `SP-Staff-Portal-Staging`. The checkout remained linked to production;
every query explicitly selected the staging ref. No link was changed, production
database queried, producer enabled or migration committed.

Staging already contained attachment links and background jobs, but not the new
private enquiry delivery table. The following exact files passed a single
transaction rehearsal with a three-second lock timeout, then rolled back:

| File | SHA-256 |
| --- | --- |
| `20260914062001_marketing_enquiry_durable_delivery.sql` | `b9a3eae358a58a1804b6e992c7ca2b8c2441dc6bdc00e27caefe865a81f27fad` |
| `20260914062002_marketing_enquiry_staff_receipt.sql` | `df8eb61a2d0c6693866505b27f90c8dd05c4fc2bb977bad3160c33c298851b93` |
| `20260914062003_marketing_enquiry_delivery_status.sql` | `0027a50a24f13618836b245be8fb6b999934182d3db074db3b97a9174505ea55` |

A second rollback rehearsal exercised the actual staging intake and triggers
with a synthetic `.invalid` recipient, no files and no provider dispatch. First
intake and replay returned the same estimate, with exactly one estimate, outbox
and private receipt. Independent postflight confirmed the new table/functions
were absent, zero fixture contacts/templates remained, and enquiry/outbox/job
counts remained zero. This verifies basic no-file intake compatibility with the
current staging schema; it is not an authenticated browser, complete configured
price, upload, worker finalisation or email-provider test.

Evidence is under `artifacts/pricing-review-2026-09-11/`:
`launch-staging-rehearsal.json`, `launch-staging-intake-rehearsal.json` and
`launch-staging-intake-postflight.json`. The SQL artifacts are rollback-only
evidence, not deployment scripts. At the end of that rehearsal they remained
unapplied; the subsequent installation is recorded below.

## Continuing rule after rehearsal

Before application, the ledger check found `20260914000001` already belongs to
`xero_connection` in staging. The three unapplied enquiry files were renumbered
from `20260914000001`–`20260914000003` to
`20260914062001`–`20260914062003`; their SQL contents and hashes are unchanged.
The table above uses the new filenames. Historical rehearsal artifacts retain
the original filenames. No existing ledger entry was repaired or overwritten.
The new version range was absent from staging at the check.

The three exact, hash-checked files were then installed atomically into staging,
with their unchanged SQL bodies recorded under the three new ledger versions.
The transaction refused existing versions/table, queued jobs or recently active
workers. Independent postflight confirmed service-only intake, anonymous denial,
no authenticated direct access to the private receipt, and zero enquiries,
outbox entries and jobs. Evidence: `launch-staging-exact-apply.json` and
`launch-staging-installed-postflight.json` in the same artifact directory.
No worker or deployed producer was enabled, and production remains untouched.

### Browser intake check

A separate local marketing process on `http://localhost:3065` points only at
staging, with durable intake enabled for that process and `RESEND_API_KEY` empty.
The deployed website/worker settings were not changed. A browser-created
`[Staging QA] Configurator Journey` enquiry submitted a 6 × 3 m parallel gable,
ground level, facade connection, open gable ends, synthetic contact/site details
and optional timing. The UI showed "Request received" and explicitly said the
visit was not booked. The persisted immutable receipt contains that design.
The local owner-review price was correctly withheld from the submitted pricing
record because no approved public pricebook was pinned.

Fixture project: `5136da29-bfb1-4d7d-9846-e805c81e7063`; enquiry:
`2c99ac99-a56e-41a7-8c16-f4457710a137`. Its test-only email job
`c3d1c572-daf5-4827-8191-1bdc70333e7e` was isolated, claimed and moved through the
existing lifecycle RPC to `needs_attention` with `STAGING_QA_NO_DISPATCH`.
Email jobs disallow cancellation, so no cancellation policy was changed.
Postflight found zero effects and zero active queue messages for the job. Do not
manually retry this synthetic job: its frozen confirmation contains the normal
business BCC. No provider request or email was sent. Keep this clearly labelled
fixture for the staff receipt/status check; it is not a customer request.

Evidence: `launch-browser-enquiry-receipt.json` and
`launch-staging-park-test-job.json`. This check used plan view because this test
browser could not render 3D; it does not prove WebGL/device performance. Uploads,
authenticated portal rendering, approved numeric pricing and actual delivery
remain separate gates.

### Staff access and attachment completion

The existing staging staff identity `codex-commercial-qa@example.invalid` was
verified before a temporary, in-memory Supabase sign-in (no account, password or
role changes and no sign-in email). The real local portal API on port 3066 denied
anonymous receipt access, returned the frozen gable receipt and `needs_attention`
status to staff, retained private/no-store headers, and omitted provider/private
cost fields. Session tokens were never logged or persisted and the test session
was signed out. Evidence: `launch-staging-staff-receipt.json`.

The browser then submitted Help me choose with a generated PNG, no dimensions,
optional location/timing empty and budget Not sure. Fixture project
`292c1e15-91e6-493f-81e3-7ba3eb84ab88` owns attachment
`4378d27d-8c65-4d5a-9ec4-ebb1bcf35475`; the shared synthetic phone correctly reused
the existing test contact. The real signed-upload/Storage/intake chain succeeded.
Staff list/download, wrong-project denial, anonymous denial, 60-second redirect,
byte equality and link/download audit checks passed. A global response-header
override was fixed in the portal config and the request repeated successfully.
Evidence: `launch-staging-upload-receipt.json`,
`launch-staging-attachment-access.json`, and `launch-staging-upload-audit.json`.
Nine focused route/config tests passed.

Read-only follow-up verification for both synthetic projects found exactly one
open `LEAD_FIRST_EMAIL_V1` task per project, due after two Auckland open hours
with a four-open-hour SLA, project owner `ellen`, and stage `NEW`. Neither
project has a site-visit event or scheduled installation. Individual work-item
assignees are null; the existing effective-assignee resolver deliberately falls
back to project ownership in both project work and the team queue. The 29
focused team-queue/project-work-section tests passed. This verifies persisted
follow-up creation and the tested ownership presentation, not a live rendered
staff-session walkthrough. Evidence: `launch-staging-follow-up.json` and
`launch-staff-follow-up-tests.txt`.

The second synthetic job `4520d182-7b9c-4dfe-ac8e-5d0dc8eee883` is also stopped in
`needs_attention` with `STAGING_QA_NO_DISPATCH`. Do not retry these fixtures.
Postflight found zero active queue messages and zero provider effects. Existing
staff API authorization was exercised; full rendered authenticated portal UX,
large-file email-link behavior and actual provider delivery remain unverified.

Do not use blanket `db push`, `migration up`, or migration repair against this sparse historical ledger. Positively assert the staging ref, inspect structural prerequisites and collisions, rehearse exact reviewed files in a rollback transaction, apply only missing files, preserve row-count evidence, and keep production as an explicit refusal target.


### Configurator staff revisions (14 September 2026)

Installed only in staging: `20260914173001_configurator_estimate_revisions.sql`,
SHA-256 `486aded33749dca5323db0ce00d3fa428eb8a2ea7c55220e20380a117303b354`.
The first rollback rehearsal caught staging's separate `estimates.version` column:
setting only `outputs.version` would display V1 again. Before installation the
migration was corrected to advance and set the real version column as well.
The disposable PostgreSQL stub now includes that column and its default, and the
contract asserts V2. Both Docker and the repeated staging rollback rehearsal
passed, including exact retry, original-row equality, wrong-project denial and
no delivery side effects. All rehearsal records were rolled back.

The exact revised body was installed and ledgered in a guarded transaction after
asserting the staging project identity, absent version/table/function, inactive
workers and the two parked synthetic jobs. Postflight: zero revision records,
one original estimate on the fixture project, unchanged two outbox/two jobs,
service-only RPC execution, no anonymous/authenticated execution or service-role
direct update privilege. No public rate was approved or enabled. Production is
unchanged. Evidence: `revision-version-db-tests.txt`,
`revision-staging-rehearsal.json`, `revision-staging-exact-apply.json`.
A priced HTTP save still awaits an approved pricebook; these schema/transaction
checks do not substitute for that final end-to-end check.
