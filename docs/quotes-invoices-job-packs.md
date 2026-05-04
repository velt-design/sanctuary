# Quotes, Invoices, And Job Packs

This doc is the current-state reference for quote, invoice, public-token, PDF/email, and job-pack flows. These workflows have side effects, public access surfaces, file artifacts, and project-stage implications, so verify behavior at the domain boundary, not only in the UI.

## Ownership

- Staff quote UI: `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`.
- Staff quote APIs: `apps/portal/app/api/quotes` and `apps/portal/app/api/staff/v1/quotes`.
- Quote domain helpers: `apps/portal/lib/quotes`.
- Deposit invoice domain helpers: `apps/portal/lib/invoices`.
- Transactional email helpers and templates: `apps/portal/lib/emails`.
- Job-pack domain helpers: `apps/portal/lib/jobPacks` and output helpers in `apps/portal/lib/outputs`.
- Public quote and invoice viewers: `apps/marketing/app/quote/[quoteId]` and `apps/marketing/app/invoice/[invoiceId]`.
- Public token helpers: `apps/marketing/lib/quotes/publicQuote.ts` and `apps/marketing/lib/invoices/publicInvoice.ts`.
- Route/auth contracts: `docs/staff-api-auth-contracts.md`.

Important tables and artifacts:

- `quotes`, `quote_versions`, `quote_line_items`, and `quote_send_logs`.
- `deposit_invoices` and `deposit_invoice_send_logs`.
- `file_artifacts` for generated PDFs and attached design PDFs.
- `job_pack_generations` and `job_pack_sheet_overrides`.

Portal PDF generators load owned static assets through module-relative URLs under `apps/portal/assets` and `apps/portal/public`. Do not reintroduce root or app fallback probing for fonts or logos; quote fonts should fail with a clear missing-font error, while header logos remain optional and resilient.

For table/RPC ownership, write paths, access boundaries, and migration sources, see `docs/supabase-schema-map.md`.

## Quote Lifecycle

- Draft quote versions can be edited, refreshed from estimates, previewed, revised, and regenerated.
- Sending a quote requires a recipient, subject, priced line items, a generated quote PDF, and configured email/public URL env.
- Sent quote versions are locked from normal draft editing.
- Sending or resending creates a fresh public accept token hash, logs the email attempt, stores/redacts tokenized body content, and attaches generated PDFs through `file_artifacts`.
- Accepting a sent quote marks it accepted, writes audit history, refreshes quote artifacts, and ensures a deposit invoice exists.
- Declining a sent quote marks it declined. Declining an accepted quote also voids the open deposit invoice for the quote.

Do not update quote status or tokens with ad hoc table writes. Use the quote domain helpers and staff/public routes.

## Pricing Source Boundary

Quote, public quote, invoice, and job-pack pricing remains unchanged during `workbench_solved` rollout prep. Draft quotes still build from the saved estimate/quote-version boundary, public outputs still render token-scoped quote state, deposit invoices still derive from quote versions, and job packs still require an eligible quote version plus estimate version.

Do not make these side-effect flows consume `workbench_solved` commercial payloads until a later explicit rollout task changes saved estimate or quote-version pricing and verifies rollback to `calculator_live`.

Quote versions copy only compact pricing source metadata from the source estimate when line items are created, refreshed, or revised. The copied record identifies the source (`calculator_live` or `workbench_solved`), compact metadata/hash values, source estimate ID, copy time, actor, and copy reason. Existing historical quote versions are not backfilled. Raw `commercial_design_input` stays out of quote versions, public-token responses, PDFs, invoice payloads, emails, and job-pack outputs unless a later explicit output task changes that boundary.

Rollback from `workbench_solved` to `calculator_live` must not reprice or mutate sent, accepted, declined, invoiced, or job-pack-backed quote versions. Existing quote line items, totals, source metadata, PDFs, send logs, public tokens, deposit invoices, file artifacts, and job-pack generations remain historical records. New draft quote refreshes may pick up the current saved estimate/quote-version boundary only through the quote domain helpers.

Rollout audit events for quote creation, refresh, revision, and blocked source transitions should include quote version IDs, estimate IDs, source metadata hashes, actor/request metadata, and gate codes when relevant. Never place raw public tokens, accept token hashes, service-role details, or oversized commercial payloads in audit records, PDFs, email bodies, public props, or job-pack outputs.

