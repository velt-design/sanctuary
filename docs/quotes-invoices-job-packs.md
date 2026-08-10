# Quotes, Invoices, And Job Packs

This doc is the current-state reference for quote, invoice, public-token, PDF/email, and job-pack flows. These workflows have side effects, public access surfaces, file artifacts, and project-stage implications, so verify behavior at the domain boundary, not only in the UI.

## Read First

- Use `## Ownership` to find the owning route/helper before changing side effects.
- Use `## Public Token Boundaries` before touching public quote, invoice, PDF, or attachment routes.
- Use `## Pricing Source Boundary` before changing estimate-to-quote pricing metadata.

## Ownership

- Staff quote composition and draft/local-first send orchestration: `apps/portal/components/projects/ProjectPage/tabs/QuotesTab.tsx`.
- Quote query/URL selection: `apps/portal/components/projects/ProjectPage/tabs/useQuotesTabSelection.ts`.
- Quote lifecycle actions and refresh/job-pack orchestration: `apps/portal/components/projects/ProjectPage/tabs/useQuoteLifecycleActions.ts`.
- Immediate admin quote retirement: `apps/portal/components/projects/ProjectPage/tabs/useQuoteSuperseding.ts`, `apps/portal/app/api/admin/quotes/[quoteVersionId]/supersede`, and `apps/portal/lib/quotes/adminLifecycle.ts`.
- Quote PDF preview lifecycle: `apps/portal/components/projects/ProjectPage/tabs/useQuotePdfPreviews.ts`.
- Quote PDF composition, presentation model, and module-relative assets: `apps/portal/lib/quotes/pdf.ts`, `apps/portal/lib/quotes/quotePdfViewModel.ts`, and `apps/portal/lib/quotes/quotePdfAssets.ts`.
- Shared quote PDF/email artifact preparation and customer-output tokens: `apps/portal/lib/quotes/renderArtifacts.ts` and `apps/portal/lib/customerArtifacts/brand.ts`.
- Quote send-review email preview: `apps/portal/components/projects/ProjectPage/tabs/QuoteEmailPreviewPanel.tsx`; it renders through the authenticated quote preview API and does not send.
- Quote detail, line-item editing, list/create, and modal presentation: `QuoteDetailView.tsx`, `QuoteLineItemsEditor.tsx`, `QuotesListView.tsx`, and `QuoteWorkflowDialogs.tsx` in the same tab directory.
- Pure quote-tab formatting, validation, and presentation model helpers: `apps/portal/components/projects/ProjectPage/tabs/quotesTabModel.ts`.
- Project Commercial composition and Quotes/Invoices navigation: `apps/portal/components/projects/ProjectPage/tabs/CommercialTab.tsx`.
- Staff quote APIs: `apps/portal/app/api/quotes` and `apps/portal/app/api/staff/v1/quotes`.
- Shared send/resend route parsing and validation: `apps/portal/app/api/quotes/_lib/quoteDeliveryRoute.ts`.
- Quote domain helpers: `apps/portal/lib/quotes`.
- Deposit invoice domain helpers: `apps/portal/lib/invoices`.
- Commercial command, durable email-intent, and audit owners: `apps/portal/lib/commercial`.
- Transactional email helpers and templates: `apps/portal/lib/emails`.
- Shared email-provider transport contract: `packages/email-provider` (`@sp/email-provider`).
- Job-pack domain helpers: `apps/portal/lib/jobPacks` and output helpers in `apps/portal/lib/outputs`.
- Public quote and invoice viewers: `apps/marketing/app/quote/[quoteId]` and `apps/marketing/app/invoice/[invoiceId]`.
- Public token helpers: `apps/marketing/lib/quotes/publicQuote.ts` and `apps/marketing/lib/invoices/publicInvoice.ts`.
- Route/auth contracts: `docs/staff-api-auth-contracts.md`.

Important tables and artifacts:

