# Testing And QA

Use the smallest test that covers the risk. Run broader suites when touching shared workflow, portal shell, scheduling, local-first, Supabase access, or public lead/quote flows.

## Read First

- Use `## Common Commands` for routine repo, portal, focused, and operational scripts.
- Use `## Docs-Only Checks` when changing docs, agent guidance, or docs tooling.
- Use `## Background-Job And Worker Tests` for JOB-01/JOB-02/JOB-03 provider-package, worker, migration, security, webhook, fault-injection, and isolated PGMQ database checks.
- Use `## Portal Browser Tests` and `## Drawing Fixture Route` for Playwright/auth/drawing smoke expectations.
- Use `## Schedule QA Gate` for Schedule V2 readiness and focused schedule checks.
- Use `## Project Work Items V2 Gate` for the new-project work model, mixed-mode boundary, and rollout checks.
- Use `## CI` to confirm which workflows enforce or report each gate.

## Canonical Command Source

Keep general repo command lists here. Other docs should link to this doc instead of duplicating broad command blocks. Feature docs may still list focused commands for their own verification gates.

The root `npm run dev`, `build`, and `start` scripts only print the app-specific command to use.

## Common Commands

```bash
npm run dev:marketing
npm run dev:portal
npm run dev:worker
npm run test
npm run test:marketing
npm run test:marketing:browser
npm run test:email-provider
npm run test:jobs
npm run test:jobs:db-contract
npm run test:jobs:db
npm run test:worker
npm run test:portal
npm run build:marketing
npm run build:portal
npm run build:worker
npm run typecheck
npm run typecheck:worker
npm run lint
```

Marketing public-boundary changes should run the unit/domain suite, marketing
TypeScript and ESLint, the production build, and the relevant browser specs.
`apps/marketing/lib/publicTokenExpiry.domain.test.ts` proves expired quote and
invoice tokens cannot read or mutate downstream resources. Enquiry coverage
includes durable signing limits, metadata/content/path validation, cleanup,
safe errors, atomic retry/concurrency semantics, and the migration contract.
`playwright/marketing.consent.spec.ts` observes real requests and fails if GTM,
GA, Meta, ArchiPro, or a GTM noscript resource loads before the corresponding
explicit consent.

Shared marketing-foundation primitive changes should run
`npx vitest run apps/marketing/components/marketing-foundation/Primitives.test.tsx`,
`npx playwright test playwright/marketing.foundation.spec.ts --config=playwright.marketing.config.ts`,
and the focused spec for each adopted public consumer. The Foundation spec
covers 430, 390 and 360 pixel fixtures plus tablet and desktop smoke, semantic
CTA tiers, 44/48 pixel targets, focus visibility, responsive media ratios and
focal points, card/fact-list layout, reduced motion, reduced horizontal
overflow risk, and stable desktop card geometry. Its isolated 390 and 1440
pixel matrix covers each distinct direct Foundation consumer without crossing
the animated route-transition boundary. Set `MARKETING_FOUNDATION_CAPTURE=1`
to capture the three mobile primitive specimens under
`artifacts/mobile-ux-phase-3-pr-6/`.

Shared public-header changes should run
`npx vitest run apps/marketing/components/Header.test.tsx apps/marketing/components/headerNavigation.test.ts`
and
`npx playwright test playwright/marketing.shared-header.spec.ts --config=playwright.marketing.config.ts`.
The component lane owns open/closed state, inert hidden content, focus cycling,
Escape return, reversible body scroll locking, history cleanup and the 901px
CSS/JavaScript breakpoint contract. The browser lane covers the approved
mobile destinations and route-aware enquiry URLs at 430px, 390px and 360px.
The current menu must expose Projects, `Pergola options`, Commercial and
Professionals exactly once, followed by `Start your project`; Home remains the
brand destination and Contact remains the project action rather than duplicate
menu rows.
Its established-route matrix includes a commercial project and verifies that
known project headers carry the governed audience and slug while product
headers carry the product slug without an inferred audience. It also covers
tablet compatibility, a 360px by 480px short viewport, 44px targets, reduced
motion, scroll and Back behavior, and established desktop routes and geometry.
Set `MARKETING_SHARED_HEADER_CAPTURE=1` to write the approved PR 8 evidence to
`artifacts/mobile-ux-phase-3-pr-8/`.

The optimized static root may supply `/index` to `usePathname()` even though
the public route is `/`. Header changes must verify the generated production
`index.html` and the deployed root, asserting the residential estimate
audience, canonical `source_path=/` and hero-overlay state. Development routing
alone does not exercise this alias. Short-height focus checks must first wait
for the menu's promised initial Home focus before programmatically moving to a
later link; otherwise the scheduled focus owner and the assertion race.

Product-page changes should run
`npx vitest run apps/marketing/data/products.test.ts apps/marketing/components/products/productDetailViewModel.test.ts apps/marketing/components/products/productHubViewModel.test.ts`
and
`npx playwright test playwright/marketing.products.spec.ts --config=playwright.marketing.config.ts`
before the full marketing browser lane. The focused browser suite covers the
product hub, one pergola form and one integrated accessory at 1440, 768 and 390
pixel widths. Its mobile-refinement matrix adds 320, 390 and 430 pixel coverage
for the hub, form, accessory and unpublished-evidence heater states, and it
visits all ten detail routes at 390 pixels. The lane verifies sitemap discovery,
one visible H1, early and final CTA continuity, one controlled gallery,
server-rendered keyboard-operable disclosure content, minimum 44 pixel targets,
loaded imagery, metadata and schema, mobile height budgets, reduced motion, no
horizontal overflow, no nested content scroll and explicit handling of
unpublished heater evidence. The hub has no responsive disclosure, retains all
ten canonical product links and shows one governed project plus one guide.
Details retain exactly three disclosure IDs and Product/Breadcrumb schema;
retired product FAQ copy must not return through an invisible FAQ schema.

Phase 3 service/product changes should also run
`npx playwright test playwright/marketing.phase-three.spec.ts --config=playwright.marketing.config.ts`.
The suite visits the product hub, all ten product details, residential and
custom at 430, 390 and 360 pixels. It enforces exact first-layer words and
sections, three product disclosure IDs, one active controlled-gallery image,
no duplicate product image requests, bounded HTML, six-region service
structures, priority hero loading and cumulative layout shift at or below
`0.1`. Set `MARKETING_PHASE_THREE_CAPTURE=1` to write the 39-record JSON and
representative screenshots under `artifacts/mobile-ux-phase-3/`. Set
`MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz` only for a read-only
deployed smoke or capture; form checks must still intercept `**/api/enquiry`.

Phase 4 commercial/professional/guide/footer/homepage changes should also run
`npx playwright test playwright/marketing.phase-four.spec.ts --config=playwright.marketing.config.ts --workers=1`.
The suite verifies three commercial cases and stages, commercial source
context, professional route discovery/schema/sitemap, supported-file guidance,
an intercepted professional payload, canonical consented analytics with no
personal properties, ten visible guide distinctions, all seven guide first
layers, refresh/Back, no-JavaScript completeness, the production homepage's one
first-question radio group, three capability pathways and three process stages,
plus compact footer utility at 430, 390 and 360 pixels. The retired homepage's
seven-region/five-disclosure budget is historical evidence only. Set
`MARKETING_PHASE_FOUR_CAPTURE=before|after` and
`MARKETING_PHASE_FOUR_WIDTH=430|390|360` to write or update the 36-record JSON
and representative screenshots under `artifacts/mobile-ux-phase-4/`. Add
`MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz` only for read-only
deployed smoke/capture and continue intercepting `**/api/enquiry`.

The production first-design-conversation homepage has a focused lane:
`npx playwright test playwright/marketing.homepage.spec.ts --config=playwright.marketing.config.ts`.
It covers the complete required 320-to-1440 responsive matrix, canonical
indexable metadata and WebSite/WebPage schema, permanent comparison-route
redirects, first-question radio keyboard and screen-reader structure,
stable project-specific link names, hero-fragment visibility at narrow and
200-percent-zoom viewports, selected hover and inverse/selected focus contrast,
44-pixel touch dimensions, reduced motion, JavaScript-disabled fallback,
unavailable session storage, image failure, consent granted/denied pointer and
keyboard analytics, deterministic fail-closed two-project responses, validated
project-reference handoff to `/contact`, retained capability/process content,
the shared mobile-menu scroll/focus contract, and local CLS/first-answer
performance ceilings. For the LCP ceiling, start a local production build,
point `MARKETING_BASE_URL` at it, and add
`MARKETING_HOMEPAGE_PRODUCTION_PERF=1`; development compilation is deliberately
excluded from LCP evidence.

The homepage lane identifies the current copy as
`design_conversation_home_v3`. Stable event names, the governed two-project
matches and the closed-intent storage key remain unchanged; tests assert the
v3 analytics property so results are not mixed with earlier copy variants.

The internal `/__foundation/marketing` catalogue fails closed in production
unless `ENABLE_MARKETING_FOUNDATION=true`. A full deployed browser sweep will
therefore fail its 18 catalogue-only assertions by design. Report the public
production result separately and prove the complete foundation file against a
local build; do not weaken the production access rule to make that matrix
green.

Phase 5 production-supporting validation should run
`npx playwright test playwright/marketing.phase-five.spec.ts --config=playwright.marketing.config.ts --workers=1`
locally and with
`MARKETING_BASE_URL=https://www.sanctuarypergolas.co.nz` for the read-only
deployed matrix. Set `MARKETING_PHASE_FIVE_CAPTURE=1` only for the dated
production evidence run. It writes a 36-record route/width payload and
representative screenshots under `artifacts/mobile-ux-phase-5/automated/`.
The lane covers twelve primary routes at 430, 390 and 360 pixels, including the
custom service and a representative guide detail in addition to HTTP
and request failures, document overflow, CLS, landmarks, H1s, duplicate IDs,
visible images, 44 pixel controls, FCP, LCP, TTFB, transfer size, image/script
payload and long tasks. A raw-response contract also requires one sanitized
`X-Sanctuary-Release` value across normal and cache-busted requests and checks
the intended semantic markers and service-route guide framing. Set
`MARKETING_EXPECTED_RELEASE_SHA` for an exact deployment assertion. For the
active PDR programme this automated matrix is the mobile interaction gate. The
device and assistive-technology matrix in
`docs/mobile-ux-phase-5-validation.md` is optional historical research, not a
merge requirement.

