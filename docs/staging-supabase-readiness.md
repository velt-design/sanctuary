# Staging Supabase Readiness

Status: Current evidence for `SP-Staff-Portal-Staging`.

Target project ref: `tnsiprehuldksnuowubv`.

Production ref `iytanftukulcnavossmd` is a refusal value in this workflow. Nothing in this record authorises a production query, migration, deployment, or data change.

## 2026-08-18 Alignment

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

Use `npm run portal:scenarios:ensure` only when the staging credentials are intentionally available and a scenario revision requires reconciliation. Routine CI reads existing staging scenarios and must never provision production.

## Continuing Rule

Do not use blanket `db push`, `migration up`, or migration repair against this sparse historical ledger. Positively assert the staging ref, inspect structural prerequisites and collisions, rehearse exact reviewed files in a rollback transaction, apply only missing files, preserve row-count evidence, and keep production as an explicit refusal target.