- `quotes`, `quote_versions`, `quote_line_items`, and `quote_send_logs`.
- `deposit_invoices` and `deposit_invoice_send_logs`.
- `private.commercial_email_intents` for frozen request identity and provider/finalisation checkpoints.
- `file_artifacts` for generated PDFs and attached design PDFs.
- `job_pack_generations` and `job_pack_sheet_overrides`.

Portal PDF generators load owned static assets through module-relative URLs under `apps/portal/assets` and `apps/portal/public`. Production bundles expose those assets as native `file:` URLs. When webpack development instead rewrites one to a hashed `/_next/static/media/...` URL, the asset owner resolves that exact hashed filename inside the current isolated server output; it does not probe source roots. Do not reintroduce root or app fallback probing for fonts or logos; quote fonts should fail with a clear missing-font error, while header logos remain optional and resilient.

For table/RPC ownership, write paths, access boundaries, and migration sources, see `docs/supabase-schema-map.md`.

## Quote Lifecycle

The project page's Overview surfaces the current design and commercial record through the dedicated server-owned command-centre read model. It selects accepted > sent > draft, excludes declined quotes, uses only the selected quote's exact source estimate, and reads only that quote's raw stored total. The precedence rules and source-of-truth notes live in `docs/projects-contacts-estimates-calculator.md` under "Overview and current-design precedence". When changing quote status semantics, accept/decline behaviour, send logs, or quote totals, double-check that read model continues to reflect the right historical source without estimate fallback.

The project header exposes one Commercial tab. Its accessible inner switch keeps Quotes and Invoices as separate lazy owners and preserves the existing `tab=quotes` and `tab=invoices` URLs. `QuotesTab.tsx` is the quote composition owner: query/selection, lifecycle actions, PDF-preview effects, and presentation now live behind the named owners above, while draft editing plus local-first create/persist and send-form orchestration remain in the tab. `CommercialTab.tsx` owns only composition, Edit/Preview URL state, and navigation. Opening either commercial subview is list-first: switching Quotes/Invoices clears quote detail/preview query state, while an explicit `quoteId` deep link or a create action may open a record. Create-from-estimate and unrelated query context remain intact. Email audit data and quote/invoice delivery side effects remain available through their domain records and APIs even though the standalone project Emails tab is retired.

The Commercial Quotes surface uses canonical `QuoteStatusBadge` presentation for `DRAFT`, `SENT`, `ACCEPTED`, `DECLINED`, and `SUPERSEDED`; a sticky action owner reports dirty or syncing draft state without claiming durable success. Version rows are keyboard operable, quote and estimate-version reads expose retry states, and create/refresh/send/expiry/delete dialogs use the shared focus trap, Escape policy, scroll lock, and focus return. Responsive CSS may hide secondary quote-index columns or contain editor tables, but it must retain quote identity, status, inc-GST amount, the explicit GST breakdown, pricing-source identity, and every lifecycle action. These are presentation boundaries only and must not move local-first queueing, locks, quote email/PDF behavior, or server-confirmed transitions into shared UI components.

Permanent quote deletion is admin-only and applies only to the authoritative unsent current draft. The list and detail surfaces use a typed destructive confirmation. Delivery-prepared, sent, accepted, declined, invoiced, and job-pack-backed versions remain historical commercial records and cannot be deleted.

Superseding is a separate immediate admin action for `SENT` or `ACCEPTED` quote versions and has no confirmation step. It is deliberately manual: creating, sending, accepting, or revising another version never changes older statuses automatically. The transition records `superseded_at`, `superseded_by`, and a commercial audit event, revokes the public acceptance token, and prevents resend, acceptance, new invoices, or new job packs from that version. It preserves the PDF, send and acceptance evidence, existing invoices and payments, and every other quote version. Repeating the server command is idempotent.