Mobile first-layer copy, responsive disclosure, shared public route-template,
service, SEO-landing or guide-directory changes should also run
`npx playwright test playwright/marketing.mobile-content-density.spec.ts --config=playwright.marketing.config.ts`.
The suite audits representative homepage, residential, custom, product,
commercial, guide and contact journeys at 430, 390 and 360 pixels. It enforces
bounded initially visible words and heading-bearing regions, retained
proposition/evidence/constraint/action signals, native disclosure identity,
44 pixel controls, keyboard operation, visible focus, reduced motion, heading
hierarchy, unique IDs, CTA and meaningful-link continuity, metadata, schema,
source-aware enquiry context, unclipped product summaries, zero horizontal
overflow with supporting detail closed and open, uniquely named guide controls,
post-evidence residential CTA continuity, fragment-target disclosure reveal and
expanded 1440 pixel desktop detail. A script-blocked, JavaScript-enabled lane
holds service, product, guide and project disclosures in their pre-hydration
state at every target width. It requires pending bodies to be hidden and
unfocusable and compares pre/post-hydration disclosure height within one pixel.
The homepage has no responsive disclosure; its focused JavaScript-disabled
browser contract verifies all three intent pathways and six project references.
The wider JavaScript-disabled context remains the required server-rendering
check: one route-owned `main` and H1, the next action, and complete open
supporting content remain visible without hydration.

Current closed-detail word ceilings are part of that contract: 450 for the
homepage and representative product detail, 500 for the product hub, 650 for
residential, custom, commercial and representative guide detail, and 350 for
the guide hub and contact. They are upper bounds, not writing targets. Page
families that embed the enquiry form must not regain a generic conversion
section after it, while the product hub plus product and project details keep
one short final project action.

Contact-page or embedded-enquiry changes should run
`npx vitest run apps/marketing/lib/enquiryFormContract.test.ts apps/marketing/app/contact/contactFormModel.test.ts apps/marketing/app/contact/enquiryRoute.test.ts apps/marketing/lib/enquiryAttachments.test.ts apps/marketing/app/api/enquiry/route.test.ts`
and
`npx playwright test playwright/marketing.contact.spec.ts playwright/marketing.seo-landing.spec.ts playwright/marketing.seo-programme.spec.ts playwright/marketing.acrylic-foundation.spec.ts playwright/marketing.acrylic-copy-variant.spec.ts --config=playwright.marketing.config.ts`
before the full marketing browser lane. These focused suites cover 320,
390, 430, tablet and desktop widths; server-rendered query preselection;
persistent labels and form metadata; minimum 44 pixel targets; reduced motion;
zero textual or generated em dashes; no horizontal overflow or nested content
scroll; a neutral/residential/commercial/professional/project/product entry
matrix; focused client validation; retained values and UUID reuse after API
failure; duplicate-submit exclusion; consent-controlled events; attribution;
attachment policy errors; visible failure when attachment signing or upload is
unavailable; and lower-case
non-personal canonical context in payloads and analytics. The embedded-route
matrix additionally asserts the shared required/optional contract, field order,
one `Add optional project details` disclosure, governed upload accept list and
limits, commercial audience, route attribution and retained success values.
The acrylic variant spec now owns a redirects-disabled assertion that
`/acrylic-roof-pergolas-auckland-v2` permanently redirects in one hop to the
self-canonical primary route; it is no longer a second page-content suite.

Project-page changes should run
`npx vitest run apps/marketing/app/projects/projectFilters.test.ts apps/marketing/app/projects/projectPresentation.test.ts apps/marketing/data/projects.claims.test.ts`
and
`npx playwright test playwright/marketing.projects.spec.ts playwright/marketing.projects-phase-two.spec.ts --config=playwright.marketing.config.ts`
before the full marketing browser lane. The project browser suite visits every
canonical case study at 390 pixels and runs the collection plus four
representative project states across 320, 360, 390 and 430 pixels. The
collection lane covers every audience and roof-form combination, all-project
and empty states, URL reset, refresh and Back, one semantic image-led card
tree, canonical destinations, native disclosure semantics, visible focus,
minimum 44 pixel targets, responsive sizes, focal points, lazy loading,
reserved image geometry, absence of hidden case-study markup or media requests,
payload size and desktop rail regression. The detail lane verifies one visible
H1 and logical heading order, early and final contact actions, loaded and
intentionally framed hero media, mobile height budgets, native server-rendered
disclosures, selector focus and scroll behavior, one native horizontal gallery
strip, top-aligned variable 4:3 and 3:4 image heights, native touch swipe,
contextual Previous/Next controls, live position and edge state, retained
control focus, Arrow/Home/End keyboard navigation, visible keyboard focus on
the region, lazy image loading, metadata and schema,
honest missing-data treatment, enquiry context, browser Back/refresh, reduced
motion, zero textual or generated em dashes, no horizontal overflow and no
nested vertical content scroller. Its seven-width responsive matrix provides
the remaining
representative desktop regression coverage. Set
`MARKETING_PHASE_TWO_CAPTURE=1` to run the focused evidence spec and write
collection payload plus current project-gallery screenshots at 430, 390, 360
and desktop under
`artifacts/mobile-ux-phase-2/`.

Project-detail copy checks require the approved short summary, visible Brief
and first Response, Facts, Gallery and Technical details. Curated related
projects are the only end-of-story project navigation; circular project
previous/next links must not return. Gallery Previous/Next controls remain part
of the separate media interaction contract above.

Portal readiness sweeps:

```bash
npm run portal:doctor:quick
npm run portal:doctor:quick:log
npm run portal:doctor
npm run portal:doctor:log
npm run portal:build-env
npm run portal:side-effects
```

`portal:doctor:quick` runs docs guard, mojibake check, typecheck, lint, and portal Vitest. `portal:doctor` adds portal build, general route bundle budgets, drawing and fixture-performance browser smoke, authenticated smoke, route performance, and production security audit.

`portal:build-env` is the fail-fast preflight for portal build-dependent gates. `npm run build:portal`, `npm run portal:side-effects`, and broad `npm run portal:doctor` run it before `next build` so an active portal dev server or Next build lock prints a clear manual-stop instruction instead of failing deep in the build.

`portal:side-effects` is the focused quote, invoice, public-token, PDF/email, and job-pack readiness gate. It runs `npm run test:portal:quotes` and then `npm run build:portal` because generated PDF and job-pack asset loading is build-sensitive.

Commercial-trust changes should also run the focused intent/audit/migration and route contracts before the broad gate:

```bash
npm run test:commercial:db
npx vitest run apps/portal/lib/commercial apps/portal/app/api/quotes/_lib apps/portal/app/api/projects/[projectId]/estimates/route.test.ts apps/portal/components/projects/ProjectPage/tabs/QuotesTab.test.tsx
```

`npm run test:commercial:db` executes the commercial bootstrap, trust migration, stale-conflict correction, and SQL contract in disposable in-process PGlite PostgreSQL 18. It proves rollback, atomic apply, idempotent replay, exact estimate/quote intents, revision conflicts, frozen delivery identity, acceptance/invoice idempotency, and service-role-only grants without reaching a shared database. The static migration test remains a complementary source-shape guard. Never use shared or production data as the disposable fixture.

`npm run test:portal:commercial:staging` is the opt-in post-migration smoke. It refuses any linked Supabase project that is not positively identified as healthy staging, provisions one deterministic `.invalid` staff/scenario lane, strips provider email variables, starts an isolated portal on port 3002, and checks authenticated quote reads, a revision-safe update, immediate stale-write `409`, prepared-delivery recovery read, final persisted state, PDF artifact refresh without a swallowed server failure, and rendered Review & Send readiness. It must not call send/resend, public acceptance, invoice delivery, or any production target.

The focused commercial suite also proves that a missing recovery RPC preserves read-only quote detail, marks commercial actions unavailable, and returns an explicit `503` from delivery/recovery routes. Quote/invoice provider tests inject transport and must not send real email. Browser review may preview but must stop before send, public acceptance, or invoice delivery.

The data-free commercial recovery fixture is `/qa/commercial-workflow-fixture`. It requires `ENABLE_PORTAL_QA_FIXTURES=1`, renders the production quote detail and prepared-delivery dialog, and has retryable plus staff-attention scenarios without database, provider, email, token, or customer-record access. `playwright/portal.commercial-workflow-fixture.spec.ts` checks both scenarios at 1280x900 and 390x844, including read-only frozen content, retry eligibility, overflow, 44px mobile targets, dialog focus return, browser errors, and attached screenshots. It belongs to the `portal-fixture` project.

Projects/Contacts list and project-create changes should run:

```bash
npx vitest run apps/portal/lib/projects/createProjectContract.test.ts apps/portal/lib/projects/createProjectCommand.test.ts apps/portal/app/api/staff/v1/projects/route.test.ts apps/portal/app/api/staff/v1/projects/index/route.test.ts apps/portal/app/api/staff/v1/contacts/index/route.test.ts apps/portal/app/api/contacts/[contactId]/route.test.ts apps/portal/lib/projects/serverProjectsIndex.test.ts apps/portal/lib/contacts/serverContactsIndex.test.ts apps/portal/lib/queries/projectsIndex.test.ts apps/portal/lib/queries/contactsIndex.test.ts apps/portal/app/staff/projects/ProjectsIndexClient.test.tsx apps/portal/app/staff/contacts/ContactsIndexClient.test.tsx test/portal-operational-lists-migration.test.ts
```

The static migration contract proves bounded pages, stable ordering, scalar access checks, duplicate normalization, and authenticated-only grants without applying SQL or reading shared data. Before any environment browser check, apply `20260729_000001_portal_operational_lists.sql` through the normal migration process; a `503 ..._SCHEMA_NOT_READY` is a failed prerequisite, not a UI empty state. Browser verification should use an authenticated local/test account, existing records, and read-only list/search/pagination interactions at desktop, compact desktop, tablet, and narrow widths. Project-create browser checks should submit only against a disposable fixture or an intercepted API response; routine review must not create persistent contacts/projects or trigger real email.

For deterministic quote-artifact review, set `QUOTE_ARTIFACT_OUTPUT_DIR` to an OS-temp directory and run `apps/portal/lib/quotes/quoteArtifactVisualFixtures.test.ts`. Render the emitted PDFs with Poppler and inspect every page of the simple, multi-page, long-description, and long-terms cases. Generated fixtures are review artifacts only and must not be committed or mistaken for delivery evidence.

For deterministic invoice-artifact review, set `INVOICE_ARTIFACT_OUTPUT_DIR` and run `apps/portal/lib/invoices/invoiceArtifactVisualFixtures.test.ts`; render and inspect every emitted PDF page with Poppler. Set `INVOICE_EMAIL_ARTIFACT_OUTPUT_DIR` when running `apps/portal/lib/emails/invoice.test.ts` to write standard and long-identity HTML/plain-text fixtures. `INVOICE_PUBLIC_FIXTURE_PATH` makes the marketing invoice page test write the open invoice plus missing-token, invalid, expired, void, loading, and unavailable-document variants beside it. These outputs use synthetic identities and payment lines only.