Before enabling or rolling back `workbench_solved`, run downstream immutability checks:

- Compare row counts and stable IDs before and after the operation for `quote_versions`, `quote_line_items`, `quote_send_logs`, `deposit_invoices`, `deposit_invoice_send_logs`, `file_artifacts`, `job_pack_generations`, and `job_pack_sheet_overrides`.
- Confirm historical quote totals, invoice totals, generated artifact IDs, public token hashes, send-log IDs, and job-pack generation IDs did not change.
- Confirm raw `commercial_design_input` is absent from quote versions, public-token responses, PDFs, emails, invoice payloads, and job-pack outputs.
- Confirm rollback to `calculator_live` does not reprice or mutate sent, accepted, declined, invoiced, or job-pack-backed quote versions.
- Confirm only new draft quote refreshes may copy compact pricing source metadata from the current saved estimate boundary.

## Invoice Lifecycle

- Deposit invoices are created from sent or accepted quote versions.
- Accepted quotes automatically create an open deposit invoice and attempt to send it.
- Open deposit invoices have token-hashed public portal links and generated invoice PDFs.
- Invoice send attempts write `deposit_invoice_send_logs`, track retry/final-failure state, and redact tokenized body content.
- Public invoice pages require a valid invoice ID plus token and treat invalid, expired, or void invoices as unavailable.
- Public invoice PDF and source quote PDF downloads are token-scoped and served with private/no-store cache headers.

Do not expose service-role access or raw token values to client components. Token comparisons must stay hash-based.

## Public Token Boundaries

- Public quote links use `quote_versions.accept_token_hash`.
- Public invoice links use `deposit_invoices.portal_token_hash`.
- Quote attachments are limited to file IDs from the send log that matches the current accept token hash.
- Token expiry must be handled as an access state, not as a missing record.
- Public accept/invoice flows should be treated as server-owned side effects, even though the initiating page lives in marketing.

When changing public routes, verify invalid token, missing token, expired token, already accepted, declined/void, and attachment/PDF unavailable states.

## Job Packs

- Job packs sit after quoting/design and before or during install preparation.
- Generation is tied to a quote version and estimate version.
- Eligible quote statuses are sent, accepted, and declined.
- Existing generations are reused for the same quote version.
- Job-pack PDFs require a generated job pack for the estimate before download.
- Powdercoating overrides are stored per estimate and sheet key with version-aware conflict handling.

Do not generate job packs directly from arbitrary estimate state when a quote-version boundary is required.

## Verification

Focused commands:

```bash
npm run portal:side-effects
npm run test:portal -- apps/portal/lib/quotes
npm run test:portal -- apps/portal/lib/emails/invoice.test.ts
npm run test:portal -- apps/portal/lib/jobPacks
npm run test:portal -- apps/portal/app/api/quotes
npm run test:marketing
```

Run `npm run portal:side-effects` first for the mechanical baseline. It runs the quote/invoice/job-pack focused tests and the portal build, without authenticated browser flows, database seeding, or real email delivery. The build step runs `npm run portal:build-env` first, so an active portal dev server or Next build lock fails early with a non-destructive manual-stop instruction. Use the narrower commands when iterating inside one owner area.

Current local signal from 2026-05-03: `npm run portal:side-effects` passed with 8 quote/invoice/job-pack test files and 32 tests, then `npm run build:portal` completed with `Compiled successfully`, TypeScript, and 55 static pages generated. `npm run test:marketing` also passed with 9 files and 37 tests, including public quote accept/attachment routes, public invoice/source quote PDF routes, and source guards that keep public token comparisons hash-bound.

Manual or browser checks should cover:

- Draft quote edit, refresh, preview, PDF generation, send, resend, accept, decline, and revise.
- Send/resend failure when email or public URL env is missing.
- Public quote view with valid, missing, invalid, expired, accepted, and declined states.
- Public quote attachment download only through a token-scoped send-log attachment.
- Accepted quote creates or reuses a deposit invoice and attempts delivery.
- Invoice retry/failure/final-failure states remain visible to staff.
- Public invoice view, invoice PDF, and source quote PDF with valid, missing, invalid, expired, and void states.
- Job-pack generation from an eligible quote version and PDF download after generation.
- Powdercoating override save conflict and successful override persistence.

If changing schema or access policy for these flows, also verify the ordered migrations, RLS/service-role boundary, and public token behavior.