- A quote has at most one authoritative current draft. Draft creation and revision use stable client intents, and a concurrent duplicate request returns the winning version instead of creating another.
- Editable draft writes use an atomic line-item replacement RPC and a monotonic `commercial_revision`. PATCH, refresh, and delivery preparation require the expected revision; stale clients receive a conflict and reload instead of overwriting newer commercial data.
- Stale revision is an application conflict (`QUOTE_STALE`), not PostgreSQL serialization failure `40001`; the API must return `409` promptly rather than allowing infrastructure-level transaction retries to turn it into a delayed `500`.
- A delivery-prepared version may still have database status `DRAFT`, but it is frozen, no longer current, and read-only. Staff may retry that exact message or create a new revision; they cannot edit underneath the prepared delivery.
- Current draft quote versions can be edited, refreshed from estimates, previewed, revised, and regenerated.
- Each quote version owns a frozen `payment_terms` schedule. A term is either a fixed GST-inclusive amount or a percentage of the balance remaining after all fixed terms; percentage rows must total 100%, resolved cents must reconcile exactly, and the final percentage row absorbs rounding. Drafts may edit this schedule, but sent versions and their resolved amounts are immutable.
- No-approval and engineering-only quote defaults are 50/50 across the full quote. Full-building-consent quotes default to the saved consent-and-engineering allowance as the first fixed payment, then 50/50 of the remaining balance. Staff may replace either default with custom mixed fixed/percentage rows.
- Calculator save completion offers an explicit handoff through `?tab=quotes&createFromEstimateId=...`. Following that action creates the draft from the exact saved estimate through the existing local-first quote workflow; merely opening the save review or outcome UI has no quote side effect.
- The calculator save outcome previews the exact mapped quote lines and total from that saved estimate before staff choose Create quote. A Reprice outcome compares that total with the Live Calculator customer total to the cent and blocks the handoff on an unexpected mismatch. When calculator inputs were saved while preserving stored costing, the handoff explicitly says the quote will use that stored costing basis rather than the Live calculator preview; that intentional basis difference is not treated as a mismatch.
- Estimate-led Project Overview pricing consumes that same saved-estimate handoff preview. It does not use `summary_json.total` or rerun true costing; any mapping blocker or non-positive total makes the customer price unavailable rather than exposing a partial total.
- `apps/portal/lib/quotes/pricing.ts` re-exports the shared `@sp/costing` customer-price sequence used by quote mapping and calculator pergola/site lines: `1.25x`, frozen policy uplift, discount, rounded ex GST, then GST. Version 5 Simple estimates freeze a 21% uplift in `pricing_policy`, exactly 10% above Version 4's result; Version 6 retains that uplift while longer-rafter labour changes the frozen true-cost basis. Historical outputs keep their frozen costing and uplift or default to zero uplift, so quote handoff never infers either from current settings. The calculator preview sums those exact line cents with authoritative approval, blind, and preserved lighting lines, then derives ex GST using the quote totals helper. `quoteDiscountPct` applies to pergola and shared-site sell lines only; approval, blind, and lighting lines remain at their frozen direct customer price. Engineering and full building consent come from the saved estimate's package-owned `customer_add_ons.approval`, receive GST only, and are never recalculated during quote handoff. Infills stay included in their pergola line rather than becoming additive quote items. The Calculator may explain that line as the exact no-infill base customer price plus reconciled incremental infill additions; this does not alter saved costing, quote mapping, quote line count, or totals.
- Meaningful blind rows must have a valid automatic price. `apps/portal/lib/quotes/mapping.ts` returns blocking issues and never substitutes a zero-dollar blind line. Calculator readiness, save-outcome handoff, local-first quote creation, and server create/refresh paths all enforce that shared boundary; direct server callers receive actionable `422` commercial validation rather than a retryable `500`.
- Send review requires a durable, server-confirmed quote: no local-only ID, unsaved edits, pending draft save, stale commercial revision, or superseded draft.
- Sending a quote requires a recipient, subject, priced line items, a generated quote PDF, and configured email/public URL env. Immediately before provider dispatch, the server atomically reserves the exact expected revision and freezes it against later edits.
- Sent quote versions are locked from normal draft editing.
- Send/resend persists one frozen commercial email intent containing the provider idempotency identity, payload hash, recipients, subject/content, token identity, attachment IDs, and exact commercial revision. Provider acceptance is checkpointed before replay-safe database finalisation. A retry reuses that exact intent and never creates a second token, provider key, or attachment set.
- Delivery logs distinguish retryable, provider-confirmed, final, and staff-attention outcomes. The UI does not promise an automatic retry. A browser intent is only a recovery hint: the server can discover the one unfinished subject-bound intent, and staff review its redacted recipients, subject, body, and attachment names before replaying the exact frozen delivery.
- Terminal quote and invoice delivery failures use one shared staff-guidance contract: state that portal retry is unsafe, forbid a replacement send/delivery, name the commercial reference and reconciliation evidence, direct staff to a portal administrator, and require a refreshed commercial record after reconciliation. The guidance changes no delivery state and never creates a new provider intent.
- Unfinished-delivery recovery is optional enrichment on quote reads, not permission to collapse historical quote review. If the commercial migration RPC is absent, staff can still inspect the exact quote, PDF, totals, provenance, and send history in an explicit read-only state. Delivery, revision, and acceptance controls remain unavailable, and delivery endpoints return `503 COMMERCIAL_WORKFLOW_SCHEMA_NOT_READY`; mutations never fall back to legacy table writes.
- Staff and public acceptance call one atomic command that locks the sent quote, records acceptance once, and creates or reuses only the first quote-version payment-term invoice. Duplicate acceptance cannot create a second invoice for that term.
- Declining a sent quote marks it declined. Declining an accepted quote also voids its open invoices; paid invoices remain historical payment evidence.