The gated `/qa/invoice-artifact-preview-fixture` uses the production staff dialog, invoice PDF renderer, HTML renderer, and plain-text renderer with no database, token generation, persistence, or provider transport. Run `npx playwright test playwright/portal.invoice-artifact-preview-fixture.spec.ts --project=portal-fixture` to check desktop and 390px containment, PDF/email/plain-text modes, 44px minimum mobile controls, Escape close, and focus return. It requires `ENABLE_PORTAL_QA_FIXTURES=1`, which the local fixture project supplies.

Use the `:log` variants when running noisy gates through an AI agent or chat tool. They run the same root npm scripts, write full stdout/stderr to an OS temp log, and print only the command, log path, duration, exit code, and a compact pass/fail summary. On failure they also print the last 120 log lines.

Focused portal commands:

```bash
npm run test:portal:api
npm run test:portal:schedule
npm run test:portal:workbench
npm run test:portal:projects
npm run test:portal:quotes
npm run portal:side-effects
npm run test:portal:shell
npm run test:portal:log
```

Use focused commands while iterating in one domain, then run `npm run portal:doctor:quick` before handing work back. Use `npm run portal:doctor` for a broad local pre-merge readiness sweep when Playwright auth/env and audit expectations are ready.

Focused guards:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run worktree:status
npm run worktree:changed
npm run worktree:changed:strict
npm run architecture:changed
npm run architecture:changed:strict
npm run dead-code:report
npm run dead-code:changed
npm run dead-code:changed:strict
npm run files:report
npm run files:changed
npm run files:changed:strict
npm run root:compat
npm run root:compat:changed
npm run root:compat:changed:strict
npm run browser:supabase
npm run browser:supabase:changed
npm run browser:supabase:changed:strict
npm run service-role:report
npm run service-role:changed
npm run service-role:changed:strict
npm run text:mojibake
npm run packages:guard
npm run cache:forbid
npm run brand:forbid
npm run portal:bundle-budget
npm run schedule:bundle-budget
```

`npm run packages:guard` checks that app imports of local `@sp/*` workspace packages are declared in the app manifest and listed in Next `transpilePackages`. `npm run lint` includes this guard after `docs:guard`.

`npm run worktree:status` is an advisory ownership report for dirty worktrees and parallel lanes. Use `WORKTREE_OWNER_PATTERNS` with comma-separated path globs to declare the current task's owned paths. `npm run worktree:changed` is the focused handoff form. `npm run worktree:changed:strict` fails when dirty files exist without declared owner patterns, when files are outside the declared lane, or when deleted/missing paths need explicit owner confirmation. These commands are not part of `npm run lint`.

`npm run architecture:changed` is the recommended advisory handoff sweep for non-trivial work. It runs `worktree:changed` first, then `dead-code:changed`, `files:changed`, `root:compat:changed`, `browser:supabase:changed`, and `service-role:changed` with section headers, while leaving each focused report as the canonical source of its own handoff cues. It is not part of `npm run lint`.

`npm run architecture:changed:strict` is an architecture/tooling check and CI-visible advisory. It starts with `worktree:changed:strict`, then runs the strict changed-file variants that currently block only selected new risky growth. Declare `WORKTREE_OWNER_PATTERNS` before running it in a dirty local worktree. It is not part of `npm run lint`.

Changed-file architecture reports use the dirty worktree against `HEAD` by default. When `ARCHITECTURE_CHANGED_BASE` and `ARCHITECTURE_CHANGED_HEAD` are set, they compare those refs instead; Portal Quality uses that mode on pull requests so the advisory and strict advisory reports see PR base-to-head changes even though the CI checkout is clean. The aggregate `architecture:changed:strict` step remains non-blocking, but Portal Quality separately runs `files:changed:strict` as a blocking pull-request gate.

`npm run dead-code:report` is an advisory unused-code and dependency report powered by Knip and explained by `docs/code-retirement-and-bloat-control.md`. It reports unused files, exports, types, dependencies, unlisted dependencies, and duplicate dependency declarations. `npm run dead-code:changed` narrows the same report to touched files for handoffs and uses the same dirty-worktree or PR base/head changed-file source as the architecture reports. `npm run dead-code:changed:strict` fails only for newly added unused files without valid registry coverage; existing modified files, unused exports/types, dependencies, and registered dynamic/deferred entrypoints remain advisory. These commands are not part of `npm run lint`; do not delete code from this report without search, owner-doc review, and focused tests.

`npm run files:report` is an advisory large-file ownership report. It highlights warning and critical files that should follow `docs/file-decomposition-and-ownership.md` before major feature expansion. `npm run files:changed` narrows that report to touched code files for agent handoffs, including line deltas from HEAD when available. `npm run files:changed:strict` fails when a touched critical code file lacks a matching decomposition-registry entry; Portal Quality runs it as a blocking pull-request gate with PR base/head refs. These commands remain outside `npm run lint`.

`npm run root:compat` is an advisory report for root-level compatibility paths such as `components`, `lib`, `data`, `src`, and `styles`. `npm run root:compat:changed` narrows the report to touched root compatibility files for handoffs. `npm run root:compat:changed:strict` fails only for new root compatibility files. These are not part of `npm run lint` yet.

`npm run browser:supabase` is a broad advisory inventory of browser-facing Supabase access. `npm run browser:supabase:changed` narrows the report to touched files for handoffs. `npm run browser:supabase:changed:strict` fails only for new browser Supabase access outside approved adapters. The narrower hard guard remains `npm run cache:forbid`, which is included in `npm run lint`.

`npm run service-role:report` is a broad advisory inventory of service-role Supabase access across portal, marketing, root compatibility, and operational scripts. `npm run service-role:changed` narrows the report to touched files for handoffs. `npm run service-role:changed:strict` fails only for new service-role access outside approved server flows or compatibility helpers. The narrower portal-only hard guard remains `apps/portal/lib/supabaseClient.boundaries.test.ts`.

Operational commands:

```bash
npm run portal:invite
npm run running-jobs:legacy-import
npm run costing:rebaseline-overrides
npm run geometry:generate-profile-assets
npm run emails:preview
```

## Docs-Only Checks

For docs-only changes, run these from the repo root:

```bash
npm run docs:guard
npm run docs:impact
npm run docs:navigation
npm run docs:readiness
npm run text:mojibake
```

`npm run docs:guard` checks required agent-doc links, startup-path docs, documented npm scripts, local Markdown link targets and anchors, decision-log structure, change-routing owner paths, portal readiness metadata, stale placeholders, ASCII docs, and superseded redirect shape.

`npm run docs:impact` is an advisory check that maps changed behavior files through `docs/change-routing.md` and suggests owner docs when matching docs were not changed. It exits nonzero only when `DOCS_IMPACT_STRICT=1`.

When `docs:impact` prints an advisory, update the suggested owner doc if the code change affects behavior, data flow, source-of-truth boundaries, test strategy, or known risks. Leaving docs unchanged is acceptable only when the change is mechanical, test-only, or behavior-neutral; note that decision in the handoff. Keep `docs:impact` advisory unless intentionally running `DOCS_IMPACT_STRICT=1` locally.

`npm run docs:navigation` is an advisory report for dense docs. It highlights long docs that may need a routing, index, or "read first" section.

`npm run docs:readiness` is an advisory report for `docs/portal-production-readiness.md`. It summarizes tracker age, status counts, at-risk rows, and unchecked checklist counts, but it does not verify readiness by itself.

## Background-Job And Worker Tests

JOB-01 through JOB-03 have six distinct verification layers:

- `npm run test:email-provider` runs the Node-only `@sp/email-provider` normalization, byte-stable durable identity, fixed 24-hour provider-retention/20-hour retry configuration, Resend outcome/timeout/abort, retry-after, integrity, and raw-body Svix verification tests. All network transport is injected or mocked; this command never sends a real email. On 2026-07-20 it passed 3 files and 47 tests.
- `npm run test:jobs` runs the `@sp/jobs` contract/state-machine/runtime-parser tests, the `@sp/email-provider` tests, static migration contract assertions, and repository security-boundary tests. The private-key guard searches tracked, non-binary Git content directly so checked-in visual evidence cannot make the security gate scale with binary asset size. On 2026-07-20 the JOB-03 local suite passed 8 files and 144 tests.
- `npm run test:jobs:db-contract` runs only `test/background-jobs-migration.test.ts`. Despite the name, it inspects SQL text and the checked-in SQL test shape; it does not connect to Postgres or execute a migration. On 2026-07-20 it passed 1 file and 26 tests.
- `npm run test:jobs:db` is the live database contract. `scripts/test-background-jobs-db.mjs` starts a disposable PGMQ-capable container, reports the resolved image, PostgreSQL major version, and PGMQ extension version, applies `supabase/tests/background_jobs_bootstrap.sql`, discovers and applies the seven JOB-01/JOB-02/JOB-03 migrations in order with each migration protected by a transaction, runs real two-session enqueue and provider-message unique-index races, executes the rollback-wrapped `supabase/tests/background_jobs.sql`, and removes the container. The default image is `ghcr.io/pgmq/pg18-pgmq:v1.10.0`; intentional overrides can set `BACKGROUND_JOBS_DB_IMAGE` and the expected version variables.
- `npm run test:worker` runs the Node-only worker configuration, safe logger, health server, RPC adapter, CLI, concurrency, execution, retry, heartbeat, shutdown, modes, and durable email coordinator tests. JOB-03 includes the required ten-point persistent-world hard-crash matrix from enqueue response loss through terminal queue archive/local return, plus an eleventh lost-return boundary after the business finaliser commits but before the `finalised` checkpoint. It asserts one frozen intent/key/body, one provider delivery, one business finalisation, monotonic checkpoints, and no redispatch after terminal state. On 2026-07-20 the JOB-03 local suite passed 12 files and 134 tests. `npm run typecheck:worker` and `npm run build:worker` prove the standalone TypeScript and bundled Node 22 entrypoint; `node apps/worker/dist/worker.mjs --help` is the built CLI smoke.
- `npm run test:email-integrations` runs the portal/marketing adapter, narrow repository, and webhook tests with mocked provider transport. They cover stable compatibility keys, safe failure summaries, incremental streaming body-size rejection and cancellation before signature verification, read failures, untouched raw-body verification, ignored signed event types, missing/invalid secrets, and strict RPC result parsing without real provider traffic. On 2026-07-20 it passed 8 files and 38 tests.
- Website autoresponder rendering and staging-preview tests also use mocked provider transport. Editorial Refined is the canonical production renderer. `npm run emails:preview -- enquiry-variants` writes all 17 production HTML/plain-text fixtures under `tmp/email-previews`; `npm run emails:preview -- enquiry-layouts` writes one representative pair for the active layout and each of the two preview-only alternatives. Neither command sends email. The authenticated `/staff/email-previews` workbench compares identical fixture data across Editorial Refined, Image-led and Compact in side-by-side or focused mode, at 760/600/390 px widths, 50/75/100% inspection zoom and controlled light/dark simulations. It shows the governed project image plus recipient/environment/delivery safety context, and confirms selected or sequential all-layout delivery before calling the one-layout preview API. `npx playwright test playwright/portal.email-preview-workbench.spec.ts --project=portal-fixture` uses the gated QA mirror, the real governed renderer and a synthetic QA send response to verify 1440 px desktop, 1024 px laptop, 768 px tablet and 390 px mobile containment, 44 px mobile segmented controls, isolated iframes, confirmation focus and return, synchronized review controls and provider-acceptance feedback without authenticating or reaching provider transport. Before-refinement evidence remains under `artifacts/email-preview-workbench/desktop-1440.png` and `mobile-390.png`; current evidence uses the `after-` filename prefix. A real inbox delivery is still a deliberate manual staging action after the preview-only Vercel variables are configured, and remains the final client-render check.

The database bootstrap creates only the test roles plus minimal `auth.users` and `public.projects` prerequisites. It is not a production migration and does not validate the repository's full historical migration chain, which is not independently bootstrappable from an empty database. Never run the SQL contract against a shared local, staging, or production database.

As of 2026-07-20, `docker`, `psql`, and the Supabase CLI were unavailable on this workstation, so the local live command still stops at `spawnSync docker ENOENT` before starting a container. The dedicated `.github/workflows/background-jobs.yml` workflow is the executable database and artifact evidence: [run 29723041212](https://github.com/velt-design/sanctuary/actions/runs/29723041212) passed all seven JOB-01/JOB-02/JOB-03 migrations on upstream PostgreSQL 18/PGMQ 1.10.0 and Supabase PostgreSQL 17/PGMQ 1.5.1. The same run passed package typechecks, job/security contracts, application integrations, worker typecheck/tests/lint/production build, built CLI, the strict service-role guard, and the non-root container build. These checks prove the scoped background-job harness and artifact, not deployment to a shared environment or the repository's non-bootstrappable historical migration chain; no real provider send belongs in this gate.

The database contract checks the logged queue and unlogged-name fail-closed rule, minimal message, atomic intent-stable enqueue (including two database clients synchronised by an advisory-lock barrier), a concurrent cross-job provider-message collision blocked on the winning unique-index transaction and atomically quarantined after it commits, private payload and effect-identity read fencing, competing claims, random lease fencing, heartbeat extension, strict state/effect transitions, provider-window and same-key uncertainty recovery, verified acceptance races/deduplication/conflicts, append-only minimal receipts, cancellation fencing, bounded-argument NULL rejection, exact terminal archive, missing/stale-message audit and repair, safe inspection projections, and browser/service-role revokes. Static tests cannot prove those runtime behaviours by themselves.

Browser-role denial is verified from the live PostgreSQL privilege catalog for every `background_*` function, including an exact service-role allowlist. Do not replace that check with caught calls to revoked functions while the compatibility matrix pins Supabase Postgres `17.6.1.107`: [supabase/postgres#2112](https://github.com/supabase/postgres/issues/2112) records a `supautils` SIGSEGV on that denial path. A targeted fix appears in [supautils v3.2.2](https://github.com/supabase/supautils/releases/tag/v3.2.2), but version presence alone is not evidence; reconsider call-style probes only after an upgraded supported image passes the focused reproduction on both matrix legs. The workaround changes only the test mechanism, not grants or RLS.

## Portal Browser Tests

Required env:

- `PORTAL_TEST_EMAIL`
- `PORTAL_TEST_PASSWORD`

Optional env:

- `PORTAL_TEST_PROVISION_TARGET=local|staging`, required only for the opt-in provisioning command.
- `PORTAL_TEST_ROLE=staff|admin`, defaults to `staff` for provisioning.
- `PORTAL_EVIDENCE_MODE=default|full`, defaults to `default`; use `full` when you want screenshots and DOM snapshots attached for every portal browser route, not only failures.
- `PORTAL_PLAYWRIGHT_PORT`, defaults to `3011` when the portal harness starts locally.
- `PORTAL_BASE_URL`, disables local harness startup and points browser gates at an already-running portal.
- `PORTAL_DRAWING_URL`, points the drawing smoke at a known project/design page.

Commands:

```bash
npm run portal:auth-env
npm run portal:auth-runtime
npm run portal:test-user:ensure
npm run portal:agent-access
npm run portal:agent-access:provision
npm run portal:scenarios:ensure
npm run portal:agent-scenarios
npm run portal:agent-scenarios:provision
npm run portal:calculator-ui
npm run portal:calculator-ui:provision
npm run portal:agent-scorecard
npm run portal:agent-scorecard:strict
npm run portal:fixture-env
npm run portal:search-readiness
npm run test:portal:browser:auth
npm run test:portal:browser
npm run test:portal:browser:headed
npm run test:portal:smoke
npm run test:portal:command-centre:read-only-auth
npm run test:portal:performance
npm run test:portal:search-performance
npm run test:portal:performance:capture
npm run test:portal:performance:fixture
```

`npm run portal:auth-env` is the cheap fail-fast credential preflight for authenticated portal browser gates. It checks that `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD` are set before Playwright starts, so missing credentials fail loudly instead of producing a skipped or late setup failure.

`npm run portal:auth-runtime` is the authenticated runtime-readiness preflight for smoke and performance gates. It runs after `portal:auth-env`, signs in through the existing Playwright setup flow, verifies the session is not redirected to `/login` or `/access-status`, checks dashboard/projects/contacts/schedule shell access, confirms schedule readiness, and requires at least one project visible to the test account. `npm run test:portal:smoke`, `npm run test:portal:performance`, and broad `npm run portal:doctor` run it before their deeper authenticated assertions.

`playwright/portal.costing-control-smoke.spec.ts` is an opt-in, read-only admin smoke for the Pricebook costing-control entrypoint. Set `PORTAL_TEST_ROLE=admin`, authenticate with an admin test account, and run it with the `portal-chromium` project. It proves `/pricebook` redirects without a browser runtime error, the version/status UI loads, and the configuration-history and estimate-preview APIs return `private, no-store`. It never creates, saves, publishes, or rolls back a costing version.

`npm run test:portal:browser` includes the gated, customer-data-free Project Command Centre fixture at `/qa/project-command-centre-fixture?scenario=...&work=...&state=...`. The fixture composes the production `ProjectOverviewLayout`, `ProjectOrientationBand`, `ProjectWorkSection`, `ProjectCurrentDesignCommercialCard`, and `ProjectRecentNotesEvents` owners with synthetic data; it does not mount `OverviewTab` or perform authenticated data reads. Its fixture catalogue supplies V2 and legacy models, first-email/follow-up/close-review work, normal through blocked due states, no owner/action, Waiting/Closed/Archived/correction review, filtered read-only legacy stage rows, `Legacy work needs review` for a prohibited server-selected legacy action, strict commercial-source cases, and pending/summary/refreshing/stale/mismatch/error/retry/access-ending states.

The current fixture Playwright spec directly asserts all ten commercial scenarios, all seventeen Project Work scenarios, all eleven read states, filtered read-only legacy rows, the prohibited legacy fallback, one semantic email-command request, and the project shell. Its V2 shell variant sends a deterministic command-centre response through the production query and `OverviewTab`, rather than reconstructing that integration in fixture code. It checks one representative blocked-work composition at 1440x1000, 1280x800, 1024x900, 768x1024, and 390x844 with attached rendered evidence; a 640 CSS-pixel 200%-zoom simulation; no document horizontal overflow, nested vertical scroll owner, or cropped control; semantic headings/regions; actual mobile Tab order; visible focus; reduced motion across descendants; prohibited lifecycle-control absence; and 44px coarse-pointer controls. Access-ending fixture states remove the complete protected Overview, while page-level component coverage proves 401/403/404 cache clearing and unavailable presentation. Catalogue entries and acceptance properties not named by those assertions remain required verification rather than completed evidence. The route requires `ENABLE_PORTAL_QA_FIXTURES=1`; the standard fixture harness supplies that flag.

The current portal UI system has a data-free visual mirror at `/qa/ui-foundation-fixture`, gated by the same `ENABLE_PORTAL_QA_FIXTURES=1` flag. Use it for desktop, tablet, and mobile screenshots when staff credentials are unavailable. `/staff/ui-foundation` remains the protected shared-component catalogue and stays in authenticated agent-access smoke. Both routes provide regression evidence; neither is a target mockup that authorizes restyling production routes.

The same fixture flag exposes `/qa/commercial-workflow-fixture` for quote-delivery recovery. This route is the canonical customer-data-free visual source for the prepared-version banner, immutable request review, retryable failure, terminal staff-attention state, mobile touch targets, and modal focus behavior. It never dispatches a provider request; live send, acceptance, invoice creation, and invoice delivery remain separate deliberate staging checks after the commercial migration is applied.

`playwright/portal.ui-foundation.spec.ts` is a regression gate for the current `/staff/ui-foundation`, `/staff/projects`, and one discovered Project Detail route. It runs 1440x1000, 1280x800, 1024x900, 768x1024, and 390x844 plus 720x500 with a 200% zoom simulation. It combines semantic and interaction assertions with document-overflow, major-section-overlap, cropped-control, keyboard/focus-return, reduced-motion, and contrast checks; screenshots remain supplementary evidence rather than the only assertion.

`npm run test:portal:command-centre:read-only-auth` is the Overview V2 authenticated read-only gate. It runs `portal:project-work-v2-readiness` and the normal credential preflight, requires the staging target/ref declarations documented under `Project Work Items V2 Gate`, and rejects production-like or ambiguous browser hosts. The spec discovers an RLS-visible project, opens its integrated Overview, checks the orientation, exactly one Project Work region, current-design/commercial source, bounded recent content, absence of the retired duplicate regions, and absence of visible Call or Site Visit links/buttons. Before navigation it suppresses only the same-origin identifier-free Web Vitals transport so QA does not write operational telemetry; a route guard then aborts and records every other request outside `GET`, `HEAD`, or `OPTIONS`, and the test fails if any such request was attempted. It does not currently assert `private, no-store` response headers, responsive layouts, or recovery interactions; those remain in the broader acceptance matrix or the separate historical command-centre gate. It must not send email, complete work, change project/contact data, accept or decline a quote, create an invoice or token, record payment, or use a production/shared-data target. On 2026-07-30 the exact command passed its readiness and credential preflights, authenticated setup, and integrated Overview smoke against the positively identified CLI-linked staging project; no business mutation request was attempted. A separate manual authenticated inspection also passed at 390x844 with no mutation control exercised and no shared project/customer data changed.

`npm run test:portal:command-centre:auth` additionally requires `PORTAL_COMMAND_CENTRE_MUTATION_PROJECT_ID` and `PORTAL_COMMAND_CENTRE_CONFLICT_PROJECT_ID`. The mutation project must be a dedicated active `new`-through-`sent` test project with no other qualifying dated action or conflict. The conflict project must be dedicated, start with a real explicit-selection conflict, and be used with an admin test account. The suite fails rather than skipping when either project is missing, so a green result is Stage 2 completion evidence rather than a partial smoke. It remains separate from the Overview V2 read-only gate and must never run against shared customer data.

`npm run test:portal:command-centre:auth` is the blocking authenticated Project Command Centre gate. It discovers an RLS-visible real project, opens its integrated Overview, requires the command-centre response to be `private, no-store`, verifies normalized nested quote/estimate/price fields plus the single-owner/action/audit contract, and requires the production owner/action UI. The mutation journey requires an admin test account because project-owner changes are admin-only. Missing staff credentials, project data, or the Stage 2 database migrations fails the gate rather than skipping it.

`npm run test:portal:performance` writes a schema-version-2 journey artifact. It measures cold Dashboard, Projects, Project Detail, Contacts, and Schedule; warm Dashboard to Projects, Dashboard to Contacts, Projects to project, browser back, and the current Overview, Calculator, Commercial Quotes/Invoices, and conditional Job Packs project tabs; and Schedule/Calculator interactions. The cold Project Detail journey discovers a real project in a separate authenticated context, then opens the canonical detail URL in a new context with no project-list or persisted-query cache so PROJECT-01 has a truthful cold-read signal. Each tab's feedback marker is its immediate selected state; useful content is the new tab's owned workflow or truthful local loading shell, while its URL, specialist bundle, and data may continue in the background. Each journey separates visible feedback, useful content, and background-settled time, and records same-origin requests/transfer, long tasks, and blocking overlays. Dashboard-to-Projects and Dashboard-to-Contacts feedback ends when the canonical index URL reaches the browser, useful content requires that index's heading, controls, truthful list region, and state marker, and background completion requires its fresh authenticated index response. Project-opening background completion still requires both the fresh snapshot and active tab workflow. Portal Performance CI builds once and runs all five authenticated repetitions against `next start`; development compilation time must never be recorded as product latency. CI rejects missing journeys and publishes p50/p75/p95. Product targets stay visible separately from regression ceilings so noisy baselines cannot redefine the product goal.

`npm run portal:search-readiness` safely probes `portal_search_v1()` and the `portal_search_bigrams()` helper with the anonymous role, then makes a zero-row schema probe for the materialized Projects search document. A ready database must report that anonymous function execution is denied and that the generated column exists; missing function/column responses fail immediately with the exact migration path. The preflight never uses the service-role key, returns search data, or treats anonymous function execution as success. The authenticated performance gate remains the deployment proof for the policy-only init-plan migration because the anonymous preflight cannot inspect `pg_policies`.

`npm run test:portal:search-performance` is the focused authenticated global-search gate and starts with that migration preflight. Its deterministic delayed-response case proves a cached repeat renders without a second request and previous results remain visible while a different query refreshes. Its live case samples five real no-store API reads, requires API wall-clock p75 plus the 50 ms debounce to stay at or below 400 ms, measures the first rendered result/empty state at or below 400 ms, then repeats the same normalized query and requires an in-memory cached result within 75 ms with no second request. It writes `artifacts/portal-search-performance.json` with raw API/server timings and rendered-result measurements. Apply the ordered `20260722_000001_portal_search_v1.sql`, `20260722_000002_portal_search_bigram_indexes.sql`, `20260722_000003_portal_search_materialized_columns.sql`, and `20260722_000004_portal_search_rls_initplan.sql` migrations before running it; a missing RPC, helper, generated-column, or policy migration is a failed prerequisite, not a skipped test.

For a focused five-run project-tab audit, run only `captures warm navigation and project tab metrics`, write five artifacts to one directory, then set `PORTAL_PERF_JOURNEY_PREFIX=project-tab-` when invoking `scripts/summarize-portal-performance.mjs`. Prefix mode still checks that every run has the same complete journey set, requires every enforced matching budget, and reports only matching journeys.

Wave 2 reversible-write coverage starts with `apps/portal/app/staff/projects/projectsIndexMutations.test.ts`, `ProjectsIndexClient.test.tsx`, and `apps/portal/lib/queries/projectCache.test.ts`. These tests use an intentionally unresolved request to prove cache/UI feedback occurs before network completion, then cover field-specific rollback, active/archived/all membership and count restoration, and separate QueryClients for user isolation. Server-confirmed success remains distinct from optimistic feedback; destructive delete and customer-facing side effects are outside the optimistic contract.

Ordinary authenticated route changes must keep the current surface usable, show the thin portal progress bar immediately, and apply `aria-busy` only to the clicked control. Full-page Blueprint loading remains for cold route/authentication boundaries. `npm run test:portal:shell` covers the shared transition owner and navigation controls; authenticated routing smoke verifies Schedule view changes never show the blocking overlay.

The initial authenticated baseline was locked on 2026-07-19 from exactly five CI runs. New regression ceilings use `max(product target, p75 x 1.2)`, rounded up to 50 ms, and are enforced against the five-run p75 aggregate. Existing cold-route and Schedule-toggle ceilings remain per-run and were not changed.

Wave 1 Slice 1 replaced the project-opening rows with exactly five production-mode authenticated runs from Portal Quality run `29671978619`. Project opening recorded 41/44/45 ms feedback p50/p75/p95, 58/60/60 ms useful-content p50/p75/p95, and 2286/2290/2956 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. The resulting locked regression ceiling is 100 ms feedback and 500 ms useful content, matching the product target.

Wave 1 Slice 2 replaced the Dashboard-to-Projects row with exactly five production-mode authenticated runs from Portal Quality run `29675363201`. The journey recorded 43/44/44 ms feedback p50/p75/p95, 75/76/99 ms useful-content p50/p75/p95, and 2243/2277/2311 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. Applying the ratchet formula keeps the locked ceiling at the 100/500 ms product target.

Wave 1 Slice 3 replaced Dashboard-to-Contacts with exactly five production-mode authenticated runs from Portal Quality run `29678858906`. The journey recorded 33/35/35 ms feedback p50/p75/p95, 50/52/53 ms useful-content p50/p75/p95, and 3053/3080/3096 ms background-settled p50/p75/p95. All five runs had no blocking overlay and no observed long task. Applying the ratchet formula keeps the locked ceiling at the 100/500 ms product target.

Wave 1 completion run `29687042640` recorded exactly five production repetitions at its then-current ref. The isolated pre-Slice-1 comparison run `29681955081` measured cold Project Detail useful-content p75 at 2,454 ms, making the unchanged 10% guard 2,699 ms. The Wave 1 run measured cold Project Detail at 1,664/1,666/1,680 ms useful content p50/p75/p95: the small authenticated direct-link summary makes the real project header and tabs useful first, while complete-snapshot background settlement remains separately measured at 2,667/2,726/2,727 ms. All five project runs had no blocking overlay and no observed long task. The same recorded run measured calculator visible feedback at 40/47/58 ms and fresh-result completion at 924/939/942 ms. Fixture-safe workbench evidence measured object selection at 86/119 ms feedback/useful and Plan-to-3D at 117/122 ms, with no request, overlay, or long task in either interaction. These results are historical evidence and do not assert coverage of the current repository ref.

The 2026-07-22 isolated project-tab pass measured the integrated UI before changing application code, then repeated the same authenticated production journey five times after the fix. The baseline p75 feedback/useful-shell results were Calculator 151/154 ms, Quotes 141/512 ms, Invoices 147/149 ms, Overview 149/152 ms, and Job Packs 923/927 ms. Optimistic frame and Commercial subview ownership reduced those p75 values to 36/40 ms, 38/41 ms, 38/41 ms, 39/44 ms, and 37/41 ms. URL state, lazy specialist modules, and data remain canonical/background owners; the 100/500 ms regression ceilings were not loosened.

| Journey                     | Feedback p50/p75/p95 | Useful p50/p75/p95 | Product target |                            Locked feedback/useful ceiling |
| --------------------------- | -------------------: | -----------------: | :------------: | --------------------------------------------------------: |
| Dashboard cold              |       806/807/871 ms |     816/817/881 ms |      Miss      |                           Existing cold ceiling unchanged |
| Projects cold               |       749/766/779 ms |     758/777/788 ms |      Miss      |                           Existing cold ceiling unchanged |
| Project Detail cold         |       781/785/797 ms |  1664/1666/1680 ms | 10% guard met  | Existing cold ceiling unchanged; 2699 ms comparison guard |
| Contacts cold               |       687/708/726 ms |     698/714/742 ms |      Miss      |                           Existing cold ceiling unchanged |
| Schedule cold               |       737/758/760 ms |  1106/1125/1135 ms |      Miss      |                           Existing cold ceiling unchanged |
| Dashboard to Projects       |          37/37/38 ms |        56/58/59 ms |      Met       |                                                100/500 ms |
| Dashboard to Contacts       |          38/39/41 ms |        57/59/63 ms |      Met       |                                                100/500 ms |
| Projects to project         |          35/38/39 ms |        48/49/51 ms |      Met       |                                                100/500 ms |
| Project back to Projects    |             5/6/6 ms |        21/25/25 ms |      Met       |                                                100/500 ms |
| Project Calculator tab      |          36/36/38 ms |        39/40/42 ms |      Met       |                                                100/500 ms |
| Project Commercial Quotes   |          37/38/38 ms |        41/41/43 ms |      Met       |                                                100/500 ms |
| Project Commercial Invoices |          36/38/40 ms |        37/41/45 ms |      Met       |                                                100/500 ms |
| Project Overview tab        |          38/39/46 ms |        44/44/52 ms |      Met       |                                                100/500 ms |
| Project Job Packs tab       |          36/37/38 ms |        41/41/42 ms |      Met       |                                                100/500 ms |
| Schedule unscheduled toggle |       137/137/139 ms |     140/141/142 ms | Regression met |                   Existing 1200/1200 ms ceiling unchanged |
| Calculator current result   |          40/47/58 ms |     924/939/942 ms |  Feedback met  |                                               700/2950 ms |

`npm run test:portal:performance:capture` is the CI repetition primitive after `portal:auth-runtime` has already passed. Use the normal `test:portal:performance` command for a standalone local run so auth/data prerequisites remain fail-fast.

`npm run test:portal:performance:fixture` runs credential-free interaction gates. The workbench journey measures object selection and Plan-to-3D feedback against `/qa/design-workbench-fixture`. The project-mutation route mounts the production Projects-index controller, Project/Contact Detail local-first controllers, and manual project-task toggle at `/qa/projects-index-mutation-fixture`. It intercepts sample requests and proves visible update/Done/checkbox feedback completes within 100 ms while deliberately 750 ms persistence responses continue in the background. Mutation feedback is timestamped inside Chromium by observing the real visible DOM state; Playwright command/IPC latency is not counted as product feedback. Paired rejection checks prove index rollback/error visibility, both detail editors' confirmed-value rollback with retained reviewable drafts, and task-specific rollback plus Retry. The route binds only a synthetic fixture owner, clears its local-first state, and uses no durable/customer record IDs. The gates produce separate schema-v2 artifacts at `artifacts/portal-workbench-performance.json` and `artifacts/portal-project-mutation-performance.json`.

After `npm run build:portal`, run `npm run portal:bundle-budget`. It enforces initial raw/gzip, total lazy raw/gzip, and largest-lazy raw/gzip limits for Schedule, Projects Index, Contacts Index, Project Detail, Calculator, and Design Workbench. The analyser reads both Next's loadable manifests and Turbopack's emitted lazy-loader groups so an empty route loadable manifest cannot silently report zero deferred code. When Next records a stale missing JavaScript hash, the analyser accepts only one unambiguous emitted loader group with the exact same module id; missing CSS, no match, an ambiguous match, or an exact-module missing artifact still fails closed. Unrelated global loaders are filtered by module id before their artifacts are read. Turbopack may repeat route/layout CSS in a dynamic entry; CSS explicitly listed in the route manifest's `entryCSSFiles` is already loaded and is de-duplicated from lazy totals while the established initial-JavaScript baseline remains unchanged. Projects Index was measured at 687.3/197.8 KiB raw/gzip initial and 2,651.9/606.2 KiB lazy. Contacts Index was measured from the Slice 3 fresh build at 559.8/159.6 KiB initial and 120.6/19.2 KiB lazy; each limit is its fresh measurement plus 5%, rounded up to KiB. Shared shell gzip grew by about 0.7 KiB from Slice 2, within the 5 KiB allowance. `npm run schedule:bundle-budget` remains the focused compatibility wrapper and preserves the original Schedule limits. Missing or changed Next manifests fail with the fresh-build recovery command.

On 2026-07-30, a clean current build and an isolated clean `060bea19` build with the same analyser both exceeded only the Contacts and Calculator initial ceilings; Project Detail remained within its unchanged allowance. Do not treat those aggregate baseline failures as authority to raise unrelated budgets from an Overview change.

Project Detail measures about 658.1/189.5 KiB raw/gzip initial plus 1,762.9/370.9 KiB lazy (about 2,421.0/560.4 KiB combined). Its fresh-build-plus-5% limits remain below the preserved 3,014,656 raw / 757,760 gzip route cap. The activity-key Overview is the default workflow and joins Calculator, Commercial, and conditional Job Packs as truthful local lazy boundaries; the project frame and tabs stay initial. Project details and stage correction live in Overview at every width, while the retired Details rail/tab and Emails UI have no runtime boundary. The Calculator drawing surface no longer pulls Three/React Three Fiber into Project Detail: the 3D viewport loads only from exact `3D Review` intent and is accounted for by the Design Workbench route gate. That route measures about 1,583.2/385.9 KiB initial plus 942.8/247.1 KiB lazy; its split limits redistribute, but do not increase, the previous 2,681,856 raw / 671,744 gzip all-initial allowance.

`npm run portal:test-user:ensure` is an explicit service-role provisioning command for local or staging only. It requires `PORTAL_TEST_PROVISION_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it creates or updates the Supabase Auth user and upserts `portal_users.role`. It must not be embedded into routine browser gates.

`npm run portal:agent-access` captures authenticated browser state and opens the `agentAccessSmokeRoutes` subset from `playwright/support/portalRouteCatalog.ts` with shared browser evidence. The current smoke subset is `/dashboard`, `/staff/ui-foundation`, `/staff/projects`, `/staff/contacts`, and `/staff/schedule`; `/staff/projects` still expects at least one visible project. `npm run portal:agent-access:provision` is the opt-in combined command that provisions the test user first, then runs the same access smoke. Neither command seeds project or schedule data.

`npm run portal:scenarios:ensure` is the explicit service-role provisioning command for local/staging scenario data. It requires `PORTAL_TEST_SCENARIO_TARGET=local|staging`, `PORTAL_TEST_EMAIL`, `PORTAL_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`; it refuses missing targets and `production`, upserts deterministic `[Agent Scenario]` records, and writes non-secret route state to `playwright/.auth/portal-scenarios.json`. Optional env: `PORTAL_SCENARIOS=project-with-estimate,calculator-multi-module,quote-ready,workbench-multi-object` and `PORTAL_SCENARIO_PREFIX=agent`. The dedicated calculator scenario is reconciled to its current fixture revision on every provisioning run rather than sharing mutable route-smoke estimate state.

`npm run portal:agent-scenarios` captures authenticated browser state and opens dynamic routes from the catalog-backed scenario lane: project detail, estimate detail, quote detail, design workbench, and calculator. It reads `playwright/.auth/portal-scenarios.json` only and does not mutate data. `npm run portal:agent-scenarios:provision` is the opt-in combined command that provisions the test user, seeds scenarios, then runs scenario smoke; because user provisioning and scenario provisioning have separate safety gates, set both `PORTAL_TEST_PROVISION_TARGET=local|staging` and `PORTAL_TEST_SCENARIO_TARGET=local|staging`.

`npm run portal:calculator-ui` runs both Calculator browser files serially (`--workers=1`): the foundation/responsive lane against the simple `project-with-estimate` and complex `calculator-multi-module` scenarios, then the authenticated trust/workflow lane against the revisioned complex fixture. The five-width foundation matrix checks container-owned template/Flashings reflow, every visible configuration control against all clipping ancestors, document overflow, and deep-scroll Save geometry/hit ownership in standalone and embedded routes with reduced-motion parity. The trust lane additionally proves authoritative current/retained automatic-default cues without rewriting raw inputs and cross-module Issue Jump focus/error visibility against split-pane, Calculator-root, and document scroll owners. Slice 5 acceptance covers two-scenario assertions at 1600px, 1366px, 1024px, 768px, and 390px for stacked task order and result/issue/back focus routing, one visible rounded customer summary, retained Context ownership, independent result-rail tab reset, stacked page-scroll stability, and result-first Workings order. The command checks the fixture precondition before interaction and tells the operator to run `npm run portal:calculator-ui:provision` when the state file or stored estimate has drifted. This authenticated Slice 5 matrix passed on 2026-07-27.

The trust suite also checks canonical grouped module identity, fresh Add, deep Duplicate, Move without reordering, immediate draft Remove without an action-level modal, per-module validation badges, current/stale result labelling, save blocking, calculator customer-price parity with the shared quote formula, exactly one comma-formatted nearest-dollar customer summary per layout with explicit rounded labels, permission-gated internal costing in Pricing details, the five-tab Result Inspector with persistent price/freshness/readiness context and keyboard-driven Pricing, Materials, Labour, selected-module Workings, and Issues routing, authoritative rafter working/Section value parity, module-scoped rafter switching, trusted whole-job material/labour grouping, package source disclosure, `Why this quantity?`, internal-cost permission presentation, retained-result disclosure, and breakdown responsiveness at 1024px, 768px, and 390px, ranked cost-change categories, separate internal and blind cent precision, quiet configuration sheets with separate Blinds and Infills cards, helper-free routine configuration with retained validation messages, aligned input/toggle controls, restrained active-module actions, Orientation-diagram removal, stored-versus-Live save review, deliberate Preserve/Reprice actions, project selection, module-switch edit retention, local draft status and reload restoration, responsive configuration columns (three at 1600px and 1024px; two at 1366px and 768px), untouched 480px/440px desktop preview defaults, compact price visibility below the 1080px Calculator container breakpoint, and quiet empty add-ons and zero-count infill summaries. Its final local/staging-only case reprices the seeded estimate, proves the saved quote-handoff total matches the exact Price by item total to the cent, and checks the outcome dialog at 390px; it does not select Create quote or create persistent quote data. The infill browser lane separately verifies that infill deletion is immediate and Undo remains available. Focused integration coverage runs both a simple one-module input and a complex multi-pergola/multi-roof input through actual costing, live preview, repriced persistence, and quote mapping. `npm run portal:calculator-ui:provision` is the explicit local/staging provisioning variant and has the same two target safety requirements as the broader scenario provision command.

Slices 6 and 7 add focused component/contract coverage for native Materials/Labour group disclosure, first-open and retained user state, full-row recovery, permission/retained gates, nested technical sources, unchanged quantities/types/grouping/source IDs, full Downpipe joins/elbows labels, command-bar DOM order, readiness root-cause versus blocked-check counts, wait/error/review grammar, and Quote Status dependencies. `CalculatorSaveOutcomeDialog.test.tsx` covers idle, queued, syncing, synced, offline, error, and conflict presentation/quote eligibility, the explicit handoff route, and a same-dialog syncing-to-synced transition without creating a quote.

`playwright/support/computedContrast.ts` is the shared computed-colour contrast helper consumed by `portal.ui-foundation.spec.ts` and the Calculator lane. On 2026-07-27, the 30-test in-scope Calculator run passed: authenticated 1600/390 disclosure checks, 768/390 command/focus and cause/check checks, computed contrast, five-width containment, the Slice 2 deep-scroll rerun, and a delayed queued/syncing/synced exact-cent save case at 1600/390. The save case did not select Create quote. The separate evidence-only foundation case that requests optional actual-cost data remains environment-dependent when the local schema does not include `estimate_cost_actuals`; it is not part of the Calculator refinement acceptance run.

`playwright/portal.calculator-infills.spec.ts` is the authenticated infill accuracy and guided-usability lane. It creates scratch-draft infills only, proves panel material and joiner direction appear only on `Existing supports` with two explicit choices each, completes all three stages with pointer and keyboard controls, verifies the exact `2.4m x 2.1m` vertical-sheet pieces and purchases at desktop size, and verifies the kerf-safe `3m x 1m` horizontal-strip purchase plan at `1024px`. Desktop coverage keeps the first cut rows beside the compact diagram. At `768px` it keyboard-selects the Rectangle, Sloping top, and Triangle visual templates, verifies the explicit Selected marker, confirms the triangle needs only width and peak height, confirms that the point has no support question or cut, and checks triangle CSV parity. The compact progression scenario verifies primary-field order, exactly two Yes/No answers per physical edge, the neutral support summary, labelled diagram guidance, conservative No defaults, and no horizontal overflow. A `480px` scenario proves untouched required fields remain calm until blur, the Opening preview stays geometry-only, canonical Results rows stack without overflow, and the plain-English export actions remain available. Blocked stock/material coverage routes to `Existing supports`; invalid partial-edge roof-rafter matching also routes there, and export remains unavailable until the blocker is resolved. Valid clipboard and downloaded CSV contain the same canonical records shown in the two result tables. The suite does not save an estimate or create a quote.

`npm run portal:agent-scorecard` prints a read-only portal-agent quality snapshot from the route catalog, scenario registry, debug-export metadata, browser evidence adoption, and `npm run repo:health` headline. It does not run browser tests, provision users, seed scenarios, or mutate data. Use `npm run portal:agent-scorecard -- --json` for automation-friendly output. The human guide is `docs/portal-agent-scorecard.md`.

`npm run portal:agent-scorecard:strict` runs the same read-only scorecard plus the current portal-agent strictness ratchet. It fails only when route catalog, scenario, debug-export, seeded-scenario, or shared browser evidence coverage drops below the documented baseline; repo-health metrics remain advisory.

The portal route catalog is documented in `docs/portal-route-catalog.md`. `playwright/support/portalRouteCatalog.test.ts` recursively inventories every `apps/portal/app/**/page.tsx` file and requires an exact match with the catalog, including authenticated, public-auth, diagnostics, and redirect-only entries. Add route metadata there first, then let browser specs consume the relevant catalog subset instead of adding local hardcoded route lists.

Shared page debug exports are enabled only outside production and only with `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `NEXT_PUBLIC_ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1`, `PORTAL_PAGE_DEBUG_EXPORTS=1`, or `NEXT_PUBLIC_PORTAL_PAGE_DEBUG_EXPORTS=1`. Project detail, redirected estimate detail, quote detail, and design workbench routes expose `data-portal-debug-export="true"` in the scenario lane. Browser specs should use `readPortalPageDebugExport(page)` / `expectPortalDebugExport(page, pageId)` from `playwright/support/portalAgent.ts`; bug reports for complex pages should include this payload when available.

Portal browser specs should install evidence through `playwright/support/portalBrowserEvidence.ts`, not local ad hoc listeners. The shared lane always attaches `portal-browser-evidence.json` with route/scenario context, current URL, console warnings/errors, page errors, failed requests, 4xx/5xx response summaries, and debug-export availability. On failure, or when `PORTAL_EVIDENCE_MODE=full`, it also attaches a full-page screenshot and truncated DOM snapshot. Workbench fixture specs add `workbench-viewport-evidence.json` with Plan body/fallback/hit-target ids, selection counts, 3D diagnostics, viewport bounds, and Plan/3D viewport screenshots when rich evidence is active. The lane never attaches storage state, cookies, auth headers, passwords, or service-role keys.

Workbench captured repro payloads are read through `readWorkbenchCapturedReproPayload(page)` from `playwright/support/workbenchFixture.ts`. The helper accepts the shared page debug export (`diagnostics.workbenchDebugFixture`) or the raw fixture script (`data-workbench-debug-export="true"`), validates `snapshot`, `objectFirst`, selected state, house geometry inputs, project house health, pergola health, and `projectPreviewSource`, and returns a normalized payload that can be pasted into `sanctuaryWorkbenchCapturedFixtures.ts`. Browser specs may attach this payload as evidence, but must not write captured payloads to tracked files. The full workflow is in `docs/workbench-captured-repro-workflow.md`.