For a V2 project, durable quote finalisation/replay, resend, acceptance, decline, reply, and supersession reconcile the manual quote cadence only after the commercial owner commits. A durable send creates one follow-up due five Auckland business days later or on the earlier last business day on/before expiry; a same-version resend reschedules only an open follow-up. Recording that follow-up creates one outcome review for the first business day after expiry. Prepared, failed, uncertain, or unfinished delivery does not start cadence, and no cadence command sends email or changes quote state. Existing unmarked projects retain legacy follow-up behavior. Reconciliation is server-only and idempotent. Once the commercial transition commits, a reconciliation repair requirement cannot roll back or report that transition as failed; replay preserves the durable outcome without duplicating its audit or invoice side effects. The reconciliation failure records a bounded staff-safe repair signal without exposing provider details; that recovery preempts normal project work and the SQL queue until a later authoritative reconciliation resolves the affected quote family.

Customer quote artifacts use one output-specific editorial system rather than browser components. The PDF uses owned module-relative Inter assets, warm neutral surfaces, square rules, an olive accent, explicit subtotal/GST/total presentation, flowing line descriptions and terms, continuation context, and page-numbered print-safe footers. The HTML email uses the same hierarchy in a fluid, table-safe 640px shell; the plain-text version preserves the same project, total, expiry, attachment, acceptance, and contact information. Quote artifacts describe the frozen payment schedule, state that the first scheduled invoice follows acceptance, and never present bank details or imply payment is due with the quote.

`renderArtifacts.ts` owns the quote artifact render-version marker used in the render-input hash. A presentation revision may invalidate and regenerate cached PDF/template bytes, but must not change pricing, quote lines, public tokens, selected attachments, send logs, or lifecycle state. Staff send review exposes the actual HTML at desktop and narrow widths plus the exact plain-text body through the existing preview route before sending.