`npm run workbench:capture:verify` is the explicit agent capture verifier for the current multi-house roof failure lane. It opens `WORKBENCH_CAPTURE_URL` or the default staff workbench route with page debug/workbench fixture flags enabled, reads `diagnostics.workbenchDebugFixture`, and fails unless the payload is object-first, has at least two house forms, has per-house diagnostics, and includes a non-healthy or inconsistent house roof/render stage. This command is expected to fail when the live page is healthy or only contains one house; that failure means no captured solver fixture should be baked yet.

`npm run portal:fixture-env` is the fail-fast server-readiness preflight for the no-auth drawing fixture gate. `npm run test:portal:browser`, `npm run test:portal:browser:headed`, and the browser segment of `npm run test:portal:workbench` run it before Playwright starts. It catches a normal portal dev server already occupying the Playwright port and catches `PORTAL_BASE_URL` targets that redirect the fixture route to auth.

The auth setup saves local state to `playwright/.auth/portal-staff.json`, which is ignored.

## Drawing Fixture Route

The drawing browser gate uses the hidden fixture workbench route:

```text
/staff/projects/fixture-roof/design-workbench?fixture=mono-standard
```

Fixture mode is read-only. It opens the standard Mono workbench fixture, enters the Plan Editor, verifies viewport diagnostics and gesture state, captures a nonblank plan screenshot, and confirms no page runtime errors. The no-auth fixture gate also checks gable, box, mono-join, and screenshot-style hipped fixtures for nonblank Plan Editor, 3D containment, finite diagnostics, top-projection parity, and the 3D Top screen-axis convention. Each parity-critical fixture now also exposes compact fixture-only browser diagnostics for the shadow `workbench_solved` commercial source, ready trust status, solved-geometry quantity takeoff source, no blocking readiness gates, and commercial parity counts. The authenticated browser suite can still open a project-backed drawing route when staff credentials and data are available.