Customer invoice artifacts use an invoice-owned translation of that editorial system, not quote browser components or a second visual system inside `server.ts`. `invoiceArtifactViewModel.ts` normalizes the customer, project, quote, scheduled-payment label/basis, date, total, payment-reference, and contact presentation shared by the PDF and email adapter. The PDF uses invoice-owned module-relative Inter assets and a payment-ledger hierarchy. The fluid 640px HTML email and plain-text fallback preserve the same amount due, due date, reference, source quote, GST totals, authoritative payment lines, attachments, next step, and clarification path. Once an invoice exists, PDF, email, preview, and public presentation use its stored `payment_instructions` and payment-term snapshot; the current owners are only fallbacks for legacy null fields.

Staff invoice preview is read-only. When a frozen commercial intent or stored invoice PDF exists, preview returns that historical artifact with the customer token redacted; otherwise it uses the production renderer with an inert link and generates the PDF in memory. Preview never generates a public token, persists an artifact, changes invoice state, writes a send log, or reaches provider transport. Existing delivery preparation remains the only owner of recipient resolution, private links, immutable requests, and delivery side effects.

The gated `/qa/commercial-workflow-fixture` renders the production quote detail and prepared-delivery dialog with synthetic `.invalid` recipients. Its retryable and staff-attention scenarios are the deterministic visual-regression boundary for immutable delivery review, retry eligibility, responsive layout, touch targets, and focus return; it has no database or provider side effects.

Do not update quote status, draft authority, commercial revision, delivery preparation, tokens, acceptance, or invoice identity with ad hoc table writes. Use the quote/commercial domain helpers and staff/public routes.

JOB-03 changes the transport boundary, not quote ownership. `apps/portal/lib/emails/sendTransactionalEmail.ts` remains a backward-compatible adapter and delegates message normalization, timeout/abort behavior, and typed Resend outcomes to `@sp/email-provider`. Quote and invoice callers now surround that request-bound transport with a private durable commercial intent and replay-safe business finaliser. Raw provider responses and customer content must not be logged. The dark worker still has no quote or invoice handler, producer, or rollout.

If a later checkpoint moves one of these flows to the worker, it must adopt the existing commercial intent rather than create a second delivery identity. An uncertain delivery may repeat only the same provider key and frozen request inside the provider window. Provider acceptance, including signed-webhook reconciliation, resumes the idempotent quote/invoice finaliser but is not itself a quote/invoice state transition.

## Pricing Source Boundary

Quote, public quote, invoice, and job-pack pricing remains unchanged during `workbench_solved` rollout prep. Draft quotes still build from the saved estimate/quote-version boundary, public outputs still render token-scoped quote state, deposit invoices still derive from quote versions, and job packs still require an eligible quote version plus estimate version.

Do not make these side-effect flows consume `workbench_solved` commercial payloads until a later explicit rollout task changes saved estimate or quote-version pricing and verifies rollback to `calculator_live`.

Quote versions copy only compact pricing source metadata from the source estimate when line items are created, refreshed, or revised. The copied record identifies the source (`calculator_live` or `workbench_solved`), compact metadata/hash values, source estimate ID, copy time, actor, and copy reason. Existing historical quote versions are not backfilled. Raw `commercial_design_input` stays out of quote versions, public-token responses, PDFs, invoice payloads, emails, and job-pack outputs unless a later explicit output task changes that boundary.

Rollback from `workbench_solved` to `calculator_live` must not reprice or mutate sent, accepted, declined, invoiced, or job-pack-backed quote versions. Existing quote line items, totals, source metadata, PDFs, send logs, public tokens, deposit invoices, file artifacts, and job-pack generations remain historical records. New draft quote refreshes may pick up the current saved estimate/quote-version boundary only through the quote domain helpers.

Blind lines are priced from the saved calculator inputs through `@sp/costing`, not from duplicated quote logic. New and refreshed draft quotes use the current corrected blind list price and include the selected roll cover, charged width, per-metre inclusive rate, and inclusive cover amount in the line description. Missing historical `rollCover` values mean No cover. Sent, accepted, declined, invoiced, or job-pack-backed quote versions remain frozen and are never repriced by this rule change.