The parity-critical baked fixture list is owned by `apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts` through fixture-only QA metadata. Keep fixture names explicit, add representative saved estimate snapshots to the commercial parity harness or the fixture registry when a checked-in corpus exists, and treat commercial parity as shadow comparison signal only.

`npm run test:portal:browser` uses the no-auth `portal-fixture` Playwright project so fixture parity can run without project data or staff credentials. Run `npm run test:portal:browser:auth` first when you need the auth-backed `portal-chromium` setup state or project-list discovery smoke.

Skipped browser cases are intentional and should stay explained in the test output:

- In the `portal-fixture` project, the auth-backed project discovery smoke is skipped unless `PORTAL_DRAWING_URL` is set; that project-backed coverage belongs to `portal-chromium`.
- In authenticated project-backed runs, a selected project with no drawing geometry may skip the browser feel pass; this is data-dependent and should not hide fixture-route coverage.

When Playwright starts the portal dev server itself, it enables `ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1` and `ENABLE_PORTAL_QA_FIXTURES=1` for the no-auth fixture gates and uses isolated Next dev output so a normal `npm run dev:portal` server can keep running on port `3001`. The fixture harness defaults to `http://127.0.0.1:3011`; if that port is occupied, choose another fixture port:

```powershell
$env:PORTAL_PLAYWRIGHT_PORT='3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_PLAYWRIGHT_PORT
```

If `PORTAL_BASE_URL` points at an already-running portal server, that server must be started with the same fixture flags. The preflight does not terminate processes or weaken auth checks:

```powershell
# Terminal A: start the manual fixture server. Use PORTAL_PLAYWRIGHT_DIST_DIR only when another portal Next dev server is already running from apps/portal.
$env:ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES='1'; $env:ENABLE_PORTAL_QA_FIXTURES='1'; $env:PORTAL_PLAYWRIGHT_DIST_DIR='.next/playwright-fixture-manual'; npm --prefix apps/portal run dev:playwright -- -p 3021

# Terminal B: point the browser gate at that server.
$env:PORTAL_BASE_URL='http://127.0.0.1:3021'; npm run test:portal:browser; Remove-Item Env:\PORTAL_BASE_URL

# Terminal A after stopping the manual server.
Remove-Item Env:\ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES; Remove-Item Env:\ENABLE_PORTAL_QA_FIXTURES; Remove-Item Env:\PORTAL_PLAYWRIGHT_DIST_DIR
```

## Project Work Items V2 Gate

Before authenticated staging QA, run the anonymous read-only readiness
preflight against an exact, positively declared staging project:

```powershell
$env:PORTAL_PROJECT_WORK_V2_READINESS_TARGET='staging'
$env:PORTAL_PROJECT_WORK_V2_STAGING_PROJECT_REF='<exact-20-character-staging-ref>'
npm run portal:project-work-v2-readiness
```

The preflight performs no writes and uses no service-role key. It distinguishes
missing foundation (`000002`), missing project relationships/schema-cache
repair (`000003`), and missing Work Queue/review RPCs (`000004`), and fails if
any checked contract unexpectedly permits anonymous access. Production,
local, ambiguous, or ref/URL-mismatched targets are rejected before a request.
This proves only deployment/read-boundary readiness; it does not replace the
authenticated integrity smoke or authorise migration application.

Run the executable migration contract:

```bash
npm run test:portal:project-work
```

This is the named non-network Project Work gate. It covers the V2 domain,
new-project boundary, staff/admin routes, Work Queue/Overview/Dashboard
presenters, static source boundaries, all executable migration contracts, and
the readiness checker's unit tests. It does not execute
`portal:project-work-v2-readiness` or contact Supabase.

The foundation test applies `20260729_000002_project_work_items_v2.sql` in PGlite, exercises calendar/cadence/state/queue/privilege contracts, and replays the migration. The schema-cache repair test proves canonical named cascade relationships, replacement of conflicting constraints, safe replay, and missing-prerequisite refusal. The focused forward test applies `20260729_000004_project_work_queue_and_legacy_triage.sql` after the foundation and covers the richer queue, admin-only append-only confirmation correction, exact-signal/version review resolution, read-only Contacted classification, deterministic related-evidence fingerprints, guarded one-project migration, replay, stale project/evidence rejection before V2 writes, internal-helper grants, and no automatic cadence seed. A local pass is not evidence that staging or production has been migrated.

Run the focused Schedule, Running Jobs, and quote handoffs:

```bash
npx vitest run apps/portal/lib/scheduling/scheduleV2Server.test.ts apps/portal/lib/runningJobs/facts.test.ts apps/portal/lib/runningJobs/writeOps.test.ts apps/portal/lib/quotes/serverEmail.cadence.test.ts apps/portal/lib/projects/workItems/quoteCadenceReconciliation.test.ts
```

Run the Overview, snapshot, projection, V2/legacy command-controller, shared visibility-policy/cache, component, command-route, and queue boundary:

```bash
npx vitest run apps/portal/components/projects/ProjectPage/tabs/overview apps/portal/lib/queries/projectWorkCache.test.ts apps/portal/lib/projects/getProjectPageSnapshot.test.ts apps/portal/lib/projects/commandCentre/getProjectCommandCentre.test.ts apps/portal/lib/projects/commandCentre/getProjectCommandExceptions.test.ts apps/portal/lib/projects/workItems/teamQueue.test.ts apps/portal/components/projects/workQueue/workQueuePresentation.test.ts apps/portal/app/api/staff/v1/projects/[projectId]/work-items/commands/route.test.ts apps/portal/app/api/staff/v1/projects/[projectId]/state/commands/route.test.ts apps/portal/app/api/staff/v1/projects/[projectId]/confirmations/commands/route.test.ts apps/portal/app/api/staff/v1/work-items/queue/route.test.ts apps/portal/app/api/admin/project-work
```