Rollout audit events for quote creation, refresh, revision, and blocked source transitions should include quote version IDs, estimate IDs, source metadata hashes, actor/request metadata, and gate codes when relevant. Never place raw public tokens, accept token hashes, service-role details, or oversized commercial payloads in audit records, PDFs, email bodies, public props, or job-pack outputs.

Before enabling or rolling back `workbench_solved`, run downstream immutability checks:

- Compare row counts and stable IDs before and after the operation for `quote_versions`, `quote_line_items`, `quote_send_logs`, `deposit_invoices`, `deposit_invoice_send_logs`, `file_artifacts`, `job_pack_generations`, and `job_pack_sheet_overrides`.
- Confirm historical quote totals, invoice totals, generated artifact IDs, public token hashes, send-log IDs, and job-pack generation IDs did not change.
- Confirm raw `commercial_design_input` is absent from quote versions, public-token responses, PDFs, emails, invoice payloads, and job-pack outputs.
- Confirm rollback to `calculator_live` does not reprice or mutate sent, accepted, declined, invoiced, or job-pack-backed quote versions.
- Confirm only new draft quote refreshes may copy compact pricing source metadata from the current saved estimate boundary.

## Invoice Lifecycle

- Invoices are whole scheduled payments and are never part-paid. Status is `OPEN`, `PAID`, or `VOID`; payment evidence records paid time, admin actor, method, reference, and optional note against the whole invoice.
- Quote acceptance creates or reuses only payment term one, prepares it, attempts delivery, and returns the actual delivery state. Acceptance remains committed when delivery fails. Later terms are created one-by-one by an admin from the accepted quote schedule and cannot skip an earlier uncreated term.
- The admin Invoice schedule scopes every metric and payment-term link to the current accepted quote version. It shows job total, paid, open, and not-yet-invoiced value, with current invoiced value as supporting detail; invoices from older quote versions remain visible in history but never inflate the current schedule.
- Admin-only routes create later invoices, mark a whole open invoice paid, or void a whole open invoice with a required reason. Voiding preserves the invoice number and audit evidence, clears public-token access, leaves accepted-job state unchanged, and makes that scheduled term eligible to invoice again. Paid invoices cannot be voided. Staff retain read/preview/send access.
- Open and paid invoices retain token-hashed public portal links and generated invoice PDFs; void invoices are unavailable publicly.
- Invoice delivery uses the same frozen-intent/checkpoint rules as quote delivery. Attempts write `deposit_invoice_send_logs`, retain retry/final/staff-attention state, and redact tokenized body content.
- Retryable delivery is a staff-triggered replay of the same intent. Configuration, payload-integrity, expired-window, or terminal provider failures require staff attention; no request-local timer or UI copy claims automatic recovery.
- Staff quote acceptance and the public accepted page distinguish provider-confirmed delivery, prepared/retryable delivery, and staff-attention outcomes. Staff recovery happens from the Invoices tab.
- Staff can preview the PDF, HTML email at desktop or narrow width, and exact plain-text fallback without preparing or sending delivery. Frozen content is preferred when it exists; prospective content is labelled and uses no live customer token.
- Public invoice pages require a valid invoice ID plus token and treat invalid, expired, or void invoices as unavailable. Paid invoices remain readable and clearly display paid state.
- Public invoice PDF and source quote PDF downloads are token-scoped and served with private/no-store cache headers.
- The public invoice presentation is payment-led, route-owned, responsive, and separate from the quote presentation owner. It consumes the existing token-scoped model and authoritative payment lines without changing lookup or lifecycle behavior.
- Invoice/payment state remains invoice-owned. Invoice helpers no longer reset or mirror `invoice_paid` into legacy project-task storage for any project; invoice creation, delivery, payment, and public-token behavior are unchanged.