For environment QA, deploy the migration and app in one short controlled window on a positively identified non-production environment. Pause or constrain new project/enquiry creation and quote lifecycle mutations during that window: app-first creation fails closed, while migration-first marketing intake can activate V2 before the new adapters are live. Resume only after the integrity smoke passes. Use disposable records and mocked or provider-disabled side effects; never send customer email, accept quotes, record payment, or mutate production/shared records. Verify:

- a new staff project and a new enquiry-linked project initialize V2; an existing project remains legacy;
- first email is due at +2 Auckland open hours with SLA +4, missing email blocks/unblocks, and one follow-up plus one manual close review are created only from confirmations;
- no call, Site Visit booking, automatic email, automatic close, or stage change occurs;
- Site Visits stays hidden/manual and no queue row links to it;
- Waiting/Closed/archive queue and compatibility behavior, stale versions, idempotent replay, access denial, and retry are truthful;
- the full Work Queue and Dashboard preview show the same one-row-per-project ordering and canonical specialist precedence, while My Tasks remains separate;
- queue commands prevent duplicate submit, preserve stable ambiguous-retry identity, and claim success only after durable confirmation;
- confirmation correction is admin-only, requires a reason, retains the original event, and opens a visible review signal without reversing later facts; resolution requires the exact signal ID/version and leaves newer signals open;
- the Contacted classifier is admin-only/read-only, returns no linked customer contact fields, and returns a stable opaque fingerprint for unchanged project and related evidence;
- reviewed Contacted migration accepts one unchanged project/evidence fingerprint and explicit disposition at a time, rejects stale/already-migrated input before V2 writes, and creates no first-email/follow-up cadence;
- a deliberately lost manual-create response reuses the same command ID and cannot create a duplicate item;
- close/outcome review resolves atomically for Close, Waiting, or Keep active with replacement work, and a customer reply remains recordable;
- unassigned cadence work visibly falls back to the Project Owner, and a recorded Site Visit confirmation remains visibly ticked after refresh;
- non-admin staff cannot archive/restore either model, and a committed V2 archive with a failed follow-up read returns success plus `refreshRequired` rather than a false failure;
- durable quote finalisation/outcomes reconcile once, and a forced reconciliation failure is visible to operations rather than silently losing cadence;
- Schedule readiness filters only unscheduled V2 candidates while scheduled rows remain visible;
- Running Jobs V2 facts use its versioned owner and job completion uses Schedule actual finish; and
- calendar coverage fails visibly when a deadline crosses an unverified year.

Before enabling existing projects, run the classifier read-only and review recommendations manually. Test the migration command only with a disposable or explicitly approved non-production project, one project at a time. No production/shared Contacted backlog row is changed by this gate.

The UI gate for this slice covers the full Work Queue, Dashboard preview, and admin legacy review at 1440, 1024, 768, and 390 CSS pixels plus 200% zoom. Assert group/heading semantics, keyboard order, visible focus, 44px coarse-pointer targets, no document overflow, loading/background refresh/error/retry/access-ending states, stale conflict recovery, and that no browser test sends email or commits a legacy migration.

## Schedule QA Gate

Before shipping schedule changes:

1. Confirm migrations are applied through current Schedule V2 command/repair migrations.
2. Confirm `GET /api/staff/v1/schedule/readiness` returns `200`.
3. Run relevant schedule unit and route tests.
4. Manually check Board and Gantt if UI behavior changed; check Site Visits only through direct compatibility access or an approved reactivation.

For an explicitly approved change to the current Schedule presentation, run the authenticated non-mutating matrix after storage state exists:

```bash
npx playwright test playwright/portal.schedule-tasks-ui.spec.ts --project=portal-chromium --no-deps
```

It covers Board at 1440/1280/1024/768/390, Gantt, the retained direct Site Visits compatibility route, Schedule and Site Visit dialogs, project Tasks, 720x500 at 200% zoom, document overflow, mobile targets, focus return, reduced motion, and browser/runtime evidence. It opens forms and dialogs but does not save, drag, delete, unschedule, or toggle a task.

Minimum targeted schedule tests:

```bash
npx vitest run apps/portal/lib/scheduling/workingDays.test.ts apps/portal/lib/scheduling/recompute.test.ts
npx vitest run apps/portal/app/staff/schedule/ScheduleClient.test.tsx apps/portal/app/staff/schedule/scheduleSnapshotRequestTracker.test.ts apps/portal/lib/queries/schedule.test.ts
```

## Manual QA Checklist Seeds

Portal shell:

- Navigate between staff pages and confirm header back/forward controls enable, disable, and move through history correctly.

Projects:

- Open `/staff/projects` across desktop and mobile widths.
- Confirm filters wrap without clipped text.
- Toggle follow-up due and confirm the list updates without layout jitter.

Design Workbench authenticated edit/save/reload:

- Use a staff test account and a reversible draft estimate/design with safe fixture-like data.
- Open `/staff/projects`, select the project, and use the project header's Design Workbench action.
- Confirm Plan Editor, Sheet View, and 3D View are nonblank, finite, and do not show legacy fallback or unavailable text.
- Make one reversible object-first edit such as a small roof pitch, attachment side, deck position, opening position, or house form parameter change.
- Save the workbench, wait for the saved/clean state, reload the page, and confirm the edited value, Plan Editor, Sheet View, and 3D View persist.
- Restore the original value, save again, reload again, and confirm the project returns to its starting state.

Pricing Source Rollout:

- `calculator_live` save: leave `PORTAL_ESTIMATE_PRICING_SOURCE` unset or set it to `calculator_live`, save a reversible estimate, and confirm `estimates.pricing_source` plus compact metadata record calculator live while `commercial_design_input` stays null and no downstream public output exposes a commercial payload.
- Blocked `workbench_solved` save: set `PORTAL_ESTIMATE_PRICING_SOURCE=workbench_solved` against a not-ready or blocked workbench case, attempt an estimate save, and confirm `409 ESTIMATE_PRICING_SOURCE_BLOCKED`, visible conflict/failure state, no estimate row mutation, and no hidden calculator fallback.
- Ready `workbench_solved` save once enabled: use a safe ready fixture-like project, save, reload, and confirm `pricing_source=workbench_solved`, compact metadata is present, `commercial_design_input` is stored only on the estimate row, and normal edit/reload behavior still works.
- Quote refresh preserving metadata: refresh a draft quote from the estimate and confirm line items and totals come from the saved estimate boundary while compact source metadata copies to the quote version.
- Rollback to `calculator_live`: switch the env back to `calculator_live`, save a new estimate or refresh a future draft quote only through domain helpers, and confirm historical workbench-backed estimates, quote versions, PDFs, public tokens, invoices, and job packs are not repriced.
- Public quote/PDF/invoice/job-pack preservation: verify public quote pages, generated quote PDFs, invoice creation/PDF, and job-pack generation preserve historical quote-version totals and never expose raw `commercial_design_input`.

Schedule Board:

- Assign an unscheduled job to a crew.
- Start pointer and keyboard drag from the labelled Move control, not the card
  or project-open control.
- Reorder jobs within a crew.
- Move a job between crews.
- Unschedule a job and refresh.
- When the preview reports affected jobs, confirm that names and before/after
  dates appear; cancel once and verify the exact prior Board state returns.
- After approval, change a reported affected date in a controlled test and
  confirm the second preview prevents `force: true`, restores the prior local
  state, and refreshes from the server.
- Exercise a safe rejected mutation and confirm the page keeps a visible
  failure/refresh state after the toast.
- Exercise a timeout or malformed success response and confirm the page does
  not claim the change was saved while it reconciles the authoritative state.
- Confirm HTTP 501 is treated as the documented pre-commit schema/RPC
  unavailable rejection, while network, 408, other 5xx, and malformed success
  envelopes reconcile as commit-ambiguous.
- Keep one deliberately slow command open across a Schedule client remount and
  confirm the new instance stays read-only until the owning command finishes.
- Delay a pre-mutation Board response until after an accepted assignment and
  confirm the older response cannot move the job back.
- Confirm crew lanes wrap onto additional rows on larger screens without page
  horizontal scroll.
- Focus or hover Gantt, switch views, and confirm the current Schedule page
  stays mounted while the prefetched view appears. Confirm browser Back/Forward
  keeps the selected tab and URL aligned.

Schedule Gantt:

- Confirm week headers are Monday-aligned.
- Confirm weekend shading is Saturday/Sunday.
- Open a focused bar with Enter/Space, close with Escape, and confirm focus
  returns.
- Focus a non-first quick-action button and press Enter; confirm the button
  action runs instead of the dialog-level Open Project shortcut.
- Resize a pinned bar and confirm one atomic `/job/adjust` request owns both
  date and duration (never a sequential duration then pin pair).
- Delay the post-accept range refresh and confirm the accepted bar never jumps
  back to its old dates. Fail that refresh safely and confirm the accepted
  direct-job preview remains visible with a refresh-needed state.
- Operate the crew-label separator with Arrow/Home/End and confirm its ARIA
  value tracks the width.
- Toggle crew collapse and range options.

## Portal Production Readiness

Use `docs/portal-production-readiness.md` as the active readiness tracker for current status, blockers, highest-leverage tasks, and parallel lanes.

This doc remains the canonical command catalog. When readiness work changes command expectations, update this doc; when readiness status changes, update `docs/portal-production-readiness.md`.

## CI

- Background Jobs runs `npm run test:jobs` (including `@sp/email-provider`), provider-package typecheck, the worker typecheck/tests/build/CLI/container checks, the strict service-role boundary, and `npm run test:jobs:db` in a dedicated workflow when provider/job packages, provider adapters/webhook/repository, worker, migration, SQL harness, repository-security test, package manifest, container context, privileged-access report, or workflow configuration files change. A configured workflow without a successful run is not a green signal; this doc does not claim the check is required by branch protection.
- Portal Quality runs docs guard, architecture changed advisory reporting, architecture strict new-growth advisory reporting, a blocking `files:changed:strict` decomposition gate, dead-code changed advisory reporting, repository typecheck, lint, portal Vitest, portal build, general route bundle budgets, production security audit, fixture browser/performance smoke, and authenticated smoke. The decomposition gate blocks touched critical code files without registry coverage. Authenticated smoke is blocking and writes the required credential, role, schedule-readiness, and project-data prerequisites to the GitHub step summary.
- Portal Performance Report runs five authenticated journey repetitions as a separate blocking job, rejects missing schema-v2 journeys, publishes p50/p75/p95, and uploads the `portal-performance-baseline` artifacts. It also writes the authenticated runtime prerequisites to the GitHub step summary before timing routes.
- Docs Health runs weekly and on demand, with blocking docs guard and mojibake checks plus advisory docs impact, navigation, and readiness reports.
- Lighthouse Guardrails run mobile and desktop Lighthouse profiles.
- Governance Monthly still runs the broader marketing/governance sweep with marketing tests, production dependency audit, and Lighthouse.