Do not expose service-role access or raw token values to client components. Token comparisons must stay hash-based.

## Public Token Boundaries

- Public quote links use `quote_versions.accept_token_hash`.
- Public invoice links use `deposit_invoices.portal_token_hash`.
- Quote attachments are limited to file IDs from the send log that matches the current accept token hash.
- Token expiry must be handled as an access state, not as a missing record.
- `apps/marketing/lib/publicTokenAccess.ts` is the shared active-token boundary. Check it immediately after the hash-bound token lookup and before loading customer/project details, line items, attachments, artifacts, or performing acceptance.
- An expired token may produce an expired/unavailable UI state, but it must not return the protected quote/invoice model. The same rule covers quote acceptance, quote attachments, invoice PDFs, and source-quote PDFs.
- Public accept/invoice flows should be treated as server-owned side effects, even though the initiating page lives in marketing.

The public quote route has an isolated, presentation-only editorial stylesheet. It may restyle the token-scoped quote model into the approved square, rule-led, warm-neutral composition and stack line-item fields at narrow widths, but it must not alter lookup, expiry, attachment authorization, acceptance form action, hidden token handling, or accepted/declined semantics. The public invoice route has its own isolated payment-led editorial owner with the same token, expiry, status, PDF, source-quote, private/no-store, and server-only service-role boundaries.

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
npm run test:email-provider
npm run test:portal -- apps/portal/lib/emails/sendTransactionalEmail.test.ts apps/portal/app/api/webhooks/resend/route.test.ts apps/portal/lib/backgroundJobs/providerWebhookRepository.test.ts
npm run test:portal -- apps/portal/lib/quotes
npm run test:portal -- apps/portal/lib/emails/invoice.test.ts
npm run test:portal -- apps/portal/lib/jobPacks
npm run test:portal -- apps/portal/app/api/quotes
npm run test:marketing
```

`apps/portal/lib/quotes/quoteArtifactVisualFixtures.test.ts` owns deterministic, non-persistent simple, discount, multi-page, long-description, long-terms, HTML-email, and plain-text-email fixtures. Set `QUOTE_ARTIFACT_OUTPUT_DIR` to write review artifacts, render every generated PDF page for inspection, and preview the email at desktop and narrow widths. The marketing public-quote page test can write a static presentation fixture with `QUOTE_PUBLIC_FIXTURE_PATH`. These fixture paths do not send email, write quotes, or require production data.

Invoice artifact review has the same data-free boundary. Set `INVOICE_ARTIFACT_OUTPUT_DIR` for representative PDF fixtures, `INVOICE_EMAIL_ARTIFACT_OUTPUT_DIR` for standard and long-identity HTML/plain-text fixtures, and `INVOICE_PUBLIC_FIXTURE_PATH` for the static public presentation fixture. `/qa/invoice-artifact-preview-fixture` exercises the production staff preview dialog and renderers with `.invalid` identities and synthetic payment lines. `playwright/portal.invoice-artifact-preview-fixture.spec.ts` checks desktop/mobile containment, minimum targets, all four preview modes, and keyboard focus return. None of these fixtures prepares delivery, sends email, writes a token, persists an invoice, or reads shared data.

Run `npm run portal:side-effects` first for the mechanical baseline. It runs the quote/invoice/job-pack focused tests and the portal build, without authenticated browser flows, database seeding, or real email delivery. The build step runs `npm run portal:build-env` first, so an active portal dev server or Next build lock fails early with a non-destructive manual-stop instruction. Use the narrower commands when iterating inside one owner area.

Provider-package, adapter, and webhook tests use injected/mocked transport and signed fixtures only. A real commercial email, shared database migration, or production webhook is never a repository test prerequisite. JOB-03 local provider, integration, worker, contract, typecheck, lint, security, and production-build gates pass. Background Jobs [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passes all seven migrations on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1, plus the contracts/integrations and worker artifact/container gates.

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
