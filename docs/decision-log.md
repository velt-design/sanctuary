# Decision Log

Compact indexed lessons and guardrails for future agents. Scan relevant entries before non-trivial or risky work, especially when the task touches a known source-of-truth boundary, migration, auth path, data flow, or quality gate.

## Entry Template

```text
Date: YYYY-MM-DD
Area: short area name
Status: Active | Promoted | Superseded
Decision or mistake: what happened or what was decided
Why it mattered: the risk or outcome
Current guardrail: what future agents must do
Promoted to: durable docs or playbook rules, or None
Related docs/tests: paths or commands
```

Use `Status: Active` when the entry is still only a decision-log guardrail. New reusable lessons should remain `Active` until a later pass promotes them into a canonical doc, so this log continues to show live risks that have not yet become standing rules. Use `Status: Promoted` when the durable behavior is now represented in `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, or another canonical doc. Use `Status: Superseded` only when a newer entry or canonical doc replaces the rule.

## Index

| Date       | Area                             | Status   | Guardrail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------- | -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-06 | Design Booklet Instant Preview   | Promoted | Show a selected drawing immediately from its local browser URL and render the sheet from shared A4 HTML geometry. Compress and persist replacements in order behind that preview, preload the durable signed source before an atomic swap, and generate the authoritative PDF only on download from latest saved inputs. |
| 2026-08-06 | Portal Routine Project Opening   | Promoted | Treat the current combined Projects-index response as the first immediate project-shell cache, not a retired query-key generation. Keep the authenticated snapshot authoritative in the background, use the small summary only when no known shell exists, and disable viewport-wide sidebar prefetch in favour of exact hover/focus/pointer/touch intent. |
| 2026-08-06 | Design Booklet PDF Authority     | Superseded | Superseded by the instant-preview boundary: shared A4 geometry now owns the responsive drawing preview, while the on-demand PDF remains the authoritative saved output and stable export writes remain serialized. Project-linked drafts still use neutral media states; Toni assets remain fixture-only. |
| 2026-08-06 | Contact Enquiry Pathways         | Promoted | Keep the three contact sales pathways as presentation over one intake: Simple and Custom resolve to residential, Commercial / Professional requires its canonical audience, and only shared fields survive pathway changes. Reuse the calculator's authenticated frozen-reference handoff; never nest or duplicate forms, costing logic, URLs or analytics payloads. |
| 2026-08-06 | Simple Calculator Enquiry Handoff | Promoted | Treat browser state as presentation only. Carry a priced Simple configuration with an authenticated encrypted reference, verify its historical published calculation server-side, and suppress generic pricing for invalid, Custom, unavailable or unconfigured continuations. Keep the reference, price and dimensions out of URLs, analytics, application logs and raw enquiry payloads. |
| 2026-08-05 | Costing Version 6                | Promoted | Keep longer-rafter labour in the package-owned actual cut-length curve, set the approved five-point curve, interpolate smoothly, and activate it only through a new published manifest so older prices remain reproducible. |
| 2026-08-05 | Costing Version 5                | Promoted | Raise the frozen Simple customer-price uplift from 10% to 21% behind manifest `v2.2`, which produces an exact additional 10% increase on Version 4 while keeping Version 4, Bespoke and approval allowances unchanged. |
| 2026-08-05 | Costing Stock Optimisation       | Promoted | Choose non-continuous extrusion stock by the total purchase cost for the complete cut group, then waste, bar count and cost per metre. Gate the correction by the base manifest so an older published configuration remains reproducible. |
| 2026-08-05 | Costing Version 4                | Promoted | Derive Simple site days and overhead from productive installation work so mobilisation cannot create another mobilisation day. Freeze the `$750` progressive overhead policy and 10% customer-price uplift behind manifest `v2.1`. |
| 2026-08-05 | Costing Version 2                | Promoted | Keep Simple eligibility, progressive overhead, and approval allowances in `@sp/costing`; gate semantics by the published base manifest so code deployment cannot reprice Version 1. Freeze resolved policy and non-discountable direct-sell approval lines with the estimate and quote from that frozen result. |
| 2026-08-05 | Portal Browser Session Refresh   | Promoted | Treat a browser session-read or token-refresh transport failure as temporary unavailability rather than proof of sign-out. Preserve server-known auth state, map only unresolved loading to `lookup_failed`, and keep the rejection handled so a route or QA fixture remains usable. |
| 2026-08-04 | Marketing Pricing Version 1      | Promoted | Use the same active published configuration for public calculator and autoresponder costing, save autoresponder provenance, and fail closed without blocking enquiry intake. Version 1 may freeze legacy-effective portal pricing with an empty diff; later unchanged drafts remain blocked. |
| 2026-08-04 | Public Simple Cover Pricing      | Promoted | Resolve the active immutable publication server-side, validate/hash/apply it through `@sp/costing/server`, calculate canonical site cost and package-owned customer price, then allow-list the public response. Never fall back to legacy/default configuration, expose true cost, or import portal UI/drawings. Keep deployment and first publication as explicit rollout gates. |
| 2026-08-04 | Simple Cover Responsive Containment | Promoted | Let the desktop hero grow with its content on short screens while retaining one-viewport ownership when the content fits. Test plain and homepage-attributed states at breakpoint edges for contiguous sections, child and proof-rail containment, text spacing, header clearance, aligned media and horizontal overflow. |
| 2026-08-04 | Simple Cover Sales Page           | Promoted | Keep the noindex Simple cover continuation short, image-led and sales-focused: prove product fit, Sanctuary finish, useful choices, honest limits, governed reviews and the existing enquiry path without repeating project cards or guide copy. Reserve the post-hero fit section as the future costing integration point, but do not publish synthetic prices or inactive configurator controls. |
| 2026-08-03 | Simple Cover Pathway              | Promoted | Keep the acrylic research page as the sole indexable SEO owner and send homepage Simple cover intent to a distinct noindex conversion route. Define simple by a clear fixed-roof scope rather than the absence of optional side blinds, preserve closed journey context and attribution, and provide a clear Custom design off-ramp for materially broader briefs. |
| 2026-08-03 | Marketing Cinematic Hero         | Promoted | Consume at most one forward gesture per active hero stage. On touch devices, cancel panning from the first forward movement and suppress it while the welcome veil is present so native momentum cannot cross two stages. Then land against the measured inner finder opening rather than padded section chrome. Centre the complete opening when it fits the live visual viewport, otherwise top-align it beneath the fixed header. Preserve reverse scrolling, responsive priority art direction and primary-mobile text-only choices. |
| 2026-08-03 | Marketing Welcome Stacking       | Promoted | A page-owned fixed welcome veil can still sit beneath a shell-owned fixed header because an ancestor creates a lower stacking context. Verify the rendered first paint, hide and disable the global header through a page-presence hook while the veil exists, and provide an explicit no-JavaScript override so progressive enhancement cannot remove navigation. |
| 2026-08-01 | Project Close Journey            | Promoted | Closing is a dedicated explicit lifecycle flow, never a generic state dropdown. Preserve stage, show cancellation/queue/reopen consequences, require a structured Lost outcome with optional note, and keep reasons for Cancelled/Complete. Bulk stale-Enquiry closure selects none by default, requires an exact second confirmation, revalidates report fingerprints and current activity/future-Waiting protection server-side, and rejects the whole batch on drift. |
| 2026-08-01 | Project Lost Close Reasons       | Promoted | Treat the selected structured Lost outcome as the business reason. Do not force staff to repeat it in free text; allow an optional note, derive a neutral server cancellation explanation for remaining work, and retain explicit reasons for Waiting, Cancelled, and Complete. |
| 2026-08-01 | Schedule Board Intent Queue      | Promoted | Keep confirmed Schedule state separate from visible Board intent. Run disjoint crew placements concurrently, serialize overlapping project/lane resources, and replay every newer operation after validated responses or scoped rollback so response order cannot rewind staff intent. Ambiguous recovery blocks only affected resources; cross-instance clients remain read-only because they do not own the optimistic layer. |
| 2026-08-01 | Schedule Board Silent Persistence | Promoted | Treat the placed card as normal Board feedback. Keep routine checking/saving/saved/reconciliation UI invisible, hold optimistic placement through ambiguous outcomes, compare bounded authoritative snapshots before applying one correction, and show one affected-card Retry or Refresh notice only when staff action is required. Preserve server-owned V2 truth, preview/re-preview, confirmation, and cross-instance mutation exclusion. |
| 2026-08-01 | Marketing Project Switching      | Promoted | Keep desktop canonical project-detail transitions inside one mounted route owner: preserve rail DOM/state/focus, decode the responsive hero before commit, retain an intersecting hero anchor or align it below the fixed header, and capture only marked project Back/Forward entries before the framework remounts the dynamic route. Keep mobile, direct, refresh, modified-click and no-JavaScript navigation canonical. |
| 2026-08-01 | Project Phase Ownership Handoffs | Promoted | Assign active New/Contacted projects to Ellen at the server boundary, keep Proposal and Dave delivery handoffs manual, and never let an ownership rule advance pipeline stage. Before any bulk Lost closure, use one read-only all-activity report with future-Waiting protection and evidence fingerprints; migration/system rollout events do not prove a customer enquiry was handled. |
| 2026-08-01 | Project Journey Action Eligibility | Promoted | Rank Overview and Work Queue from one server adapter: New remains enquiry-led, Contacted and Site Visit may expose only the bounded Schedule-owned visit action, and estimate-to-quote creation is eligible only at Quoting. Use explicit CTA labels/destinations, durable visit-completion evidence, and a reasoned stage correction for the no-visit path; never infer this in either browser surface. |
| 2026-08-01 | Schedule Operational Presentation | Promoted | Keep Board and Gantt attention, commitment/flex wording, forecast workload, and persistence language under named shared presentation owners. Derive only scan aids from server forecast facts; never imply a browser-owned capacity limit. At phone/zoom widths use a single-column read-only Gantt agenda, while desktop keeps sticky crew identity and labels bars only when legible. |
| 2026-07-31 | Schedule Board Gestures          | Promoted | Commit the last visible pointer-owned semantic target, keep the source card anchored, and block gestures before they start when Schedule cannot accept a command. Keep persistence lifecycle internal and show only the newer action-required card notice; keep exact timing and affected-job consequences server-owned. |
| 2026-07-31 | Schedule Authoritative Timing    | Promoted | A browser drag may request start and duration but must not claim an exact new finish: crew calendars, holidays, closures, affected jobs, preview/re-preview, and commit remain server-owned. At phone width use a read-only agenda from the same Gantt model and route changes to Board instead of compressing desktop manipulation. |
| 2026-07-31 | Project Overview Hierarchy       | Promoted | Present one authority and one visual centre: server-ranked work visibly leads, repeated stage and empty slots are absent, and mobile priority applies at or below 768px. |
| 2026-07-31 | Pipeline Accountability          | Promoted | Keep journey, detailed stage, and operational state separate; expose owner and the current server-ranked obligation across Dashboard, Projects, Queue, and Overview; filter owners before pagination; and require an explicit review before stage correction recalculates Project Work. |
| 2026-07-31 | Schedule Trusted Job Context     | Promoted | Project name remains the primary Schedule label; one presenter owns deduplicated customer/site identity, search text, crew and timing across Board, Gantt and dialogs. Keep Gantt project lookup bounded to scheduled IDs. A drag/resize must show authoritative current timing and the requested start/duration before server-owned affected-job preview/re-preview calculates exact consequences. |
| 2026-07-31 | Regional Marketing Tracking      | Promoted | Start optional categories denied, then enable both automatically only for an exact Vercel `NZ` country result. Non-NZ, missing, invalid, or failed geography remains denied behind the existing banner. Preserve every saved explicit choice, label attribution as `regional_default` versus `user_choice`, and keep the public page static by resolving the coarse region asynchronously through a private/no-store first-party endpoint. |
| 2026-07-31 | Project Work Rollout Durability  | Promoted | A one-time rollout sentinel must outlive the rows it governs, including an empty cohort. Terminal legacy sources must be enforced at the database command boundary, and governed/append-only child guards must distinguish a real parent cascade from direct deletion so the confirmed admin project-delete path remains valid without opening child-row mutation. |
| 2026-07-31 | Project Work Portfolio Adoption  | Promoted | Technical readiness is not operational adoption. Convert every existing project to Project Work V2 in one migration-first rollout, anchor its initial obligation to one rollout timestamp as if the project just entered its current detailed stage, preserve stronger V2 state/work and specialist facts, show five journey phases plus server-owned Active/Waiting/Closed/Archived state, and leave retired legacy task/action rows read-only with no application readers or writers. |
| 2026-07-31 | Project Booklet Media Boundary   | Promoted | Do not send a booklet's complete image set or generated PDF through a Vercel Function payload. Resize images before direct signed upload to private project-scoped Storage, verify them before metadata commit, render from saved server-owned assets, and return a short-lived signed PDF URL. |
| 2026-07-30 | Project Snapshot Cache Policy    | Promoted | The complete authenticated Project Detail snapshot is private staff data. Set `private, no-store` on every response path, including authentication, validation, not-found, and server failures, and verify the deployed header with an authenticated read rather than relying on framework defaults. |
| 2026-07-30 | Contacts/Calculator Bundle Owners | Promoted | Prefer a small shared portal interaction owner over a heavy primitive package when the complete consumer set needs only bounded menu/popover behavior. A narrow package-owned material loader may serve takeoff defaults while the unchanged full costing config remains authoritative for commercial calculation. Prove route graphs, behavior parity, and every unchanged bundle ceiling together. |
| 2026-07-30 | Marketing Measurement CSP        | Promoted | Treat live GTM container diagnostics and the deployed CSP header as a tracking release gate. Permit only reported vendor origins in both enforced and report-only directives, retain consent gating, and guard required measurement resources with a source contract test. |
| 2026-07-31 | Project Booklet Signed-Image CSP | Promoted | A successful storage upload does not prove the saved browser preview can render. Keep the private Supabase host in portal `img-src` and guard the production header contract; `connect-src` covers fetches, not `<img>` loads. |
| 2026-07-30 | Marketing Lifecycle Delivery     | Promoted | Emit conversions from the shared authoritative business owner used by every public/staff path; independently re-enforce consent on the server; claim only immediately dispatchable rows below their attempt ceiling; and describe generic GA4 Measurement Protocol delivery as at-least-once because provider acceptance can precede the local completion checkpoint. |
| 2026-07-30 | Overview V2 Bundle Exception     | Promoted | A scope-specific handoff exception may accept unrelated route-budget failures only when the same analyser reproduces them at the approved baseline and the changed route remains within its unchanged allowance. Keep every ceiling and the exception evidence visible; later route optimization must independently prove the aggregate gate green. |
| 2026-07-30 | Project Overview V2 Handover     | Promoted | Redesign Overview inside the current portal visual system, with one server-backed Project Work surface and email-only communication. Site Visits stays outside work items and normal navigation; only the separately approved stage-gated direct workflow remains. Preserve strict design/commercial precedence and add full-journey facts only through bounded specialist-owned server projections. The 2026-07-31 portfolio-adoption decision supersedes this entry's former mixed-model requirement. |
| 2026-07-30 | Supabase Migration Versions      | Promoted | Supabase CLI reads only the digits before the first underscore as a migration version. Date-only sibling files collide in the remote ledger, so never blanket-push, migrate-up, or repair the shared version. Positively identify the target, rollback-rehearse and apply exact reviewed files, preserve hashes/evidence, and repair naming/ledger compatibility separately. |
| 2026-07-30 | Schedule Continuity And Switching | Promoted | Once a Schedule API explicitly accepts a command, never render a known-older checkpoint while reconciliation loads. Gate optimism behind mutation ownership, cancel and start-stamp reads per view, reject pre-settlement or same-view out-of-order snapshots, and retain the confirmed Gantt target preview until an authoritative range replaces it. Keep Board/Gantt switches inside the mounted client, prefetch by intent, synchronize browser history, and derive only the active view model. |
| 2026-07-29 | Project Work Queue And Triage    | Promoted | Keep one server-composed current row per V2 project in the team Work Queue and only a bounded preview on Dashboard; personal reminders remain separate. Legacy Contacted classification is admin-only, read-only, and excludes linked customer contact fields. Migrate only one reviewed, unchanged project per explicit command, never bulk-seed cadence. Confirmation correction appends history and an explicit review signal. Site Visits stays hidden/manual and outside work items. That slice did not authorize redesign; the later 2026-07-30 handover now does. |
| 2026-07-29 | Project Work Review Concurrency  | Promoted | Bind confirmation reconciliation to the exact repair-signal ID and row version. Bind legacy Contacted migration to a database fingerprint of every project and related evidence field used by classification, reject mismatch before V2 writes, and keep the internal fingerprint helper ungranted. |
| 2026-07-29 | Portal Staging Auth Callback     | Promoted | Exchange controlled local/staging one-time links through `/login/callback` with a hashed magic-link token, a fail-closed session-cookie write, safe same-origin callback normalization, `private, no-store`, and `Referrer-Policy: no-referrer`. Never redirect an access/refresh-token fragment straight to a protected route or treat a successful token exchange without a durable cookie as a successful login. |
| 2026-07-29 | Project Work V2                  | Promoted | Read marker inventory and operational state through direct bounded server owners rather than PostgREST embedded relationships. Per-project legacy classification may tolerate only the exact pre-rollout missing-marker condition; authoritative team inventory must fail closed when missing or truncated. Canonicalize the named cascade foreign keys, reload PostgREST after each DDL commit, run read-only readiness, and prove direct marker plus authenticated legacy-project reads before resuming writers. Cached work stays read-only, and a missing V2 contract exposes no actions. |
| 2026-07-29 | Marketing Enquiry Reachability   | Promoted | Keep one public conversion system across `/contact` and embedded service-page forms. Require project type, name, phone and email through one client/server validator, reuse one browser-generated submission UUID across enhanced retries, assign each no-JavaScript POST a server UUID, and keep any rejected attachment visibly blocking until replaced or removed. Retire the unused `/start` and `/start/explore` flows rather than maintaining a parallel contract. |
| 2026-07-29 | Schedule Mutation Trust          | Promoted | Preview Schedule V2 commands without force, confirm only when the server identifies other moved jobs, re-preview immediately after approval, and force only when the reviewed impacts are unchanged. Every optimistic mutation owns an exact rollback checkpoint and one in-flight lifecycle; accepted state updates only the compatible active-view cache and invalidates incompatible snapshots. Gantt start-plus-duration adjustment is one atomic RPC-backed command, while ambiguous failures reconcile visibly. Database-revision protection against near-simultaneous staff edits remains follow-up work. |
| 2026-07-29 | Portal UI Authority              | Promoted | Treat the checked-in and rendered portal UI as canonical. Portal and marketing have separate UI systems; catalogues and historical migration language are regression/history evidence, not authority for a broad restyle. Preserve active specialist and compatibility owners, and require explicit user approval for cross-route visual migrations or shared-token replacement. |
| 2026-07-29 | Portal Operational Lists/Create  | Promoted | Keep ordinary Projects/Contacts discovery bounded and server-paged with response query identity; never present a retained page under a different scope/filter. Project creation is one server-owned stable-ID command: detect strong contact duplicates before writes, separate confirmed records from setup-automation state, preserve saved records when setup needs attention, and mark indeterminate writes or unverifiable cleanup as do-not-retry administrator reconciliation. |
| 2026-07-29 | Marketing Copy Reduction         | Promoted | Remove repeated decisions, explanations and conversion prompts at their owners; do not replace long pages with more hidden copy. Keep one useful action, preserve governed evidence and intake/SEO contracts, version material homepage copy changes, and include public noindex flows in claims review rather than relying only on the sitemap. |
| 2026-07-28 | Quote PDF Asset Runtime          | Promoted | Keep quote assets module-owned. When Next emits a hashed browser URL in a server bundle, resolve the exact current server-output file and make staging update smoke fail on swallowed artifact refresh errors; never probe source roots. |
| 2026-07-28 | Commercial Revision Conflicts    | Promoted | Treat stale quote revisions as non-retryable application conflicts, not SQLSTATE `40001`; prove immediate API `409` behavior in disposable PostgreSQL and provider-free staging smoke before production review. |
| 2026-07-28 | Commercial Workflow Trust        | Promoted | Bind each save/send/accept action to one stable intent and exact commercial revision. Freeze provider requests before dispatch, checkpoint provider acceptance before replay-safe finalisation, keep acceptance committed when invoice delivery fails, and never let unavailable recovery enrichment hide an otherwise readable historical quote. |
| 2026-07-28 | Infill Incremental Pricing       | Promoted | Price one authoritative no-infill site baseline, divide the exact incremental pool across infills, and keep the base customer price stable. Retain the $75/h single-installer rate while labour actions explicitly include preparation/fabrication work and realistic minutes. |
| 2026-07-28 | Calculator Infill Pricing        | Superseded | The pooled attribution remains useful internally, but a proportional share of the whole pergola made the displayed structure remainder fall. Use the newer no-infill baseline guardrail for customer contributions. |
| 2026-07-27 | Enquiry Attachment Readiness     | Promoted | Verify the private Storage bucket in the exact production project before enabling attachment claims. A selected file must reach Storage or fail visibly; never convert an upload failure into metadata-only while allowing the enquiry/email to claim files were received. |
| 2026-07-27 | Enquiry Email Optional Pricing   | Promoted | Treat indicative pricing as optional customer-email content. A valid short residential or commercial enquiry must still render, send and log its confirmation when dimensions or costing are unavailable; omit the investment panel and pricing copy instead of aborting the side effect. |
| 2026-07-27 | Calculator Rafter Explainability | Promoted | A trusted drawing label and written working must consume the same package-owned result facts. Remove app-local formula lookalikes when their deductions, sides, allowances, or rounding differ from the engine. |
| 2026-07-27 | Calculator Trusted Breakdowns     | Promoted | Build everyday explanations from the exact BOM/actions, preserve source and instance identity, and bound complete groups with stable native disclosures. Keep routine copy plain and package IDs inside optional technical detail. |
| 2026-07-27 | Calculator Quote Reconciliation   | Promoted | Validate Live pricing, repriced persistence, and saved-estimate quote mapping as one exact-cent chain. Compare commercial inclusions without requiring unrelated UI row ordering, and fail closed on a repriced mismatch. |
| 2026-07-27 | Calculator Responsive Ownership   | Promoted | Reflow composite controls from their own container, place sticky chrome against the actual scroll owner, and reveal hidden Advanced sections plus the invalid descendant before completing Issue Jump. |
| 2026-07-27 | Calculator Automatic Defaults     | Promoted | Explain automatic pitch and downpipes from the selected authoritative result without rewriting raw inputs or duplicating costing rules; keep retained-result and validation states explicit. |
| 2026-07-27 | Calculator Result Hierarchy       | Promoted | Let the Workspace own result-task state and explicit cross-layout navigation. Show one rounded lead price per layout, reset only the independent result rail on task changes, preserve exact-cent detail, and put the written result before its diagram. |
| 2026-07-27 | Calculator Readiness Presentation | Promoted | Preserve every readiness row and Save gate while separately presenting causal issues, dependent blocked checks, waits, reviews, and errors. Command-bar visual/focus order must follow its DOM source order. |
| 2026-07-27 | Calculator Add Actions           | Active   | Wrap zero-argument UI actions before binding functions that accept optional data; otherwise React can pass a DOM event into serializable calculator state. Assert that the callback receives no arguments. |
| 2026-07-26 | Marketing Homepage Interaction   | Promoted | Keep one visible first-question introduction, make its hero fragment reveal an actionable choice at narrow and zoomed viewports, route semantic keyboard selection through the same consent-aware activation path, and test selected/inverse focus plus selected hover colours rather than CSS-property presence alone. |
| 2026-07-26 | Marketing Homepage Promotion     | Promoted | Promote an approved experiment by moving it into one production owner, transferring canonical SEO, proof, service, process, enquiry and analytics responsibilities, and retiring the parallel implementation. Redirect comparison URLs to `/`; do not retain hidden duplicate homepages. |
| 2026-07-26 | Enquiry Email Production Layout  | Promoted | Promote an approved layout through the canonical renderer so live send, staff preview and generated fixtures stay identical. Keep template IDs, subjects and delivery side effects stable; unapproved layouts remain preview-only. |
| 2026-07-26 | Marketing Project Gallery        | Promoted | Project detail mobile uses the product-owner-preferred native, variable-height, top-aligned horizontal strip. Do not replace it with a single-frame controlled carousel without explicit approval; keep the desktop mosaic and product galleries unchanged. |
| 2026-07-26 | Marketing Release Identity       | Promoted | Production parity evidence must identify one sanitized source revision on normal and cache-busted responses; visible copy, HTTP 200 and cache status cannot prove which commit is deployed. |
| 2026-07-26 | Marketing Enquiry Reconciliation | Promoted | Reuse the intake's validated, client-generated submission UUID as the non-personal analytics lead identifier. Do not create an unrelated event UUID when production evidence must reconcile one success event with one accepted submission. |
| 2026-07-26 | Marketing Static Root Routing    | Promoted | Canonicalise Next's production-only `/index` root alias before the shared header derives navigation, hero presentation or enquiry context. Prove the optimized root HTML and deployed browser path, and let focus tests observe the menu's initial focus contract before moving focus elsewhere. |
| 2026-07-26 | Marketing Guide First Layers     | Promoted | Share guide transformation and rendering, but keep supporting headings, the selected project and return route owned by each guide. Verify heading uniqueness across the programme and measure governed project cards with selectors that match their rendered primitive. |
| 2026-07-26 | Enquiry Email Preview Access     | Promoted | Gate provider delivery separately from safe authenticated rendering. Production staff may compare governed email fixtures read-only; preview-only environment and credential checks must disable sending without making the renderer appear broken. |
| 2026-07-25 | Marketing Editorial Consolidation | Promoted | Measure the complete mobile decision path, not disclosure count alone. Service first layers have explicit section/project/stage budgets; product routes use one typed decision model, three purposeful detail groups and one controlled gallery without repeated inventory. |
| 2026-07-25 | Enquiry Email Layout Comparison  | Promoted | Keep layout exploration preview-only until approval, compare alternatives with identical governed fixture data, label each real send distinctly, and treat simulated dark mode as guidance rather than inbox proof. |
| 2026-07-25 | Enquiry Email Preview Delivery   | Promoted | Never leave a staging email action silently disabled. Report the safe server-owned readiness reason beside the control, require the actual provider secret value in the portal Preview environment, and redeploy after environment changes while preserving fixed-recipient and no-write controls. |
| 2026-07-25 | Marketing Disclosure Hydration   | Promoted | Keep responsive disclosures open in server markup for no-JavaScript access, but hide only pending mobile bodies through the shared scripting-aware breakpoint contract so hydration resolves native state without changing visual height. |
| 2026-07-25 | Marketing Enquiry Form Contract  | Superseded | Superseded by the 2026-07-29 Marketing Enquiry Reachability decision, which also requires email and retires the parallel `/start` flows. |
| 2026-07-25 | Marketing Enquiry Routing        | Promoted | Resolve audience from explicit service or governed project route metadata, keep product and unknown routes neutral, preserve canonical item slugs, and apply validated lower-case context after other analytics fields so callers cannot overwrite it. |
| 2026-07-25 | Marketing Fragment Navigation    | Promoted | Responsive disclosures must reveal any fragment target they contain, and global route scroll handling must prefer a valid hash target over resetting to the top. Verify the real cross-route link and Back journey, not only a direct URL or attached target. |
| 2026-07-25 | Marketing Server Rendering       | Promoted | Keep the marketing route template server-rendered and non-landmark, let each page own its single `main`, and do not add a top-level App Router loading boundary whose streamed replacement requires JavaScript to reveal the real public page. Test visible no-JavaScript browser output, not response-string presence alone. |
| 2026-07-25 | Repository Security Scan         | Promoted | Search tracked, non-binary Git content for exact private-key markers; do not synchronously decode every tracked blob or let binary visual evidence consume the security gate's fixed timeout. |
| 2026-07-24 | Marketing Mobile Navigation      | Promoted | Keep the global menu breakpoint identical in CSS and JavaScript, capture the reading position before fixing the body, make the closed portal inert, and verify focus/history/short-height behavior on public routes. Do not add a global sticky CTA while consent and route-local fixed surfaces prevent a non-obstruction guarantee. |
| 2026-07-24 | Marketing Enquiry Schema Rollout | Promoted | Before deploying an RPC that writes fields introduced in a legacy root schema snapshot, add a forward migration for every consumed column and run the real RPC inside a rollback-only transaction against the exact target project; function existence alone is not schema readiness. |
| 2026-07-24 | Marketing Enquiry Secret Rollout | Promoted | A new fail-closed production secret must not outage an already-configured public conversion path: use an explicitly documented, domain-separated derivation from an existing required server credential when that preserves the security property, and retain a no-secret failure test. |
| 2026-07-24 | Admin API Cache Policy           | Promoted | Send every response produced by the shared admin API helpers as `private, no-store`; route-specific success-only headers leave authenticated data and error payloads cacheable on untested branches. |
| 2026-07-24 | Staff Search Overlay             | Promoted | Render shared search results in a viewport-level overlay anchored to the input; do not nest an interactive dropdown inside responsive header scroll containers, and cover the project-detail command-rail breakpoint in authenticated browser tests.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-24 | Marketing Contact Form           | Promoted | Keep one responsive form tree, render supported query preselection on the server, match required fields to the intake contract, preserve the same submission UUID across retries, and close duplicate submission synchronously before uploads or network work.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-07-23 | Marketing Public Boundaries      | Promoted | Validate token expiry before protected reads/mutations; make enquiry intake transactionally idempotent by submission UUID; bind private uploads to short-lived durable sessions with content validation and cleanup; and keep optional tracking loaders behind the applicable regional/category decision.                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-23 | Costing Configuration Provenance | Promoted | Carry the exact immutable configuration provenance with each calculation result; do not discover it in a later save-time metadata read. Store typed values only, publish atomically, and fail closed rather than silently changing a published costing basis. |
| 2026-07-23 | Project Header Density           | Promoted | Keep the project masthead to one command row plus one tab row: name and current-stage badge replace repeated ID and pipeline chrome; equal desktop tracks centre search, while narrow layouts scroll commands inside the row rather than hiding permissions or adding header rows.                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-23 | Calculator Pricing Preview       | Promoted | Build the customer headline from complete quote-line cents, keep infills inside pergola pricing, and limit internal calculator cost presentation to admins without claiming payload secrecy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-23 | Overview and Enquiry Pricing     | Promoted | Never relabel ambiguous estimate summaries as customer price. Project Overview and quote creation consume one saved-snapshot quote-handoff projection; blocked projections are unavailable. Marketing enquiry email budgets, saved inputs, and saved outputs consume one two-post costing snapshot.                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-23 | Calculator Blind Pricing         | Promoted | Apply the blind core `1.15x` uplift before GST in `@sp/costing`; keep motor and roll-cover rates as fixed GST-inclusive add-ons, price covers from entered width, and default historical snapshots to No cover.                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-07-23 | Calculator Template Application  | Promoted | Treat selecting a template and pressing Apply to active module as sufficient intent: update the browser draft immediately and leave the final modal validation/commercial decision to Save.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-22 | Calculator Draft Removal         | Promoted | Apply reversible calculator-draft removals immediately without confirmation dialogs; keep structural invariants in the control, retain Undo where available, and reserve the modal validation/commercial decision for Save.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-22 | Calculator Configuration Layout  | Promoted | Keep the module navigator separate from one grouped main-column stack containing templates and the configuration form; never add another direct child to the two-column workspace without declaring its grid ownership and proving split plus stacked widths in Playwright.                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-22 | Calculator Commercial Safety     | Promoted | Enforce discount and invalid-add-on rules in shared estimate-to-quote mapping as well as UI readiness; preview the exact saved estimate at handoff, require a reason to preserve stale pricing, and keep post-job actuals downstream of frozen estimate history.                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-22 | Marketing Evidence               | Promoted | Treat reusable project fields and comparison scores as public claims: keep one aligned evidence record, test known corrections at source level, derive guide facts from it, and require current product or assembly evidence before publishing measurable rankings.                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-22 | Staff Header Search Rollout       | Promoted | Keep one shared Projects/Contacts discovery owner across adopted portal headers, use the non-blocking route-progress owner for result navigation, clear search state on route commit, mark the current result, and ensure instant Project A content cannot mask a searched Project B. Preserve route-local actions/filters and defer Calculator/Design Workbench until unsaved-work handoff is defined.                                                                                                                                                                                                                                                        |
| 2026-07-22 | Global Search Performance         | Promoted | Keep typeahead to one auth-bound, database-verified `SECURITY INVOKER` RPC with indexed canonical fields; use only the authenticated user's QueryClient for fresh/stale results, invalidate it from project/contact mutation owners, and enforce the 400 ms uncached plus 75 ms cached browser budgets.                                                                                                                                                                                                                                                                                                                                                  |
| 2026-07-22 | Staff Header Search Pilot         | Promoted | Add global search through an opt-in shared header composition, prove Dashboard/Index/Detail archetypes before wider rollout, keep route-local filters and actions independent, and query only real schema fields through the auth-bound RLS client.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-22 | Dashboard Operational Semantics  | Promoted | A workflow stage is inventory, not proof that a downstream artifact or action is ready. Dashboard labels and amounts must name their exact source: stage counts stay stage counts, Project Command Centre projections own due work, and estimate customer price uses the canonical quote-pricing helper rather than ambiguous estimate summaries.                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-22 | Project Tab Perceived Speed      | Promoted | Render selected-tab state and the matching owned shell optimistically from the project frame; keep the canonical URL, deferred workflow module, and data settlement authoritative in the background, and measure every current tab rather than a retired compatibility surface.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-21 | Portal Bundle Accounting         | Promoted | De-duplicate route/layout CSS named by `entryCSSFiles` from dynamic-entry totals; it is already loaded. Preserve the established initial-JavaScript baseline and cover Turbopack manifest overlap with a regression test rather than raising a route budget.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-07-21 | Portal UI Foundation             | Superseded | Superseded by the 2026-07-29 Portal UI Authority decision. Its responsive, canonical-status and no-clipping guardrails remain part of the current contract, but its broader-adoption wording does not authorize a migration. |
| 2026-07-21 | Project Calculator Chrome        | Promoted | Keep one compact project/Calculator context stack: project wrapper owns design-version routing, embedded Calculator receives a typed design-navigation model, and locked or unavailable states retain navigation without duplicating the standalone heading/project picker.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-07-21 | Project Calculator/Commercial    | Promoted | Embed the authoritative Calculator through an explicit project workspace contract, treat historical estimates as revision sources, group Quotes/Invoices through a composition-only Commercial owner, and retire the project Designs/Emails UI without changing their durable data or side effects.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-07-21 | Project Page Shell               | Promoted | Keep one fixed sticky identity/navigation header and one full-width tab surface; lifecycle and local-first details belong in Overview, and tab validity belongs to the shared registry rather than server/client copies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-07-21 | Narrow Embedded Forms            | Active   | Responsive controls embedded in grid columns must adapt to their own container width; viewport breakpoints do not protect a narrow card on a wide desktop.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-21 | Project Command Single Owner     | Promoted | Use one stable Project Owner from lead through deposit, selected only from Jordan, JP, Joe, or Bruce; specialist action assignees may override the action display but do not create parallel project-owner roles.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-21 | Project Command Centre Reads     | Active   | Explicit PostgREST selects use only canonical project schema columns; application fallbacks cannot protect a query that requests a missing legacy column.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-21 | Production-Scale Related Reads   | Active   | Use bounded-concurrency ID chunks for production-scale related-table reads, test above one chunk, and require browser evidence to settle beyond loading before declaring a route ready.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-20 | Project Command Ownership        | Promoted | Keep project roles in one canonical assignment table, keep source tasks canonical, derive one action deterministically, and isolate explicit selection/conflict/audit from stage checks, personal reminders, and legacy Schedule projection columns.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-20 | Durable Provider Effects         | Promoted | Freeze one provider key and exact request before dispatch; uncertain delivery may replay only that identity inside its bounded window, signed callbacks reconcile only minimal acceptance evidence, and provider acceptance never substitutes for idempotent business finalisation.                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-20 | Durable DB Role Tests            | Promoted | Verify browser denial from the real PostgreSQL privilege catalog on Supabase Postgres 17.6.1.107; its known supautils bug can SIGSEGV on direct calls to revoked functions, so restore call-style probes only after the pinned image contains the upstream fix.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-20 | Durable Worker Runtime           | Promoted | Treat AbortSignal as advisory: heartbeat a lease through handler settlement and terminal writes, never retry or release while old handler code is live, signal-fence every handler RPC, and exit before lease expiry when aborted code will not settle.                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-20 | Repository Secret Incident       | Promoted | Removing tracked key material does not revoke it or erase Git history: treat it as compromised, rotate/revoke and audit use, keep scans green, and do not rewrite repository history.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-07-20 | Durable Job Hardening            | Promoted | Freeze accepted effect policy, validate an exact PGMQ ID/body before mutation, use typed safe-summary projections, and keep restart identity behind the current lease; claim guards must run before every branch that can archive or skip a row.                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-20 | Durable Background Jobs          | Promoted | The logged queue carries only a job pointer/version; frozen input, state/effect history, and business finalisation stay durable and private, and every worker-owned payload read/mutation is fenced by the current lease token through service-role RPCs.                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-20 | Portal Project Details           | Promoted | Route-safe background saves belong to the authenticated local-first queue, not a component promise; clear confirmed working copies only when no newer draft or queued save exists, and retain terminally rejected drafts for Review/Retry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-07-20 | Portal Contact Details           | Promoted | Contact Detail uses the same authenticated local-first save contract as Project Details: immediate Done feedback, ordered full drafts, coherent cache updates, durable retry, and confirmed-value rollback with the rejected draft retained.                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-20 | Portal Project Task Mutations    | Promoted | Manual task feedback is immediate, but overlapping writes own rollback by task key and auto-advance side effects remain server-confirmed; rejected tasks refresh server truth and expose task-specific Retry.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-20 | Portal Project Index Mutations   | Promoted | Reversible index writes update only the authenticated user's query caches immediately, retain background-sync feedback, and roll back the affected field/scope on rejection; server-confirmed success and destructive actions stay separate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-07-20 | Portal Performance Measurement   | Promoted | Fixture interaction feedback is timestamped inside Chromium when the real visual DOM state changes; Playwright driver round trips must not be counted as user-visible latency.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-20 | Infill Explicit Selections       | Promoted | Panel material and joiner direction are explicit two-option selections on Existing supports; physical edges use only Yes/No, with new items defaulting to conservative No and legacy auto/Unsure values resolved without changing their current purchasing result.                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-19 | Workbench Solve Lifecycle        | Promoted | Memoize the solved base by draft/project identity and derive selection, visibility, and viewport UI from it; UI-only changes must not rebuild solved geometry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-19 | Calculator Request Lifecycle     | Promoted | Keep debouncing, abort ownership, newest-result protection, and last-valid continuity in the dedicated request controller; costing inputs and results remain server/package authoritative.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-19 | Portal Workflow Bundles          | Promoted | Keep the project frame and tabs initial; default Activity may be a deferred workflow only with truthful local loading, exact intent preloading, and combined Project Detail/Workbench bundle accounting.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-07-19 | Portal Auth Request Scope        | Promoted | Deduplicate verified user and role reads only within one server render; never use browser claims or a process-global private cache, and keep API requests independently authenticated through RLS-bound clients.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-19 | Portal Navigation Feedback       | Promoted | Ordinary route changes keep the current surface usable, show immediate thin progress, and mark only the clicked control busy; blocking Blueprint screens remain cold-route/auth boundaries.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-07-19 | Portal Projects Index            | Promoted | Render the Projects frame before data, load the combined project/contact index through the staff API/query boundary, scope cached placeholders by archive and authenticated QueryClient, hide them on access-ending responses, and preload only from user intent.                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-07-19 | Portal Contacts Index            | Promoted | Reuse the portal-index navigation boundary, render a truthful Contacts frame before data, load contacts through the authenticated API/query owner, keep related caches coherent centrally, and lazy-load CSV import from user intent.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-19 | Portal Project Opening           | Promoted | Open from a current-user cached or small authenticated project/contact summary, keep the complete snapshot separate in the background, reject incomplete relationship reads, hide known data on access-ending responses, and intent-preload without automatic row fan-out.                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-07-18 | Portal Performance Telemetry     | Promoted | Store only allowlisted identifier-free Web Vitals in the first-party table, keep ingestion non-blocking, restrict summaries to admins, and enforce automatic 30-day retention.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-07-18 | Portal Browser Persistence       | Promoted | Query caches, working copies, and mutation queues belong to one authenticated user; never replay unscoped legacy keys or leave the old owner's runtime alive across an auth change.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-07-18 | Calculator Module Navigation     | Promoted | Compute one per-pergola module identity and keep navigation mutations pure: Add is fresh, Duplicate regenerates nested IDs, Move never reorders, and confirmed Remove remains browser-draft-only until Save.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-07-18 | Calculator Local Drafts          | Promoted | Draft-key changes must block persistence until local restoration or the new external estimate source is ready; browser-draft status stays separate from estimate Save and server-sync state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-07-18 | Calculator Commercial UI         | Promoted | Keep internal true cost distinct, derive the non-persisted pergola customer-price preview through the shared quote-pricing helper, keep blinds separate, and expose Preserve versus Reprice before quote handoff.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-07-18 | Calculator Infills               | Promoted | Keep physical infill takeoff, stock allocation, joiner/support cuts, labour, and BOM purchasing in `@sp/costing`; portal calculator code owns draft validation and presentation only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-18 | Infill Configurator UX           | Superseded | Automatic material/direction choices were replaced on 2026-07-20 by explicit selections on Existing supports; costing ownership and blocker routing remain unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-07-18 | Calculator Browser Fixtures      | Promoted | Stateful trust suites use dedicated revisioned scenarios, explicit local/staging reconciliation, and clear drift failures instead of sharing general route-smoke records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-07-19 | Infill Support Confirmation      | Superseded | The three-answer confirmation model was replaced on 2026-07-20 by Yes/No only; conservative No remains the new-item default and only resolved booleans cross into costing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-07-19 | Infill Results                   | Promoted | Present conservative support defaults calmly and separate finished dimensions or cut length from allocated stock without changing canonical takeoff or export records.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-07-19 | Infill Triangle Geometry         | Promoted | Treat a one-zero-end mono-slope as a true three-edge triangle and remove its collapsed edge from physical joiner/support output; never purchase zero-length material to preserve a four-edge UI model.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-23 | Design Workbench                 | Active   | The live workbench sheet view is plan-only; retired `activeView` state is stripped as opaque legacy input, and future Section output must be a solved-artifact surface rather than a revived workbench view tab.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-23 | Design Workbench                 | Active   | The live workbench viewport modes are `geometry3d`, `plan`, and `sheet`; retired `model` state is stripped as opaque legacy input and must not be reintroduced as a render branch or navigation tab.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-01 | Supabase Schema                  | Promoted | Schema-affecting work needs a table/RPC ownership map before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-01 | Agent Routing                    | Promoted | Non-trivial changes need a path ownership and doc-trigger map before editing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Automation/Email/Audit           | Promoted | Automation, email outbox, audit, tasks, and follow-ups need a canonical side-effect doc.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-01 | API/Auth                         | Promoted | Staff/admin/public-token route changes need a route contract doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Projects/Estimates               | Promoted | Core project/contact/estimate workflows need a canonical doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-01 | Docs/Testing                     | Promoted | Keep broad repo command guidance in `docs/testing-and-qa.md`; link to it instead of duplicating command blocks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-01 | Parallel Work                    | Promoted | Use universal parallel-work guardrails for concurrent lanes across apps, packages, docs, and workbench migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-01 | Geometry Top Projection          | Promoted | Mesh-backed top projection must follow the 3D Top camera visibility contract, not render-mesh order or face winding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready plan views must use top projection as the single committed visual body source.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Plan Rendering                   | Promoted | Projection-backed plans must suppress context/reference bodies as normal visuals and invert the projection transform for deck drag coordinates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready plan selection and drag must use render-graph layer ownership and canonical preview/commit/rebuild round trips.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-01 | Plan Rendering                   | Promoted | Projection-backed overlays must bind visible selection/hit geometry to committed top-projection polygons, not reference footprints.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Portal Test Auth                 | Active   | Service-role-backed portal test-user provisioning must be explicit, local/staging-targeted, and never run as part of routine browser gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-02 | Portal Browser Coverage          | Active   | Authenticated portal route coverage must be catalog-driven through `playwright/support/portalRouteCatalog.ts`; browser specs consume catalog subsets instead of local hardcoded route lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-02 | Portal Browser Coverage          | Active   | Seeded portal scenarios must be explicit, local/staging-only, idempotent, and separate from non-mutating browser gates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-06-02 | Agent Tooling                    | Active   | Complex page bug reports should capture the shared page debug export before implementation changes; page exports must stay gated outside production and preserve page-specific inner payloads.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-02 | Portal Browser Evidence          | Active   | Portal browser specs must use the shared evidence lane instead of local ad hoc console, request, screenshot, or viewport listeners.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Agent Tooling                    | Active   | Portal-agent quality should be catalog/report driven through the scorecard, not inferred manually from screenshots, one-off test files, or scattered route lists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-02 | Agent Tooling                    | Active   | Strictness ratchets must start with stable, changed-safe coverage baselines and must not block broad legacy pressure or unrelated repo-health debt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-02 | Workbench Debugging              | Active   | Workbench captured repros must be validated and attached through the shared Playwright helper before any exact payload is baked into `sanctuaryWorkbenchCapturedFixtures.ts`; browser specs must not write captured payloads to tracked files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-02 | Workbench Debugging              | Active   | Multi-house roof solver captures must pass the stricter verifier before baking; healthy one-house payloads or non-reproducing pages are evidence only, not solver fixtures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-11 | Design Workbench                 | Active   | Live workbench runtime is object-first only: no calculator module state, house-first carrier, raw module/house context, module index, legacy plan/section fallback, or costing imports may enter workbench roots. Snapshot-only calculator designs are unsupported/empty in the workbench, and repricing stays disabled until a downstream artifact-to-commercial adapter is introduced outside runtime.                                                                                                                                                                                                                                                                                                              |
| 2026-06-03 | Design Workbench                 | Active   | Object-first workbench state must persist through authenticated staff estimate boundaries and reload as the source of truth before live multi-house bugs are captured; legacy `house-main` synthesis is only for estimates without saved object-first state.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-03 | Design Workbench                 | Active   | House roof intent must resolve through an object-first authorship boundary before status, raw geometry input, Plan, or 3D render health; unauthored legacy/default `mono` repairs to canonical `hipped`, while authored mono remains a user design choice.                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-06-03 | Workbench House Forms            | Active   | House-form status must validate preset forms against resolved raw geometry when draft polygons are empty; do not mark healthy preset roofs invalid just because the authored polygon field is blank.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-03 | Workbench House Forms            | Active   | Project 3D preview composition must replace legacy active-module house layers whenever project house geometry exists, including single-pergola projects; expose per-house projection health in 3D diagnostics alongside Plan.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-03 | Workbench House Forms            | Active   | Custom house footprint numeric residue must be canonicalized at the `@sp/geometry` solved-input boundary before wall/eave/roof solving; do not mutate saved drafts or patch Plan/3D rendering for sub-visible coordinate noise.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-06-03 | Workbench House Forms            | Active   | Custom hipped eave repair is package-owned and render-only: Plan and 3D consume the same repaired eave package from `HouseModel3D`, while final package roof QA owns health status.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-03 | Workbench House Forms            | Active   | Fully hipped non-rectangular orthogonal house footprints route through `eave_graph_source_edge_envelope`; invalid topology stays diagnostic instead of falling back to Plan paint fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-06-03 | Workbench House Forms            | Active   | Fully hipped custom orthogonal roofs must pass semantic topology QA before committed roof bodies, material accounting, or status can be considered healthy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-30 | Portal Shell                     | Active   | Expandable pinned sidebars must keep each icon, label, and submenu in one vertical flow group; split rail/panel lists desync icons from labels.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T7: house form inspector cull -- dead-write/derived fields and duplicate diagnostics were removed from the right rail; future inspector controls must persist and re-derive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T8: roof appendage band feature removed end-to-end; future shape edits go through the gumball, not inspector number fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | Workbench Cleanup                | Active   | PR-T9: deck inspector cull — `deck.label` / `deck.kind` / `deck.elevationMode` removed; host edge dropdown removed (snap-derived only); ground-clamp on negative offsets dropped.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-06-16 | Portal Lists                     | Active   | PR-PG1: explicit `.range(0, MAX_LIST_FETCH_ROWS - 1)` + `count: 'exact'` at every staff list-fetch boundary; `ListCountBanner` on contacts + projects pages surfaces visible-vs-total when crossing 80% of the ceiling. Closes PostgREST's silent 1000-row default.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-16 | Portal Lists                     | Active   | PR-PG1c: every staff list fetch goes through `fetchAllPages()` paging Supabase 1000 rows at a time up to `MAX_LIST_FETCH_ROWS = 5000`. Defeats Supabase's project-level `db-max-rows` cap that silently clamped every `.range(...)` response to 1000 rows. Banner now fires unconditionally on `truncated === true`.                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR2: workbench right rail renders a structured `RoofValidationPanel` (failing stage label + raw diagnostic code chip + approximation reasons + "Copy diagnostics" clipboard button) instead of a single truncated line. `ObjectWorkbenchRoofStatus` carries `stageDiagnostics` + `failingStage`; clipboard payload is the canonical shape PR-HR1 will persist as a fixture.                                                                                                                                                                                                                                                                                                                                       |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR1: one-click "Save bug report" button in the right-rail validation panel exports a schema-versioned `RoofFailureRepro` JSON of the failing house (geometry-only, no PII). Designer-mediated; downloaded file drops into `packages/geometry/src/house/__fixtures__/captured/` for PR-HR4's regression matrix to pick up. Closes the "failing shapes lost on tab close" loop.                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR4: property-based orthogonal coverage matrix at `packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts` enumerates 69 multi-open cases (8 presets + 3 custom shapes × both ridge axes × `{none, all, every adjacent pair}`) and auto-loads any captured fixture under `__fixtures__/captured/` produced by PR-HR1. `it.fails` quarantine surfaces regressions immediately. Baseline: 69 of 69 green.                                                                                                                                                                                                                                                                                                  |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR3: QA-invalid roof surface solids now render in the 3D viewport with a warm amber diagnostic tint (`#d97706`, opacity 0.42) instead of being suppressed. Geometry scene builder stamps `houseRoofRenderRole: "diagnostic"` on the solids; `HouseSurfaceSolidObject` reads the metadata and overrides the layer colour. Designers can finally see what the solver attempted on a failing shape — closes the last visibility gap in the recurring "house roof broken" loop.                                                                                                                                                                                                                                       |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR6: first designer-captured fixture (Graham — Oratia) loaded into the HR4 matrix via the HR1 "Save bug report" button — full HR1→HR4 loop closed end-to-end. Both `buildEaveGraphJoinedHippedRoof` and `buildJoinedRectilinearHippedRoof` (bent-spine wavefront) fail differently on this aspect ratio, so the fix isn't a solver dispatch tweak. Quarantined with investigation notes; HR3 amber-tint render keeps the broken roof visible to designers.                                                                                                                                                                                                                                                              |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP1: house composition geometry primitives ship in `@sp/geometry`. `HouseComposition` = N axis-aligned rectangles + explicit joins + per-rectangle roof intent. `composeRoofFromComposition` routes fused-rectangle compositions (with matching intents) to a single `buildRectangularRoof` call; falls back to per-rectangle stitched solve with `approximationReasons: 'composition_stitched_render'` for non-fused / mixed-intent. True unified-topology (Hip-and-Valley L) deferred to COMP2.                                                                                                                                                                                                                |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP-PHASE2: optional `composition?: HouseComposition` field added to `HouseFormModel` + `ObjectFirstHouseFormDraft`. Workbench-draft normalisation preserves valid compositions; silently drops invalid / empty (defensive). New `deriveHouseFormFootprintPolygon()` helper lets downstream consumers ignore the composition-vs-polygon distinction. No geometry routing yet — Phase 3 wires it alongside the rectangle-tool UX. Zero designer-facing change today.                                                                                                                                                                                                                                              |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP-PHASE3.2: `buildHouseFormGeometryInputForForm` now routes the roof through `composeRoofFromComposition` when the house form has a `composition`. Single-rectangle compositions (the only kind Phase 3 ships) produce byte-equivalent roof planes to the legacy path because both bottom out in `buildRectangularRoof` on the same dimensions; the swap stamps `roofTopologySolver: "composition_*"` so observability shows which forms travel the composition route. Walls/eaves/openings unchanged in Phase 3 — Phase 4 swaps those for multi-rectangle composites.                                                                                                                                        |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP-PHASE3.3: `Draw outline` retired as a house-form authoring affordance. The rail's footprint-mode picker now offers only `Preset`; the `Continue outline` button and `startDrawOutlineEditor` action are removed. Legacy forms persisted with `mode: 'custom_polygon'` still render their stored polygon read-only via the legacy pipeline and show a read-only badge in the rail explaining why preset-specific controls are hidden. Follow-up cleanup also retired the inspector-only deck redraw trigger after Canvas Plan stopped consuming `drawOutline*` requests; preset deck creation and stored custom deck outlines remain supported.                                                                                                                                            |
| 2026-06-18 | Workbench Snap                   | Active   | PR-COMP-PHASE3.4: house-to-house snap. `buildProjectHouseSnapTargets` accepts an `excludeHouseFormId` and now emits snap targets when `activeFamily === 'house_forms'` — walls + roof eaves of every form OTHER than the one being dragged. Self-snap is prevented by the exclusion filter; PlanViewport supplies the dragged form's id when active. No new resolver / preview chrome needed — the existing `MoveTool` + `resolveMoveSnap` + `PlanMoveSnapIndicatorLayer` infra picks up the new targets transparently.                                                                                                                                                                                                                |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP-PHASE4a: multi-rectangle composite geometry pipeline + pure `detachHouseFormAtSeam`. Multi-rectangle composites now render walls/eaves/openings from the composition's union polygon (substituted into the legacy builder via the new `deriveCompositionUnionPolygon3` helper) and the roof from `composeRoofFromComposition` (the Phase 3.2 swap unchanged). Single-rectangle composites preserve Phase 3.2's byte-equivalence — the helper returns null on `primitives.length <= 1` so the legacy preset path runs. `detachHouseFormAtSeam(composition, joinIndex)` ships as a pure geometry primitive that 4b's seam-icon UX will call; no UX in 4a (orphaned-UI avoidance — nothing currently authors multi-rectangle composites). |
| 2026-06-18 | Workbench House Forms            | Active   | PR-COMP-PHASE4b: Join / Detach seam-icon UX. Three sub-commits: (4b.1) `joinTwoHouseForms` + `findCompositionJoinSeamMidpoint` + `detectSharedSeamBetweenForms` pure geometry primitives in `@sp/geometry`; (4b.2) workbench actions `joinHouseForms` + `detachHouseFormAtSeam` wired in `useObjectWorkbenchActions`; (4b.3) PlanSeamIconLayer renders chip icons at world-space seam midpoints (Detach on every internal composite seam, Join on every pair of edge-adjacent forms within snap tolerance). Click dispatches the matching action via the existing draft-transaction pipeline. Single-axis-rotation forms only (cross-rotation pairs skipped); chip click `stopPropagation` prevents underlying form-select. |
| 2026-06-18 | Workbench House Forms            | Active   | PR-HR5: `KNOWN_FAILURES` quarantine in `partialOpenJoinedTopology.test.ts` cleared — the 2 entries (`custom-recess:y:house-gable-end-y-5`, `custom-t:y:house-gable-end-y-1`) were zombies referencing terminal-end IDs that no longer exist after Phase 2's bent-spine wing-tip narrowing (commit `56de9de`). Added a narrow-return L-shape fixture (~Graham–Oratia proxy) to the HR4 matrix; all 252 house-lane tests green.                                                                                                                                                                                                                                                                                        |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-house PR3: project house geometry registry is the canonical derived source for per-form house references, host-excluded 3D scene composition, and PlanViewport house snap targets. Per-pergola `RawGeometryModuleInput.houseContext` remains a Phase 2 deletion target; host house ids now flow through geometry, so portal-side scene retag bridges should not be reintroduced.                                                                                                                                                                                                                                                                                                                               |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR2: object-first pergolas without persisted calculator modules solve through explicit runtime-only sources. Do not reintroduce fake `inputs.modules[]` persistence just to render/select a pergola; keep the temporary `CalculatorModuleInputs` adapter in memory until the per-object solve rewrite deletes it.                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR3: Add Pergola creates a freestanding object-first pergola and selects its transient solve entry. Do not revive select-host-first or persisted-module creation flows when adding new pergolas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-29 | Workbench Geometry               | Active   | Multi-object PR4: project context pergola outlines are selectable plan targets. Selection must resolve by `pergolaId` across persisted and transient solved entries, never by falling back to module 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-29 | Plan Rendering                   | Active   | Multi-object PR5: Plan Editor renders project-wide pergola bodies by object id, not by active module. Do not regress multi-pergola plans to active-only detail plus reference boxes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-29 | 3D Rendering                     | Active   | Multi-object PR6: 3D Review renders project-wide pergola scene bodies by `pergolaId`, not by active module. Keep 3D read/select-only and preserve object ids for selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-30 | Workbench Geometry               | Active   | Multi-object PR7: workbench solve sources route eligible host-house groups through package-level `solveProject`. Do not add new per-module normalize/solve branches in portal state; keep remaining `houseContext` use explicit as the next deletion target.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-30 | Workbench Geometry               | Active   | PR-2B.1b.3g: QA fixture routes must pass the same project-level render contracts as production workbench routes instead of creating parallel render behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-30 | Workbench Rendering              | Active   | Multi-object PR8: invalid selected pergolas must not own the project view basis. Keep Plan/3D on a ready project basis and render invalid selections as reference/context objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-30 | Plan Rendering                   | Active   | Multi-object PR9: house-form plan rendering must resolve by canonical `house_reference:<formId>` from `projectHouseGeometries`. Do not let the object-workbench overlay borrow the active pergola module's host-house projection for a different selected house form; visible-body dedupe is per house form id, not global.                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-30 | Plan Rendering                   | Active   | PR-2B.1b.3e: project Plan surfaces must use `projectPlanProjection` as their object source. Do not render object-workbench Plan from the active module `topProjection`; active selection may affect halos and inspector state only, not which house or pergola bodies exist.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-30 | Workbench House Forms            | Active   | PR-2B.1b.3j: house-form labels are order-derived presentation and `house-main` must never be privileged. An explicit empty object-first house assembly is a tombstone, not permission to re-synthesize a primary house.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3k: house-form status and visible plan body precedence must be keyed by `houseFormId`. Rail/inspector/overlay status must not borrow the first house form; house roof Plan bodies are eave-perimeter projections, while roof-material projections are not committed Plan bodies.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3l: Plan SVG paint order is a semantic view-model contract, not raw top-projection array/z-order. Project pergola bodies must paint below house roof bodies while hit targets and selection chrome remain separate layers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3m: Plan hit targets are event geometry only. They must not paint hover/body visuals; local hover affordance belongs in explicit outline chrome, suppressed for the active selection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3p: visible reference fallbacks need provenance diagnostics and must remain diagnostic/outline-only instead of being mistaken for committed house bodies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-31 | Plan Rendering                   | Active   | PR-2B.1b.3q: no selected house means no selected-house overlay/status fallback; project house projection health remains project-level diagnostics.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3n: solver-derived roof fields should not appear as primary user controls unless they are clear design choices. Hipped ridge axis is derived from the selected house form's footprint, and footprint presets are seeds/provenance rather than object identity.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3o: roof intent writes must be object-id addressed. Roof controls and plan terminal-end toggles must carry `houseFormId` and must not fall back to the first house form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-31 | Workbench House Forms            | Active   | PR-2B.1b.3r: selected-object status must be nullable and keyed by explicit object id. Project/row status may list every house form, but selected-house inspector, trust, diagnostics, and overlay status must not fall back to the first house form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-31 | Workbench Actions                | Active   | PR-2B.1b.3s: action context must be nullable and object-owned. Deck/opening/pergola/house action paths resolve house context from the target object's owner id, never from House 1 or the active module.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3t: project render surfaces may show committed bodies only for object-owned healthy geometry. Invalid or unresolved object-first pergolas must render as reference/diagnostic fallbacks, not normal Plan/3D bodies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3u: unresolved pergola fallbacks must have their own diagnostic render path. They may appear as transparent Plan context outlines and 3D reference lines, but must not flow through committed pergola body layers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3v: diagnostic fallbacks are first-class render outputs, separate from committed bodies, hit-target paint, selection chrome, and generic context overlays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3w: house render health is owned per `houseFormId` before Plan/3D consume project render data. Mixed project composition orchestrates house health; it must not infer house stages after merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3x: house render health has one implementation and repro fixtures should live in focused fixture modules instead of growing the registry hotspot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-01 | Workbench Rendering              | Active   | PR-2B.1b.3y: project 3D must not use active-module preview as committed geometry for suppressed/unresolved project objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3aa: house roof failures must be diagnosed at geometry-stage boundaries before Plan/3D render fallbacks are changed. Capture the live failing payload before changing solver behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3ab: package house-model adapters must expose the raw-house-to-model boundary and named roof-stage statuses before solver fixes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-06-01 | Workbench Geometry               | Active   | PR-2B.1b.3z: house geometry must cross one object-id-addressed input boundary before Plan or 3D consume it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3ac: package roof pipeline stages must be explicit and capture-driven before solver changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-06-02 | Geometry Tests                   | Active   | PR-2B.1b.3ad: geometry solver tests should be split by stage/family instead of relying on one monolithic integration file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3ae: live captured fixtures are required before solver changes for screenshot-only house roof failures.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-06-02 | Workbench Geometry               | Active   | PR-2B.1b.3af: roof-stage diagnostics must classify the first missing render-critical stage, not an optional intermediate collection when valid committed roof bodies exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-06-03 | Workbench House Forms            | Active   | Coverage solver fixes must stay quarantined to representative fixtures until solver-owned evidence proves the topology; do not promote healthy one-house captures into multi-house roof solver fixtures.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Plan Rendering                   | Promoted | Geometry-ready Model Space is a hard top-projection-only render path; legacy/context/reference/opening overlays stay out of normal visuals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-01 | Design Workbench Architecture    | Promoted | Split workbench ownership contract-first: coordinate adapters and render graphs leave React presenters before moving tools/renderers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck snapping must use top-projection frames live and object frames only at the commit boundary.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-01 | Plan Detail                      | Promoted | Geometry-ready plan detail and deck snap edges must come from scene-backed projected wall segments, not legacy footprint overlays or roof outlines.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-01 | Deck Interaction                 | Promoted | Floating deck releases are valid projection placements and must not be failed by snapped-settle geometry checks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck drag sessions must use committed top-projection polygons for live drag math, not SVG-projected or legacy overlay objects.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-01 | Deck Interaction                 | Promoted | Projection-backed deck releases must map render-space previews through object commit frames before writing persisted deck fields.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-03 | Design Workbench Geometry        | Promoted | There is one solved geometry spine; plan, 3D, sheet, section, detail, snap, and interaction surfaces are views of it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-03 | Deck Interaction                 | Active   | Projection-backed deck releases must not use `commitStartPolygon` bounds remapping; it can reintroduce stale overlay coordinates.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-04 | Deck Interaction                 | Active   | Projection-backed drag deltas must normalize the pointer anchor, and snapped commits must map render-frame offsets into object-frame offsets before settle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-04 | Plan Rendering                   | Active   | Geometry-ready Model Space Top renders through `Geometry3DViewport lockedViewPreset="top"` on the same R3F scene as Perspective; the SVG `ProjectionTopViewport` stack is retired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-04 | Design Workbench Architecture    | Active   | Workbench has two render surfaces: a read-only 3D viewport (`Geometry3DViewport`) and a 2D `PlanViewport` (the editor). Plan replaces "Model Space" in the mode switch (`Sheet \| Plan \| 3D`); all editing, tools, and gizmos live in PlanViewport.                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-04 | Design Workbench Architecture    | Active   | Nine foundational contracts govern the read/edit split (single-source intent, three-phase drag, plan-projection math, typed selection, isolated tool state machines, snap-as-a-service, gizmos+overlays Plan-only, mm everywhere, 3D is read-only).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-21 | Design Workbench Testing         | Superseded | Historical ModelSpaceViewport fixture rot; the retired viewport/test no longer exists, and Plan render coverage now lives in `PlanViewport` plus the plan render graph.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-05-21 | Design Workbench Testing         | Superseded | Historical ModelSpaceViewport import-guard drift; the retired rail guard no longer exists, and the live boundary is `apps/portal/lib/workbenchBreakawayImportGuards.test.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Quotes/Invoices/Job Packs        | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-01 | Docs                             | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-01 | Docs                             | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-01 | Docs                             | Promoted | Distinguish current-state references from active operating rules.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-06 | Decomposition / Refactor Hygiene | Promoted | Extracting helpers during a decomposition refactor must be byte-for-byte; rewriting "while I'm there" introduces subtle behavioural drift that escapes typecheck.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-08 | PlanViewport / Pointer Events    | Promoted | Pointer-driven tools require `touch-action: none`, `setPointerCapture` on primary-button down, `pointerCancel` -> `cancelActiveTool` (not `pointerUp`), and a pure dispatch helper that NEVER invents coords on null.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-08 | Debugging Hygiene                | Active   | When live-runtime symptoms don't match any of the current hypotheses, instrument the boundary with logs before iterating fixes; root-cause from real data, not theory chains.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-08 | House Roof Topology              | Active   | "Click hip triangle to open as gable" needs a Dutch-hip / half-hip topology in the geometry pipeline -- hipped + `openGableEndIds` is currently a no-op (gated to gable form). Multi-session work: rectangle Dutch-hip first, joined Dutch-hip second, UI third.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-12 | 3D Wall Rendering                | Active   | Wall solids must consume `renderMesh` (not just `boundary`); miter footprints offset inward-only `(0, -thickness)`, not centered `(±half, ±half)`; non-flat-top walls extrude polygonally via `buildPolygonalWallRenderMesh`; open-gable migrated-from-hipped boundaries reshape only when `wallBoundaryHasFlatTop` is true.                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-12 | 3D Viewport Navigation           | Active   | OrbitControls `mouseButtons.LEFT` must branch on `lockedViewPreset === 'top'` (pan in Plan, rotate in 3D). Trackpad users have no MIDDLE button, so rotate-on-LEFT is the only navigable default.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-12 | Open-Gable Roof Frames           | Active   | Triangular gable walls have a 1-point top profile (apex only); the frame-feature gate must be `topProfile.length < 1`, not `< 2`, or the gable-end posts/top-chord disappear.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-13 | Plan Rendering                   | Active   | Superseded by PR-2B.1b.3i/3l: visual house dedupe now lives in the Plan render graph's explicit committed-body visual stack, while `house_reference:*` stays in hit targets. Sheet still applies its own render-only suppression.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-13 | Pergola Snap Targets             | Active   | `HouseModel3D.roofEaves` must include EVERY attachable perimeter edge (drain + weather-flashed gable + apron), not just `drain_eave`. Opening a Dutch-hip end strips the adjacent roof plane and reclassifies the eave as `weather_flashed_edge` -- the user still expects to snap a pergola there. Downstream gutter/flashing consumers re-filter on `edgeKind`.                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-13 | Plan Tool Chain                  | Active   | `EdgeDragTool.onPointerDown` runs a distance-based priority: terminal-end toggle target (`event.shape?.metadata?.openGableEndId`) ONLY falls through to SelectTool when the click is outside `edgeHitToleranceMm` of the active outline. Clicks on the synthetic's eave-corner overhang that overlap a wall edge start an edge drag instead, restoring wall interaction under the synthetic. Default tolerance is 250 mm (was 500).                                                                                                                                                                                                                                                                                  |
| 2026-05-13 | House Roof Topology              | Active   | The geometry normalize migration treats `roofIntent.form: 'gable'` as "hipped + every terminal end open" regardless of `openGableEndIds`. Any terminal-end toggle that operates on the workbench state must port the migration into explicit `form: 'hipped' + openGableEndIds: <all terminals minus the toggled one>` in the SAME commit, or `[].filter(...)` produces a no-op and normalize re-migrates on the next solve. Helper: `resolveHouseTerminalEndToggleRoofDraft`.                                                                                                                                                                                                                                       |
| 2026-05-14 | Plan Snap Engine                 | Active   | `resolveMoveSnap` resolves a corner snap after the primary: if a second target on a different polygon edge whose direction is at least `cornerMinAngleDeg` (default 30 deg) from the primary's lies within tolerance, it solves the 2x2 system `[primary_normal; secondary_normal] . delta = [ps; ss]` so the moving polygon's corner lands on the two target lines' intersection. `MoveSnapResult.secondary` + `cornerVertex` are optional; single-line consumers are unaffected. EdgeDragTool stays single-line (1D motion).                                                                                                                                                                                       |
| 2026-05-14 | House Roof Topology              | Active   | Milestone 13 session C: `'gable'` is retired from the `HouseRoofForm` type union (`'flat' \| 'mono' \| 'hipped'`). `resolveHouseRoofForm` (geometry normalize) and `normalizeHouseFormRoofIntent` (workbench draft normalize) BOTH map legacy `'gable'` string input to `'hipped'` so storage can still carry it but no typed surface accepts it. Picker, validators, dispatchers, and inspector derivations are simplified accordingly. Known regression: legacy gable-form houses in preset mode (no explicit polygon at normalize time) load as `'hipped'` with empty `openGableEndIds`; the user re-opens ends from the rail or Plan canvas.                                                                     |
| 2026-05-14 | House Roof Topology              | Active   | Partial-open clicks on joined footprints (U / wrap with one terminal end opened) require TWO wavefront facet-validator relaxations: (1) `allowRaisedBoundaryPoints: true` -- the slope adjacent to a stationary gable edge legitimately reaches the eave at apex z, not eave z (the gable wall fills the height gap); (2) the `face_count_mismatch` check subtracts the stationary edge count from the expected facet count because stationary edges intentionally produce zero slope facets. Without these, clicking ONE terminal end on a U produced `roof_topology_face_count_mismatch:5:8` and the geometry rendered as invalid. Fully-hipped (no stationary edges) and bent-spine all-open paths are unchanged. |
| 2026-06-11 | Workbench House Forms | Active | Eave-offset recovery lives in `@sp/geometry`; fully hipped custom orthogonal roofs try `orthogonal_cell_union` at the requested overhang before any reduced-overhang/narrow-return repair, and commit the exact boundary only when downstream roof QA passes -- no Plan/first-house/active-module fallbacks. |
| 2026-06-11 | Workbench House Forms | Active | Fully hipped custom roofs try `source_edge_exact_envelope_partition` first and expose `roofTopologyExactPartition*` metadata; committed geometry must still pass semantic and coverage QA, and failed exact-attempt metadata must not become the diagnostic code for a roof that committed valid geometry. |
| 2026-06-12 | Design Workbench | Active | Live workbench runtime roots must not import `@sp/costing`, expose `data-workbench-pricing*`, or reintroduce `activeModule`/`moduleLabel`/`legacy_plan_m`/`geometry_plan_fallback`; pricing/readiness stays on estimate/calculator/commercial paths. |
| 2026-06-12 | Design Workbench | Active | Live workbench roots use object/pergola artifact vocabulary: pergola render diagnostics keyed by `pergolaId`/`artifactId`, `WorkbenchSolvedModel` exposes no solved-module arrays, and no module selection/status names return. |
| 2026-06-12 | Design Workbench | Promoted | `design-workbench-architecture.md` is the current contract, `design-workbench-multi-object-goal.md` tracks milestones, and `design-workbench-legacy-cull.md` is archived history plus Gate 0 references only; do not use old PR history as a next-task list. |
| 2026-06-12 | Design Workbench | Promoted | `DrawingWorkbench` callers pass `projectArtifact` and `WorkbenchViewportHost` is the only place to unpack it; no loose project geometry/status prop arrays or reintroduced `WorkbenchSolvedModel` aliases. |
| 2026-06-12 | Design Workbench | Promoted | Live workbench code reads solved project geometry, plan layers, snap sources, and render diagnostics from `projectArtifact`; the breakaway guard forbids direct `solvedModel.*` alias reads. |
| 2026-06-12 | Design Workbench | Promoted | `buildWorkbenchSolvedModel` builds project house geometry, then project pergola render artifacts, then passes the same pergola artifact list into project render-pipeline and viewer scene composition; package geometry owns pergola solving via a neutral boundary. |
| 2026-06-19 | Workbench House Forms            | Active   | PR-COMP-UNIFIED-1: `composeRoofFromComposition` routes non-fused hipped composites (L, T, U, cross) to the existing `buildJoinedRectilinearHippedRoof` wavefront solver. Single coherent roof topology — one continuous ridge structure, valleys at reflex corners, hips at convex corners. `roofGeometry: "composition_unified"`, no `approximationReasons`. Falls back to stitched per-rectangle on `roofTopologyFailureReason` or zero-plane output. Mixed-intent / mono / flat composites still take the stitched path. |
| 2026-06-19 | Workbench House Forms            | Active   | PR-COMP-UNIFIED-2: status pipeline (`objectWorkbenchStatusModel.buildRoofStatus`) was running a parallel legacy `buildHouseModel3DFromRawHouseInput` against the (wrong) preset footprint, then surfacing its failures as the rail status. After this PR, the status pipeline mirrors the rendering pipeline: substitutes the composition union polygon, swaps the roof via `swapRoofFromComposition`, runs `applyRoofQa` on the composition's planes, strips stale legacy `roofTopology*`/`roofWavefront*`/`roofEaveOffset*` stamps from the merged metadata. The rail status now reflects what the composition pipeline actually produces — verified end-to-end via HR1 diagnostic capture. |
| 2026-06-19 | Workbench House Forms            | Active   | PR-SS-2 part 2: `computeOrthogonalStraightSkeleton` now handles reflex vertices via split events + vertex (coincidence) events + ridge finalization, so L/T/U/+ rectilinear footprints solve — not just rectangles. Exactness is preserved by an internal **2x coordinate space** (all event times/positions exact integers, guarded by `time_not_integral_in_2x`; output halves and rounds to the nearest mm — the single documented rounding step). Merged-vertex velocity bug from part 1 fixed (average the DYING endpoints, not the survivors), which also completes non-square rectangle ridges. **Scope: skeleton primitive only — nothing is wired into `composeRoofFromComposition` yet (that is PR-SS-3 translator / PR-SS-4 orchestrator swap), so the regression matrix stays quarantined unchanged.** Known limitation: perfectly symmetric N-way simultaneous ridge-line collapse (e.g. centred-stem T with bar = 2x ridge offset) returns a typed `unsupported_topology` (graceful fallback), not wrong geometry — pinned by a test; real designer composites are not perfectly symmetric. The HR1/Playwright/visual-3D verification gate is assigned to PR-SS-4 (where the skeleton enters the render path); part 2's artifact is the expanded `solve.test.ts` + eave-coverage topology bridge. |
| 2026-06-20 | Workbench House Forms            | Active   | PR-SS-3: roof translator `buildSkeletonRoof` (`packages/geometry/src/house/roofSkeleton.ts`) turns the straight-skeleton graph into `RoofPlane3D[]` + ridge/hip/valley features at a pitch + eave height. Node height = `eaveHeightMm + node.time × tan(pitch)`. Facets are built by **angular planar-subdivision traversal (DCEL-style), using only graph geometry — NOT the skeleton's left/right edge labels** — so it is robust at convergences where a clean label partition is hard to keep. A **correctness self-guard** verifies facets partition the footprint (plan areas sum to footprint area) and returns a typed error instead of silently-wrong geometry. Scope: fully hipped (one slope facet per eave); no open-gable caps, cladding, QA call, or wiring (PR-SS-4). **Surfaced a real SS-2 gap: the 4-way central convergence of `+` / `H` is unresolved (arm ridges dangle, facets overlap) — caught by the area guard, returns typed error. Root cause is the split/coincidence merged-vertex velocity (`cornerVelocity` solves L/T/U but breaks the plus centre). This is now a prerequisite (PR-SS-2 part 3) BEFORE PR-SS-4 can unquarantine the +/H fixtures.** Rect/L/T/U solve cleanly. Verified: roofSkeleton 6 + straightSkeleton 22 green, geometry typecheck clean. |


## Entries

### 2026-06-02 - Portal Test Auth - Explicit Test User Provisioning

Area: Portal Test Auth

Status: Active

Decision or mistake: authenticated browser gates need a reliable staff account, but service-role-backed user creation is a mutation and must not happen implicitly inside routine test commands.

Why it mattered: implicit provisioning could mutate staging unexpectedly, hide credential problems, or make production safety depend on convention instead of a hard command gate.

Current guardrail: use `npm run portal:test-user:ensure` or `npm run portal:agent-access:provision` only with `PORTAL_TEST_PROVISION_TARGET=local|staging`. The provisioning script must refuse missing targets and `production`, must not log passwords or service-role keys, and normal browser gates must only consume credentials/auth state.

Promoted to: None

Related docs/tests: `scripts/ensure-portal-test-user.ts`, `scripts/ensure-portal-test-user.test.ts`, `playwright/support/portalAgent.ts`, `playwright/portal.agent-access.spec.ts`, `docs/testing-and-qa.md`, `docs/environment-auth-supabase.md`.

### 2026-06-02 - Portal Browser Coverage - Route Catalog Ownership

Area: Portal Browser Coverage

Status: Active

Decision or mistake: authenticated portal browser coverage should not grow through scattered hardcoded route lists in unrelated specs.

Why it mattered: agents need to know which routes exist, which role or seeded data they require, and which owner doc explains them. Hardcoded smoke lists make coverage drift harder to see and make dynamic/data-dependent routes look accidentally untested instead of intentionally scenario-gated.

Current guardrail: portal route coverage is catalog-driven through `playwright/support/portalRouteCatalog.ts`, with status mirrored in `docs/portal-route-catalog.md`. Browser specs consume catalog subsets such as `agentAccessSmokeRoutes`; dynamic routes remain `scenario-required` until seeded scenarios exist.

Promoted to: None

Related docs/tests: `playwright/support/portalRouteCatalog.ts`, `playwright/support/portalRouteCatalog.test.ts`, `playwright/portal.agent-access.spec.ts`, `docs/portal-route-catalog.md`, `docs/testing-and-qa.md`.

### 2026-06-02 - Portal Browser Coverage - Explicit Seeded Scenario Registry

Area: Portal Browser Coverage

Status: Active

Decision or mistake: dynamic portal route smoke needs deterministic project, estimate, quote, and workbench data, but data seeding is a mutation and must stay separate from routine browser gates.

Why it mattered: without seeded scenarios, agents could only open static staff pages or depend on whatever data happened to exist. If scenario provisioning were implicit, browser checks could mutate local or staging unexpectedly and make failures harder to reproduce.

Current guardrail: seeded portal scenarios live in `playwright/support/portalScenarioRegistry.ts` and are provisioned only by `npm run portal:scenarios:ensure` or the opt-in combined `npm run portal:agent-scenarios:provision`. Provisioning must require `PORTAL_TEST_SCENARIO_TARGET=local|staging`, refuse `production`, never log service-role keys or passwords, and write only non-secret route state to `playwright/.auth/portal-scenarios.json`. `npm run portal:agent-scenarios` reads that state only.

Promoted to: None

Related docs/tests: `scripts/ensure-portal-scenarios.ts`, `scripts/ensure-portal-scenarios.test.ts`, `playwright/support/portalScenarioRegistry.ts`, `playwright/portal.agent-scenarios.spec.ts`, `docs/testing-and-qa.md`, `docs/portal-route-catalog.md`.

### 2026-06-02 - Portal Browser Evidence - Shared Evidence Lane

Area: Portal Browser Evidence

Status: Active

Decision or mistake: browser specs were starting to grow local copies of console, network, screenshot, debug-export, and workbench viewport evidence capture.

Why it mattered: ad hoc evidence listeners drift quickly and make failures harder for agents to compare across auth, scenario, fixture, and route-catalog lanes. Browser failures should attach consistent artifacts without weakening auth or logging secrets.

Current guardrail: use `playwright/support/portalBrowserEvidence.ts` for portal browser evidence and `playwright/support/workbenchEvidence.ts` for Plan/3D viewport diagnostics. Specs should not add local evidence listeners or screenshots unless the shared helper cannot express the needed artifact; if that happens, extend the helper first. Shared screenshot capture keeps `caret: 'initial'`: Playwright's default caret masking mutates input styles and can create a false hydration mismatch when a capture is followed immediately by navigation.

Promoted to: None

Related docs/tests: `playwright/support/portalBrowserEvidence.ts`, `playwright/support/workbenchEvidence.ts`, `playwright/portal.contacts-ui.spec.ts`, `playwright/portal.agent-access.spec.ts`, `playwright/portal.agent-scenarios.spec.ts`, `playwright/portal.auth-runtime.spec.ts`, `docs/testing-and-qa.md`.

### 2026-06-01 - Workbench Geometry - Roof Solver Stage Diagnostics

Area: Workbench Geometry

Status: Active

Decision or mistake: repeated Plan/3D fallback patches did not fix the remaining house-form failure because the failing live state was not captured and the package roof path only exposed coarse render-health stages.

Why it mattered: without package-level stages, a missing roof body could be misread as Plan paint order, selection chrome, first-house fallback, or 3D scene composition. That led to useful cleanup, but not a direct fix for the live house geometry failure.

Current guardrail: house roof failures must cross an object-id-addressed geometry input boundary and report stage diagnostics before Plan/3D render behavior changes. Capture the live failing workbench payload through the gated debug fixture export before changing solver behavior for a screenshot-only repro.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseRoofDiagnostics.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`, `apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts`, `apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchDebugExportButton.tsx`, `playwright/support/workbenchFixture.ts`.

### 2026-06-01 - Workbench Geometry - House Model Stage Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: house solver fixes should not start inside Plan, 3D, or portal render classification. The package must first expose the raw-house-to-model boundary and named roof-stage statuses so a captured repro can fail at a specific stage.

Why it mattered: `buildHouseModel3DFromRawHouseInput` previously built its compatibility `GeometryConfig` inline, which made it hard to tell whether a bad house failed during raw input adaptation, footprint/eave setup, roof topology, QA, or later projection. Portal code also duplicated empty roof-stage defaults, increasing drift risk.

Current guardrail: keep `buildHouseModel3DFromRawHouseInput` stable, but route it through `buildHouseModel3DGeometryConfigInputFromRawHouseInput`. Portal house geometry/render pipelines should consume package-owned roof-stage helpers (`EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS`, `pickHouseRoofStageDiagnostics`, `firstHouseRoofStageDiagnosticCode`) instead of inventing their own stage defaults.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseModel.ts`, `packages/geometry/src/houseRoofDiagnostics.ts`, `packages/geometry/src/houseModelStageDiagnostics.test.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`, `apps/portal/lib/drawings/state/projectHouseRenderPipeline.ts`.

### 2026-06-02 - Workbench Geometry - Roof Pipeline Stage Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: portal render-health stages and package roof solver stages are related but not equivalent. Portal code should not infer footprint/eave/topology/QA failures from Plan or 3D output counts.

Why it mattered: repeated render-layer cleanup made the workbench more object-owned, but the visible house bug persisted because the exact failing solver boundary was still implicit. The package now owns a typed `buildHouseRoofModelPipeline` result so the debug export can name the roof-pipeline stage independently from coarse Plan/3D render health.

Current guardrail: keep `buildHouseModel3DFromRawHouseInput` compatible, but expose roof pipeline diagnostics from `packages/geometry/src/house/`. Do not change solver behavior for screenshot-only failures; bake the copied live debug fixture first, then fix the first failing package stage.

Promoted to: None

Related docs/tests: `packages/geometry/src/house/roofModelPipeline.ts`, `packages/geometry/src/house/roofModelPipeline.test.ts`, `packages/geometry/src/houseModelStageDiagnostics.test.ts`, `apps/portal/lib/drawings/state/houseFormGeometryInput.ts`.

### 2026-05-30 - Portal Shell - Pinned Sidebar Flow

Area: Portal Shell

Status: Active

Decision or mistake: pinned sidebar icons and labels were rendered as two separate fixed vertical lists. Expanding a label submenu pushed only the label list down, so later icons no longer lined up with their labels.

Why it mattered: the sidebar looked like icons belonged to the wrong navigation item, which makes routine staff navigation error-prone and undermines the compact rail/label design.

Current guardrail: expandable pinned navigation must render each top-level icon, label, chevron, and submenu in a single parent flow group. Rail-only routes can keep an icon-only rail, but pinned mode must not stack an independent icon list beside an expandable label list.

Promoted to: None

Related docs/tests: `apps/portal/components/navigation/PortalSidebarPanel.test.tsx`, `apps/portal/components/layout/PortalShell.test.tsx`, `npm run test:portal:shell`.

### 2026-05-31 - Plan Rendering - House-Form Overlay Ownership

Area: Plan Rendering

Status: Active

Decision or mistake: object workbench status still exposed one `houseForm` status derived from the first house form, while Plan could paint both raw roof-solid and roof-material bodies for the same house form.

Why it mattered: selecting House 2 could show House 1's preset/status in rail or inspector surfaces, and duplicate visible roof bodies made the Plan overlay look like house forms were connected or competing.

Current guardrail: house-form status, rail rows, inspector state, selection overlays, hit targets, and visible body precedence must resolve by `houseFormId`. `house_roof_material:<houseFormId>` is the preferred visible roof body when present; raw same-form roof solids and canonical references stay out of the visible body layer except as explicit fallback.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`.

### 2026-05-31 - Plan Rendering - Project Visual Stack Ownership

Area: Plan Rendering

Status: Active

Decision or mistake: project Plan committed bodies still inherited raw top-projection array/z-order after the projection became object-owned. Pergola bodies have higher package-level geometry z-order than house roofs, so attached pergola panels could paint over the house/eave plan body even when there was no selection overlay.

Why it mattered: top-projection z-order describes geometry/object detail depth, not the SVG drawing contract for the project Plan editor. Letting it drive the final paint stack made project-level rendering look like objects were visually fused or selected when only their projected footprints overlapped.

Current guardrail: Plan SVG paint order is owned by the Plan view model. The render graph returns already-filtered and semantically sorted committed bodies: pergola visual bodies below house roof/roof-material bodies, canonical house references in hit/selection layers unless promoted as no-roof fallbacks, and detail/selection chrome in separate layers.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-31 - Plan Rendering - Invisible Hit Targets

Area: Plan Rendering

Status: Active

Decision or mistake: Plan hit targets stayed visually coupled to hover styling after visible bodies and hit targets were split. Because hit targets sit above committed bodies for pointer routing, the CSS `:hover` fill on canonical `house_reference:*` polygons could still paint a blue footprint over the house roof/pergola stack.

Why it mattered: event geometry is often larger or more canonical than the visible body it controls. Letting it paint hover/body visuals reintroduced the same overlay bug through a different layer.

Current guardrail: Plan hit targets are event-only. They may carry pointer handlers and diagnostics, but hover feedback must render through explicit chrome layers with outline-only styling, and the active selection suppresses duplicate hover chrome.

Promoted to: None

Related docs/tests: `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas2D.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/usePlanRenderModel.test.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-31 - Plan Rendering - Reference Fallback Provenance

Area: Plan Rendering

Status: Active

Decision or mistake: no-roof `house_reference:*` fallbacks could be promoted into the committed body layer without diagnostics and still use filled footprint styling. That made missing roof-material/roof bodies look like a generic overlay problem instead of an explicit fallback for one house form.

Why it mattered: Plan fallbacks are useful for inspectability, but they are not real house roof bodies. They need to expose their owning `houseFormId` and render as reference outlines so they do not visually compete with project roof/pergola geometry.

Current guardrail: Plan render diagnostics report per-house reference ids, roof/roof-material body ids, hit targets, and visible reference fallbacks. `house_reference:*` fallbacks may render only as transparent outline geometry; filled committed house bodies must come from roof or roof-material projection shapes.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/views/plan/planRenderDiagnostics.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `playwright/portal.workbench-fixture.spec.ts`.

### 2026-05-30 - Plan Rendering - House Form Plan Body Identity

Area: Plan Rendering

Status: Active

Decision or mistake: house-form plan rendering could borrow the active pergola module's host-house projection when the selected house form was different.

Why it mattered: multi-house plan views need stable visual and hit-target identity per house form. Borrowing the active module's host projection makes the wrong house look selected and can dedupe visible bodies globally instead of by form.

Current guardrail: resolve house-form plan bodies through the canonical `house_reference:<formId>` entry from `projectHouseGeometries`. Visible-body dedupe is scoped by house form id, not treated as one global house outline.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`.

### 2026-05-30 - Plan Rendering - Project Projection Source

Area: Plan Rendering

Status: Active

Decision or mistake: object-workbench Plan rendering still used the active module's `topProjection` as its base, then merged project-level references and pergola bodies on top.

Why it mattered: switching active pergolas changed which house form contributed detailed roof/body shapes. The Plan surface looked like houses were connected even though project-level house references were stable.

Current guardrail: object-workbench Plan surfaces must render from `WorkbenchSolvedModel.projectPlanProjection`, built from project-level house geometry and project pergola plan bodies. Active selection may change halos, dimensions, snap exclusions, and inspector state; it must not change which project objects exist in the Plan render source.

Promoted to: None

Related docs/tests: `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `packages/geometry/src/topProjection.test.ts`.

### 2026-05-30 - Workbench Rendering - Stable Project View Basis

Area: Workbench Rendering

Status: Active

Decision or mistake: selecting an invalid transient pergola could make Plan lose its projection basis and could leave 3D with a selected id that did not exist in the aggregated scene.

Why it mattered: object selection and project rendering were still coupled to the active module's artifact, so one invalid object could blank or crash an otherwise valid multi-object project view.

Current guardrail: Plan and 3D should use a stable project basis derived from the active ready module, or the first ready module when the active selection is invalid. Invalid/unsupported objects remain selectable as reference/context outlines; do not invent solved bodies for them.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `docs/design-workbench-architecture.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `apps/portal/components/drawings/viewports/selection/selectionRouter.test.ts`, `apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts`.

### 2026-05-29 - 3D Rendering - Project-Wide Pergola Scene Bodies

Area: 3D Rendering

Status: Active

Decision or mistake: multi-pergola 3D Review still showed only the active pergola after Plan Editor had moved to project-wide solved bodies.

Why it mattered: active-only 3D made the workbench look unresolved and encouraged another active-module-only presentation path, splitting Plan and 3D identity.

Current guardrail: 3D Review must consume a project-wide solved preview for valid pergolas. Prefix aggregated scene object ids by `pergolaId`, preserve `metadata.pergolaId`, and route selection by that id; direct manipulation remains Plan-only.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `apps/portal/components/drawings/viewports/selection/selectionRouter.test.ts`, `apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts`.

### 2026-05-30 - Workbench Geometry - Project Solve Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: workbench state now builds an explicit persisted + transient pergola solve-source list and routes eligible host-house groups through `@sp/geometry solveProject` before rehydrating the existing `WorkbenchSolvedModule` contract.

Why it mattered: repeated portal-side per-module normalize/solve branches made it too easy for future multi-object work to keep treating each pergola as its own project. The package-level boundary is now the normal workbench entry point for object-first host groups, while legacy/no-object-first sources remain named fallback.

Current guardrail: new workbench geometry solve work should extend the project solve-source boundary, not add another caller-specific per-module solve path in `workbenchSolvedModel.ts`. `RawGeometryModuleInput.houseContext` still exists as compatibility data and remains the next deletion/shrink target.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `docs/design-workbench-architecture.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `packages/geometry/src/solveProject.test.ts`.

### 2026-05-29 - Plan Rendering - Project-Wide Pergola Bodies

Area: Plan Rendering

Status: Active

Decision or mistake: multi-pergola Plan Editor rendering had reached solved-object selection, but full detail still came from the active module while other pergolas appeared only as faded reference boxes.

Why it mattered: active-only plan bodies made the workbench look like only one pergola was resolved, and it encouraged callers to keep adding active-module branches instead of aggregating solved objects by id.

Current guardrail: Plan rendering must aggregate valid pergola plan bodies by `pergolaId` from the solved model. Reference/context outlines are fallback and snap inputs, not the normal visual body for valid solved pergolas.

Promoted to: None

Related docs/tests: `docs/design-workbench-multi-object-goal.md`, `apps/portal/lib/drawings/state/workbenchSolvedModel.ts`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`.

### 2026-05-03 - Design Workbench Geometry - Single Solved Geometry Spine

Area: Design Workbench Geometry

Status: Promoted

Decision or mistake: plan, 3D, sheet, object overlays, snap frames, and commit/rebuild paths were allowed to carry separate geometry models that each looked locally valid.

Why it mattered: Model Space could be visually accurate to 3D while deck dragging or sheet output still jumped or drifted because another view-specific geometry quietly acted as truth.

Current guardrail: object-first design intent resolves into one solved physical geometry artifact. Plan, 3D, sheet, section, wall/detail lines, snap frames, dimensions, hit targets, and interaction previews are derived views of that artifact. Calculator-era plan models, semantic house context, legacy sheet geometry, and object-workbench overlay polygons are fallback/reference/edit-support only unless explicitly derived from the solved geometry spine.

Promoted to: `docs/target-architecture.md`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`, `docs/parallel-work-guardrails.md`.

Related docs/tests: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`, `docs/parallel-work-guardrails.md`, `npm run test:portal:workbench`, `npm run test:portal:browser`.

### 2026-05-01 - Design Workbench Architecture - Contract First Split

Area: Design Workbench Architecture

Status: Promoted

Decision or mistake: Model Space rendering, coordinate transforms, pointer lifecycles, preview state, and commit conversion had accumulated inside large React components, making plan/3D coordinate bugs difficult to isolate.

Why it mattered: deck movement could pass narrow visual or DOM tests while still crossing renderer, projection, object, and commit spaces in different files.

Current guardrail: split the workbench by contracts first. Plan coordinate transforms belong in `PlanCoordinateAdapter`, top-projection visual ownership belongs in the plan render graph, and interaction tools/commit adapters should consume those contracts instead of duplicating math in presenters.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/views/plan/planCoordinateAdapter.test.ts`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`.

### 2026-05-01 - Deck Interaction - Projection To Object Commit Frame

Area: Deck Interaction

Status: Promoted

Decision or mistake: floating projection-backed releases persisted raw top-projection preview coordinates into `floatingRect`, while the object rebuild interpreted those fields as object/local deck coordinates.

Why it mattered: the deck could preview in the right place, then rebuild far away or on the wrong side because the saved coordinates crossed the render/object boundary unconverted.

Current guardrail: projection-backed deck releases must map the rendered preview polygon through a matched render-frame to object-frame transform before writing snapped offsets, custom outlines, or floating rects. If no object commit frame can be matched, fail the release with diagnostics instead of saving raw projection coordinates. Legacy non-projection fallback may keep direct plan-space behavior.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: historical retired deck interaction adapter coverage and retired ModelSpace viewport coverage; current Plan-path coverage lives in [apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts), [apps/portal/lib/drawings/commits/commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts), and [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts).

### 2026-05-03 - Deck Interaction - No Commit-Start Bounds For Projection Releases

Area: Deck Interaction

Status: Active

Decision or mistake: projection-backed floating releases still had a bounds-based `commitStartPolygon` remap path available before the render-frame to object-frame transform.

Why it mattered: `commitStartPolygon` can come from stale object-workbench or legacy overlay geometry. Using its bounds lets a visually correct top-projection preview rebuild through old coordinates and jump on release.

Current guardrail: projection-backed releases must map through matched render/object frames only. `commitStartPolygon` is legacy/fallback or diagnostic geometry and must not override top-projection frame mapping for floating or snapped projection commits.

Promoted to: None

Related docs/tests: historical retired deck commit adapter coverage and retired ModelSpace viewport coverage; current Plan commit coverage lives in [apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts), [apps/portal/lib/drawings/commits/commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts), and [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts).

### 2026-05-04 - Plan Rendering - Unified Scene Graph Top Viewport

Area: Plan Rendering

Status: Active

Decision or mistake: an SVG-based `ProjectionTopViewport` stack (`ProjectionTopViewport.tsx`, `ProjectionTopSvg.tsx`, `ProjectionTopLayers.tsx`, `ProjectionTopHitTargets.tsx`, `ProjectionTopDimensions.tsx`, `ProjectionTopInteractionAdapter.ts`) was running as a parallel renderer for geometry-ready Model Space Plan, reading `topProjection` and producing its own SVG body/hit-target tree alongside the R3F 3D viewport.

Why it mattered: it violated the Rhino-like north star (one scene graph, multiple cameras). Two renderers reading the same artifact via different code paths drift; selection, dimensions, and interaction logic had to be re-implemented per surface.

Current guardrail: geometry-ready Model Space Plan renders through `Geometry3DViewport` with `lockedViewPreset="top"` (orthographic top camera, rotation locked, right-drag pan, wheel zoom). Selection comes from the shared scene's R3F raycaster. The SVG ProjectionTop stack is deleted; `topProjection` remains only for Sheet drawings and parity diagnostics. Future Front/Right/Section viewports should follow the same pattern: same scene graph, different `lockedViewPreset`.

Promoted to: None

Related docs/tests: `apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx`, retired Model Space viewport history, `apps/portal/lib/workbenchBreakawayImportGuards.test.ts`.

### 2026-05-04 - Deck Interaction - Projection Drag Anchor And Commit Offset Parity

Area: Deck Interaction

Status: Active

Decision or mistake: projection-backed deck drag normalized the grabbed point to the deck center when the pointer resolver landed outside the committed polygon, but preview deltas and snapped commit offsets could still use the raw pointer or render-frame center offset.

Why it mattered: a screen-right drag could feel like it moved through the wrong frame, and a side-wall snap could settle with a projection/object-frame offset instead of the released preview.

Current guardrail: projection-backed drag sessions must use one normalized start anchor for grabbed-point and delta math, preserving raw resolver points only as diagnostics. Snapped commits must map center offsets through the matched render/object frames before persistence, and settle matching may allow only narrow top-projection visual jitter while still rejecting larger rebuilt-geometry drift.

Promoted to: None

Related docs/tests: historical retired deck interaction/commit adapter coverage, retired ModelSpace viewport coverage, and retired deck release settlement coverage; current Plan tool-chain coverage lives in [apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts), and [apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts).

### 2026-05-01 - Deck Interaction - Projection-Native Drag Session

Area: Deck Interaction

Status: Promoted

Decision or mistake: projection-backed deck drag mixed top-projection pointer coordinates with overlay objects whose interaction fields could be SVG-projected for rendering or derived from older object-workbench geometry.

Why it mattered: every drag could feel like it moved through an old coordinate system before the commit/rebuild tried to land in the real 3D/top-projection position.

Current guardrail: geometry-ready deck drag sessions use committed top-projection polygons, centers, grabbed points, hit targets, and preview polygons for live plan-space math. SVG-only interaction data is display-only, legacy/object polygons are fallback or commit-boundary data only, and projection-backed drags must not fall back to the raw legacy plan resolver.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: retired deck interaction adapter coverage, retired ModelSpace viewport coverage, and `apps/portal/app/staff/calculator/ModuleViewsCard.tsx`.

### 2026-05-01 - Deck Interaction - Floating Release Legality

Area: Deck Interaction

Status: Promoted

Decision or mistake: floating deck release reused snapped release remapping and strict top-projection settle failure behavior.

Why it mattered: dragging a deck away from the house could commit successfully, then show a blocking failure because the top-projection deck body was late or did not match the released preview before the settle deadline.

Current guardrail: a floating release persists the released projected preview as an absolute `floatingRect`. Wall/snap frames remain witness metadata only. If a floating commit succeeds, stale top-projection geometry may be reported with projection-settle diagnostics, but it must not become a user-facing failed move. Snapped releases remain strict.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: historical retired deck interaction adapter coverage and retired ModelSpace viewport coverage; current Plan viewport coverage lives in [apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.roundtrip.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts), and [apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.test.ts).

### 2026-05-01 - Plan Detail - Scene-Backed Wall Edges

Area: Plan Detail

Status: Promoted

Decision or mistake: After Model Space became projection-only, plan detail still needed to return without reintroducing legacy/reference overlays or using roof outlines as deck host edges.

Why it mattered: users need accurate wall edges for snapping and readable plans, but detail must remain tied to the same 3D scene as the top-view bodies.

Current guardrail: solved house wall segments emit `house_line:wall_segment` scene objects. Top projection renders them as context detail with `planDetailRole: wall_edge` and `snapRole: deck_host_edge`; they do not drive extents or committed body counts. Projection-backed deck snapping should prefer these wall-edge frames, with committed body frames only as fallback.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `packages/geometry/src/viewer.test.ts`, `packages/geometry/src/topProjection.test.ts`, `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`.

### 2026-05-01 - Plan Rendering - Model Space Hard Projection Cut

Area: Plan Rendering

Status: Promoted

Decision or mistake: Model Space still executed legacy/context/object-workbench branches after top projection rendered, so selection or edit state could leak mirrored house/deck/opening geometry back onto the plan.

Why it mattered: users could still see multiple plan truths at once even after projection-first rendering landed.

Current guardrail: geometry-ready Model Space must take the `top_projection_only` branch. Normal visible bodies come only from top-projection committed bodies, while legacy pergola geometry, semantic house context, reference footprints, model primary dimensions, fall labels, context shapes, and opening drag overlays stay out of normal Model Space rendering. Projection-backed selection and hit targets must come from `top_projection_committed`.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Plan Rendering - Overlay Source Ownership

Area: Plan Rendering

Status: Promoted

Decision or mistake: object-workbench overlays could still use the top-projection `house_reference` footprint or geometry-plan fallback polygon as the visible selection/hit body while the committed plan body came from the 3D top projection.

Why it mattered: normal Model Space could show a mirrored second house/deck plan even when committed body rendering was projection-first.

Current guardrail: projection-backed selection outlines and hit targets must bind to `top_projection_committed` polygons. Context/reference/fallback polygons may drive host/reference math, explicit footprint editing, or diagnostics, but their visible normal overlay counts must stay `0`.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Plan Rendering - Layer Ownership And Drag Round Trip

Area: Plan Rendering

Status: Promoted

Decision or mistake: geometry-ready plan mode still allowed top projection, object-workbench overlays, selection state, preview state, and commit rebuild geometry to draw or persist bodies through different coordinate contracts.

Why it mattered: selected decks could reintroduce a second house/deck body, and deck release could jump because the preview and persisted commit were not compared in the same canonical object plan space.

Current guardrail: geometry-ready normal visuals must flow through the plan render graph and only draw filled/stroked bodies from `committedBodies`. Selection may add transparent hit targets, outlines, handles, dimensions, and previews only. Deck drag preview, release commit payload, and rebuilt settled geometry must round-trip through canonical object plan metres, with projection-backed settle failures surfaced instead of silently snapping.

Promoted to: `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, retired ModelSpace/deck interaction adapter coverage, `docs/design-workbench-architecture.md`, `docs/costing-and-geometry.md`.

### 2026-05-01 - Deck Interaction - Projection-Native Snap And Commit

Area: Deck Interaction

Status: Promoted

Decision or mistake: after Model Space became projection-only, deck drag still mixed top-projection live coordinates with geometry/object commit frames during snap and release.

Why it mattered: a deck preview could look correctly snapped in Model Space, then release to the opposite side or jump because the projected preview point was treated as an object-local commit point.

Current guardrail: geometry-ready deck drag uses committed top-projection frames for live hit, snap, and preview. Commit serialization maps the released preview through matching frame coordinates into canonical object plan metres; object/geometry frames are commit targets only, not live snap geometry.

Promoted to: `docs/design-workbench-architecture.md`.

Related docs/tests: `apps/portal/lib/drawings/views/plan/objectWorkbenchPlanOverlay.ts`, retired deck interaction adapter coverage, `docs/design-workbench-architecture.md`.

### 2026-05-01 - Agent Routing - Change Routing Map

Area: Agent Routing

Status: Promoted

Decision or mistake: agent docs had the right learning loop, but future agents still had to infer which paths mapped to which owner docs and when docs needed updates.

Why it mattered: ambiguity causes extra repo scans, wrong-layer edits, duplicate docs, and missed documentation updates after behavior changes.

Current guardrail: before non-trivial portal work, use `docs/change-routing.md` to map changed paths to owner docs, doc update triggers, common task cards, and docs bloat rules.

Promoted to: `docs/change-routing.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/change-routing.md`, `docs/testing-and-qa.md`, `npm run text:mojibake`.

### 2026-05-01 - Automation/Email/Audit - Side-Effect Owner Doc

Area: Automation/Email/Audit

Status: Promoted

Decision or mistake: automation events, email outbox, audit rows, project tasks, follow-ups, and marketing enquiry email behavior were visible in schema and code but did not have a focused owner doc.

Why it mattered: future side-effect changes can duplicate emails, miss idempotency keys, hide failures from staff, bypass audit records, or expand direct browser writes.

Current guardrail: before changing automation, email outbox, audit, follow-up, task, site-visit notification, or marketing enquiry email behavior, read `docs/automation-email-audit.md` and verify idempotency, outbox visibility, server-owned sends, and audit records.

Promoted to: `docs/automation-email-audit.md`, `docs/change-routing.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/automation-email-audit.md`, `docs/supabase-schema-map.md`, `docs/security-privacy-quality.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Supabase Schema - Ownership Map

Area: Supabase Schema

Status: Promoted

Decision or mistake: active tables and RPCs were spread across migrations, route helpers, server helpers, and feature docs without one ownership map.

Why it mattered: future schema changes can bypass workflow owners, add direct browser writes, skip RLS/grants, or mutate public-token and Schedule V2 tables through the wrong boundary.

Current guardrail: before changing tables, RPCs, migrations, RLS, grants, or route Supabase access, read `docs/supabase-schema-map.md` and verify the owner doc, primary write path, primary read path, access boundary, migration source, and focused verification path.

Promoted to: `docs/supabase-schema-map.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/supabase-schema-map.md`, `docs/environment-auth-supabase.md`, `docs/staff-api-auth-contracts.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - API/Auth - Route Contract Doc

Area: API/Auth

Status: Promoted

Decision or mistake: staff, admin, public-token, diagnostics, response, and Supabase client boundaries were spread across helper files and feature docs without one route contract reference.

Why it mattered: future API changes can accidentally use the wrong auth helper, bypass route ownership, expose service-role access, skip token-hash checks, or return inconsistent diagnostics and error shapes.

Current guardrail: before changing staff, admin, or public-token API routes, read `docs/staff-api-auth-contracts.md` and verify auth helper choice, Supabase client boundary, diagnostics, response shape, and side-effect owner.

Promoted to: `docs/staff-api-auth-contracts.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/staff-api-auth-contracts.md`, `docs/environment-auth-supabase.md`, `docs/quotes-invoices-job-packs.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Projects/Estimates - Core Workflow Doc

Area: Projects/Estimates

Status: Promoted

Decision or mistake: contacts, projects, calculator estimates, project snapshots, estimate locks, and local-first estimate mutations were spread across broad workflow, local-first, quote, and workbench docs without a dedicated current-state reference.

Why it mattered: future changes in this area can affect project detail state, pipeline tasks, estimate versioning, quote locks, local-first queues, design requests, quote creation, and downstream job-pack eligibility.

Current guardrail: before changing contacts, projects, project snapshots, calculator estimates, estimate locks, or local-first estimate mutation behavior, read `docs/projects-contacts-estimates-calculator.md` and verify the relevant route, domain, cache, and lock behavior.

Promoted to: `docs/projects-contacts-estimates-calculator.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/projects-contacts-estimates-calculator.md`, `docs/local-first-sync.md`, `docs/quotes-invoices-job-packs.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Docs/Testing - Canonical Command Source

Area: Docs/Testing

Status: Promoted

Decision or mistake: broad command lists were repeated across entrypoint and architecture docs, creating drift risk when scripts or verification expectations change.

Why it mattered: future agents need one trusted place for repo commands so docs stay current and task-specific docs can focus on ownership, risks, and focused verification gates.

Current guardrail: keep general repo commands, docs-only checks, browser commands, and operational commands in `docs/testing-and-qa.md`. Other docs should link there and only list focused commands when the area needs a specific gate.

Promoted to: `docs/testing-and-qa.md`, `AGENTS.md`, `README.md`, `docs/architecture.md`, `docs/agent-playbook.md`, `docs/README.md`.

Related docs/tests: `docs/testing-and-qa.md`, `rg -n "/User[s]/|my[-]site|create[-]next[-]app|costing[-]baseline|\\.env\\.example" README.md AGENTS.md docs`, `npm run text:mojibake`.

### 2026-05-01 - Parallel Work - Universal Guardrails

Area: Parallel Work

Status: Promoted

Decision or mistake: the workbench-specific guardrail was broadened into universal parallel-work guardrails for concurrent work across marketing, portal, shared packages, docs, and workbench migration lanes.

Why it mattered: simultaneous marketing and portal work can drift across shared customer flows, quote and invoice routes, analytics and consent behavior, package contracts, and portal source-of-truth boundaries even when files do not conflict.

Current guardrail: before parallel lanes or cross-app work, read `docs/parallel-work-guardrails.md`, declare lane ownership, keep source-of-truth boundaries explicit, make temporary bridges visible, and run the named focused and integration checks.

Promoted to: `docs/parallel-work-guardrails.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/parallel-work-guardrails.md`, `docs/platform-workflow.md`, `docs/testing-and-qa.md`, `npm run text:mojibake`.

### 2026-05-01 - Quotes/Invoices/Job Packs - Side-Effect Workflow Doc

Area: Quotes/Invoices/Job Packs

Status: Promoted

Decision or mistake: quote, invoice, public-token, PDF/email, and job-pack flows were identified as high-risk side-effect workflows without a dedicated canonical reference.

Why it mattered: future changes in these areas can affect public access, token security, generated files, email delivery, invoice retries, quote locks, project stages, and job-pack outputs.

Current guardrail: before changing these flows, read `docs/quotes-invoices-job-packs.md` and verify side effects, token boundaries, PDFs, emails, generated artifacts, and failure states.

Promoted to: `docs/quotes-invoices-job-packs.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: `docs/quotes-invoices-job-packs.md`, `docs/platform-workflow.md`, `docs/testing-and-qa.md`.

### 2026-05-01 - Geometry Top Projection - Top Surface Contract

Area: Geometry Top Projection

Status: Promoted

Decision or mistake: mesh-backed house solids in the top projection used to trust render-mesh vertex-ring order and later face normals, which could still select or render lower envelope geometry when the plan needed the same visible top view as the 3D Top camera.

Why it mattered: model-space plan could look aligned to a bottom-up view of the 3D model even while sharing the same scene instance.

Current guardrail: top projection must follow the 3D Top camera convention: the camera is above world `+Z`, screen X is world `-X`, and screen Y down is world `+Y`. Roof and deck solids use semantic top boundaries; other mesh-backed solids use the highest non-vertical projected surface without trusting winding; lower envelope geometry must carry `topProjectionRole: hidden_from_top` and be filtered from normal Model Space rendering. Plan/3D accuracy changes must keep the top-view parity helper and fixture browser gate green.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `docs/costing-and-geometry.md`, `packages/geometry/src/topProjection.test.ts`, `npm run test -- packages/geometry/src/topProjection.test.ts packages/geometry/src/contracts.test.ts`.

### 2026-05-01 - Plan Rendering - Single Projection Body Source

Area: Plan Rendering

Status: Promoted

Decision or mistake: geometry-ready Model Space could draw top-projection bodies and object-workbench committed bodies at the same time, while Sheet View could still render the legacy plan path without the solved projection.

Why it mattered: users saw two offset versions of the deck/house in Model Space and a Sheet View that did not match the 3D Top view.

Current guardrail: geometry-ready plan rendering must use top projection as the single committed visual body source in both Model Space and Sheet View. Object-workbench overlays may keep object identity attrs for hit targets, previews, handles, and dimensions, but duplicate visual body diagnostics must remain `0`.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, `apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts`.

### 2026-05-01 - Plan Rendering - Projection-Native Interaction Axes

Area: Plan Rendering

Status: Promoted

Decision or mistake: after switching plan visuals to top projection, context/reference projection bodies could still render like a second house/deck, and deck dragging used raw SVG plan coordinates instead of the inverse top-projection screen transform.

Why it mattered: users still saw doubled plan geometry and deck drag felt inverted: right moved left and up moved down relative to the rendered Model Space plan.

Current guardrail: geometry-ready normal plans render top-visible bodies only; context/reference bodies stay suppressed or non-body overlays, and deck drag point resolvers must invert the same `world_x_left_world_y_down` transform used to draw top projection.

Promoted to: `docs/costing-and-geometry.md`, `docs/design-workbench-architecture.md`, `docs/decision-log.md`.

Related docs/tests: `apps/portal/app/staff/calculator/ModuleViewsCard.test.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`.

### 2026-05-01 - Docs - Agent Playbook

Area: Docs

Status: Promoted

Decision or mistake: recurring portal work needs a procedural playbook, not only an index of current-state references.

Why it mattered: future agents need a repeatable work loop for discovery, source-of-truth checks, risk routing, verification, docs maintenance, and learning from past corrections without requiring the user to intervene each time.

Current guardrail: agents should read `docs/agent-playbook.md` for non-trivial portal work. New lessons go to `docs/decision-log.md` first; only durable, repeatable behaviors should be promoted into the playbook.

Promoted to: `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`.

Related docs/tests: `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, `docs/decision-log.md`.

### 2026-05-01 - Docs - Active Guardrail Docs

Area: Docs

Status: Promoted

Decision or mistake: `docs/design-workbench-parallel-migration-rules.md` was deleted during a docs cleanup even though it was still an active workbench migration authority.

Why it mattered: the cleanup treated all long historical-looking docs as stale, but this file carried live rules for parallel workbench migration safety.

Current guardrail: before deleting any doc, check whether it is a current reference, active guardrail, operational runbook, or historical artifact. Active guardrail docs must be restored or explicitly superseded by an equivalent canonical doc, with old paths preserved as redirects when future agents may search for them.

Promoted to: `docs/parallel-work-guardrails.md`, `docs/design-workbench-parallel-migration-rules.md`, `docs/agent-playbook.md`, `docs/README.md`, `AGENTS.md`.

Related docs/tests: historical predecessor `docs/design-workbench-parallel-migration-rules.md`, now superseded by `docs/parallel-work-guardrails.md`; `docs/README.md`; `AGENTS.md`.

### 2026-05-01 - Docs - Current References And Operating Rules

Area: Docs

Status: Promoted

Decision or mistake: the agent docs originally optimized for current-state references but did not clearly preserve active operating rules that guide ongoing migration work.

Why it mattered: future agents need both current architecture facts and procedural guardrails from past mistakes to work safely without repeated user intervention.

Current guardrail: docs may be either `Current` references or `Active guardrail` operating rules. `docs/README.md` must label them clearly, and agents should update relevant docs whenever implementation work changes behavior, boundaries, tests, or known risks.

Promoted to: `docs/README.md`, `AGENTS.md`, `docs/agent-playbook.md`.

Related docs/tests: `docs/README.md`, `AGENTS.md`, `docs/decision-log.md`.

### 2026-05-04 - Design Workbench Architecture - Read Edit Split: Plan Editor And 3D Viewer

Area: Design Workbench Architecture

Status: Active

Decision or mistake: the workbench had three viewport modes (`sheet`, `model`, `geometry3d`). The earlier plan was to collapse to a single canonical 3D editor where movement, gizmos, and tools all lived inside the R3F scene graph. That plan was revised: 3D editing inside R3F has too many ways for screen<->world coordinate math to leak into command paths, and overlays/gizmos in 3D fight orthographic camera presets when users want a clean drawing.

Why it mattered: this is the load-bearing architectural decision for every subsequent interaction feature. Picking the wrong surface for editing means the entire tool/snap/gizmo tree gets built against the wrong coordinate space.

Current guardrail: the workbench has two render surfaces, both derived from the same solved geometry artifact:

- **`Geometry3DViewport`** (read-only): the R3F scene graph. Camera presets, selection highlights for visual reference. **No drag handlers, no gizmos, no commit paths.** Selecting an object in 3D writes into shared selection state -- that is the only output 3D produces.
- **`PlanViewport`** (the editor): a 2D SVG/Canvas surface that consumes the same artifact (typically `topProjection` for committed polygon plan, plus the scene graph for snap targets and dimensions). **All editing lives here:** tools, gizmos, drag, snap, dimension overlays, hit targets.

The viewport mode switch becomes `Sheet | Plan | 3D`. The old `'model'` mode and Model Space viewport survived only until their non-3D responsibilities migrated into `PlanViewport`; they are now retired and must not be recreated.

`DesignViewport.tsx` is the host that mounts the right surface for the active mode. It owns the typed selection seam (`selectionRouter.ts`) shared between 3D and Plan, but does not own editing chrome itself.

New workbench interaction code lives under `apps/portal/components/drawings/viewports/PlanViewport/{canvas,tools,interactions,gizmos,overlays}/` and `apps/portal/lib/drawings/commands/` -- never inside a revived Model Space viewport, never inside `Geometry3DViewport`, never inside `DesignViewport`.

Promoted to: None

Related docs/tests: `docs/design-workbench-architecture.md`, `apps/portal/components/drawings/viewports/DesignViewport.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/`, `apps/portal/components/drawings/workbench/WorkbenchChrome.tsx`.

### 2026-05-04 - Design Workbench Architecture - Nine Contracts For The Read Edit Split

Area: Design Workbench Architecture

Status: Active

Decision or mistake: as PlanViewport accretes tools, gizmos, snap, and dimension code, prior workbench experience shows it is easy to lose seam discipline -- interactions mutate state directly, drag math leaks pixel/screen coordinates into commit paths, scene objects get classified by string-matching ids, and editing chrome bleeds into the read-only 3D surface. Each of these is a category of bug we have already paid for at least once.

Why it mattered: future workbench work expects a large volume of interaction code. Cementing the right invariants up-front -- before tools and commands are written -- makes growth safe; retrofitting them later is expensive and tends to be skipped.

Current guardrail: every interactive feature added to PlanViewport (and the read-only 3D viewport) must obey nine contracts.

1. **Single source of truth.** Design intent is the only writable state. `WorkbenchSolvedGeometryArtifact`, `viewerScene`, and `topProjection` are derived. Tools never mutate intent directly; they issue a `Command` through the command bus.
2. **Three-phase drag.** Every transformative gesture implements `begin -> update -> commit`. `begin` snapshots state. `update` mutates a preview overlay only. `commit` issues a Command. Cancel reverts to the `begin` snapshot.
3. **Plan-projection math.** Drag deltas live in plan-projection coordinates (mm). Object-frame conversions happen at the commit boundary, never at the input edge. Screen<->plan conversion happens only at the pointer edge. The deck-projection drift class of bugs traces back to violating this rule.
4. **Typed selection.** `selectionRouter.ts` returns a discriminated `WorkbenchSelectionTarget` union shared by both 3D and Plan. No substring matching on scene object ids. Unhandled object families fall through to a typed `unhandled` case that is logged, not silently dropped.
5. **Tools are isolated state machines.** Only the active tool sees pointer events. `ToolDispatcher` owns tool activation and routes events. Switching tools cancels in-flight gestures. Tools live exclusively in PlanViewport.
6. **Snap is a service, not per-tool.** Tools query `snapEngine.query(point, context)` and receive a ranked list. They do not reimplement nearest-edge/midpoint/intersection logic per tool. The snap engine lives in PlanViewport.
7. **Gizmos and overlays are Plan-only and owned by tools.** Translation, rotation, and edge-drag handles are rendered above the selection by the active tool inside PlanViewport. 3D never renders editing chrome -- it only renders solved geometry plus a passive selection highlight.
8. **mm everywhere.** Every container that takes a numeric position, size, or delta types it as `Mm`. Pixel and screen units are confined to the pointer edge and never enter command payloads.
9. **3D is read-only.** `Geometry3DViewport` has no drag handlers, no gizmos, no commit paths. Selecting an object in 3D writes into shared selection state -- that is the only output 3D produces. Editing chrome must not be added to the 3D surface, even temporarily.

Promoted to: None

Related docs/tests: `docs/design-workbench-architecture.md`, `apps/portal/components/drawings/viewports/PlanViewport/`, `apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx`, `apps/portal/components/drawings/viewports/selection/selectionRouter.ts`, `apps/portal/lib/drawings/commands/`.

### 2026-05-06 - Decomposition / Refactor Hygiene - Copy Verbatim When Extracting

Area: Decomposition / Refactor Hygiene

Status: Promoted

Decision or mistake: while extracting helpers from `apps/portal/lib/quotes/serverCore.ts` into a new `rowMappers.ts` module, two helpers (`toStatus`, `safeStringArray`) were re-implemented from memory rather than copied byte-for-byte. The replacements had subtly different validation logic -- one accepted statuses the original rejected; the other lost a fallback branch. Caught at review before typecheck, but neither typecheck nor the existing call-site tests would have surfaced the drift because the changed behaviour only fires on edge-case inputs the existing tests do not exercise.

Why it mattered: decomposition refactors look "mechanical" but rewrites slip in easily -- "while I'm there" tidying is the standard way pure helpers acquire silent regressions. Because typecheck cannot see behavioural drift in pure helper bodies, and because callers' tests usually only cover the happy path of the refactored helper, this class of bug is invisible to local CI and tends to be discovered in production.

Current guardrail: when extracting helpers as part of a decomposition pass, copy byte-for-byte from the source file. Do not rename, retype, or "tidy" the helper while moving it. Behaviour-preserving improvements belong in a separate PR with their own tests. If the helper has no direct test, add one in the new module before the next functional change.

Promoted to: `docs/file-decomposition-and-ownership.md` (Operating Rule extraction-hygiene note)

Related docs/tests: `docs/file-decomposition-and-ownership.md`, `apps/portal/lib/quotes/rowMappers.ts`, `apps/portal/lib/quotes/serverHelpers.ts`, `apps/portal/lib/quotes/serverLoaders.ts`

### 2026-05-08 - PlanViewport / Pointer Events - Four Invariants For Pointer-Driven Tools

Area: PlanViewport / Pointer Events

Status: Promoted

Decision or mistake: while shipping the move tool (milestone 14), several user-visible bugs surfaced over multiple iterations -- pergola couldn't be selected, deck moved to a "random location," deck slid exponentially toward the corner with each commit, and (after a partial fix) the click was always cancelled mid-drag. Multiple plausible-but-wrong root causes were tried (geometry encode/decode math, viewBox cursor-scale runaway, null-point fallback) before the actual cause was found. The real root cause was at the React/DOM event boundary, not the geometry layer: `pointerCancel` was aliased to `pointerUp`, the SVG had no `touch-action: none`, primary-button drags didn't `setPointerCapture`, and the dispatcher had a `(0, 0)` fallback when the cursor couldn't be resolved. Any one of these alone produces wildly wrong delta values; together they hid the real failure mode behind defensive layers that "felt" like fixes.

Why it mattered: pointer events are the input boundary of every interactive tool. A bug there manifests as something happening to the deck/pergola/whatever, so investigation goes downstream into geometry first. The actual fixes are tiny (one CSS line, one capture call, one handler split, one helper extraction) but are LOAD-BEARING: removing any one re-introduces the bug. Future agents who "clean up" what looks redundant can re-ship the same regression. Worse, all 79 unit tests for MoveTool / commitDeckTransform / etc. passed throughout, because the boundary that actually fails has no JSDOM-level integration test (`SVGSVGElement.getScreenCTM` is not implemented in JSDOM).

Current guardrail: every pointer-driven tool added to PlanViewport must respect four invariants, enforced at [PlanCanvas.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx) and [pointerDispatch.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.ts):

1. **`touch-action: none`** on the SVG canvas. Browser default lets the gesture be stolen.
2. **`setPointerCapture(pointerId)` on every primary-button pointer-down.** Without capture, the browser fires `pointerleave`/`pointercancel` as soon as the cursor crosses any element boundary mid-drag.
3. **`pointerCancel` MUST call `dispatcher.cancelActiveTool()`, never dispatch as `pointerUp`.** Cancel events have `clientX/Y === 0`; routing them as up dispatches a synthetic release at world coord (0, 0)-derived, which (with pan/zoom applied) lands deep off-canvas. MoveTool computes `delta = bogusEnd - realStart` and the deck jumps proportional to its distance from origin; each commit grows the distance, making the next bogus delta larger -- the deck-runaway bug.
4. **The pure dispatch helper NEVER invents a coord on null.** `buildPointerDispatchAction` returns `{ type: 'skip' }` when the cursor can't be resolved. The previous shape-only fallback to `point: { x: 0, y: 0 }` poisoned MoveTool's session for any pointer-move/up where the SVG couldn't be measured.

Promoted to: `docs/maintainability-principles.md` (Coordinate-system footgun #5)

Related docs/tests: `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.ts`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/pointerDispatch.test.ts`, `apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.module.css`

### 2026-05-08 - Debugging Hygiene - Diagnose Before Theorising

Area: Debugging Hygiene

Status: Active

Decision or mistake: a user-reported runaway-drift bug was attacked through three iterations of theory-driven fixes (subtract house position in `buildDeckTransformPatch`; cap `PLAN_LAYOUT_MAX_DIMENSION_M`; bail on null point in dispatcher) before adding diagnostic logs. The logs immediately revealed the real cause -- a `pointerCancel` event with `clientX/Y === 0` was being committed as a `pointerUp` -- which none of the prior hypotheses matched. The first three fixes were defensible-but-wrong: each addressed a real possible failure mode, but none was THE cause, and shipping them as "fixes" without confirmation extended the time the bug was in production.

Why it mattered: when a hypothesis-driven fix doesn't work, the natural next move is to refine the hypothesis. But when symptoms don't match ANY current hypothesis, more theorising compounds the wrong-direction work. Five minutes of `console.log` at the suspected boundary collapses the hypothesis tree to one branch immediately. This is especially true for bugs at I/O / DOM boundaries (pointer events, browser APIs, network responses) where the actual data shape is hard to predict from code-reading alone.

Current guardrail: when a bug recurs after a "should have fixed it" change, stop iterating fixes. Add diagnostic logs at the suspected boundary (input edge, persistence edge, downstream consumer), reproduce, and let the data identify the root cause. Remove the logs after the fix lands. Defensive layers added during the wrong-direction work should be audited: keep what's load-bearing or cheap, remove what isn't, and document the rest with comments naming the bug they guard. Avoid leaving "I think this might also be needed" code in the tree -- it's indistinguishable from dead code to future maintainers.

Promoted to: None

Related docs/tests: this session's chain of fixes in [PlanCanvas.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas.tsx), [planLayout.ts](../apps/portal/components/drawings/viewports/PlanViewport/canvas/planLayout.ts), [commitDeckTransform.ts](../apps/portal/lib/drawings/commits/commitDeckTransform.ts).

### 2026-05-08 - House Roof Topology - Dutch-Hip Migration Plan

Area: House Roof Topology

Status: Active

Decision or mistake: user requested "click hip triangle in plan view to convert that corner of a hipped roof to a gable end" -- with the goal of retiring the standalone `gable` roof form and replacing it with `hipped` + per-end open/closed toggles. The data model already supports this (`HouseModelConfig.openGableEndIds`) and the inspector already populates `terminalEnds` for any roof form, but the geometry pipeline gates open-end honouring behind `roofForm === 'gable'` (`packages/geometry/src/houseModel.ts:428`). For hipped roofs, `openGableEndIds` is currently a no-op -- the roof topology is built assuming all terminal ends are closed.

Why it mattered: properly opening one end of a hipped roof while keeping the others hipped is the "Dutch hip" / "half-hip" topology. The roof builder must remove the hip plane on the open end, extend the ridge to that end face, and adjust the trapezoidal main slopes to reach the new ridge endpoint. None of `roofRectangleHipped.ts`, `roofJoinedHipped.ts`, or `roofPrimary.ts` knows about partial conversion today. Lifting the gate alone produces inconsistent geometry (open-gable wall tag + hip plane drawn over it).

Current guardrail: the migration is multi-session work, organised around a UNIFICATION approach (not patching the existing per-form builders). Hipped and gable are degenerate cases of the same shape -- a rectangular roof with two terminal ends, each independently `'hipped' | 'open_gable'`. The patched alternative (add `openTerminalEndIds` parameter to existing per-form builders) duplicates topology rules across hipped + gable + Dutch-hip branches and leaves `gable` as a separate codepath -- inconsistent with the user's stated goal of retiring the gable form entirely. Unification keeps topology rules in one place and makes Dutch-hip a natural case (one end hipped, one open).

**Locked design choices** (confirmed with user):

- `type RidgeEndCap = 'hipped' | 'open_gable'` -- binary; no speculative third state.
- Remove `'gable'` from `HouseRoofForm` type union immediately in session C (not deferred). Robust normalize-migration MUST run before any type-narrowing read; load-time migration coverage is non-negotiable.
- Plan-view click target = first-class top-projection shape (`kind: 'house_terminal_end'`) with stable id; reuses the current PlanCanvas2D hit-test path plus hover halo + selection halo infrastructure.

Sequence:

1. **Session A (rectangle unification + Dutch-hip):**
   - New file `packages/geometry/src/house/roofRectangle.ts` exporting `buildRectangularRoof({ minX, maxX, minY, maxY, eaveHeightMm, roofPitchDeg, ridgeAxis, startCap, endCap })`. Body unifies today's `buildRectangleHippedRoof` (in `roofRectangleHipped.ts`) and `buildRectangularGableRoof` (in `roofPrimary.ts`), branched per-end on cap state.
   - Topology rules (ridge along X axis; mirror for Y; ignore for pyramid):
     - `startCap = 'hipped'`: emit `house-roof-min-x` triangular plane; ridge starts at `(input.minX + halfShort, centerY, ridgeZ)`; emit 2 hip features pointing at ridge start.
     - `startCap = 'open_gable'`: skip min-x plane; ridge starts at `(input.minX, centerY, ridgeZ)`; skip those 2 hip features; the `min-y` and `max-y` planes' western corners use the extended ridge start.
     - Same logic mirrored for `endCap` on the max-x side.
   - Existing entries `buildRectangleHippedRoof` and `buildRectangularGableRoof` become thin compat wrappers calling the unified builder with both caps set, until session C retires `gable`.
   - Lift the `roofForm === 'gable'` gate in `houseModel.ts:428` -- `openGableEndIds` is now meaningful for any rectangular roof regardless of form.
   - Plumb `openTerminalEndIds` through `buildHippedHouseRoof` -> `buildPrimaryHouseRoof` -> `buildSharedHouseRoof`.
   - Tests parameterised over (startCap, endCap) x ridgeAxis -- ~8 unique topologies. Equivalence assertions: `(hipped, hipped)` byte-equivalent to existing `buildRectangleHippedRoof`; `(open, open)` byte-equivalent to existing `buildRectangularGableRoof`. THIS IS THE MIGRATION SAFETY NET.

2. **Session B (joined / L-shape Dutch-hip):** the wavefront-based joined builder (`buildJoinedRoofWavefrontRegions` in `roofJoinedWavefront.ts`, 428 LOC) does NOT trivially extend to per-end caps -- the topology emerges from edge velocities + offset advancement, not from explicit ridge endpoints. Investigated mid-session A; honest scope is its own focused session. Two viable approaches surfaced:
   - **Approach A (true Dutch hip)**: set velocity = 0 on terminal-end edges in `joinedRoofWavefrontVertexVelocity` so those edges stay at the eave while neighbours advance. The neighbouring facets reach the now-stationary edge, forming a real gable end. Mental model matches "a gable wall has no inward roof advance." Implementation: extend `JoinedRoofWavefrontLoop` vertex velocity computation to flag stationary edges; trace impact through `advanceJoinedRoofWavefrontLoop`, edge-collapse + split logic, and `polygonizeJoinedRoofWavefrontSegments`. Wavefront is the most complex algorithm in the geometry package -- changes need careful test coverage (rectangle Dutch-hip via the joined path as a sanity check; explicit L-shape Dutch-hip cases). Probably a full session; possibly two if the velocity-zero edge case has unexpected interactions with edge collapse.

   - **Approach B (clipped gable / jerkin head)**: just remove facets/planes whose `metadata.sourceEdgeId` matches an open terminal end's source edge. Adjacent facets keep their inset-ridge boundaries; the gable wall apex sits at the hip apex height (NOT at the full ridge-line gable peak). Architecturally a real style ("jerkin head" / "clipped gable") but visually different from a full open gable. Implementation: ~1 hr post-hoc filter on `buildJoinedRectilinearHippedRoof`'s output. Documented limitation rather than the user's stated mental model.

   User chose Approach A. Implementation entry points:
   - `roofJoinedWavefront.ts:25` `joinedRoofWavefrontVertexVelocity` -- accept a `stationaryEdgeIds` set; when both edges of a vertex are stationary, vertex velocity = 0; when one is stationary, vertex slides along the stationary edge under the moving edge's pressure (analogous to a gable wall with one slope).
   - `roofJoinedWavefront.ts:318` `advanceJoinedRoofWavefrontLoop` -- skip distance-to-collapse / distance-to-split calculations for stationary edges (they never collapse or split).
   - `roofJoinedHipped.ts:16` `buildJoinedRectilinearHippedRoof` -- accept `openTerminalEndIds`, look up corresponding `sourceEdgeId`s via `deriveHouseGableTerminalEndsFromFootprint`, pass to wavefront as the stationary set.
   - Plumb through `buildHippedHouseRoof` (joined branch in `roofPrimary.ts`).
   - Tests: rectangle Dutch-hip via the joined path produces the same shape as session A's direct rectangular path (sanity check); explicit L-shape with one terminal end open produces a true gable extension (visual: roof slope removed, ridge extends, gable wall reaches the ridge apex).

3. **Session C (UI + type retirement):**
   - normalize-time migration: `roofForm: 'gable'` -> `roofForm: 'hipped'` + `openGableEndIds: [<all terminal ids>]`. MUST run before any read narrows the type. Test: load fixture with `roofForm: 'gable'`, assert post-normalize state is hipped+all-open and produces identical `HouseModel3D`.
   - Remove `'gable'` from `HouseRoofForm` type union in `contracts.ts` (and `houseFirstWorkbenchModel.ts`, `objectFirstWorkbenchModel.ts` -- 3 places). Remove `'gable'` from `HOUSE_ROOF_FORM_ORDER`. Retire `buildRectangularGableRoof` and the gable-specific builder in `roofPrimary.ts`.
   - Inspector: lift the `roofForm === 'gable'` gate in `HouseFormRoofSections.tsx:165`; rename "Open gable ends" label to something form-agnostic (e.g. "Roof ends").
   - Plan-view click target: extend `topProjection.ts` to emit one `kind: 'house_terminal_end'` shape per terminal end (id = the terminal-end id, polygon = the hip-triangle plan polygon for hipped state, the gable-end-face polygon for open state -- so the click target moves with the state). On click, toggle id in `openGableEndIds` via `commitSharedHouseFormRoof` action. Hover affordance reuses `PlanHoverHaloLayer`.

4. **Slice 2 follow-up (after slice 1 ships):** smart pergola-attachment prompt -- when a hip end is opened on a wall a pergola is attached to (or when a pergola is dragged onto an open-gable wall), prompt "convert pergola to gable form to match house gable height + pitch?" Auto-copies gable parameters.

Terminal-end ID format: `house-gable-end-x-{N}` or `house-gable-end-y-{N}` (`packages/geometry/src/house/roofJoinedGableTerminals.ts:67`). The `sourceEdgeId` field on each terminal end maps it to a footprint edge index.

Promoted to: None

Related docs/tests: `packages/geometry/src/houseModel.ts` (gating at line 428), `packages/geometry/src/house/roofRectangleHipped.ts`, `packages/geometry/src/house/roofJoinedHipped.ts`, `packages/geometry/src/house/roofPrimary.ts`, `packages/geometry/src/house/roofJoinedGableTerminals.ts`, `apps/portal/components/drawings/rail/HouseFormRoofSections.tsx:165`, `apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts:336`.

### 2026-05-12 - 3D Wall Rendering - Solid Walls, Inward Miter, and Renderable Open-Gable Boundaries

Area: 3D Wall Rendering

Status: Active

Decision or mistake: walls in the 3D viewport rendered as flat polygons that looked papery; on hipped roofs with one end opened (Dutch-hip), the resulting open-gable wall was not drawn at all. Three independent issues were uncovered while making walls render as 3D solids: (1) the 3D viewport had a wall-specific branch that ignored `renderMesh` and rebuilt geometry from `boundary` alone -- so any extrusion work in `envelopeSolids.ts` was silently discarded for walls; (2) the miter footprint helper was offsetting walls by `+/- half-thickness` (centered on the footprint edge), but the house footprint is defined as the outer face of the wall -- centered offsets push half the wall mass _outside_ the house outline, and adjacent walls' centered offsets do not meet cleanly at corners; (3) the migrated-from-hipped open-gable wall arrived with a 4-vertex flat-top boundary (rectangle), not the 5-vertex apex shape native gable walls have, so the polygonal extruder had no apex to extrude -- the wall vanished into the roof. A naive reshape (always inject the apex) regressed native gable: those walls already have 5 vertices and re-inserting an apex produces a degenerate boundary.

Why it mattered: each issue masked the others. Bumping `DEFAULT_WALL_SOLID_THICKNESS_MM` from 90 -> 150 didn't make walls look thicker because the viewer was still rebuilding from boundary. Adding the polygonal extruder didn't make open-gable walls visible because they had no apex in their boundary. Fixing the reshape broke native gable until the `wallBoundaryHasFlatTop` guard landed. Future agents touching `envelopeSolids.ts`, `roofSolids.ts`, the viewer's `kind === 'wall'` path, or open-gable boundary handling can re-introduce any of these regressions individually.

Current guardrail: four rules apply when touching 3D wall rendering:

1. **Walls consume `renderMesh` first.** The 3D viewport's wall-rendering path in [Geometry3DViewport.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx) (around the wall-object useMemo) must call `buildRenderMeshGeometry(object.renderMesh) ?? buildPolygonSlabGeometry(...)`, in that order. Never reach for `boundary` before `renderMesh`.
2. **Miter footprints are inward-only.** Use `buildMiteredOffsetStripFootprints(footprint, 0, -DEFAULT_WALL_SOLID_THICKNESS_MM)` in [envelopeSolids.ts](../packages/geometry/src/house/envelopeSolids.ts), not a centered strip variant. The footprint edge is the outer face of the wall; the interior extrudes inward toward the house centroid. Adjacent walls meet cleanly at corners only under this convention.
3. **Non-flat-top walls extrude polygonally.** When `wallBoundaryHasFlatTop(boundary)` is false (gable walls -- triangular or pentagonal top), the wall builder must call `buildPolygonalWallRenderMesh(boundary, planeNormal, thicknessMm)` in [roofSolids.ts](../packages/geometry/src/house/roofSolids.ts). This extrudes the closed polygonal boundary perpendicular to its plane via `+/- half-thickness`, fan-triangulates both faces, and bridges the sides with quads. Flat-top walls keep using `buildVerticalPrismRenderMesh` on the miter footprint.
4. **Open-gable boundary reshape is gated by `wallBoundaryHasFlatTop`.** In [houseModel.ts](../packages/geometry/src/houseModel.ts), when an `open_gable_frame` wall is migrated from hipped topology, its boundary arrives flat-top (4 vertices) and must be reshaped to insert the apex at `ridgeZ`. Native gable walls already have 5-vertex apex boundaries and MUST NOT be reshaped -- gating on `wallBoundaryHasFlatTop(segment.boundary)` is what distinguishes the two cases. Inserting an apex into an already-apex boundary degrades the wall.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/envelopeSolids.ts](../packages/geometry/src/house/envelopeSolids.ts), [packages/geometry/src/house/roofSolids.ts](../packages/geometry/src/house/roofSolids.ts), [packages/geometry/src/house/buildPolygonalWallRenderMesh.test.ts](../packages/geometry/src/house/buildPolygonalWallRenderMesh.test.ts), [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx).

### 2026-05-12 - 3D Viewport Navigation - Trackpad-Friendly Mouse Bindings

Area: 3D Viewport Navigation

Status: Active

Decision or mistake: the design workbench 3D viewport used OrbitControls defaults -- LEFT = rotate, MIDDLE = dolly, RIGHT = pan -- which works fine with a 3-button mouse but is hostile on a MacBook trackpad. Trackpads have no MIDDLE button; right-click-drag on a trackpad is either a context menu (Safari) or two-finger gesture (varies). Users couldn't rotate the 3D view at all on Mac trackpads, and on the Plan (top-locked) view, LEFT-drag accidentally rotated the locked-top camera, producing visible tilt artifacts before snapping back.

Why it mattered: 3D viewport navigation is the primary "feel" interaction of the workbench. A confusing rotate/pan binding doesn't surface as a bug report -- users just feel the tool is broken. The fix is one tiny ternary in `mouseButtons`, but the principle (which button does what _depends_ on which view-preset is active) is non-obvious and easy to regress when adding new view presets or wiring new controls.

Current guardrail: `OrbitControls.mouseButtons.LEFT` must branch on `lockedViewPreset` in [Geometry3DViewport.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx):

```ts
mouseButtons={{
  LEFT: lockedViewPreset === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: lockedViewPreset === "top" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
}}
```

In top-locked views (Plan), LEFT must PAN -- rotation has no semantic in a top-locked camera. In Perspective (3D), LEFT must ROTATE so trackpad users can navigate at all. RIGHT mirrors LEFT for safety (some Mac trackpad gestures synthesize right-click). MIDDLE stays dolly. Any new view preset that locks the camera in a constrained axis must extend this branch -- pan, not rotate, on LEFT.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx).

### 2026-05-12 - Open-Gable Roof Frames - Triangular Top Profile Gate

Area: Open-Gable Roof Frames

Status: Active

Decision or mistake: [roofFrames.ts](../packages/geometry/src/house/roofFrames.ts) emits gable-end frame features (posts, top-chord) by walking the top-profile of an open-gable wall. The gate guarded `topProfile.length < 2`, intending to skip degenerate walls with no top profile. But triangular gable walls (a single apex point above the eave line) have a _1-point_ top profile -- one vertex, no segment. The `< 2` gate skipped them entirely, producing open-gable walls with no frame features (the apex post and top-chord vanished).

Why it mattered: the failure mode is visually subtle -- the open-gable rectangle still renders (via `buildPolygonalWallRenderMesh`), but the frame timber detail is missing on the triangular variant only. Pentagonal flat-top gable walls (apex + two short verticals) have a 2-point top profile and were fine; triangular gable walls (apex only) silently lost their frames. The bug only manifests on roof presets that produce triangular gable boundaries.

Current guardrail: the gate is `topProfile.length < 1`, not `< 2`. A 1-point top profile is valid -- it's the apex, and the frame builder emits the two side-verticals from the eave corners to the apex (no top-chord segment, since `topProfile.length - 1 === 0`). Only `topProfile.length < 1` (zero vertices = degenerate) deserves the skip. When adding new wall-topology variants, double-check that `topProfile.length === 1` is treated as a valid case by every consumer.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofFrames.ts](../packages/geometry/src/house/roofFrames.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts).

### 2026-05-13 - Plan Rendering - Suppress House Footprint When Roof Body Renders

Area: Plan Rendering

Status: Active

Decision or mistake: on Sheet (and projection-only Plan), houses with a `house_surface_solid + roof` committed body ALSO rendered a `house_reference + footprint` committed body. Both are top_visible polygons in the same active module's top-projection. Visually they produced overlapping strokes -- the roof outline (with eave overhangs) plus a concentric inner footprint outline (the wall outer face). On hipped roofs this looked like doubled house edges; on roofs with zero overhang the polygons could coincide entirely and stroke twice.

A first fix (commit `77a3a133`) suppressed `house_reference + footprint` at the render-graph level inside `buildProjectionPlanRenderGraph` whenever a roof body existed. That removed the visible double-stroke but ALSO removed the house's clickable polygon: at the time, the Plan canvas's hit-target layer was derived from the same `committedBodies` array. After the fix, users could no longer click the house polygon on the Plan canvas to select the house -- they had to use the rail. The graph-level filter conflated "visible stroke" with "hit target."

Why it mattered: the same array (`committedBodies`) serves two distinct concerns -- visible rendering AND hit-testing -- and they have different requirements. Removing the canonical reference footprint from the graph removes BOTH, even when only one was the goal. The hit-target chain has no alternative anchor for house selection on the canvas. Future agents who push more responsibilities through `committedBodies` (selection, drag, dimensions) will hit the same trap if they suppress at the graph level.

Current guardrail: superseded by the explicit Plan hit-target layer and project visual stack from PR-2B.1b.3i/3l. The original mistake remains valid -- do not remove a house selection anchor just because it should not visibly paint -- but the implementation moved from a React render-layer filter into the Plan view model. Specifically:

- In [planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), `buildProjectionPlanRenderGraph` puts canonical `house_reference + footprint` shapes in `hitTargets`, not normal visible bodies. `house_reference` promotes to a visible committed fallback only when the same house form has no roof body.
- In [planCommittedBodyVisualStack.ts](../apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts), visible committed bodies are filtered and semantically sorted before they reach React. Project-level house roof bodies come from the package eave-perimeter projection, and project pergola bodies paint below house roof bodies.
- In the Plan canvas committed-body render path, React/canvas rendering is presenter-only; it renders the already-filtered/sorted items from the render model.
- In [ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx)'s `TopProjectionLayerRenderer` (Sheet view), the same render-time suppression applies. Sheet has no hit-target layer for the house so a render-only filter is sufficient.
- The non-active project-context overlay path (`buildProjectContextOverlayShapes` in workbenchSolvedModel.ts) is unaffected -- it filters `house_reference` out of the context overlay separately.

Keep visible and hit-target concerns separate: interaction references belong in hit/selection layers unless explicitly promoted as no-body fallbacks.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/views/plan/planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), [apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts](../apps/portal/lib/drawings/views/plan/planCommittedBodyVisualStack.ts), [apps/portal/lib/drawings/views/plan/planShapeOwnership.ts](../apps/portal/lib/drawings/views/plan/planShapeOwnership.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas2D.tsx](../apps/portal/components/drawings/viewports/PlanViewport/canvas/PlanCanvas2D.tsx), [apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx](../apps/portal/app/staff/calculator/ModulePlanLayerRenderers.tsx), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts) (`buildProjectContextOverlayShapes` for the project context-overlay path that still keeps `house_reference`).

### 2026-05-13 - Pergola Snap Targets - Every Attachable Perimeter Edge

Area: Pergola Snap Targets

Status: Active

Decision or mistake: `HouseModel3D.roofEaves` (`packages/geometry/src/houseModel.ts`) used to filter perimeter edges to `edgeKind === 'drain_eave'` only -- the v1 simplification was "pergolas attach to gutter-bearing edges." Two real cases break under this:

1. **Opened Dutch-hip gable end.** Milestone 13 lets a user open a hip end into a gable. The geometric consequence is that the adjacent roof plane disappears; `classifyHousePerimeterEdges` then labels the perimeter edge `weather_flashed_edge` (no draining plane above it). The user still wants to snap a pergola to that perimeter -- it's a valid attachment line in plan view. With the old filter, that edge was invisible to the snap engine.
2. **L-/U-shape apron joins.** Inner perimeter joins are classified `house_apron_edge`. The same omission applied.

Why it mattered: pergola placement is the workbench's primary interaction. "Some perimeter edges don't snap" surfaces as a feel/quality complaint that doesn't trip any test. The classifier's edge-kind labels are correct (they describe hydrology) but the downstream filter conflated hydrology with attachment eligibility.

Current guardrail: `HouseModel3D.roofEaves` includes every attachable perimeter edge -- `drain_eave`, `weather_flashed_edge`, and `house_apron_edge`. `HouseRoofEave3D.edgeKind` now spans all three values (was a literal `"drain_eave"`). Downstream consumers that truly need draining edges only (gutter rendering, flashing rules) re-filter on `edgeKind === 'drain_eave'` at their own call sites. The snap consumer (`buildHouseSnapTargets`) needs no change: it already emits one snap line per eave. When adding new perimeter classifications, default to "attachable" unless the geometry physically excludes pergola attachment (e.g. an inner courtyard with no ground access).

Promoted to: None

Related docs/tests: [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/contracts.ts](../packages/geometry/src/contracts.ts) (`HouseRoofEave3D` edgeKind union), [packages/geometry/src/house/perimeterEdges.ts](../packages/geometry/src/house/perimeterEdges.ts) (the classifier; unchanged), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildHouseSnapTargets.test.ts), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts).

### 2026-05-13 - Plan Tool Chain - Terminal-End Click Yields to Edge Drag Within Tolerance

Area: Plan Tool Chain

Status: Active

Decision or mistake: this entry has two rounds. **Round 1** (commit `cae8cb13`): clicking the synthetic gable triangle to re-close an opened Dutch-hip end did nothing when the house was the active selection. `EdgeDragTool` is the entry tool in the Plan tool chain, and its `onPointerDown` accepts ANY click that lands within `edgeHitToleranceMm` of the active outline's perimeter. The synthetic gable triangle is built from `[apex, eaveStart, eaveEnd]` with the eave corners pushed outward by the eave overhang, so it overlaps the house outline's perimeter edge entirely. With the house selected, EdgeDragTool started a resize session, swallowing the click before the chain could fall through to `MoveTool` → `SelectTool`. Round-1 fix added an UNCONDITIONAL early-fallthrough on `event.shape?.metadata?.openGableEndId`, which routed every terminal-end click to SelectTool.

**Round 2:** the unconditional fallthrough swung the pendulum too far. The synthetic triangle's eave-corner extension covers a strip of the wall edge that the user reasonably expects to be the resize/drag affordance. With the round-1 fix in place, the user lost the ability to drag the wall edge anywhere the synthetic overlapped it -- every click in that strip routed to the toggle, never to edge drag. The fix needed to be distance-based, not categorical.

Why it mattered: same class of bug as the `pointerCancel` -> `pointerUp` aliasing in milestone 14 -- the user-visible symptom (toggle silently fails / wall drag silently fails) sits downstream of an input-layer boundary, and naive categorical fixes overshoot in the opposite direction. The lesson again: distinguish "click target" from "interactive region" -- they have different precedence rules when polygons overlap.

Current guardrail: `EdgeDragTool.onPointerDown` runs a single proximity check at the top of the handler and feeds the same answer to BOTH gates:

1. Compute `closest = findClosestPolygonEdge(outline.polygon, event.point)` and `withinEdgeTolerance = !!closest && closest.distanceMm <= tolerance`.
2. If `event.shape?.metadata?.openGableEndId` is a string AND NOT `withinEdgeTolerance` → fall through to SelectTool (the toggle path).
3. Else if no outline / no closest edge / not within tolerance → fall through to SelectTool (the existing non-edge-drag path).
4. Else start the edge drag session.

The contract: terminal-end toggle targets are click targets in the synthetic's INTERIOR only. Clicks on the synthetic's perimeter overhang that fall inside the active outline's `edgeHitToleranceMm` band are edge-drag clicks, not toggle clicks. Future tools added to the Plan chain that introduce "click-only" UI targets overlapping movable outlines MUST mirror this distance-based precedence (not a categorical fallthrough). Default tolerance is 250 mm (was 500); the smaller value addresses user feedback that wall hit boxes felt too generous AND naturally shrinks the band where edge drag and toggle compete.

If the chain grows more click-only UI targets, promote the proximity-check pattern into a shared helper (`shouldYieldToActiveOutlineEdgeDrag(event, outline, tolerance)`) consumed by every tool's `onPointerDown`.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/EdgeDragTool.test.ts) ("terminal-end toggle priority vs. edge drag" describe block: falls through when far from the edge; starts edge drag when within tolerance), [apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.ts), [apps/portal/components/drawings/viewports/selection/selectionRouter.ts](../apps/portal/components/drawings/viewports/selection/selectionRouter.ts) (`house_terminal_end_toggle` classification), [packages/geometry/src/topProjection.ts](../packages/geometry/src/topProjection.ts) (`enrichHouseRoofShapesWithTerminalEnds` -- emits synthetic triangle with `openGableEndId` + `isOpen` metadata).

### 2026-05-13 - House Roof Topology - Gable Form Migration Must Be Ported on First Toggle

Area: House Roof Topology

Status: Active

Decision or mistake: clicking the synthetic gable triangle on the Plan canvas to re-close an opened end did nothing -- even after the EdgeDragTool early-fallthrough (`cae8cb13`) and all the diagnostic instrumentation passed every hop. The entire chain (Plan hit-test layer → EdgeDragTool fallthrough → SelectTool → callback) was firing correctly. The callback received `endId: 'house-gable-end-x-1'` and `currentlyOpen: true`, but `currentRoof.openGableEndIds` came back as `[]` -- empty. So the toggle's logic (`currentlyOpen ? filter(id !== endId) : [...currentOpenIds, endId]`) produced `[].filter(...) === []`, committed an empty list, and the user saw no change. The root cause was state inconsistency: the workbench had `roofIntent.form === 'gable'` with empty `openGableEndIds`, but the geometry normalize layer at `packages/geometry/src/normalize.ts:691-720` carries a milestone-13 compat migration that treats `roofForm: 'gable'` as "hipped + every terminal end open" regardless of the explicit `openGableEndIds`. So the GEOMETRY topology renders every end open while the WORKBENCH state has `openGableEndIds: []`. Any toggle from this implicit state is a no-op because there's nothing in the explicit set to remove, and the migration re-opens every end on the next solve.

Why it mattered: this is the second-order failure mode after the EdgeDragTool fix. Two rounds of theory-based fixes ran before instrumentation pinpointed it. The lesson, repeated from `2026-05-08 Debugging Hygiene`: a wired-up pipeline that silently fails almost always means state is split across two consumers that LOOK like they should agree but don't. The migration was correctly documented in `normalize.ts` but never ported back into the workbench draft -- so the rail's "Open"/"Close" buttons on a gable form also look like they don't work (clicking them commits `[]` and the migration re-opens everything anyway). The Plan toggle inherited the same bug.

Current guardrail: any UI toggle that operates on a single terminal end's open state MUST go through [`resolveHouseTerminalEndToggleRoofDraft`](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts) (or replicate its semantics exactly). When the current roof's `form === 'gable'`, that helper converts to `form: 'hipped'` and seeds `openGableEndIds` from the full terminal-end set (minus the one being closed, or plus the one being opened). This ports the implicit migration into explicit workbench state in one commit, so subsequent reads of `openGableEndIds` agree with the rendered topology and every future toggle works as the user expects.

Future agents:

- ~~The rail's open-end toggle at [HouseFormRoofSections.tsx:188-195](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) currently still uses inline logic that has the same bug for gable-form roofs. Migrating it to use the shared helper is the obvious next step; do it the next time the rail is touched.~~ **DONE 2026-05-14:** the rail's toggle now routes through `resolveHouseTerminalEndToggleRoofDraft`. Both the Plan canvas and the rail share the helper; the gable-migration bug is fixed on both surfaces.
- ~~The deeper fix is to migrate `form: 'gable'` -> `form: 'hipped' + openGableEndIds: <all terminals>` at the workbench draft normalization boundary so every consumer reads coherent state.~~ **DONE 2026-05-14 (Slices 2 + 2B):** the migration runs at the workbench draft and geometry-input boundaries so every geometry input is `'hipped' + openGableEndIds: <list>`, never `'gable'`. The `openGableEndIds` auto-derivation in `packages/geometry/src/normalize.ts:691-720` is RETIRED (replaced with a one-line pass-through of `resolveHouseOpenGableEndIds`). The form-name narrowing at `normalize.ts:506` (`rawRoofForm === 'gable' ? 'hipped' : rawRoofForm`) STAYS as a defensive safety net for direct geometry callers that bypass the workbench geometry-input boundary. Inspector `terminalEnds[].isOpen` keeps the `intent.form === 'gable' ? true : ...` fallback for the rare workbench-state-only-sees-gable case. **Milestone 13 session C** (dropping `'gable'` from the `HouseRoofForm` type union, retiring `buildRectangularGableRoof` and the gable-specific builder in `roofPrimary.ts`) is now unblocked.
- When adding new consumers that read `roofIntent.openGableEndIds` for behavior (snap targets, rail badges, etc.), if the user expects the result to match the rendered topology, those consumers must either run the migration themselves or assume the helper has already ported the state.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.test.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.test.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx) (`onToggleHouseTerminalEnd` callsite), [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts) (the migration at lines 691-720), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) (still-buggy rail toggle to migrate).

### 2026-05-14 - Plan Snap Engine - Corner Snap Extends MoveTool

Area: Plan Snap Engine

Status: Active

Decision or mistake: the snap engine was single-line for years -- each MoveTool/EdgeDragTool drag resolved at most one `EdgeSnapResult` and applied one perpendicular correction along the snapped edge's normal. Users couldn't snap a pergola or deck to a HOUSE CORNER cleanly: dragging toward a corner attracted to one wall, but the orthogonal axis stayed free, so the user had to drag along the snapped wall to align the second edge by eye. CAD users have a baked-in expectation of corner snapping; without it the workbench's feel was off in attachment workflows.

Why it mattered: the constraint was a RESOLUTION choice, not a structural limit. `SnapLineTarget` already carries direction (bounded segment endpoints); the engine just never asked "is there a non-parallel partner in tolerance?" The deck system already proved the persistence side: deck shapes store `primaryHostEdgeId + secondaryHostEdgeId + cornerVertexId` (`deckInteractionContract.ts`), and that dual-edge storage remains the precedent after the old deck commit test adapter was retired. The piece that was missing was the SNAP RESOLVER stage -- detecting the pair, computing the intersection, and producing a 2D delta that lands the moving polygon's corner there in one shot.

Current guardrail: corner snap lives in [`resolveMoveSnap`](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts) only. EdgeDragTool's motion is 1D (perpendicular to the dragged edge) -- a second axis doesn't exist, so corner snap doesn't apply.

`resolveMoveSnap` runs a two-pass search:

1. **Primary** -- the existing single-line search across every polygon edge against every target. Smallest-correction wins.
2. **Secondary (corner partner)** -- on a DIFFERENT polygon edge (`excludeEdgeIndex` guard), against targets whose direction is at least `cornerMinAngleDeg` (default 30 deg) away from the primary's. The same per-edge distance/parallelism gates run; smallest-correction wins among the filtered candidates.

When a secondary is found, the resolver solves the 2x2 system `[primary_normal; secondary_normal] . delta = [primary_snapDeltaMm; secondary_snapDeltaMm]` for the 2-vector `delta`. After applying `delta`, both edges sit exactly on their target lines; their shared corner sits on the intersection of the two target lines (computed and returned as `cornerVertex`). Existing single-line callers see `secondary: undefined` and unchanged behaviour.

The Plan preview renderer can show both snap lines + a marker at `cornerVertex` when secondary is present; the primary-only render path is unchanged.

Future agents:

- This slice ships the visual + geometric corner snap. The commit path still persists a single primary host edge for pergolas. Persistent dual-host attachment for pergolas (mirroring the deck `primaryHostEdgeId/secondaryHostEdgeId/cornerVertexId` data-model extension) is a separate slice -- gated on a clear product ask, since the geometric corner snap alone gives the user the "feel" they were asking for.
- When adding new snap target families (opening edges, deck edges as pergola hosts, etc.), make sure the new targets carry bounded `start`/`end` so `targetsFormCornerPair` can compute a direction vector. Targets without orientation can't participate in the secondary search.
- `cornerMinAngleDeg` is per-call, not per-family. If pergola-vs-deck have different "what counts as a corner" thresholds, expose per-family overrides at the MoveTool config layer (mirror `houseEdgeHitToleranceMm` / `pergolaEdgeHitToleranceMm` pattern flagged in the "Terminal-End Click Yields to Edge Drag" entry).

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.ts), [apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/resolveMoveSnap.test.ts) ("corner snap (two non-parallel targets in tolerance)" describe block), [apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.ts](../apps/portal/components/drawings/viewports/PlanViewport/tools/MoveTool.ts) (`MoveToolPreview.snap` carries live snap feedback), and [apps/portal/lib/drawings/interactions/deckInteractionContract.ts](../apps/portal/lib/drawings/interactions/deckInteractionContract.ts) (`corner_dual_edge` deck attachment precedent). The old deck commit adapter test helper was retired after the live Plan path moved to `buildDeckTransformPatch`.

### 2026-05-14 - House Roof Topology - Session C: HouseRoofForm 'gable' Retirement

Area: House Roof Topology

Status: Active

Decision or mistake: closes Milestone 13. Earlier sessions made `'gable'` topologically redundant -- a `'hipped'` roof with every terminal end open produces identical geometry via the unified Dutch-hip rectangle/joined builder. Sessions 2 and 2B migrated the workbench draft state and the geometry input boundary so `'gable'` was never produced at runtime, only consumed from legacy storage. Session C completes the retirement at the TYPE level: `HouseRoofForm` is now `'flat' | 'mono' | 'hipped'`, and `'gable'` is mapped to `'hipped'` at the two normalize boundaries before it crosses any typed surface. The picker, rail labels, validators, dispatcher branches, and inspector derivations that handled `'gable'` are all simplified or removed.

Why it mattered: the `'gable'` literal was the only remaining handle for legacy gable behavior that survived sessions A/B. Keeping it in the type union meant every form-aware consumer (validators, dispatchers, snap-target builders, inspector derivations, rail labels) had to carry a `form === 'gable' || form === 'hipped'` branch. ~30 conditional branches across the geometry package + portal app boiled down to either `form === 'hipped'` or unconditional logic, and the dispatcher in `roofPrimary.ts:540` no longer routes to `buildGabledHouseRoof` -- it always calls `buildHippedHouseRoof`.

Current guardrail: legacy gable storage continues to round-trip safely. Two narrowing points map `'gable'` to `'hipped'`:

1. `resolveHouseRoofForm` in [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts): geometry-side input safety net. Accepts the wider `HouseRoofForm | 'gable'` input type and returns the narrowed `HouseRoofForm`.
2. `normalizeHouseFormRoofIntent` in [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts): workbench draft normalize. Detects legacy `'gable'` via string comparison (cast through `unknown`), maps to `'hipped'`, and when an explicit polygon is available seeds `openGableEndIds` with the all-terminals-open set so the rendered topology matches what gable-form houses produced before.

Internal builders kept and re-wired: `buildGabledHouseRoof` (and its delegate `buildBentSpineJoinedGableRoofX`) is back in the dispatcher's joined path -- the wavefront-based `buildJoinedRectilinearHippedRoof` does not produce the closure metadata + `bent_spine_joined_gable` geometry kind that downstream consumers (rail, plan view, terminal-closure walls) expect for the all-terminal-open topology on U / wrap footprints. `buildHippedHouseRoof` now detects "every active-axis terminal end is open" and routes through `buildGabledHouseRoof`; partial-open joined cases still go through the wavefront with stationary edges. As of the workbench dead-code cleanup lane, consumer searches show the rectangular/joined gable delegates and the legacy joined fallback are still load-bearing under that route. Do not delete them without first replacing the all-terminal-open fallback and verifying joined, rectangular, and legacy-storage cases.

Capability + validation surface changes:

- `HOUSE_ROOF_FORM_BEHAVIORS.hipped.controls.appendage = true` (was `false`). Hipped subsumes the retired gable form, which previously surfaced the appendage band. Without this, every authored appendage on a legacy gable-form house silently dropped at the rail boundary on upgrade.
- `appendageAllowed = sharedRoofForm === 'mono' || sharedRoofForm === 'hipped'` in houseFirstWorkbenchAdapter.ts (was `'mono' || 'gable'`). Mirrors the capability change.
- `getHouseRoofFormBehavior` falls back to the hipped behavior for unrecognized form names, so direct geometry callers that pass legacy serialized `'gable'` strings get a sane footprint requirement instead of an undefined-property crash.
- `deriveHouseRoofGeometryKind` now accepts optional `openGableEndIds` + `roofRidgeAxis`. When every active terminal end is open on a joined footprint it reports `'bent_spine_joined_gable'`; partial-open + closed cases stay `'rectilinear_joined_hipped'`. The rail's geometry kind label tracks the dispatcher.
- `walls.ts:buildWallSegments` triggers roof-aligned wall top profiles on `roofGeometry === 'bent_spine_joined_gable'` instead of `roofForm === 'gable'`. The rectangular all-open (`startCap === 'open_gable' && endCap === 'open_gable'`) case keeps a flat-top wall and relies on the existing reshape in `buildHouseModel3D` to triangulate to `[groundStart, groundEnd, apex]`. Without this split, rectangular gable produced 5-point gable walls while joined gable produced 4-point flat-top walls.
- Frame features built by `buildOpenGableFrameFeatures` get the parent roof's `roofQaStatus` stamped in `buildHouseModel3D` after construction, so the `model.roofFeatures.every(f => f.metadata.roofQaStatus === 'valid')` invariant holds across the synthetic + builder-emitted feature sets.

Known regression: legacy gable-form houses stored in PRESET MODE (no explicit polygon at the workbench draft normalize boundary) now load as `'hipped'` with empty `openGableEndIds`. The geometry pipeline previously force-opened every end via the compat migration at `normalize.ts:691-720`; that compat was retired in slice 2B. For preset-mode houses, the user needs to re-open the desired ends from the rail or Plan canvas after upgrade. Custom-polygon houses (the common case) migrate fully; the `setObjectFirstRoofIntent` -> `normalizeHouseFormRoofIntent` path with `polygon: [...]` seeds `openGableEndIds` from the resolved terminals.

Future agents:

- The gable-named builders are not a deletion target by name alone. They are compatibility implementation details for `'hipped' + all terminal ends open`; future cleanup should first prove an equivalent unified rectangle/joined path replaces that behavior.
- The cast `value?.form as unknown as 'hipped'` in `normalizeHouseFormRoofIntent` is the safety net for legacy storage. If a future schema validator runs BEFORE this normalize, the cast becomes redundant.

Promoted to: None

Related docs/tests: [packages/geometry/src/contracts.ts](../packages/geometry/src/contracts.ts) (`HouseRoofForm` union), [packages/geometry/src/houseRoofValidation.ts](../packages/geometry/src/houseRoofValidation.ts) (`HOUSE_ROOF_FORM_BEHAVIORS`, `HOUSE_ROOF_FORM_ORDER`), [packages/geometry/src/normalize.ts](../packages/geometry/src/normalize.ts) (`resolveHouseRoofForm`), [packages/geometry/src/house/roofPrimary.ts](../packages/geometry/src/house/roofPrimary.ts) (`buildPrimaryHouseRoof` dispatcher), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts) (`normalizeHouseFormRoofIntent`), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) (rail picker + open-end toggles), [apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/resolveHouseTerminalEndToggleRoofDraft.ts) (now a plain hipped toggle since the migration moved upstream).

### 2026-05-14 - House Roof Topology - Partial-Open Joined Topology Wavefront Fix

Area: House Roof Topology

Status: Active

Decision or mistake: clicking ONE terminal end on a U / wrap footprint produced invalid geometry (`roof_topology_face_count_mismatch:5:8`) because the wavefront-based joined-hipped builder's facet validator was strict in two places that don't hold for partial-open topologies:

1. `roofPointOnEaveBoundaryAtWrongHeight` rejected any facet whose boundary touched the eave polygon at a z != eaveHeightMm. For a slope adjacent to a stationary gable edge, the slope legitimately reaches the eave at apex z (the gable wall fills the vertical gap). The validator now accepts those raised-boundary points when `allowRaisedBoundaryPoints: true` is plumbed through; `buildJoinedRectilinearHippedRoof` opts in only when any edge is stationary, so the fully-hipped case stays strict.

2. The `face_count_mismatch` topology check compared `facets.length` to `input.edges.length`. Stationary edges intentionally produce ZERO slope facets (the vertical gable wall replaces the slope), so the expected count is `input.edges.length - stationaryEdgeCount`. Detected by counting edges with `|inwardNormal| <= ROOF_JOIN_EPSILON_MM`.

Why it mattered: before this fix, the only way to see bent-spine gable peaks on a U / wrap was to open BOTH terminal ends (which routes through `buildGabledHouseRoof`, a separate code path). Individual click-toggling was a no-op visually because the workbench fell back to invalid-geometry rendering. The user expectation (per session B) is that each terminal end is independently toggleable -- this fix makes that work for joined footprints, matching the rectangular case.

Future agents:

- `allowRaisedBoundaryPoints` is now plumbed through `buildJoinedRoofFacets`. The flag is consumed only by `roofPointOnEaveBoundaryAtWrongHeight`; other validators (finite boundary, non-zero area, simple polygon) still apply. Adding similar pre-existing-strict checks should mirror this opt-in shape.
- The stationary-edge count is derived from the edge's inward normal (`Math.hypot(inwardNormal.x, inwardNormal.y) <= ROOF_JOIN_EPSILON_MM`). If a future builder wants to encode "stationary" differently (e.g. a flag), update both the velocity treatment in `roofJoinedWavefront.ts` and the count in `roofJoinedFacets.ts`.

Current guardrail: joined-hipped facet validation must treat stationary-edge topology as a first-class case, not an error. Any new pre-existing-strict validator (raised-point checks, face counts, ridge-graph completeness) must either skip stationary edges or accept the resulting partial-open geometry; opt-in via `allowRaisedBoundaryPoints` for boundary-height checks, and subtract `stationaryEdgeCount` from any "expected facets equals edges" comparison.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofJoinedFacets.ts](../packages/geometry/src/house/roofJoinedFacets.ts) (`allowRaisedBoundaryPoints` + stationary-edge-aware face-count check), [packages/geometry/src/house/roofJoinedHipped.ts](../packages/geometry/src/house/roofJoinedHipped.ts) (passes flag when stationary edges exist), [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts) (regression test: "produces valid joined-hipped geometry when ONE terminal end is opened on a U/wrap footprint").

### 2026-05-21 - Design Workbench Testing - ModelSpaceViewport Fixture Rot

Area: Design Workbench Testing

Status: Superseded

Decision or mistake: 8 stale model-space viewport fixtures failed on `main` with `data-plan-render-status="invalid_geometry"`. These were NOT a regression in shipped code: neighbouring `PlanViewport` / `Geometry3DViewport` tests passed against the same render pipeline, and `typecheck` was clean. The failures were localised fixture rot from the milestone-13 `objectWorkbenchOverlayInput` contract change and casted test inputs around the old plan-view builder.

Why it mattered: this is the kind of failure that compounds across PRs if the surface gets touched. A future agent making any HouseModel / plan-render change will see these same 8 fail and may assume their change caused them, or worse, may add their own `as unknown` cast to keep things green. The contract-change debt has to be paid down with a real migration.

Fix path is retired with the ModelSpace/plan-view cleanup: the old `PlanViewModel` pass-through contract is removed, and plan overlay behavior is covered through `PlanViewport`, plan render graph, and interaction tests. If a similar fixture drift appears, build a focused overlay-input fixture instead of restoring the old builder function or adding broad `as unknown` casts.

Current guardrail: do NOT restore `buildPlanViewModel` as a compatibility builder or add more broad fixture casts. Use focused overlay-input fixtures plus the `PlanViewport` / `Geometry3DViewport` suites for plan render coverage.

Promoted to: None

Related docs/tests: `apps/portal/components/drawings/viewports/PlanViewport`, [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts).

### 2026-05-21 - Design Workbench Testing - ModelSpaceViewport Architectural Drift

Area: Design Workbench Testing

Status: Superseded

Decision or mistake: 2 import-guard failures in `apps/portal/lib/workbenchBreakawayImportGuards.test.ts` are real architectural violations, not stale paths. They were previously masked by ENOENT errors against the stale `Geometry3DViewport.tsx` path (file moved to `Geometry3DViewport/index.tsx` during decomposition); fixing the path in the guard test unmasked them. The two real violations:

1. **ModelSpaceViewport.tsx imports `houseFirstWorkbenchModel`** -- uses `HouseFirstDeckDraft`, `HouseFirstOpeningDraft`, `WorkbenchHouseSelection`, `WorkbenchMode` types directly. The guard treats this as a layering violation because `houseFirstWorkbenchModel` is the legacy state-compatibility model that boundary files (viewports/workbench) should not consume directly.

2. **ModelSpaceViewport.tsx does not route through `Geometry3DViewport`** -- the guard at objectWorkbenchImportGuards.test.ts:270-272 expects `ModelSpaceViewport` to import `Geometry3DViewport` with `lockedViewPreset="top"`, per the canonical architecture in the 2026-05-04 entry "Model Space Top renders through Geometry3DViewport lockedViewPreset='top'". The actual ModelSpaceViewport.tsx does not do this. Either the architecture migration was reverted/incomplete, or the guard was added speculatively before the migration landed and never enforced.

Why it mattered: same compound-cost argument as the ModelSpaceViewport stale-fixture entry above -- failures accumulate across PRs, mask real issues, and erode test-signal trust. The PR8 multi-form sequence shipped 6 PRs with these failures red, masking the genuine question of "is multi-form work breaking anything?"

Fix path is retired with the ModelSpace/rail-guard cleanup. Do not recreate `ModelSpaceViewport.tsx`, `houseFirstWorkbenchModel` imports, or the old rail import guard to satisfy historical notes.

Current guardrail: live workbench roots must stay on object-first state and the solved-artifact boundary. `apps/portal/lib/workbenchBreakawayImportGuards.test.ts` is the executable boundary; do not add new house-first, raw-module, module-index, legacy plan/section, or costing imports to workbench roots.

Promoted to: `docs/design-workbench-architecture.md` and `apps/portal/lib/workbenchBreakawayImportGuards.test.ts`.

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/components/drawings/viewports/PlanViewport](../apps/portal/components/drawings/viewports/PlanViewport).

### 2026-05-29 - Workbench Cleanup - PR-T7 House Form Inspector Cull

Area: Design Workbench / House Forms

Status: Active

Decision or mistake: restructured the house form right inspector into PRIMARY / DIMENSIONS / ADVANCED and removed dead-write or derived controls from the inspector and embedded rail. Removed surfaces included house connection, attachment strategy, storey mode, drawing rotation, disabled gable gutter readouts, duplicate selected-object diagnostics, and the Review Basis summary block.

Why it mattered: the old inspector mixed editable geometry controls with values that were either derived on the next solve, disabled, duplicated elsewhere, or useful only as solver diagnostics. That made the right rail look more powerful than it was and made future inspector changes harder to reason about.

Current guardrail: a house-form inspector control must either write a persisted object-first field that survives the next solve, or it should not be presented as an editable field. Solver diagnostics belong behind explicit diagnostics surfaces, not in the primary editing inspector. Keep the compact PRIMARY / DIMENSIONS / ADVANCED structure unless a future product change creates a new persisted editing concept.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/rail/HouseFormInspector.tsx](../apps/portal/components/drawings/rail/HouseFormInspector.tsx), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx), [apps/portal/components/drawings/rail/ObjectWorkbenchRail.tsx](../apps/portal/components/drawings/rail/ObjectWorkbenchRail.tsx), [docs/house-inspector-cull-plan.md](house-inspector-cull-plan.md) (the PR-T7 plan).

### 2026-05-29 - Workbench Cleanup - PR-T8 Appendage Feature Cull

Area: Design Workbench / House Geometry

Status: Active

Decision or mistake: removed the roof "appendage band" feature end-to-end -- types, UI, geometry solver, validation codes, fixtures, and dedicated tests. The feature surfaced an editable secondary roof band attached to a chosen house-edge ("hostEdge") with its own pitch, drop, and form, but no production flow consumed it and the right inspector exposed dead fields with no downstream effect.

Why it mattered: the appendage controls were dead UI -- they sat in the inspector but nothing in cost engine, rendering, or estimates read the resulting `HouseRoofModel.appendage` shape. Keeping them around accumulated drag (validation branches, capability flags, host-edge support analysis, geometry-side perimeter builders, and ~12 test surfaces) without delivering a feature. Each subsequent house-roof PR had to thread the appendage shape through, increasing the cognitive load on otherwise-simple changes.

Current guardrail: shape edits to the house roof (pitch tweaks at one corner, mansard bands, lean-tos) go through the gumball in the 3D viewport in a future PR -- not through inspector number fields. If a future engineer reaches for an "add a roof band to this edge" inspector control again, treat it as a smell that the gumball is missing a capability instead of resurrecting the appendage feature. The deleted code lives at the PR-T8 commit -- check git history before re-deriving.

What was deleted (production source returns zero hits for `[Aa]ppendage` outside tombstone comments + tests):

- The retired roof-appendages module was deleted entirely. The single load-bearing function (`buildSharedHouseRoof`) was lifted into `packages/geometry/src/house/sharedHouseRoof.ts`.
- Geometry types: `HouseRoofAppendageForm`, `HouseRoofAppendageSupport`, `HouseRoofAppendageHostRun`, `HouseRoofAppendageSupportAnalysis`, plus the `roofAppendage` field on `RawHouseInput` and friends.
- Geometry helpers: `deriveHouseRoofAppendageSupport`, `deriveHouseRoofAppendageSupportedHostEdges`, `deriveHouseRoofAppendageSupportFromFootprint`, `deriveHouseRoofAppendageSupportFromPrimaryRoof`, `buildHouseRoofAppendageBand`, `buildMonoAppendagePerimeterEdges`, `buildAppendagePerimeterEdges`, `resolveHouseRoofAppendageForm`, `formatAttachmentSideList`.
- Capability flags: `HouseRoofCapabilities.appendageSupported`, `HouseRoofCapabilities.appendageFootprintRequirement`, `HouseRoofControls.appendage`.
- Validation: `'invalid_appendage_topology'` and `'invalid_appendage_host_edge'` validation codes; `blockedBy: 'appendage'`.
- Portal state: `HouseRoofAppendageForm`, `HouseRoofModel.appendage`, `HouseRoofModel.appendageSupportedHostEdges`, `HouseRoofModel.appendageSupportReason`, `HouseRoofProvenance.appendage`, `HouseFirstRoofDraft.appendage`, plus `isHouseRoofAppendageForm`, `normalizeAppendageForm`, `hasExplicitRoofAppendage`, `roofFormAcceptsAppendage`.
- UI: appendage controls in `HouseFormRoofSections.tsx`, appendage rows in `WorkbenchDiagnosticsPanel.tsx`, appendage inspector model fields in `objectWorkbenchInspectorModel.ts` and `objectWorkbenchStatusModel.ts`.
- Tests: 4 dedicated `houseModel.test.ts` blocks, retired house-first/store appendage tests, the retired appendage gate suite, the retired appendage invalid-diagnostics test, plus appendage entries scrubbed from every fixture (`objectFirstWorkbenchFixtures.ts`, historical house-first fixtures, multiple test fixtures inline).

Legacy storage: any persisted draft still carrying an `appendage` block is silently dropped at the workbench draft normalize boundary (`normalizeHouseFormRoofIntent`); no migration path is needed because the only consumers were the inspector + the deleted geometry path.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/sharedHouseRoof.ts](../packages/geometry/src/house/sharedHouseRoof.ts), [packages/geometry/src/houseRoofValidation.ts](../packages/geometry/src/houseRoofValidation.ts), [packages/geometry/src/houseRoofValidation.test.ts](../packages/geometry/src/houseRoofValidation.test.ts), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx), [docs/appendage-removal-plan.md](appendage-removal-plan.md) (the PR-T8 plan).

### 2026-05-29 - Workbench Cleanup - PR-T9 Deck Inspector Cull

Area: Design Workbench / Deck

Status: Active

Decision or mistake: stripped the deck right-rail inspector of three dead fields (`deck.label`, `deck.kind`, `deck.elevationMode`), one snap-derived field that had a misleading inspector dropdown (`hostEdgeId`), and two duplicate action buttons (top-row `Add deck` + `Custom outline`). Same shape as PR-T8 (atomic delete + verify).

Why it mattered: deck right rail was the same shape as the pre-T7 house rail — manual labels nothing reads, a `kind` enum nothing branched on, an `elevationMode` dropdown whose three options collapsed to a single boolean branch (clamp negative offsets to ground or don't) that the user had never observed firing, and a host-edge dropdown that misled users into thinking they could override the snap engine. Each field added cost to every PR that touched the deck pipeline.

Current guardrail:

- `hostEdgeId` is snap-derived only. The PR-T9 implementation wrote it through the now-retired `buildDeckCommitPatch`/`deckCommitAdapter` path; the live Plan tool path commits deck geometry through `buildDeckTransformPatch`. If a future inspector control re-exposes manual edge selection, treat it as a smell that the snap-target picker is missing a UI affordance, not that the dropdown should come back.
- Deck names auto-derive from list index (`Deck ${index + 1}`). If a future use case needs persistent identity (e.g. PDF callouts), reintroduce as a derived field, not a manual one.
- `elevationMode` is gone — negative `levelOffsetMm` is no longer clamped to ground. A user can now sink a deck below ground level by typing a negative offset. If this bites, the boolean `sitsOnGround` comes back as a one-line addition.
- Costing recon (`rg 'kind|elevationMode' packages/costing/src`) confirmed zero hits before deletion. Re-run before similar culls.

What was deleted (production source returns zero hits for these names outside tombstone comments + negative-assertion tests):

- Portal state types: `DeckKind`, `DeckElevationMode` (both copies — `objectFirstWorkbenchModel.ts` + `houseFirstWorkbenchModel.ts`), plus `label` / `kind` / `elevationMode` fields on `DeckObjectModel`, `ObjectFirstDeckDraft`, `DeckModel`, `HouseFirstDeckDraft`, `ObjectWorkbenchDeckPatch`.
- Type guards: `isDeckKind`, `isDeckElevationMode`.
- Geometry types: `HouseDeckKind`, `HouseDeckElevationMode`, plus `name` / `kind` / `elevationMode` on `HouseDeckConfig`, `HouseDeck3D`, `RawHouseInput.decks[]`.
- Adapter logic: the elevationMode-branched `topSurfaceElevationMm` calc (now unconditionally `= levelOffsetMm`), the detached_threshold_alignment validation emission, the elevationMode-based deck classification (now `isAttached ? 'threshold_attached' : 'ground_supported'`).
- UI: deck-name TextField, deck-kind SelectField, deck-host-edge SelectField, deck-elevation SelectField in `DeckInspectorSections.tsx`. Top-row `Add deck` / `Custom outline` action buttons (left rail and Shape dropdown remain the canonical entry points).
- Options arrays: `DECK_KIND_OPTIONS`, `DECK_ELEVATION_OPTIONS` in `objectRailShared.tsx`.

Legacy storage: persisted drafts still carrying `label` / `kind` / `elevationMode` are silently dropped at `normalizeObjectFirstDeckDraft`. No migration script.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/rail/DeckInspectorSections.tsx](../apps/portal/components/drawings/rail/DeckInspectorSections.tsx), [apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts](../apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.ts), [apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchDeckGeometry.test.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [docs/deck-inspector-cull-plan.md](deck-inspector-cull-plan.md) (the PR-T9 plan).

### 2026-05-29 - Workbench Geometry - Multi-House PR3 Project House Geometry Registry

Area: Workbench Geometry

Status: Active

Decision or mistake: introduced a project-level house geometry registry as the canonical derived source for per-form house references, host-excluded 3D scene composition, and PlanViewport house snap targets in multi-house scenes. Replaces the previous pattern of each per-pergola `RawGeometryModuleInput.houseContext` carrying its own copy of the host house geometry — which produced duplicate scene objects and inconsistent snap targets when more than one pergola attached to the same house form.

Why it mattered: with multi-house support landing (PR3 of the multi-house sequence), the per-pergola houseContext shape stops being a 1:1 source of truth. Multiple pergolas pointing at the same house produced duplicate render objects with colliding ids; PlanViewport snap targets fired against the per-pergola copy, not the canonical project-level house. The registry pattern lifts house geometry to project scope so every consumer reads the same derived artifact.

Current guardrail: scene composition + snap-target derivation must read from the project house geometry registry, not from per-pergola `RawGeometryModuleInput.houseContext`. Per-pergola `houseContext` remains a Phase 2 deletion target (cleanup blocked on the solve loop becoming per-object — see [Phase 2 Plan](design-workbench-phase-2-plan.md)). Host house ids now flow through raw/normalized geometry and solver output directly; do not reintroduce portal-side scene retag bridges.

Promoted to: None

Related docs/tests: [apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx](../apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts).

### 2026-05-29 - Workbench Geometry - Multi-Object PR2 Runtime Pergola Solve Sources

Area: Workbench Geometry

Status: Active

Decision or mistake: object-first pergolas without matching calculator modules now solve through explicit runtime-only solve sources. The workbench synthesizes the temporary `CalculatorModuleInputs` adapter in memory so the existing renderer can consume it, but it does not write a fake row to persisted `inputs.modules[]`.

Why it mattered: enabling Add Pergola by persisting a temporary module row would have made the old calculator module bridge more comfortable instead of moving toward the object-first north star. Runtime solve sources let orphan pergolas render/select now while keeping the persistence model pointed at `objectFirst.pergolas`.

Current guardrail: do not create persisted calculator modules just to make object-first pergolas visible or selectable. If code needs calculator-shaped fields during the coexist period, keep them in a named runtime adapter and mark them for deletion with the per-object solve rewrite. Freestanding mono defaults need at least four posts because the geometry solver rejects the two-post layout.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts).

### 2026-05-29 - Workbench Geometry - Multi-Object PR3 Freestanding Add Pergola

Area: Workbench Geometry

Status: Active

Decision or mistake: Add Pergola now creates a freestanding `objectFirst.pergolas[]` draft, selects it, and lets the runtime object-first pergola solve-source path render it. The action does not create or persist a calculator module row.

Why it mattered: this is the first user-visible multiple-pergola creation step. If it had written `inputs.modules[]` rows or asked the user to pick a host before creation, it would have rebuilt the legacy module/host workflow instead of the object-first north star.

Current guardrail: new pergolas are born freestanding with solver-valid defaults and snap later creates relationships. Do not add host-picking add flows or fake persisted module rows for visibility, selection, or costing during the coexistence period.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [apps/portal/components/drawings/rail/objectTree/objectTree.test.tsx](../apps/portal/components/drawings/rail/objectTree/objectTree.test.tsx).

### 2026-05-29 - Workbench Geometry - Multi-Object PR4 Plan Pergola Selection

Area: Workbench Geometry

Status: Active

Decision or mistake: non-active project pergola outlines are no longer passive-only plan context. The context `pergola_reference:<id>` shape is rendered as a hit target and routed through the same pergola-id selection resolver used by rail and inspector selection.

Why it mattered: a newly added or non-active pergola could be visible but not directly selectable from the plan, which preserved the old active-module-only editing assumption. Routing by `pergolaId` keeps transient object-first pergolas editable without inventing persisted calculator modules.

Current guardrail: selecting a pergola must resolve the matching solved entry by `pergolaId` across persisted and transient runtime modules. If no entry exists, keep the current module index; never silently select module 0.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/pergolaSelectionState.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/pergolaSelectionState.ts), `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, [apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/selectShape.test.ts).

### 2026-05-30 - Workbench Geometry - Production-Aligned QA Fixture Routes

Area: Workbench Geometry

Status: Active

Decision or mistake: hidden workbench fixture routes must mount the same project-level render contract as the production workbench route. The `/qa/design-workbench-fixture` route now passes `projectPlanProjection`, project pergola/context overlays, canonical house snap sources, active object refs, hover state, and projection-only model interactions into `DrawingWorkbench` instead of relying on active-module-only fixture defaults.

Why it mattered: the multi-house/two-pergola regressions were caused by active-module render sources. A Playwright fixture that omitted the production project-level props would have tested a parallel surface and could pass while production regressed, or fail on behavior that users no longer exercise.

Current guardrail: fixture routes are allowed to be authless and baked, but they must not simplify workbench render ownership. If production uses project-level object registries, the fixture route must pass those same inputs and only vary the data source.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.tsx](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/DesignWorkbenchFixtureClient.tsx), [apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchFixtures.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-05-30 - Workbench House Forms - Removable Peer Forms

Area: Workbench House Forms

Status: Active

Decision or mistake: house forms are peers. User-visible labels are derived from current order (`House 1`, `House 2`, ...), and existing ids such as `house-main` are not presentation or primary-role signals.

Why it mattered: protecting `house-main`, displaying it as `House`, or re-creating it after the final form was removed kept the old single shared-house model alive inside the object-first workbench. That made removal and attachment behavior look inconsistent and encouraged fallback retargeting.

Current guardrail: when `objectFirst.houseAssembly` exists, its `houseForms[]` array is authoritative even when empty. Removing a house form must not retarget attached objects or silently synthesize a replacement; unresolved hosts are the correct object-first state until the user creates or snaps a new relationship.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchFixtures.test.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchFixtures.test.ts).

### 2026-05-31 - Workbench House Forms - Derived Roof Axis And Preset Seeds

Area: Workbench House Forms

Status: Active

Decision or mistake: hipped ridge axis is a solver-derived field, not normal user-facing house identity or a primary design control. Footprint presets are creation/edit seeds and provenance only; rail and inspector presentation must not describe a house form by raw preset id.

Why it mattered: exposing ridge axis made users fix a solver implementation detail manually when switching between U/wrap/recess footprints. Displaying raw preset ids (`wrap_right footprint`) also made presets look like the object identity even after the footprint became object-owned geometry.

Current guardrail: reconcile hipped `roofIntent.ridgeAxis` from the edited house form's current footprint by `houseFormId` before status/solve/render and on footprint writes. Keep presets available as seed controls, but use order-derived house labels plus neutral footprint readiness/custom status for presentation.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts](../apps/portal/lib/drawings/state/houseFormRoofIntentForFootprint.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormFootprintDraftActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/houseFormFootprintDraftActions.ts), [apps/portal/lib/drawings/state/drawingWorkbenchRailModel.ts](../apps/portal/lib/drawings/state/drawingWorkbenchRailModel.ts).

### 2026-05-31 - Workbench House Forms - Roof Intent By Id

Area: Workbench House Forms

Status: Active

Decision or mistake: house roof form, material, pitch, and open-end edits must write to an explicit `houseFormId`. Plan terminal-end hit targets carry their owning house form id, and clicks with missing ownership no-op instead of editing House 1.

Why it mattered: the shared-house roof draft path kept the original single-house assumption alive. When multiple house forms were visible, roof/open-end interactions could silently mutate the first form and make the selected form's Plan/3D roof body look disconnected from the inspector.

Current guardrail: normal roof writes go through `commitHouseFormRoofIntent({ houseFormId, roof })`; the old `commitSharedHouseRoofDraft` legacy wrapper is retired. New terminal-end or roof-control routes must preserve owner metadata from geometry through selection routing to the draft commit, and must not use array index 0 as a fallback.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/houseFormRoofDraftActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/houseFormRoofDraftActions.ts), [apps/portal/components/drawings/viewports/selection/selectionRouter.ts](../apps/portal/components/drawings/viewports/selection/selectionRouter.ts), [packages/geometry/src/topProjection.ts](../packages/geometry/src/topProjection.ts).

### 2026-05-31 - Plan Rendering - House Projection Health And Selected-Only Overlays

Area: Plan Rendering

Status: Active

Decision or mistake: project Plan fallbacks must be diagnosed at the solved-model boundary, and selected-house overlays must only exist for an explicit selected `houseFormId`. No-selection must not manufacture House 1 chrome or overlay geometry.

Why it mattered: after visible body, hit-target, hover, and roof-write ownership were separated, the remaining large outline was a legitimate `house_reference` fallback for a house that lacked a usable roof/roof-material Plan body. Without solved-model health, the UI looked like another paint-layer bug. Without selected-only overlay resolution, no-selection could still inject first-house overlay state and hide the real render source.

Current guardrail: `WorkbenchSolvedModel.projectHouseProjectionHealth` is the project-level diagnostic source for house Plan projection stages. Plan overlays are selected-object chrome/status only; visible bodies come from `projectPlanProjection`, and no selected house means no object-workbench house overlay.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectHouseProjectionHealth.ts](../apps/portal/lib/drawings/state/projectHouseProjectionHealth.ts), `apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.canvas.test.tsx`, [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts). The old selected-house overlay input helper was retired after `projectPlanProjection` became the live body source.

### 2026-05-31 - Workbench House Forms - Selected Status Is Nullable

Area: Workbench House Forms

Status: Active

Decision or mistake: selected-house status must be a nullable, object-id-addressed view over project house-form status. `houseFormsById` can carry status for every row, but selected-house inspector context, trust aggregation, diagnostics, and Plan overlay status must not borrow array index 0 when no house is selected.

Why it mattered: the previous facade kept a temporary `status.houseForm` alias alive by falling back to the first form. That made no-selection and invalid-selection states look like House 1 was active, which obscured whether the remaining Plan issue came from selected chrome, fallback projection health, or a real House 2 geometry problem.

Current guardrail: call sites that need a selected house must use `selectedHouseFormStatus` / `selectedHouseFormId` and handle `null`. Row lists use `houseFormsById[houseForm.id]`; project diagnostics use project-level health; no selected house means no selected-house status.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), [apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchInspectorModel.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts), [apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts](../apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts).

### 2026-05-31 - Workbench Actions - Object-Owned House Context

Area: Workbench Actions

Status: Active

Decision or mistake: object-workbench action paths must resolve house context from the target object owner, and unresolved ownership is a real nullable state. They must not use `activeHouseForm ?? houseForms[0]`, active module house position, or any other first-house fallback.

Why it mattered: after status/render paths became selected-object aware, action paths could still silently encode deck/opening/outline commits against House 1. That kind of write path makes later Plan diagnostics misleading because the stored object has already been mutated through the wrong house frame.

Current guardrail: selected house actions resolve by selected `houseFormId`; deck actions resolve through `deck.attachment.host.objectId`; opening actions resolve through `opening.sourceFormId`; pergola house context resolves only through an explicit house-form host. Missing context no-ops or returns a validation error instead of borrowing House 1.

Promoted to: None

Related docs/tests: [apps/portal/app/staff/projects/[projectId]/design-workbench/objectWorkbenchActionContext.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/objectWorkbenchActionContext.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/useObjectWorkbenchActions.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/commitOutlineEdit.ts](../apps/portal/app/staff/projects/%5BprojectId%5D/design-workbench/commitOutlineEdit.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchDraft.test.ts).

### 2026-06-01 - Workbench Rendering - Project Object Render Health

Area: Workbench Rendering

Status: Active

Decision or mistake: project render surfaces may only show committed bodies for object-owned healthy geometry. Invalid or unresolved object-first pergolas must stay visible as reference/diagnostic fallback only; they must not be painted into Plan/3D as normal pergola roof/panel/post bodies.

Why it mattered: the multi-object fixture showed an unresolved Pergola 2 still producing committed Plan and 3D geometry by way of coexist solve outputs. That made the UI look like a Plan overlay bug, but the real ambiguity was upstream: render consumers could not tell whether a body was healthy committed geometry or a fallback solve artifact.

Current guardrail: project rendering flows through `buildProjectObjectRenderPipeline`, which emits project Plan projection, per-house projection health, per-pergola render health, and gated Plan/3D body sources. Persisted module-backed pergolas keep their coexist render path, but transient object-first pergolas with unresolved hosts are suppressed from committed body layers and named by id in diagnostics.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts](../apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - Pergola Diagnostic Fallbacks

Area: Workbench Rendering

Status: Active

Decision or mistake: suppressing unhealthy pergolas from committed body layers is not enough; unresolved pergolas need an explicit diagnostic fallback path.

Why it mattered: after committed-body gating, an unresolved gable pergola could either disappear from 3D or paint as a dark Plan body if its `pergola_reference` outline re-entered the generic committed-body graph. Both outcomes made the fixture look broken even though the health gate was correct.

Current guardrail: unresolved pergola references flow through `projectPergolaFallbackPlanShapes` and the 3D `project_pergola_fallbacks` reference-line layer. They may be visible/selectable as transparent context outlines or reference lines with owner diagnostics, but must never use normal pergola roof/panel/post committed body styling.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/projectPergolaViewerScene.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - First-Class Diagnostic Fallbacks

Area: Workbench Rendering

Status: Active

Decision or mistake: diagnostic fallbacks are first-class render outputs. They must not live in committed body layers, hit-target paint, selection/hover chrome, or generic context overlays.

Why it mattered: invalid/custom house roof projection fallbacks and unresolved pergola references were visually ambiguous. A `house_reference` fallback could look like selected-object chrome, while unresolved pergolas could either disappear or borrow generic context styling that was too faint to diagnose.

Current guardrail: Plan render graph exposes `diagnosticFallbacks` separately from `committedBodies` and `hitTargets`; house reference fallbacks render as muted outline-only diagnostics; unresolved pergola fallbacks render as diagnostic Plan outlines and non-committed 3D reference lines with owner/reason metadata. Healthy geometry remains the only source of committed bodies.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/views/plan/planRenderGraph.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.ts), [apps/portal/lib/drawings/views/plan/planDiagnosticFallbacks.ts](../apps/portal/lib/drawings/views/plan/planDiagnosticFallbacks.ts), [apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts](../apps/portal/lib/drawings/views/plan/planRenderGraph.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/ReferenceLineObject.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/ReferenceLineObject.tsx).

### 2026-06-01 - Workbench Rendering - House Render Health By Form

Area: Workbench Rendering

Status: Active

Decision or mistake: house render health is owned per `houseFormId` before Plan or 3D consume project render data. The mixed project render pipeline may orchestrate houses and pergolas, but it must not infer house failure stages from the final merged projection.

Why it mattered: custom and edited house forms could degrade to a large `house_reference` diagnostic fallback, but the old diagnostics only counted shapes after project composition. That made it unclear whether the failing stage was reference geometry, model construction, roof planes, roof-material projection, Plan body classification, or 3D scene output.

Current guardrail: `projectHouseRenderPipeline` emits pre-classified house Plan shapes plus per-house stage diagnostics (`referencePresent`, model/wall/roof counts, roof/roof-material ids, 3D body counts, `failureStage`, `diagnosticCode`). `buildProjectPlanProjection` consumes those house shapes and does not rebuild house projection inline.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts](../apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - House Fixture Health Ownership

Area: Workbench Rendering

Status: Active

Decision or mistake: house render health should have one implementation (`projectHouseRenderPipeline`) and custom/multi-object repro fixtures should live in focused fixture modules, not in the registry entrypoint.

Why it mattered: the custom-house screenshot debugging was obscured by a growing fixture registry and a duplicate post-composition health helper. Once health assertions were tightened, the baked custom fixture reported healthy houses through Plan and 3D, which means that fixture does not reproduce the visible failure and future bug work needs a more exact state fixture/export before changing render policy again.

Current guardrail: add new house/pergola repros in focused fixture modules, assert `failureStage`, Plan/3D body counts, and fallback ids in fixture tests, and keep `projectHouseRenderPipeline` as the single source for per-house render health before Plan/3D consume it.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/sanctuaryWorkbenchFixtureBuilders.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchFixtureBuilders.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchMultiObjectFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchMultiObjectFixtures.ts), [apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts](../apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Rendering - Project 3D Preview Ownership

Area: Workbench Rendering

Status: Active

Decision or mistake: project 3D preview must never use the active module preview as committed geometry for suppressed or unresolved project objects. A ready module may only act as a preview carrier for config/camera metadata when the scene is rebuilt from project-owned house geometry and diagnostic fallbacks.

Why it mattered: unresolved Pergola 2 could be suppressed by project render health but still appear as committed roof geometry in 3D through the active-module preview escape hatch. That made Plan and 3D disagree about whether the pergola was healthy, and it obscured the remaining house projection issue.

Current guardrail: superseded by the 2026-06-11 breakaway. Project 3D preview assembly now flows from the solved project artifact and live workbench runtime must not carry active-module preview fallbacks. Diagnostic/reference geometry is explicit and must not be committed as healthy geometry.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/lib/drawings/state/projectPergolaViewerScene.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-01 - Workbench Geometry - House Form Input Boundary

Area: Workbench Geometry

Status: Active

Decision or mistake: house geometry must cross one object-id-addressed input boundary before Plan or 3D consume it. Render pipelines must not infer a house form from the first form, `house-main`, active module input, or active pergola state.

Why it mattered: the remaining house-form screenshots looked like Plan overlays, but the persistent symptom was missing or invalid roof geometry for a specific object. Without a per-house input boundary, diagnostics could name final render fallout but not the first failing stage.

Current guardrail: use `buildHouseFormGeometryInput({ projectModel, houseFormId })` for project house render assembly. It resolves exactly one form and reports typed stages (`missing_house_form`, `invalid_footprint`, `missing_geometry_input`, `missing_model`, `missing_roof_model`, `missing_plan_body`, `missing_3d_body`, `none`) with no fallback to any other house or module. Gated debug exports include `houseGeometryInputsById` so live failures can be captured as fixtures.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/houseFormRawGeometry.ts](../apps/portal/lib/drawings/state/houseFormRawGeometry.ts), [apps/portal/lib/drawings/exportRoofFailureRepro.ts](../apps/portal/lib/drawings/exportRoofFailureRepro.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts).

### 2026-06-02 - Geometry Tests - Stage-Owned House Model Coverage

Area: Geometry Tests

Status: Active

Decision or mistake: house-model solver coverage should be owned by geometry stage or family. `houseModel.test.ts` should remain a small public-entry smoke suite, not the place for every roof topology, attachment, solids, and preset assertion.

Why it mattered: the 3,700+ line house-model integration test hid the failing house-form roof path inside broad coverage and made future solver fixes harder to review safely.

Current guardrail: add new package house solver tests under `packages/geometry/src/house/` by stage/family. Shared fixtures can live in `houseModelTestSupport.ts`, but stage-specific behavior should not grow `houseModel.test.ts`.

Promoted to: None

Related docs/tests: [packages/geometry/src/houseModel.test.ts](../packages/geometry/src/houseModel.test.ts), [packages/geometry/src/house/houseModelTestSupport.ts](../packages/geometry/src/house/houseModelTestSupport.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofOpenEndsIntegration.test.ts](../packages/geometry/src/house/roofOpenEndsIntegration.test.ts).

### 2026-06-02 - Workbench Geometry - Captured Fixture Gate For Solver Fixes

Area: Workbench Geometry

Status: Active

Decision or mistake: screenshot-only house roof failures are not enough evidence for geometry solver changes. A solver fix must be driven by an exact captured debug fixture payload from the real staff workbench.

Why it mattered: repeated approximation fixtures improved ownership and diagnostics but did not reproduce the user's visible failure. Without the live payload, changing the roof solver risks fixing synthetic cases while the real object-first state still fails at a different stage.

Current guardrail: bake captured live failures through `sanctuaryWorkbenchCapturedFixtures.ts` using the gated `Copy debug fixture payload` output. If no exact payload is available, land only fixture/import/harness improvements and do not change solver behavior.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts), [apps/portal/lib/drawings/exportRoofFailureRepro.ts](../apps/portal/lib/drawings/exportRoofFailureRepro.ts), [playwright/support/workbenchCapturedRepro.test.ts](../playwright/support/workbenchCapturedRepro.test.ts).

### 2026-06-02 - Workbench Geometry - Roof Stage Diagnostics Must Be Render-Critical

Area: Workbench Geometry

Status: Active

Decision or mistake: roof-stage diagnostics must report the first missing render-critical stage, not an optional intermediate collection when valid committed roof bodies already exist.

Why it mattered: the first exact captured staff-workbench payload showed a mono roof with valid roof planes, valid QA, Plan roof-material bodies, and 3D roof-material scene bodies, but diagnostics still reported `eave_polygon_construction_failed` because the separate eave polygon arrays were empty. That made a healthy render path look like a solver failure and obscured real remaining house-form issues.

Current guardrail: package roof-stage diagnostics may classify eave construction as failed only when the missing eave output prevents downstream roof body/material generation. Mono roofs with valid roof planes and committed roof body/material output are eave-stage healthy even if they do not populate a separate eave polygon list.

Promoted to: None

Related docs/tests: [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/house/roofModelPipeline.test.ts](../packages/geometry/src/house/roofModelPipeline.test.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts), [playwright/support/workbenchCapturedRepro.test.ts](../playwright/support/workbenchCapturedRepro.test.ts).

### 2026-06-02 - Workbench Debugging - Multi-House Capture Verifier

Area: Workbench Debugging

Status: Active

Decision or mistake: a valid workbench debug export is not automatically a valid solver fixture for the multi-house roof failure. The capture must match the bug class before it is baked or used to justify geometry changes.

Why it mattered: the first agent-access capture of the provided staff workbench URL produced no object-first house assembly and only healthy `house-main` diagnostics. Baking that payload as a multi-house repro would repeat the previous failure mode: improving diagnostics while not fixing the visible multi-house bug.

Current guardrail: run `npm run workbench:capture:verify` for this lane. It requires object-first state, at least two house forms, per-house diagnostics, and at least one non-healthy or inconsistent house roof/render stage. If the verifier rejects the page, land tooling/evidence improvements only and do not change solver behavior.

Promoted to: None

Related docs/tests: [playwright/support/workbenchCaptureVerifier.ts](../playwright/support/workbenchCaptureVerifier.ts), [playwright/workbench.capture-verify.spec.ts](../playwright/workbench.capture-verify.spec.ts), [docs/workbench-captured-repro-workflow.md](workbench-captured-repro-workflow.md), [docs/testing-and-qa.md](testing-and-qa.md).

### 2026-06-02 - Agent Tooling - Shared Page Debug Exports

Area: Agent Tooling

Status: Active

Decision or mistake: complex portal page bug reports should capture the shared gated page debug export before implementation changes. Screenshots are useful evidence, but they are not enough for routes with server state, client state, local drafts, scenario data, or render diagnostics.

Why it mattered: recent workbench debugging improved architecture but did not visibly fix the bug until the exact failing state could be captured. The same pattern should apply across project, estimate, quote, schedule, running jobs, design list, and future complex pages.

Current guardrail: use `PortalPageDebugExport` for local/staging/debug-only page diagnostics, expose it with `data-portal-debug-export="true"`, and read it in browser specs through `readPortalPageDebugExport` / `expectPortalDebugExport`. Routine browser gates may read debug exports but must not mutate app data.

Promoted to: None

Related docs/tests: [apps/portal/lib/debug/portalPageDebugExport.ts](../apps/portal/lib/debug/portalPageDebugExport.ts), [playwright/support/portalAgent.ts](../playwright/support/portalAgent.ts), [docs/portal-route-catalog.md](portal-route-catalog.md), [docs/testing-and-qa.md](testing-and-qa.md).

### 2026-06-02 - Agent Tooling - Portal Agent Scorecard

Area: Agent Tooling

Status: Active

Decision or mistake: portal-agent quality should be catalog/report driven through a shared scorecard, not manually inferred from screenshots, one-off browser specs, route lists, or local memory.

Why it mattered: PR-Agent.1-5 created authenticated access, route cataloging, seeded scenarios, page debug exports, and shared browser evidence. Without one concise report, agents still had to inspect scattered files to decide whether the next best lane was route coverage, scenarios, debug exports, evidence adoption, or general repo health.

Current guardrail: use `npm run portal:agent-scorecard` before choosing agent-readiness or strictness PRs. The command reads existing catalogs/reports only, supports JSON output for automation, and must not run browsers, provision users, seed scenarios, or expose credentials.

Promoted to: None

Related docs/tests: [docs/portal-agent-scorecard.md](portal-agent-scorecard.md), [playwright/support/portalAgentScorecard.ts](../playwright/support/portalAgentScorecard.ts), [scripts/portal-agent-scorecard.ts](../scripts/portal-agent-scorecard.ts), [playwright/support/portalAgentScorecard.test.ts](../playwright/support/portalAgentScorecard.test.ts).

### 2026-06-02 - Agent Tooling - Portal Agent Strictness Ratchet

Area: Agent Tooling

Status: Active

Decision or mistake: strictness ratchets must start with stable, changed-safe coverage baselines and must not block broad legacy pressure or unrelated repo-health debt.

Why it mattered: PR-Agent.1-6 created real portal-agent tooling, but immediately making broad repo-health metrics strict would create noisy failures from existing debt. The first useful strict check is "do not go backwards" on the agent-readiness baseline that was just established.

Current guardrail: use `npm run portal:agent-scorecard:strict` to protect route catalog coverage, scenario coverage, exported debug-route coverage, seeded scenario coverage, and shared browser evidence adoption. Keep `npm run portal:agent-scorecard` advisory and keep repo-health metrics advisory until a later changed-file-safe ratchet explicitly owns them.

Promoted to: None

Related docs/tests: [docs/portal-agent-scorecard.md](portal-agent-scorecard.md), [playwright/support/portalAgentScorecard.ts](../playwright/support/portalAgentScorecard.ts), [scripts/portal-agent-scorecard.ts](../scripts/portal-agent-scorecard.ts), [playwright/support/portalAgentScorecard.test.ts](../playwright/support/portalAgentScorecard.test.ts).

### 2026-06-02 - Workbench Debugging - Captured Repro Workflow

Area: Workbench Debugging

Status: Active

Decision or mistake: workbench captured repros must be validated and attached through the shared Playwright helper before any exact payload is baked into the captured fixture lane. Browser specs may read and attach payloads as evidence, but must not write captured payloads to tracked files.

Why it mattered: repeated screenshot-driven workbench PRs improved architecture but did not reliably reproduce the live failure. PR-Agent.8 makes the live payload itself executable evidence by validating the required snapshot, object-first state, selected state, house geometry inputs, project house health, pergola health, and project preview source before solver or render changes begin.

Current guardrail: use `readWorkbenchCapturedReproPayload(page)` / `attachWorkbenchCapturedReproPayload(testInfo, page)` for workbench browser evidence. Keep `CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES` limited to exact copied staff-workbench payloads intentionally pasted through `buildCapturedSanctuaryGeometryWorkbenchFixture`; screenshot approximations do not belong in the captured lane.

Promoted to: None

Related docs/tests: [docs/workbench-captured-repro-workflow.md](workbench-captured-repro-workflow.md), [playwright/support/workbenchCapturedRepro.ts](../playwright/support/workbenchCapturedRepro.ts), [playwright/support/workbenchCapturedRepro.test.ts](../playwright/support/workbenchCapturedRepro.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts), [apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts](../apps/portal/lib/drawings/sanctuaryWorkbenchCapturedFixtures.ts).

### 2026-06-03 - Design Workbench - Durable Object-First Draft Save

Area: Design Workbench

Status: Active

Decision or mistake: object-first workbench state must be durable before live multi-house geometry bugs can be captured or fixed reliably. IndexedDB-only drafts are useful for local editing, but they are not enough for agent-access repros because leaving and reopening the workbench can recreate the legacy snapshot-only `house-main` state.

Why it mattered: the multi-house roof failure could not be baked from the provided staff workbench URL because the reloaded project had no saved `objectFirst` assembly. Without a server-backed object-first draft save, agents and browser tests would keep debugging transient UI states that cannot survive reload.

Current guardrail: persist `EstimateDrawingDraft.objectFirst` through authenticated staff estimate boundaries, keep it out of legacy `inputs.modules[]`, and make saved object-first state the reload source of truth. Legacy `house-main` synthesis is allowed only when no saved object-first draft exists.

Promoted to: None

Related docs/tests: [docs/design-workbench-phase-2-plan.md](design-workbench-phase-2-plan.md), [apps/portal/lib/estimates/drawingEdits.ts](../apps/portal/lib/estimates/drawingEdits.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchEstimateClient.tsx).

### 2026-06-03 - Design Workbench - House Roof Intent Provenance

Area: Design Workbench

Status: Active

Decision or mistake: unauthored object-first house roof defaults must not silently determine roof topology. The saved multi-house repro showed persisted `roofIntent.form: "mono"` values that were not authored design choices, so Plan and 3D could render mono-like roofs while diagnostics still looked healthy.

Why it mattered: house roof topology is object-owned state. Without provenance, a legacy/default mono value can leak into a specific `houseFormId` and make the rendered roof disagree with the user's expected default, while authored mono roofs still need to remain supported.

Current guardrail: resolve house roof intent through the object-first authorship boundary before status, raw geometry input, project Plan, or 3D render health consume it. Unauthored mono repairs to the canonical house default (`hipped`); authored mono is preserved. Diagnostics must expose raw form, resolved form, authorship, source, and repair code per `houseFormId`.

Promoted to: None

Related docs/tests: [docs/design-workbench-phase-2-plan.md](design-workbench-phase-2-plan.md), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts).

### 2026-06-03 - Workbench House Forms - Custom Hipped Eave Topology Repair

Area: Workbench House Forms

Status: Active

Decision or mistake: custom hipped house roofs with narrow returns can fail package roof QA after footprint/eave topology solving while the selected house status still reports only a generic approximate state. Render code must not paper over this by fabricating roof bodies or borrowing another house; the package roof solve must classify and repair the first failing eave topology stage when a constrained roof-only repair is possible.

Why it mattered: House 4-style custom footprints kept their wall geometry in Plan/3D but lost the 3D roof because `roofQaStatus` was invalid (`overlapping_boundary_fragments`). Plan could look clean after the house-owned projection fix, but 3D still dropped roof solids and the inspector trust chip hid the package QA failure.

Current guardrail: custom hipped eave repair is package-owned and render-only. The saved wall footprint and user eave setting remain unchanged; repaired models expose `roofEaveOffsetRepairStatus`, `roofEaveOffsetRepairCode`, and requested/effective eave metadata. Plan projection consumes the repaired eave package from the same `HouseModel3D` that produces 3D roof solids. Workbench status must use final package roof QA, not selection validation alone.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/eaveOffsetRepair.ts](../packages/geometry/src/house/eaveOffsetRepair.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-11 - Workbench House Forms - Topology-Aware Eave Offset Boundary

Area: Workbench House Forms

Status: Active

Decision or mistake: some fully hipped custom orthogonal house roofs fail before roof topology because adjacent-edge miter eave offset can self-overlap on edited narrow recesses. Treating this as a roof-topology or Plan-paint issue hides the first failing geometry stage.

Why it mattered: House 4-style footprints could be valid wall shapes with the requested eave overhang, but the legacy eave offset boundary collapsed before semantic roof QA had a clean polygon to solve. Reducing the eave overhang can make a roof visible, but that is an approximate render repair and should not be the first north-star path.

Current guardrail: eave-offset recovery belongs in `@sp/geometry`. For fully hipped custom orthogonal roofs, keep the existing adjacent-edge eave path for already-healthy cases, but when package QA fails with eave-offset self-overlap, try `orthogonal_cell_union` at the requested overhang before any reduced-overhang/narrow-return repair. Commit the exact boundary only if downstream roof QA is valid; otherwise remain invalid or fall through to the approximate repair path with `roofEaveOffsetRepair*` metadata. Do not add Plan paint fallbacks, first-house fallbacks, or active-module fallbacks.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/orthogonalEaveOffset.ts](../packages/geometry/src/house/orthogonalEaveOffset.ts), [packages/geometry/src/house/eaveOffsetRepair.ts](../packages/geometry/src/house/eaveOffsetRepair.ts), [packages/geometry/src/houseModel.ts](../packages/geometry/src/houseModel.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts).

### 2026-06-03 - Workbench House Forms - Custom Footprint Numeric Canonicalization

Area: Workbench House Forms

Status: Active

Decision or mistake: tiny floating-point residue from object-first custom footprint editing can make a valid custom hipped house look degenerate to package roof topology, surfacing as `roof_topology_face_count_mismatch` even though the same footprint rounded to sub-visible precision solves correctly.

Why it mattered: the live House 4 repro was not another Plan projection bug or eave-overhang collapse. The wall outline was valid, but one local footprint edge carried near-zero metre residue. Without a package boundary cleanup, Plan, 3D, status, and diagnostics could disagree or report invalid geometry for an authored shape that is valid at modelling precision.

Current guardrail: numeric stabilization belongs at the `@sp/geometry` house solve boundary. Canonicalize solved footprint coordinates to `0.001 mm`, collapse duplicate consecutive points, and remove residue-only collinear points before wall/eave/roof solving; do not round or rewrite saved workbench values. Surface additive `footprintCanonicalization*` metadata per `houseFormId`, and keep Plan/3D consuming the same `HouseModel3D.footprint` rather than adding portal-only render workarounds.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/footprintMath.ts](../packages/geometry/src/house/footprintMath.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts](../apps/portal/lib/drawings/state/projectContextOverlayShapes.test.ts), [playwright/portal.workbench-fixture.spec.ts](../playwright/portal.workbench-fixture.spec.ts).

### 2026-06-03 - Workbench House Forms - Custom Hipped Eave Graph Topology

Area: Workbench House Forms

Status: Active

Decision or mistake: custom orthogonal hipped roofs should not depend on the old rectilinear region-dissolve stage for fully hipped topology. The live House 4 break surfaced as `house-eave-edge-5:unclosed_boundary_graph`: the eave polygon was solvable, but one post-dissolve roof-face boundary failed to close.

Why it mattered: after Plan projection and numeric canonicalization were fixed, the remaining failure was a package roof-topology stage, not a visual layer bug. Adding Plan paint fallbacks or active-module fallbacks would have hidden the first failing geometry stage and kept House 4 visually untrustworthy in 3D.

Current guardrail: fully hipped non-rectangular orthogonal house footprints route through `eave_graph_source_edge_envelope`, which commits one semantic roof facet per source eave edge and rejects/coalesces duplicate lower-envelope fragments before they can be committed as healthy geometry. Open-end/gable variants may continue using the existing joined path until retired separately. Diagnostics must expose `roofTopologySolver`, semantic QA, failure edge/reason, closed/expected face counts, and gap/overlap/dangling counts; invalid roofs still render diagnostics/reference geometry only.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPrimary.ts](../packages/geometry/src/house/roofPrimary.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts).

### 2026-06-03 - Workbench House Forms - Semantic Hipped Topology QA

Area: Workbench House Forms

Status: Active

Decision or mistake: a custom hipped roof can have finite roof planes and matching projected area while still being visually untrustworthy if the committed planes are lower-envelope fragments instead of semantic eave-owned faces.

Why it mattered: House 4 could show `Geometry ready` while Plan/3D rendered a huge fragmented roof with dangling/internal feature lines and a broken 3D surface. The renderer was exposing bad committed package geometry; it was not the first failing stage.

Current guardrail: fully hipped custom orthogonal roofs must pass semantic topology QA before normal roof solids/materials are committed. Healthy output uses `eave_graph_source_edge_envelope`, one semantic face per required eave edge, zero internal eave-height seams, no duplicate lower-envelope fragments, no fallback valley features, and feature lines backed by final facet adjacency. Lower-envelope fragments may exist only as diagnostics, never as healthy committed roof bodies.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofQa.ts](../packages/geometry/src/house/roofQa.ts), [packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts](../packages/geometry/src/house/roofJoinedTopologyIntegration.test.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/viewer.test.ts](../packages/geometry/src/viewer.test.ts).

### 2026-06-03 - Workbench House Forms - Status Uses Resolved Geometry

Area: Workbench House Forms

Status: Active

Decision or mistake: multi-house preset forms can have empty object-first draft polygons even though the house geometry input boundary can resolve a valid physical footprint. Status, rail subtitles, inspector trust, and selected-house invalidity must validate against the addressed form's resolved geometry, not the empty draft polygon.

Why it mattered: the Plan/3D render pipeline could show healthy or diagnostic per-house geometry by id while the rail and inspector still labelled preset houses as `Invalid geometry`. That made a status-boundary bug look like a Plan or 3D visual failure and risked triggering paint-layer workarounds.

Current guardrail: `objectWorkbenchStatusModel` derives roof validation from `buildHouseFormRawGeometryInput(houseForm)` whenever a form's side-local polygon is empty, preserving authored invalid choices while avoiding first-house or active-module fallback. New multi-house status tests should cover preset forms with empty draft polygons.

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts), [apps/portal/lib/drawings/state/houseFormRawGeometry.ts](../apps/portal/lib/drawings/state/houseFormRawGeometry.ts).

### 2026-06-03 - Workbench House Forms - Single-Pergola 3D Uses Project Houses

Area: Workbench House Forms

Status: Active

Decision or mistake: project 3D preview composition must replace legacy active-module house layers whenever object-owned project house geometry exists, even when there is only one pergola/module.

Why it mattered: the single-pergola fast path returned the active module's legacy 3D preview directly. Multi-house projects could therefore show object-owned house forms in Plan diagnostics while 3D still rendered the active module's wall-only/legacy house layer, making the same `houseFormId` visually disagree across Plan and 3D.

Current guardrail: superseded by the 2026-06-11 breakaway. Live workbench runtime no longer has an active-module preview path; Plan and 3D consume the solved project artifact and expose object-owned diagnostics per `houseFormId`.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/index.tsx), [apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts](../apps/portal/lib/drawings/state/projectPergolaViewerScene.test.ts).

### 2026-06-03 - Workbench House Forms - Coverage Solver Quarantine

Area: Workbench House Forms

Status: Active

Decision or mistake: the source-edge coverage partition is the right package-owned recovery path for custom hipped roofs whose older source-edge envelope path fails with area/coverage mismatch, but forcing all existing custom hipped footprints through it immediately regresses older U/L fixtures with raised boundary fragments.

Why it mattered: House 4 needs a coverage-owned fix at the first failing roof stage, but replacing every custom hipped path at once would trade one visible bug for another. The north-star move is to quarantine legacy behavior while retiring it in provable slices, not to pretend a partly proven solver is universally ready.

Current guardrail: fully hipped custom roofs first use the existing validated source-edge envelope path when it proves valid. When that path fails, `@sp/geometry` can commit `source_edge_coverage_partition` only if it proves non-empty source-edge coverage and zero coverage delta/gap/overlap within tolerance; otherwise the roof remains invalid with package diagnostics. Coverage metadata (`roofTopologyCoverage*`) must be surfaced through package, Plan, and 3D diagnostics so the next retirement slice can target exact failing topology without Plan paint or active-module fallbacks.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/viewer.ts](../packages/geometry/src/viewer.ts), [playwright/support/workbenchFixture.ts](../playwright/support/workbenchFixture.ts).

### 2026-06-11 - Workbench House Forms - Exact Hipped Partition Diagnostics

Area: Workbench House Forms

Status: Active

Decision or mistake: a pure source-edge exact lower-envelope partition is useful package-owned topology evidence, but it must not become the first failure diagnostic when another committed candidate passes semantic QA. Infinite source-edge roof-plane clipping can erase legitimate short-edge faces on concave custom forms, so replacing every custom hipped roof with that exact attempt in one slice would regress known-valid fixtures.

Why it mattered: the north-star move is to retire the brittle rectilinear/dissolve path by proving cleaner package geometry, not by making healthy roofs look invalid or adding portal paint fallbacks. Exact partition QA now surfaces as metadata for captured payloads, while committed geometry still has to pass semantic and coverage gates.

Current guardrail: fully hipped custom roofs try `source_edge_exact_envelope_partition` first and expose `roofTopologyExactPartition*` metadata. If exact semantic QA fails, known-good `eave_graph_source_edge_envelope` may still commit only when semantic QA passes; `source_edge_coverage_partition` may recover split source-edge faces only when every source edge is represented and coverage/semantic QA are valid. Do not use failed exact-attempt metadata as `diagnosticCode` for a roof that committed valid geometry.

Promoted to: None

Related docs/tests: [docs/costing-and-geometry.md](costing-and-geometry.md), [docs/design-workbench-architecture.md](design-workbench-architecture.md), [packages/geometry/src/house/roofEaveGraphHipped.ts](../packages/geometry/src/house/roofEaveGraphHipped.ts), [packages/geometry/src/house/roofPresetCoverage.test.ts](../packages/geometry/src/house/roofPresetCoverage.test.ts), [packages/geometry/src/houseRoofDiagnostics.ts](../packages/geometry/src/houseRoofDiagnostics.ts), [packages/geometry/src/viewer.ts](../packages/geometry/src/viewer.ts), [playwright/support/workbenchFixture.ts](../playwright/support/workbenchFixture.ts).

### 2026-06-11 - Design Workbench - Breakaway From Calculator Runtime

Area: Design Workbench

Status: Active

Decision or mistake: live Design Workbench runtime is now a separate object-first product path. It accepts persisted `WorkbenchProjectModel` state and solves to `WorkbenchSolvedGeometryArtifact`; it no longer reads or synthesizes calculator module state, house-first carriers, raw module house context, active module indexes, legacy plan/section models, or workbench costing payloads.

Why it mattered: compatibility bridges kept reintroducing first-house and per-module assumptions while roof geometry bugs were being debugged. Keeping calculator and workbench coupled made visual trust depend on hidden fallback paths instead of object-owned package geometry diagnostics.

Current guardrail: workbench runtime roots must pass the breakaway import guard. Snapshot-only calculator designs should load as unsupported/empty workbench designs, not be synthesized. Workbench repricing remains unavailable until a downstream artifact/takeoff-to-commercial adapter is introduced outside geometry/render/runtime decisions. Marketing enquiry and calculator V1 pricing remain protected as a separate path.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/costing-and-geometry.md](costing-and-geometry.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), `npm run test:portal:workbench`.

### 2026-06-12 - Design Workbench - Remaining Runtime Cleanup Guard

Area: Design Workbench

Status: Active

Decision or mistake: after the breakaway, live workbench roots still carried cleanup-only calculator-era names and fixture pricing diagnostics that could invite new compatibility work.

Why it mattered: the workbench should stay object-first and geometry-owned. Pricing/readiness belongs to estimates/calculator/commercial paths until a downstream solved-artifact takeoff adapter exists.

Current guardrail: live workbench runtime roots must not import `@sp/costing`, expose `data-workbench-pricing*`, or reintroduce `activeModule`, `moduleLabel`, `legacy_plan_m`, or `geometry_plan_fallback`. Sheet labels, object-outline diagnostic coordinates, and diagnostic plan references are the workbench names.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Module Vocabulary Retirement

Area: Design Workbench

Status: Active

Decision or mistake: after the calculator breakaway, live workbench runtime still exposed solved-module wrappers and module-shaped pergola render/status names even though project solving was already object-first.

Why it mattered: leaving empty `modules` arrays, `moduleInput`, `moduleId`, and module-state terms in the runtime made future work likely to rebuild per-module assumptions around an object-first artifact.

Current guardrail: live workbench roots must use object/pergola artifact vocabulary. Pergola render diagnostics are keyed by `pergolaId`/`artifactId`; `WorkbenchSolvedModel` must not expose solved-module arrays; pergola inspector and rail state must not reintroduce module selection/status names. Calculator/public-export module vocabulary remains outside the workbench boundary only.

Promoted to: None

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts](../apps/portal/lib/drawings/state/projectObjectRenderPipeline.ts).

### 2026-06-12 - Design Workbench - Docs Current-State Reset

Area: Design Workbench

Status: Promoted

Decision or mistake: after the breakaway and module-vocabulary cleanup, the workbench docs still mixed current architecture, historical cull PR sequences, and roof incident notes in ways that could be mistaken for active implementation guidance.

Why it mattered: stale campaign language can pull future work back toward compatibility tasks, module-era problem framing, or visual bug history instead of the current object-first artifact boundary.

Current guardrail: `docs/design-workbench-architecture.md` is the current contract, `docs/design-workbench-multi-object-goal.md` tracks active product milestones, and `docs/design-workbench-legacy-cull.md` is archived history plus Gate 0 row references only. Do not use old PR history as a next-task list. The next architecture cleanup is the `WorkbenchSolvedProjectArtifact` UI-consumption boundary.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/design-workbench-multi-object-goal.md](design-workbench-multi-object-goal.md), [docs/design-workbench-legacy-cull.md](design-workbench-legacy-cull.md), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Project Artifact UI Boundary

Area: Design Workbench

Status: Promoted

Decision or mistake: the live workbench shell now consumes one `WorkbenchSolvedProjectArtifact` bundle for project-level Plan layers, 3D preview, drawing-surface geometry, snap sources, and diagnostics. Route clients should not rebuild or pass loose project geometry/status prop arrays.

Why it mattered: the breakaway removed calculator-era inputs, but loose render props still made it easy to create view-specific geometry truth. The bundled artifact makes the current UI contract match the north-star solved-geometry spine without changing solver behavior.

Current guardrail: `DrawingWorkbench` callers pass `projectArtifact`; `WorkbenchViewportHost` is the single allowed place to unpack it for existing lower-level viewport props. Loose-field aliases on `WorkbenchSolvedModel` were retired in the follow-up artifact alias slice and should not be reintroduced.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [docs/design-workbench-multi-object-goal.md](design-workbench-multi-object-goal.md), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Solved Model Alias Retirement

Area: Design Workbench

Status: Promoted

Decision or mistake: `WorkbenchSolvedModel` no longer exposes temporary loose project geometry/status aliases such as project preview, viewport geometry, plan projection, projection health, pergola render health, house geometry inputs, or project reference shapes. Those values are available only through `WorkbenchSolvedProjectArtifact`, whose construction now lives in a focused artifact owner.

Why it mattered: the artifact boundary was useful only if callers could not keep reading parallel loose fields. Removing the aliases prevents future work from recreating view-specific geometry truth or bypassing object-owned diagnostics.

Current guardrail: live workbench code should read solved project geometry, plan layers, snap sources, and render diagnostics from `projectArtifact`. The breakaway guard forbids direct `solvedModel.*` alias reads. Lower-level Plan/3D viewport prop names may remain until a separate internal naming cleanup.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts](../apps/portal/lib/drawings/state/workbenchSolvedProjectArtifact.ts), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-12 - Design Workbench - Pergola Artifacts Before Project Composition

Area: Design Workbench

Status: Promoted

Decision or mistake: project-level Plan/3D composition was still called with `pergolaArtifacts: []`, so solved pergola output could not reach `WorkbenchSolvedProjectArtifact` even when the project model contained pergolas.

Why it mattered: the multi-object workbench goal depends on every project object contributing an object-id-keyed solved artifact before Plan, 3D, snap, and diagnostics are composed. An empty artifact set silently turns pergolas into missing geometry rather than object-owned diagnostics.

Current guardrail: `buildWorkbenchSolvedModel` must build project house geometry first, then project pergola render artifacts, then pass the same pergola artifact list into `buildProjectObjectRenderPipeline` and project viewer scene composition. Package geometry owns pergola solving through a neutral solve boundary; portal workbench roots adapt object-first pergolas but must not reintroduce calculator/raw wrapper contracts.

Promoted to: `docs/design-workbench-architecture.md`

Related docs/tests: [docs/design-workbench-architecture.md](design-workbench-architecture.md), [apps/portal/lib/drawings/state/workbenchSolvedModel.ts](../apps/portal/lib/drawings/state/workbenchSolvedModel.ts), [apps/portal/lib/drawings/state/projectPergolaRenderArtifacts.ts](../apps/portal/lib/drawings/state/projectPergolaRenderArtifacts.ts), [packages/geometry/src/solvePergolaGeometry.ts](../packages/geometry/src/solvePergolaGeometry.ts), [apps/portal/lib/workbenchBreakawayImportGuards.test.ts](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts).

### 2026-06-16 - Portal Lists - Explicit Fetch Ceiling Plus Visibility Banner

Area: Portal List Pages

Status: Active

Decision or mistake: every staff list fetch (`contacts`, `projects`, `design_package_requests`, the running-jobs top-level `projects`, and the schedule legacy fallback's `estimates`) was relying on PostgREST's silent 1000-row default. The 1001st row was dropped on the floor with no UI signal, so staff at any growing org would silently lose data without knowing it. PR-PG1 closes that by setting an explicit ceiling at every list-fetch boundary and surfacing a `ListCountBanner` on the contacts and projects pages when the row count crosses 80% of the ceiling.

Why it mattered: the silent default was the same shape as the appendage and elevation-mode bugs we keep refactoring out (PR-T8 / PR-T9) — implicit upstream behaviour acting as a meaningful constraint. The fix has to make the constraint explicit AND visible, not just lift it higher.

Current guardrail:
- Top-level list selects (no `.eq()` / `.in()` / `.single()` filter) MUST set `.range(0, MAX_LIST_FETCH_ROWS - 1)` and either `count: 'exact'` (when the count needs to feed a banner) or no count opt. Lives at [`apps/portal/lib/list/listLimits.ts`](../apps/portal/lib/list/listLimits.ts).
- Hitting the warning is the signal to graduate that list to cursor pagination (PR-PG2 / PR-PG3 in the [list-pagination plan](list-pagination-plan.md)) — a higher cap would just hide the next problem the same way the silent PostgREST default did.
- For the banner UX: site-wide `ToastProvider` policy ([`ToastProvider.tsx:56-57`](../apps/portal/components/ui/toast/ToastProvider.tsx#L56-L57)) silently suppresses non-error toasts. The PR-PG1 banner uses an inline `ListCountBanner` instead — that's the right surface anyway (truncation is a STATE, not an EVENT), but worth flagging that the "toast" instinct fails here.

Behavioural impact: zero at current scale (the highest-count list in the live data is well below 4000). The change is preparation, not a bug fix.

Promoted to: None

Related docs/tests: [docs/list-pagination-plan.md](list-pagination-plan.md), [docs/pr-pg1-plan.md](pr-pg1-plan.md), [apps/portal/lib/list/listLimits.ts](../apps/portal/lib/list/listLimits.ts), [apps/portal/components/ui/listBanner/ListCountBanner.tsx](../apps/portal/components/ui/listBanner/ListCountBanner.tsx), [apps/portal/lib/contacts/serverContactsIndex.ts](../apps/portal/lib/contacts/serverContactsIndex.ts), [apps/portal/lib/projects/serverProjectsIndex.ts](../apps/portal/lib/projects/serverProjectsIndex.ts).

### 2026-06-16 - Portal Lists - Chunked Fetch Defeats Supabase db-max-rows Cap (PR-PG1c)

Area: Portal List Pages

Status: Active

Decision or mistake: PR-PG1's `.range(0, MAX_LIST_FETCH_ROWS - 1)` (i.e. `.range(0, 4999)`) assumed PostgREST would honour the requested upper bound. Live verification after deploy proved that assumption wrong: the Supabase project enforces a `db-max-rows = 1000` setting that silently clamps every single response to 1000 rows regardless of `.range(...)`. Result: the contacts page still showed exactly 1000 rows alphabetically (A→Pa) on production after PR-PG1 shipped, and the banner never fired because PR-PG1's threshold was 4000 and the count itself was being capped at 1000.

PR-PG1c replaces every list-fetch site's single `.range()` call with `fetchAllPages()` — a paged loop that asks for 1000 rows at a time until exhausted or `MAX_LIST_FETCH_ROWS = 5000` is hit. It also adds a `truncated: boolean` field to the fetch result and a `truncated?` prop to `ListCountBanner`; the banner now fires unconditionally on `truncated === true`, independent of the count threshold (since count itself may be unreliable when `db-max-rows` is set).

Why it mattered: PR-PG1 made the client's intent explicit but didn't make the portal *immune* to upstream caps. Chunked fetch closes that gap: the portal works against any Supabase project regardless of its `db-max-rows` setting, and "I see exactly 1000 rows" can never recur silently.

Current guardrail:
- Top-level list selects (no `.eq()` / `.in()` / `.single()` filter) MUST go through `fetchAllPages()` from [`apps/portal/lib/list/listLimits.ts`](../apps/portal/lib/list/listLimits.ts). Inline `.range(0, MAX_LIST_FETCH_ROWS - 1)` is treated as a bug — `Grep "\.range\(0, MAX_LIST_FETCH_ROWS - 1\)"` should return zero hits in `apps/portal/`.
- The `truncated` field is the hard truth-signal. `shouldShowListCountWarning(visible, total, { truncated })` fires the banner unconditionally on `truncated === true`. Count-based threshold (>= 4000) still works for the soft-warning case but is no longer the only path.
- Conditional `.in(...)` / `.is(...)` filters MUST be applied INSIDE the page-builder callback — applying them outside the helper means later pages forget the filter. Pattern: `(from, to) => { let q = client.from('x').select(...); if (filter) q = q.in('id', filter); return q.range(from, to); }`.

Behavioural impact: the live contacts page (and any portal table over 1000 rows) is now correctly shown end-to-end, with a banner appearing only when the actual list exceeds `MAX_LIST_FETCH_ROWS = 5000`. Up to 5 sequential round-trips per list at the ceiling (5 * ~50ms = ~250ms); negligible at current scale.

Promoted to: None

Related docs/tests: [docs/pr-pg1c-plan.md](pr-pg1c-plan.md), [docs/pr-pg1-plan.md](pr-pg1-plan.md), [apps/portal/lib/list/listLimits.ts](../apps/portal/lib/list/listLimits.ts), [apps/portal/lib/list/listLimits.test.ts](../apps/portal/lib/list/listLimits.test.ts), [apps/portal/components/ui/listBanner/ListCountBanner.tsx](../apps/portal/components/ui/listBanner/ListCountBanner.tsx).

### 2026-06-18 - Workbench House Forms - Structured Validation Panel (PR-HR2)

Area: Workbench House Forms

Status: Active

Decision or mistake: the workbench right rail rendered roof-QA failures as a single-line `<p className={styles.fieldError}>{validationMessage}</p>`. Designers saw text like "Roof geometry failed package QA: eave_…" (truncated by panel width when the code was long), with no failing-stage label, no raw code surfaced as a copyable chip, and no way to send diagnostics to an engineer without spinning up the dev-server captured-repro workflow ([`docs/workbench-captured-repro-workflow.md`](workbench-captured-repro-workflow.md)). PR-HR2 replaces the inline message with a structured `RoofValidationPanel` that shows the message, the failing pipeline stage (e.g. "Eave polygon construction"), the raw diagnostic code as a monospace chip, the approximation reasons, and a "Copy diagnostics" button that puts the full `stageDiagnostics` JSON on the clipboard. First PR in the [house-roof-stability-plan](house-roof-stability-plan.md) sequence.

Why it mattered: every recurring "house roof broken" complaint shared the same shape — designer hits a failing footprint/roof combo, the rail tells them nothing actionable, they back out, the failing inputs are lost, the bug feels new on the next attempt. The structured panel closes one half of that loop (the designer can now copy a payload that names exactly which stage failed and why); PR-HR1 will close the other half (the same payload becomes a permanent regression fixture).

Current guardrail:
- `ObjectWorkbenchRoofStatus` now carries `stageDiagnostics: HouseRoofStageDiagnostics` (always present — defaults to `EMPTY_HOUSE_ROOF_STAGE_DIAGNOSTICS` when no package model solved) and `failingStage: ObjectWorkbenchRoofFailingStage | null` (non-null only when `validationStatus === 'invalid'`). The same fields are forwarded through `ObjectWorkbenchRoofInspectorModel` so the rail consumes them without a second resolver pass. Lives at [`apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts`](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts).
- Failing-stage ordering in `resolveFailingStage()` MUST mirror `firstHouseRoofStageDiagnosticCode()` in `@sp/geometry`; if a new stage is added there, update both. The unit test at [`apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts`](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts) pins the contract.
- Validation copy in [`apps/portal/components/drawings/rail/RoofValidationPanel.tsx`](../apps/portal/components/drawings/rail/RoofValidationPanel.tsx) MUST stay independent of the calculator vocabulary — only reads workbench-side fields. The "Copy diagnostics" payload is the canonical shape PR-HR1 will persist as a fixture; do not narrow it without updating both.

Behavioural impact: invalid + approximate roofs now render a coloured panel (red / amber) in the rail with the full diagnostic detail and a clipboard button. No change to the underlying geometry pipeline — purely a UX/data-surfacing change. Sets up PR-HR1 to skip dev-server gymnastics.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModelRoofValidation.test.ts), [apps/portal/components/drawings/rail/RoofValidationPanel.tsx](../apps/portal/components/drawings/rail/RoofValidationPanel.tsx), [apps/portal/components/drawings/rail/RoofValidationPanel.module.css](../apps/portal/components/drawings/rail/RoofValidationPanel.module.css), [apps/portal/components/drawings/rail/HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx).

### 2026-06-18 - Workbench House Forms - Designer-Facing Failure Capture (PR-HR1)

Area: Workbench House Forms

Status: Active

Decision or mistake: a designer who hit a recurring house-roof QA failure had no path to share the failing inputs with an engineer that didn't require spinning up the dev server with `PORTAL_PAGE_DEBUG_EXPORTS=1 ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES=1` and copy-pasting a full `PortalPageDebugExport` payload — neither of which a designer can be expected to do. As a result, real-world failing shapes were lost the moment a designer backed out of the workbench; every fresh report felt like a new bug even when it was the same root cause repeating. PR-HR1 adds a one-click "Save bug report" button to the right-rail `RoofValidationPanel` (PR-HR2) that builds a schema-versioned `RoofFailureRepro` JSON of the failing house — geometry inputs + stage diagnostics only, no customer-identifying fields — and triggers a browser download. Second PR in the [house-roof-stability-plan](house-roof-stability-plan.md) sequence.

Why it mattered: closes the "failing shapes are lost the moment a designer closes the tab" half of the recurring-bug loop. Combined with PR-HR2's structured panel, designers now have a complete designer-mediated failure-reporting workflow that bypasses the engineer-mediated `docs/workbench-captured-repro-workflow.md` path entirely. The output JSON is the canonical input format PR-HR4 will load from `packages/geometry/src/house/__fixtures__/captured/` as regression fixtures.

Current guardrail:
- `buildRoofFailureRepro()` in [`apps/portal/lib/drawings/exportRoofFailureRepro.ts`](../apps/portal/lib/drawings/exportRoofFailureRepro.ts) is pure / synchronous / no-side-effect — safe to memoize. Throws on `validationStatus === 'valid'` or `null` so callers must gate on status before invoking.
- Schema version constant `ROOF_FAILURE_REPRO_SCHEMA_VERSION = 1` MUST bump on any breaking change to `RoofFailureRepro`. Captured fixtures in `packages/geometry/src/house/__fixtures__/captured/` are pinned to schema versions; PR-HR4's loader will reject unknown versions.
- The payload is geometry-only by construction. PII redaction is enforced by the test at [`apps/portal/lib/drawings/exportRoofFailureRepro.ts`](../apps/portal/lib/drawings/exportRoofFailureRepro.ts) — the JSON serialization must not contain "House 1" (label), the house id, "contact", "siteAddress", or "projectName".
- Filename pattern is `roof-failure_{stage}_{code}_{timestamp}.json`. Designers should drop the file unchanged into `packages/geometry/src/house/__fixtures__/captured/` per [the README there](../packages/geometry/src/house/__fixtures__/captured/README.md).

Behavioural impact: invalid + approximate roofs now show a second button in the rail next to "Copy diagnostics" labelled "Save bug report" → file download. No new server endpoint (file-download path only); a server-persisted variant is deferred until PII redaction is independently audited.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [apps/portal/lib/drawings/exportRoofFailureRepro.ts](../apps/portal/lib/drawings/exportRoofFailureRepro.ts), [apps/portal/lib/drawings/exportRoofFailureRepro.ts](../apps/portal/lib/drawings/exportRoofFailureRepro.ts), [apps/portal/components/drawings/rail/RoofValidationPanel.tsx](../apps/portal/components/drawings/rail/RoofValidationPanel.tsx), [packages/geometry/src/house/__fixtures__/captured/README.md](../packages/geometry/src/house/__fixtures__/captured/README.md).

### 2026-06-18 - Workbench House Forms - Property-Based Orthogonal Coverage Matrix (PR-HR4)

Area: Workbench House Forms

Status: Active

Decision or mistake: existing roof regression coverage was fixture-by-fixture — `roofPresetCoverage.test.ts` exercised each preset with NO opens, and `partialOpenJoinedTopology.test.ts` exercised each preset / custom-topology shape with ONE open at a time. Multi-open subsets (none / all / every adjacent pair) and any case a designer might hit in production but engineers hadn't thought of were not exercised at all. PR-HR4 closes that gap with a property-based matrix at [`packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts`](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts) that enumerates 69 multi-open cases (8 presets + 3 custom shapes, both ridge axes, `{none, all, every adjacent pair}` per shape), AND a `__fixtures__/captured/` loader that auto-runs every `.json` file dropped in by the PR-HR1 "Save bug report" button.

Why it mattered: the recurring "house roof broken" bugs were dying in a designer's tab because (a) the failing shape wasn't captured (closed in PR-HR1), and (b) even when caught, the regression matrix only covered shapes engineers had imagined. PR-HR4 makes the combinatorial space testable directly — every designer-saved fixture becomes a permanent regression case the moment it lands in the captured dir; the multi-open matrix surfaces fresh failure classes proactively.

Current guardrail:
- Multi-open enumeration uses `{none-open, all-open, every adjacent pair}` per (fixture × ridgeAxis). Full power-set would be 2^N per case; the chosen subset is O(N) and matches the most common designer configurations. Bump to full power-set if a real failure escapes this triplet.
- Quarantine sets `KNOWN_MULTI_OPEN_FAILURES` and `CAPTURED_KNOWN_FAILURES` follow the same `it.fails` contract as `partialOpenJoinedTopology.test.ts` — `it.fails` passes ONLY if the inner expectations throw; a deeper fix that makes a case start passing flips the marker red and the dev must drop it. New failures auto-surface.
- Captured loader (`loadCapturedFixtures()`) enforces `schemaVersion: 1` (`RoofFailureRepro` from PR-HR1). Bumping the schema in PR-HR1 means bumping the gate here too — stale fixtures cannot silently misbehave.
- The geometry package MUST NOT import from `apps/portal/`. The captured fixture type in the matrix is a *structural* subset of `RoofFailureRepro`, not a re-export of the portal type.

Behavioural impact: baseline shipping PR is 69 multi-open cases green, zero quarantines, zero captured fixtures. Adds ~380ms to the geometry test lane (1.06s total for this file). When PR-HR1 starts persisting designer-saved fixtures into `__fixtures__/captured/`, the matrix grows automatically.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts), [packages/geometry/src/house/__fixtures__/captured/README.md](../packages/geometry/src/house/__fixtures__/captured/README.md), [packages/geometry/src/house/partialOpenJoinedTopology.test.ts](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts), [apps/portal/lib/drawings/exportRoofFailureRepro.ts](../apps/portal/lib/drawings/exportRoofFailureRepro.ts).

### 2026-06-18 - Workbench House Forms - Fail-Soft Roof Render (PR-HR3)

Area: Workbench House Forms

Status: Active

Decision or mistake: when house-roof QA failed, the 3D viewer's scene builder skipped every roof surface solid (`viewer.ts:781` `if (solid.kind === "roof" && skipRoofSolids) continue;`) and the user saw only rafters/framing with no roof surface — the skeletal look in the recurring "house roof broken" screenshots. This was the right *correctness* move (don't render geometry the QA gate rejected) but a poor *visibility* move: designers couldn't tell what the solver attempted, only that something was missing. PR-HR3 changes the gate from "skip" to "include + stamp diagnostic": QA-invalid roof solids stay in the scene, marked with `houseRoofRenderRole: "diagnostic"`, and the `HouseSurfaceSolidObject` renderer applies a warm amber tint (`#d97706`, opacity 0.42) so the designer sees the best-effort surface AND knows it didn't pass QA.

Why it mattered: closes the third loop in the recurring-bug cycle. PR-HR2 surfaced the validation code in the rail; PR-HR1 gave designers a "Save bug report" button; PR-HR4 added the regression matrix. PR-HR3 makes the broken-roof state usable to work around — a designer can keep iterating on adjacent objects without the missing surface dominating the viewport.

Current guardrail:
- The scene builder MUST keep emitting QA-invalid roof solids; only the metadata stamp differentiates them. Pre-existing `buildHouseRoofOutlineObjects` outline cues continue to emit alongside (consumed by Plan-side fallback styling and downstream observability). Lives at [`packages/geometry/src/viewer.ts`](../packages/geometry/src/viewer.ts) around line 779-840.
- Scene metadata: `houseRoofSolidSceneCount` and `houseRoofSolidRenderedCount` now ALWAYS report the actual rendered count (no QA gating). `houseRoofSolidSkippedCount` is now meaningfully 0 in the QA-invalid case (we render, we don't skip). New field `houseRoofSolidDiagnosticCount` reports how many of the rendered solids are stamped diagnostic. Downstream observability that needed the old "skipped=N when invalid" signal should switch to `houseRoofSolidDiagnosticCount`.
- The diagnostic tint colour MUST stay aligned with the `RoofValidationPanel` (PR-HR2) approximate-state amber. The shared vocabulary is what makes "broken roof" recognisable across the inspector rail + 3D viewport.
- This PR consciously does NOT touch the Plan-side (`housePlanProjection.ts:80`'s `if (!modelRoofQaIsValid(model)) return null` still drops the plan body for invalid roofs). Plan viewport's existing roof-skeleton outline + footprint dashed outline already communicate the broken state. If a designer hits a plan-side blind spot, that's a focused follow-up — not in scope here.

Behavioural impact: the user's Graham–Oratia screenshot would now render with a tinted amber roof surface in 3D instead of bare rafters — still clearly "this is broken" (amber + transparency), but with the solver's best-effort surface visible so the designer can see what the geometry pipeline tried. No change for valid roofs.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [packages/geometry/src/viewer.ts](../packages/geometry/src/viewer.ts), [packages/geometry/src/viewer.test.ts](../packages/geometry/src/viewer.test.ts), [apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/HouseSurfaceSolidObject.tsx](../apps/portal/components/drawings/viewports/Geometry3DViewport/renderers/HouseSurfaceSolidObject.tsx).

### 2026-06-18 - Workbench House Forms - Quarantine Cleanup + Narrow-Return Coverage (PR-HR5)

Area: Workbench House Forms

Status: Active

Decision or mistake: PR-HR5 was originally planned as 3-8 hours of numerical wavefront work to burn down two `it.fails` quarantines in [`packages/geometry/src/house/partialOpenJoinedTopology.test.ts`](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts) (`custom-recess:y:house-gable-end-y-5` and `custom-t:y:house-gable-end-y-1`). When the new `orthogonalRoofCoverageMatrix.test.ts` (PR-HR4) ran clean, that surprised us into re-checking; the quarantines turned out to be **zombie entries** — they reference terminal-end IDs that **no longer exist** in the matrix. Commit `56de9de` (2026-05-14) narrowed `deriveHouseGableTerminalEndsFromFootprint` to only "real wing-tip edges" (degree-1 ridge-graph nodes), correctly excluding `y-5` for recess and `y-1` for T as medial-axis connectors rather than wing tips. With those terminals unreachable from the workbench, the fragile-wavefront cases became unreachable too — the legacy quarantine entries silently never fired in the matrix. PR-HR5 acknowledges that and clears the set; also adds a `custom-l-narrow-return` fixture to the multi-open matrix to proxy the Graham–Oratia screenshot shape (~11m × 11m L with 1.8m return) so future regressions in the narrow-return-eave-offset path get caught.

Why it mattered: documents that the recurring "the 2 Y-ridge cases are still quarantined" narrative is dead — Phase 2's terminal-end fix retired them by classification, not by numerical convergence. Also extends the property-based matrix from 69 → 75 cases to cover the most common real-customer footprint pattern (narrow returns) the user reported via screenshot.

Current guardrail:
- `KNOWN_FAILURES` in [`packages/geometry/src/house/partialOpenJoinedTopology.test.ts`](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts) is now empty. Adding an entry MUST cite both the failing case AND a tracking ticket — silent quarantines were the precise cause of this round-trip.
- Narrow-return L fixture exercises `eave_offset_self_overlap` repair path (the symptom the Graham–Oratia screenshot showed). If a real-world JSON repro from PR-HR1's "Save bug report" surfaces a narrower case, drop it into `__fixtures__/captured/` per [the README](../packages/geometry/src/house/__fixtures__/captured/README.md) — the matrix loader (PR-HR4) picks it up automatically.

Behavioural impact: zero functional change to geometry; 252 of 252 house-lane tests green; matrix grows from 69 → 75 multi-open cases (added narrow-return L × 6 subsets × 2 axes minus duplicate baselines). Documentation alignment only.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [packages/geometry/src/house/partialOpenJoinedTopology.test.ts](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts), [packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts).

### 2026-06-18 - Workbench House Forms - First Real Captured Fixture + Solver-Pair Investigation (PR-HR6)

Area: Workbench House Forms

Status: Active

Decision or mistake: a designer hit the recurring `eave_offset_self_overlap` QA failure on the live workbench (Graham — Oratia project), clicked the PR-HR1 "Save bug report" button, and exported a `RoofFailureRepro` JSON. PR-HR6 dropped that JSON into `packages/geometry/src/house/__fixtures__/captured/graham-oratia_l-narrow-south-return.json`; the PR-HR4 matrix loader picked it up automatically and the test failed (as expected). The full HR1→HR4 loop worked end-to-end on the first real customer-shaped bug.

Investigation: hypothesized that the legacy `buildEaveGraphJoinedHippedRoof` dispatch was the culprit (Dutch-hip cases route through the newer `buildJoinedRectilinearHippedRoof` bent-spine wavefront, which is known to be more robust). Built a scratch hypothesis test exercising both solvers on the captured footprint with the 450mm overhang and got:
  - `buildEaveGraphJoinedHippedRoof`: 7 planes, fails `house-eave-edge-3:self_intersecting_merged_face` (over-fragmentation).
  - `buildJoinedRectilinearHippedRoof`: 3 planes, fails `house-eave-edge-5:overlapping_boundary_fragments` (under-coverage).

**Hypothesis disproved** — BOTH solver paths fail on this footprint at 450mm overhang. The fix is NOT a solver dispatch tweak. The eave-offset-repair loop in [`eaveOffsetRepair.ts`](../packages/geometry/src/house/eaveOffsetRepair.ts) confirmed this by independently stepping 450 → 0 in 50mm increments with neither solver producing a valid QA roof (`repairStatus: "failed"`).

Why it mattered: this is the first instance where the PR-HR loop genuinely closed end-to-end — a designer-reported bug became a permanent regression fixture without engineer back-and-forth. Also clears up a wrong assumption (that the bent-spine wavefront was a universal fix); the deeper geometry work needed for Graham-Oratia-class footprints needs either (a) eave-polygon simplification before topology partition or (b) a third solver variant tuned for asymmetric narrow-return L-shapes. Quarantined with detailed notes in [`orthogonalRoofCoverageMatrix.test.ts`](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts) `CAPTURED_KNOWN_FAILURES` set so the next agent (or session) doesn't repeat the hypothesis exercise.

Current guardrail:
- Captured fixtures dropped into `__fixtures__/captured/` are now load-tested in CI. If a deeper fix lands and Graham-Oratia starts passing, vitest's `it.fails` flips red — drop the entry from `CAPTURED_KNOWN_FAILURES` at that moment.
- The amber-tinted diagnostic render from PR-HR3 keeps Graham-Oratia visible to designers in the workbench while the underlying geometry work is pending.
- `eavePolygonPointCount: 32` from the diagnostic is the SUM of soffit + fascia polygon point counts (not the unified eave polygon shape), so it's NOT the smoking gun it first appeared. The actual eave used by the solver is a simple 6-vertex offset of the orthogonal L.

Behavioural impact: matrix grows from 75 → 76 cases (one quarantined captured); 226 of 226 house-lane tests green. No code change to the geometry pipeline — only the fixture, quarantine entry, and investigation comments.

Promoted to: None

Related docs/tests: [docs/house-roof-stability-plan.md](house-roof-stability-plan.md), [packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts](../packages/geometry/src/house/orthogonalRoofCoverageMatrix.test.ts), [packages/geometry/src/house/__fixtures__/captured/graham-oratia_l-narrow-south-return.json](../packages/geometry/src/house/__fixtures__/captured/graham-oratia_l-narrow-south-return.json), [packages/geometry/src/house/roofPrimary.ts](../packages/geometry/src/house/roofPrimary.ts).

### 2026-06-18 - Workbench House Forms - Composition Geometry Primitives (PR-COMP1)

Area: Workbench House Forms

Status: Active

Decision or mistake: ships Phase 1 of the house composition migration ([`docs/house-composition-vision.md`](house-composition-vision.md)) — the geometry primitives that let a house form be authored as N axis-aligned rectangle primitives joined by explicit `Join` operations, each rectangle carrying its own roof intent (form, pitch, ridge axis, Dutch-hip caps).

Includes:
- Types: `AxisAlignedRectangle`, `CompositionPrimitive` (polymorphic, v1 only rectangles), `CompositionJoin`, `RectangleRoofIntent`, `HouseComposition`, typed `CompositionValidationError`.
- `validateHouseComposition()` — structural validator with closed-union errors (empty / unsupported kind / non-positive rectangle / invalid join index / join edges same axis / join edges don't overlap / interior overlap).
- `composeFootprintFromComposition()` — orthogonal cell-union to derive the composite footprint polygon (CCW, collinear-cleaned).
- `detectFusedRectangle()` — checks if a composed footprint is itself a single axis-aligned rectangle (the optimisation case).
- `composeRoofFromComposition()` — orchestrator. Strategy 1: fused-rectangle case where all rectangles share an identical roof intent and the union is a rectangle → single `buildRectangularRoof` call (continuous hipped roof, four facets). Strategy 2: per-rectangle stitched solve for non-fused or mixed-intent cases → each rectangle solved independently via existing `buildRectangularRoof` / `buildFlatHouseRoof` / `buildMonoHouseRoof`, results concatenated. The stitched result stamps `metadata.approximationReasons: 'composition_stitched_render'` so the workbench rail (PR-HR2) surfaces the limitation.

Investigation that scoped the work: an earlier attempt to construct a "valley feature" at inside corners of stitched per-rectangle composites (Hip + Hip on an L producing the "Hip and Valley" pattern from real construction) hit a real geometric error. The valley line lies outside the domains of one of the two slopes it would connect — per-rectangle independent solves produce two roofs meeting only at the shared eave edge at z = eave, not an extended 3D valley. The construction-accurate Hip-and-Valley pattern requires unified-topology computation (the same problem the existing `buildEaveGraphJoinedHippedRoof` and `buildJoinedRectilinearHippedRoof` solvers attempt and partially fail at). Decomposing into per-rectangle solves does not eliminate that geometry — it just sidesteps it for cases where two roofs naturally slope away from each other at joins (hipped+skillion, skillion+skillion, fused-rectangle hipped+hipped). True unified-topology composition is deferred to a future COMP2 PR.

Why it mattered: lands the foundational data model for the composition vision without overcommitting to geometry the v1 solver can't honestly deliver. Designer-facing UX (shape palette, snap, Join/Detach) is downstream of this in subsequent phases; this PR is geometry plumbing only. Bug class around free-form-polygon partition failures (Graham–Oratia) remains, but is now scoped to the legacy free-form path which is read-only per the north-star update.

Current guardrail:
- Composition geometry lives in `@sp/geometry`, not in `apps/portal`. New consumers (workbench, future tools) import from `@sp/geometry`.
- Primitive type is polymorphic (`CompositionPrimitive = AxisAlignedRectangle | { kind: "unknown" }`); adding rotated rectangles / curves / octagons in future drops in as new union members without refactor.
- `RectangleRoofIntent` is per-rectangle — composite holds multiple constituents with different forms (hipped, mono, flat). No "single intent per composite" rule (we considered and rejected it; designer-controlled per-rectangle intent matches the vision).
- `validateHouseComposition` errors are a closed union; downstream consumers should switch on the code exhaustively.
- The stitched-render limitation (no extended valleys at inside corners of mixed-rectangle composites) is honestly surfaced via `approximationReasons: 'composition_stitched_render'`. COMP2 will resolve this with true unified-topology computation.

Behavioural impact: no workbench changes yet. Public API exported from `@sp/geometry`. 32 of 32 new composition tests green. No regression on 474 existing geometry tests (the 3 pre-existing failures in `plan.test.ts` / `section.test.ts` / `topProjection.test.ts` are unrelated solver-name drift, confirmed against base).

Promoted to: None

Related docs/tests: [docs/house-composition-vision.md](house-composition-vision.md), [docs/pr-comp1-plan.md](pr-comp1-plan.md), [packages/geometry/src/house/composition/](../packages/geometry/src/house/composition/).

### 2026-06-18 - Workbench House Forms - Composition Data Model in HouseFormModel (PR-COMP-PHASE2)

Area: Workbench House Forms

Status: Active

Decision or mistake: Phase 2 of the [composition migration](house-composition-vision.md). Adds an optional `composition?: HouseComposition | null` field to `HouseFormModel` + `ObjectFirstHouseFormDraft`, with defensive normalisation through workbench-draft round-trip and a `deriveHouseFormFootprintPolygon()` derivation helper. No geometry-routing change yet — that lands in Phase 3 alongside the rectangle-tool UX that actually produces composition data.

Scope deliberately narrow:
- Data field on both the in-memory model (`HouseFormModel`) and persisted draft (`ObjectFirstHouseFormDraft`).
- Workbench-draft normalisation preserves a valid composition; silently drops invalid / empty compositions (defensive — bad persisted data must never crash workbench load, form gracefully falls back to its legacy `footprint.polygon`).
- Adapter (model ↔ draft) round-trips composition.
- New `deriveHouseFormFootprintPolygon()` helper lets downstream consumers ignore the composition-vs-polygon distinction (returns the composite polygon when composition is present, falls back to legacy polygon otherwise).
- Zero designer-facing change — every house form today has `composition` absent and uses the legacy path unchanged.

Why it mattered: lands the data plumbing for the composition migration without overcommitting to geometry routing in a vacuum. Phase 3 wires the router when there's real workbench data flowing through (from the rectangle tool). Splitting Phase 2 (data) from Phase 3 (geometry routing) keeps each PR's blast radius small and lets each ship independently with its own gates.

Current guardrail:
- `composition` is optional on both `HouseFormModel` and `ObjectFirstHouseFormDraft`. Every existing fixture and consumer continues to work unchanged.
- `normalizeHouseComposition` runs `validateHouseComposition` (from `@sp/geometry`) on persisted JSON; structural failures cause silent fallback to "composition absent." This is defensive plumbing; the workbench load must never crash on a bad composition.
- When `composition` is present, downstream consumers SHOULD prefer `deriveHouseFormFootprintPolygon(houseForm)` over `houseForm.footprint.polygon` directly. Phase 3 migrates the consumers that need it.
- Composition is the source of truth when present; legacy polygon is the source of truth when absent. No cross-validation between the two (per the vision: legacy data stays as-is, composition data is authored fresh).

Behavioural impact: zero functional change in the workbench today. The data field rides through serialisation cleanly. Phase 3 will populate it via the rectangle tool and wire the geometry router. 7 new tests green; 172 state-lane tests green; portal typecheck clean.

Promoted to: None

Related docs/tests: [docs/pr-comp-phase2-plan.md](pr-comp-phase2-plan.md), [apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchModel.ts), [apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts](../apps/portal/lib/drawings/state/objectFirstWorkbenchAdapter.ts), [apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts](../apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts), [apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts](../apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts).

### 2026-06-18 - Workbench House Forms - Composition Roof Router Swap (PR-COMP-PHASE3.2)

Area: Workbench House Forms

Status: Active

Decision or mistake: Phase 3.2 of the [composition migration](house-composition-vision.md). `buildHouseFormGeometryInputForForm` (the per-form geometry entry point used by the workbench solved-model pipeline) now intercepts forms that carry a `composition` and swaps the legacy roof planes/features for the output of `composeRoofFromComposition`. Walls, eaves, openings, and solids continue to come from the legacy pipeline; only the roof is composition-routed in Phase 3 because every Phase-3 composition is a single rectangle, for which the legacy walls are already correct.

Implementation shape:
- New helper `swapRoofFromComposition({ houseForm, legacyModel, composition })` in `houseFormGeometryInput.ts`. Calls `composeRoofFromComposition({ composition, eaveHeightMm })`, then returns a spread of `legacyModel` with `roofPlanes` / `roofFeatures` replaced and `metadata` merged (composition stamps override topology-solver name; legacy `roofQaStatus` / `roofQaFailureReason` are preserved so downstream HR2/HR3 diagnostics keep working).
- Eave height resolves from `houseForm.eaveHeightM` (parsed metres → mm), defaulting to 2400mm — same default the legacy pipeline uses for forms without explicit value. Swap is skipped (legacy returned) if eave resolves to a non-positive number.
- Dispatch: legacy local variable renamed `model` → `legacyModel`; the returned `model` is either the swap result (composition present) or `legacyModel` (no composition).

Why it mattered: this is the first PR where workbench data ACTUALLY flows through the composition path end-to-end. Phase 1 shipped the geometry, Phase 2 shipped the data field, Phase 3.1 populated it on new forms; Phase 3.2 closes the loop so the composition is consumed by 3D rendering. Without this swap, the `composition` field was inert data — populated but never read. The byte-equivalence invariant for single-rectangle inputs (both paths call `buildRectangularRoof` on the same dimensions) means designers see zero visual change today, while every new house form silently exercises the new path so Phase 4's join/detach work has a known-good base to build on.

Current guardrail:
- Only swap when `houseForm.composition` is present. Legacy forms (custom-polygon, cloned non-straight presets) get `composition: undefined` and continue to use the legacy roof solver verbatim — that path stays alive indefinitely for those forms, per the vision (no migration of legacy data).
- For single-rectangle compositions, the composition path MUST remain visually equivalent to the legacy path. Both paths bottom out in `buildRectangularRoof` on the same dimensions; pinned by `houseFormCompositionRender.test.ts` (plane-count + wall-count equivalence + Dutch-hip variant). If a future refactor breaks this equivalence, the test catches it.
- Walls/eaves/openings continue to come from the legacy pipeline for Phase 3. Phase 4 (multi-rectangle compositions) MUST extend the swap to also rebuild walls/eaves from the composite footprint, because the union polygon differs from any single constituent rectangle.

Behavioural impact: zero designer-facing visual change for existing forms. New forms (added via `Add structure`) now render their roof via the composition path; metadata stamps `roofTopologySolver: "composition_per_rectangle_stitched"` (single-rectangle compositions route through Strategy 2 in the composer; result is geometrically clean because there's only one rectangle to stitch). 185 state-lane tests green (181 → 185, +4 new equivalence tests); portal typecheck clean.

Promoted to: None

Related docs/tests: [docs/pr-comp-phase3-plan.md](pr-comp-phase3-plan.md), [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts](../apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts), [packages/geometry/src/house/composition/composeRoofFromComposition.ts](../packages/geometry/src/house/composition/composeRoofFromComposition.ts).

### 2026-06-18 - Workbench House Forms - Draw Outline Retired as Authoring Affordance (PR-COMP-PHASE3.3)

Area: Workbench House Forms

Status: Active

Decision or mistake: Phase 3.3 of the [composition migration](house-composition-vision.md). With composition-first authoring landed (Phases 3.1 / 3.2 — every new house form is a rectangle with a populated `composition`), the freeform `Draw outline` path is retired as a house-form authoring affordance. The rail's footprint-mode picker drops the `'Draw outline'` option (now a single-option list, so the picker itself is replaced by direct preset selection); the `Continue outline` button is removed; the `startDrawOutlineEditor` action is dropped from `useObjectWorkbenchSelection` and from the fixture stubs.

Legacy forms persisted with `mode: 'custom_polygon'` are NOT migrated — they continue to render their stored polygon read-only via the legacy pipeline. The rail shows a small read-only badge explaining the form was authored before composition and that preset controls are unavailable on it; designers wanting to change shape recreate the form as a new rectangle.

Follow-up cleanup retired the inspector-only deck redraw trigger (`startDeckOutlineEditor`) after Canvas Plan stopped consuming `drawOutline*` requests. Stored custom deck outlines still render, and preset deck creation remains the live authoring path.

Why it mattered: closes the authoring loop the composition migration opens. Composition is the source-of-truth shape for new forms (rectangle primitive + roof intent); leaving the freeform polygon tool active would create two divergent authoring paths and tempt designers back to a model the geometry router can't fully consume. Removing it cleanly signals the direction — and removes ~50 LOC of orphaned plumbing (the `runStartOutline` / `canStartDrawOutline` prop chain through the inspector hierarchy, the `startDrawOutlineEditor` action, the `Continue outline` button condition). Legacy custom-polygon forms keep rendering because the read path was always separate from the edit path.

Current guardrail:
- The footprint-mode picker for house forms must NOT regain a freeform option. New shape primitives ship as additional values on the `RectangleRoofIntent` / composition primitive type, not by reviving `custom_polygon` as an authoring target.
- Legacy `mode: 'custom_polygon'` forms must remain visible (read-only render). The defensive fallback in the inspector — show a "legacy form" badge and skip the preset picker — must stay so designers understand why preset controls are absent on those forms.
- Do not revive the old inspector-only deck redraw trigger. If custom deck outline editing comes back, rebuild it against the current Canvas Plan interaction model instead of reintroducing `drawOutlineMode` / `drawOutlineRequestId` / `drawOutlineSeedPolygon` shell props.

Behavioural impact: designers can no longer enter freeform polygon authoring for house forms (the rail's mode picker no longer exposes the option). Existing forms persisted as `custom_polygon` continue to render their shape unchanged and surface a read-only badge instead of a `Continue outline` button. Later cleanup removed the stale deck redraw button/action wiring; stored custom deck outlines remain visible and preset decks remain addable. 197 state-lane tests green (was 185 pre-PR; +12 from suites that ran but had been unaffected); portal typecheck clean; eslint clean.

Promoted to: None

Related docs/tests: [docs/pr-comp-phase3-plan.md](pr-comp-phase3-plan.md), [apps/portal/components/drawings/rail/objectRailShared.tsx](../apps/portal/components/drawings/rail/objectRailShared.tsx), [apps/portal/components/drawings/rail/HouseFormFootprintSections.tsx](../apps/portal/components/drawings/rail/HouseFormFootprintSections.tsx), [apps/portal/components/drawings/rail/HouseFormInspector.tsx](../apps/portal/components/drawings/rail/HouseFormInspector.tsx), [apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchInspectorHost.tsx](../apps/portal/app/staff/projects/[projectId]/design-workbench/WorkbenchInspectorHost.tsx), [apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchSelection.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchSelection.ts).

### 2026-06-18 - Workbench Snap - House-to-House Plan-View Snap (PR-COMP-PHASE3.4)

Area: Workbench Snap

Status: Active

Decision or mistake: Final chunk of Phase 3. `buildProjectHouseSnapTargets` now emits snap targets when `activeFamily === 'house_forms'` — walls + roof eaves of every house form OTHER than the one being dragged. Self-snap is prevented by a new `excludeHouseFormId` parameter; PlanViewport supplies the dragged form's id from `activeObjectRef.objectId` when active family is `house_forms`. The existing `MoveTool` + `resolveMoveSnap` + `PlanMoveSnapIndicatorLayer` infrastructure already handles the drag, snap resolution, and preview chrome for moves of any family — they pick up the new targets transparently without modification.

Why it mattered: composition-first authoring (Phases 3.1 / 3.2) makes new house forms rectangles a designer can resize. To build the L / T / U / cross composites Phase 4 will Join, designers need a precise way to drag one rectangle into edge contact with another — that's exactly what wall-to-wall and eave-to-eave snap delivers. Phase 4's Join operation will read the snapped position to infer the join edge, so reliable snap is a prerequisite. The change is small (one function signature + one PlanViewport memo) precisely because the snap engine was designed family-agnostic from the start (PR-SNAP-X); only the source-list builder needed to learn about house-form drags.

Current guardrail:
- House-form snap MUST exclude the dragged form's own walls/eaves. The exclusion lives in `buildProjectHouseSnapTargets` (filters `projectHouseSnapSources` by `excludeHouseFormId` before generating targets); PlanViewport passes the id from `activeObjectRef.objectId` when the family is `house_forms`. A test pins the behaviour so a future refactor doesn't silently reintroduce self-snap.
- Eave-to-eave snap is intentional. House composites are often built with shared verandahs / matching overhangs, and eave-aligned drag is the natural way to express that. If a designer reports false-positive eave snap, the fix is per-form tolerance — not removing eaves from the target set.
- The MoveTool, resolveMoveSnap, and snap-indicator layers MUST stay family-agnostic. They already work for pergola / deck / house-form moves because the snap protocol is shape-based, not family-based. Resist adding family branches to those — keep family logic in the source-list builder.

Behavioural impact: designers dragging a house form in plan view now see snap chrome (line + marker + label) when the form's edge approaches another form's wall or eave, and the drop position locks to the snapped alignment. Cross-family snap (pergola → house, deck → house) is unchanged. 518 PlanViewport + state-lane tests green (was 511 pre-PR; +4 new snap-exclusion tests in `buildProjectHouseSnapTargets.test.ts`); portal typecheck clean; eslint clean.

Promoted to: None

Related docs/tests: [docs/pr-comp-phase3-plan.md](pr-comp-phase3-plan.md), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/snap/buildProjectHouseSnapTargets.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx](../apps/portal/components/drawings/viewports/PlanViewport/PlanViewport.tsx).

### 2026-06-18 - Workbench House Forms - Multi-Rectangle Composite Geometry + Detach Primitive (PR-COMP-PHASE4a)

Area: Workbench House Forms

Status: Active

Decision or mistake: First half of Phase 4 of the [composition migration](house-composition-vision.md). Three sub-commits land invisible infrastructure that closes the multi-rectangle loop end-to-end and adds the pure detach primitive for 4b's seam-icon UX:

- **4a.1**: `detachHouseFormAtSeam({ composition, joinIndex })` ships in `@sp/geometry/house/composition` — pure function, adjacency-graph BFS, returns one `HouseComposition` per connected component of the post-detach graph. Renumbers `primitiveIndex` fields in each partition so the result validates via `validateHouseComposition`. Closed typed error union (`invalid_join_index` / `composition_disconnects_into_more_than_two`).
- **4a.2**: `deriveCompositionUnionPolygon3(composition)` ships in `houseFormCompositionFootprint.ts` — pure helper that returns `Polygon3 | null`. Returns null for null / empty / single-primitive compositions (preserves Phase 3.2 byte-equivalence) or when `composeFootprintFromComposition` throws (defensive). Returns the union polygon for 2+ primitive compositions.
- **4a.3**: `buildHouseFormGeometryInputForForm` substitutes the union polygon for the preset-derived footprint when `deriveCompositionUnionPolygon3` returns non-null, BEFORE calling `buildHouseModel3DFromRawHouseInput`. The legacy wall / eave / opening builders consume the union polygon transparently (they've handled L / T / U preset footprints since the project's inception). The Phase 3.2 roof swap continues to run unchanged on top.

Why it mattered: Phase 3.2 left a half-finished loop — composition data flowed through the roof solver but walls/eaves still came from the legacy preset path. Single-rectangle composites were correct because preset and composition produced identical dimensions; multi-rectangle composites would have rendered with walls along ONE constituent rectangle instead of the union. Until 4a closed this gap, no PR could author a multi-rectangle composite and trust the render, which meant 4b's Join operation had nowhere safe to land its output. 4a also lands the pure `detachHouseFormAtSeam` function ahead of 4b so the visual Detach UX in 4b is just an icon + action call, not a geometric algorithm.

The orphaned-UI decision: Detach UX is deferred to 4b alongside Join. Nothing currently authors a multi-rectangle composition (Phase 3 only ships single-rectangle), so detach icons in 4a would never appear in any project. Spending review surface on UI nothing can trigger is wasted; both icons share the seam-position math and naturally belong together in 4b.

Current guardrail:
- `deriveCompositionUnionPolygon3` MUST return null for single-primitive compositions. The byte-equivalence test in `houseFormCompositionRender.test.ts` pins this invariant — if a future refactor flips the gate, single-rectangle compositions would silently diverge from the legacy path and Phase 3.2's invariant breaks.
- The composition union polygon's contract (CCW, orthogonal, mm, z=0) MUST match what the legacy wall builder expects. `composeFootprintFromComposition` already produces this shape; tests in `houseFormCompositionFootprint.ts` pin it independently of the integration. If a future refactor changes the polygon shape on either side, the seam tests catch it before the integration test does.
- `detachHouseFormAtSeam` partitions MUST validate cleanly via `validateHouseComposition`. The renumbering of `primitiveIndex` fields is the trickiest part (a join referencing original indices [2, 5] in a partition containing [2, 4, 5] becomes [0, 2]); tests assert validator success on every partition, which catches stale indices via the validator's bounds check.
- Multi-rectangle composites currently render via the per-rectangle stitched solver from PR-COMP1 (the same path single-rectangle composites use); this produces approximate geometry on non-fused composites with the existing `composition_stitched_render` amber-tint diagnostic. PR-COMP-UNIFIED is the dedicated investment to ship the proper Hip+Hip L topology when designers demand it — don't conflate that work with the routine pipeline wiring 4a does.

Behavioural impact: zero designer-facing change in any current project (no production form has a multi-rectangle composition yet — Join lands in 4b). Internally, the pipeline now correctly handles whatever 4b will create: a hand-authored L composite produces 6 wall segments (vs. a single rectangle's 4), the `footprint` field on the geometry input result reports the union polygon (not the preset polygon), and the roof solver continues to stamp `roofTopologySolver: "composition_per_rectangle_stitched"`. 196 state-lane tests green (was 185 + 7 from 4a.2 + 4 from 4a.3); 43 composition-lane tests green (was 32 + 11 from 4a.1); portal typecheck clean; eslint clean.

Promoted to: None

Related docs/tests: [docs/pr-comp-phase4a-plan.md](pr-comp-phase4a-plan.md), [packages/geometry/src/house/composition/detachHouseFormAtSeam.ts](../packages/geometry/src/house/composition/detachHouseFormAtSeam.ts), [apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts](../apps/portal/lib/drawings/state/houseFormCompositionFootprint.ts), [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts](../apps/portal/lib/drawings/state/houseFormCompositionRender.test.ts).

### 2026-06-18 - Workbench House Forms - Join / Detach Seam-Icon UX (PR-COMP-PHASE4b)

Area: Workbench House Forms

Status: Active

Decision or mistake: Second half of Phase 4. Three sub-commits land the visible composition workflow — designers can now Join two snapped house forms into a composite (clicking a chip on the shared edge) and Detach a composite at any of its internal seams (clicking a chip on the seam). The UX deliberately uses per-seam icons rather than multi-select + rail button so the affordance lives where the action happens (the seam itself); Detach is naturally granular (one click breaks one seam, not the whole composite).

- **4b.1** — Pure geometry primitives in `@sp/geometry/house/composition/compositionSeams.ts`: `findCompositionJoinSeamMidpoint(composition, joinIndex)` for Detach icon position; `detectSharedSeamBetweenForms({...})` for Join icon visibility / position; `joinTwoHouseForms({...})` for the merge (translates form B into A's frame, validates the seam, builds the merged composition with renumbered joins). Closed typed errors (`no_shared_seam` / `merged_primitives_overlap`).
- **4b.2** — Workbench actions in `useObjectWorkbenchActions`: `joinHouseForms({ formAId, formBId })` keeps form A's id/transform/metadata, replaces its composition with the merge, removes form B; `detachHouseFormAtSeam({ houseFormId, joinIndex })` replaces the original form's composition with partition 0, creates new house forms (cloning metadata) for partitions 1..N-1. Both actions surface typed geometry errors as designer-readable messages.
- **4b.3** — PlanViewport overlay: `interactions/seams/seamIconTargets.ts` emits Detach + Join target lists from per-form composition and world transform; the Plan canvas renders circular chips with + glyph for Join and - for Detach. Click dispatches the matching action; `stopPropagation` prevents underlying form-select; tooltip via `<title>`. PlanViewport receives `projectHouseFormCompositions` from DesignWorkbenchEstimateClient through DrawingWorkbench → WorkbenchViewportHost.

Why it mattered: closes the entire composition vision end-to-end. Phase 1 shipped geometry primitives; 2 shipped data field; 3.1/3.2 wired single-rectangle composites through the pipeline; 3.3/3.4 retired Draw outline + added house-to-house snap; 4a shipped multi-rectangle pipeline + pure detach primitive; 4b is what designers actually see and use. After 4b, the workflow is: place a rectangle → drag near another rectangle → snap aligns them → click the Join chip → one composite house form. To unwind: click any seam's Detach chip → the composite splits at that seam. No multi-select, no modal dialogs, no separate "compose" mode — the affordance lives in the geometry.

The orphaned-UI argument flipped at 4b: 4a deferred UX because no production form had a multi-rectangle composition yet. 4b closes the loop because Join is the entry point — once it ships, the Detach icons in 4b.3 (which 4a's pure function powers) start appearing on every composite a designer creates.

Current guardrail:
- Seam icons MUST live in PlanViewport only. They're an authoring affordance; the 3D viewport stays read-only per the workbench's read/edit split.
- The chip click handler MUST `stopPropagation` so the icon click doesn't fall through to the underlying form's hit-target (which would change selection instead of running the action). Tests in 4b.3 don't exercise this directly (no React testing harness for the layer yet); the pattern is pinned by the existing snap-indicator chrome — keep the patterns aligned.
- Rotation: Join icons skip pairs with differing rotations. Composition's axis-aligned-rectangle primitive can't represent rotated rectangles; joining across rotations would require either rotating one form's primitives (defeats axis alignment) or supporting a new primitive kind (out of scope for v1). Detach icons render regardless of rotation because the geometry is form-local.
- `joinHouseForms` MUST keep form A's id + transform + metadata. Designers who rename a form, tweak its eave height, add openings, etc. shouldn't lose that work when they Join it to another form.

Behavioural impact: designers placing two rectangles next to each other now see a circular orange chip with `+` between them; click → one composite house form. Detach chips appear on every internal seam of every composite (one per join). Cross-family snap (pergola → house, deck → house) unchanged. Multi-rectangle composites render correctly via the 4a pipeline. Composition lane: 60 of 60 green (was 43 + 17 from 4b.1). PlanViewport / state / app-staff lanes: 805 of 805 green (no regressions; 11 pre-existing skipped). Portal typecheck clean; eslint clean.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/composition/compositionSeams.ts](../packages/geometry/src/house/composition/compositionSeams.ts), [packages/geometry/src/house/composition/compositionSeams.test.ts](../packages/geometry/src/house/composition/compositionSeams.test.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets.ts), [apps/portal/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets.test.ts](../apps/portal/components/drawings/viewports/PlanViewport/interactions/seams/seamIconTargets.test.ts), [apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts](../apps/portal/app/staff/projects/[projectId]/design-workbench/useObjectWorkbenchActions.ts).

### 2026-06-19 - Workbench House Forms - Unified-Topology Hipped Composite Roof (PR-COMP-UNIFIED-1)

Area: Workbench House Forms

Status: Active

Decision or mistake: Closes the gap PR-COMP1 explicitly deferred. `composeRoofFromComposition` previously had two strategies — fused-rectangle shortcut (good) and per-rectangle stitched solve (placeholder for non-fused composites that stamped `approximationReasons: 'composition_stitched_render'`). An L composite rendered as two independent hipped roofs meeting at eave height; a T rendered as three; etc. No unified ridge, no valleys at reflex corners. Designers saw "Invalid geometry" / "approximate" badges on every composite they joined.

The fix is one of those rare cases where the math we needed was already in the codebase. `buildJoinedRectilinearHippedRoof` (an inward-moving wavefront solver in `packages/geometry/src/house/roofJoinedHipped.ts`, used by the legacy custom-polygon path) takes an arbitrary orthogonal polygon and produces a single coherent hipped roof — one continuous ridge, valleys at reflex corners, hips at convex corners. It even supports Dutch-hip open gables via `stationaryEdgeIndexes`. It just was never wired into the composition orchestrator.

This PR adds a third strategy slotted between the fused-rectangle shortcut and the stitched fallback: when every primitive has an identical hipped intent and the composition has 2+ rectangles, route `composeFootprintFromComposition(composition)` to the wavefront solver. Stamp `roofGeometry: "composition_unified"` and `roofTopologySolver: "composition_joined_wavefront"`. If the wavefront reports `roofTopologyFailureReason` or returns zero planes, fall back to the existing stitched path — the safety net is preserved.

Test coverage: L (Graham–Oratia: 6 facets, 1+ valley), T (8 facets, 2+ valleys), U (8 facets, 2+ valleys) all pass via the unified path. The Graham–Oratia L test previously expected 8 stitched planes; updated to 6 unified planes. Mixed-intent and mono/flat composites continue to take the stitched path unchanged.

Why it mattered: Composition was the input model designers landed on; the rendering hadn't caught up. After this PR, every L/T/U/cross composite a designer joins via the 4b chip UX renders as one architecturally coherent roof — the visual matches the data model. The amber-tint diagnostic stops firing on every composite. The composition vision finally feels complete end-to-end: place rectangles → snap → join → one coherent house with one coherent roof.

The scouting result that drove the implementation: the original plan was to write a straight-skeleton from scratch (~250 LOC of finicky geometry math). Read-only Explore agent surfaced `buildJoinedRectilinearHippedRoof` — already battle-tested through the legacy free-form pipeline. ~80 LOC of wiring + 3 new tests beat a ~250 LOC greenfield implementation. The lesson: scout for prior art before writing geometry from scratch, especially in a codebase with a homegrown geometry package.

Current guardrail:
- The wavefront has known failure modes on certain aspect ratios (legacy free-form bug class). Composition input may dodge them (axis-aligned designer-authored rectangles, not inferred decomposition) but the topology-failure fallback to stitched preserves the safety net. If the fallback fires in production, capture the composition shape via the existing HR1 "Save bug report" button and quarantine in the HR4 matrix.
- Open-gable / Dutch-hip on composite terminal ends is NOT yet wired. The rail's `openGableEndIds` translates to per-rectangle caps on single rectangles; for composites, the `stationaryEdgeIndexes` derivation from composite-perimeter terminal ends is PR-COMP-UNIFIED-2. Until then, composite Dutch-hip toggles are a no-op on the wavefront path.
- Mixed-intent composites (e.g. main hipped + extension skillion) intentionally take the stitched path — the wavefront only handles uniform pitch. The vision doc names this as a v1 limit; revisit if a real customer need surfaces.

Behavioural impact: in-browser Plan Editor + 3D Review render correctly for all composition shapes; geometry tests 12 of 12 green in the composition lane; portal drawings lane 253 of 253 green. The 4 pre-existing legacy `custom polygon` / `recessed footprint` / `DXF asset` test failures on `main` are unrelated to this change (they exercise the free-form polygon path, which still calls `buildJoinedRectilinearHippedRoof` directly without going through composition).

Promoted to: None

Related docs/tests: [packages/geometry/src/house/composition/composeRoofFromComposition.ts](../packages/geometry/src/house/composition/composeRoofFromComposition.ts), [packages/geometry/src/house/composition/composeRoofFromComposition.test.ts](../packages/geometry/src/house/composition/composeRoofFromComposition.test.ts), [packages/geometry/src/house/roofJoinedHipped.ts](../packages/geometry/src/house/roofJoinedHipped.ts), [docs/house-composition-vision.md](house-composition-vision.md).

### 2026-06-19 - Workbench House Forms - Status Pipeline Mirrors Composition Render (PR-COMP-UNIFIED-2)

Area: Workbench House Forms

Status: Active

Decision or mistake: PR-COMP-UNIFIED-1 wired the unified-topology hipped solver into `composeRoofFromComposition`, but the workbench rail kept showing "Invalid geometry — `roof_wavefront_unclosed_boundary`" on joined composites. Investigating the HR1 diagnostic JSON (captured live via the designer-facing "Save bug report" button — see [[feedback-workbench-verification]]) traced the failure to a **parallel pipeline architectural issue**: `objectWorkbenchStatusModel.buildRoofStatus` was calling `buildHouseModel3DFromRawHouseInput` independently on the raw preset footprint (not the composition union) and surfacing the failure of THAT legacy solver as the rail status. The render pipeline's composition swap had no effect on what the rail showed.

Three fixes land in one commit:

1. **Substitute composition union for the status pipeline's footprint.** `deriveCompositionUnionPolygon3(houseForm.composition)` returns the union polygon for multi-rectangle composites (null for single-rectangle). The status pipeline now feeds that polygon to `buildHouseModel3DFromRawHouseInput` instead of the preset footprint, mirroring what the render pipeline does (PR-COMP-PHASE4a.3 added the same substitution there).

2. **Apply the composition swap to the status pipeline's model.** `swapRoofFromComposition` was previously an internal helper inside `houseFormGeometryInput.ts`. Now exported. The status pipeline calls it on its `legacyPackageRoofModel` so the rail diagnostics are derived from the composition's planes, not the legacy solver's planes.

3. **Re-run QA on composition planes + strip stale legacy stamps.** The original swap preserved the legacy model's `roofQaStatus` and `roofQaFailureReason`, which made sense for single-rectangle byte-equivalent cases but was wrong for multi-rectangle composites where the legacy was solving a different polygon. After the swap, the composition's planes are run through `applyRoofQa` (now exported from `@sp/geometry`) against the composition's union polygon. The merged metadata also explicitly strips legacy `roofTopology*` / `roofWavefront*` / `roofEaveOffset*` / `roofFacetMergeMode` / `roofQa*` / `roofGeometry` / `roofTopologySolver` / `approximationReasons` fields — they describe LEGACY solver behaviour and don't apply to the composition planes.

Why it mattered: this was a class of bug I'd have shipped repeatedly without the captured-repro discipline. Math-test green showed the composition pipeline was healthy. The rail still said invalid. The cause was a DIFFERENT pipeline failing — invisible from inside the geometry package, only visible end-to-end via the HR1 diagnostic export. Verification artifact: HR1 capture before fix showed `roofTopologySolver: null` and `roofQaStatus: "invalid"` with `roof_wavefront_unclosed_boundary`; capture after fix shows `roofTopologySolver: "composition_per_rectangle_stitched"`, `roofQaStatus: "valid"`, `roofPlaneCountAfterQa: 11`, `roofQaAreaDeltaMm2: 0`. Plan Editor renders the composite's 11 roof planes correctly.

Current guardrail:
- **Status pipeline and render pipeline MUST stay in lockstep.** Both apply the composition swap, both substitute the union polygon. If a future PR adds a new geometry input step to one, it must add the same step to the other or extract a shared helper. The two-pipeline architecture is a latent risk — followup should consolidate into a single canonical model build that both consume.
- **For multi-rectangle composites, do NOT preserve legacy model metadata after the swap** for any field that describes the LEGACY solver's behaviour. The legacy was given a different polygon and solved different planes; its QA / topology stamps don't apply to composition's output.
- **The HR4 matrix loader now handles BOTH `polygonLocalM` (legacy free-form captures) and `composition` (PR-WB-COMPOSITION-ONLY captures).** Composition-shaped captures get reduced to their union polygon for matrix exercise. A composition-shaped capture failing the matrix means the legacy free-form pipeline fails on that union polygon — NOT that the composition pipeline fails (the composition pipeline is exercised through `composeRoofFromComposition.test.ts`). Followup: extend the matrix to exercise composition-shaped captures via `composeRoofFromComposition` directly so the right pipeline is asserted.

Behavioural impact: every joined composite a designer creates now shows correct rail status — `roofQaStatus: "valid"` when composition succeeds (the common case), genuine failure stamps only when composition itself fails. The renderer shows the composition's planes (stitched per-rectangle for mixed-intent cases, unified-wavefront for matched-intent cases). The "Invalid geometry" badge no longer fires falsely on every joined composite.

Followups not in this PR:
- Wavefront topology failure on certain matched-intent composites (e.g. 3-rect L+L composite with floating-point primitive coords) — separate investigation, fall-back to stitched currently handles it but designers should see unified.
- Consolidate `buildRoofStatus` and `buildHouseFormGeometryInputForForm` to use a single shared canonical model build, eliminating the parallel-pipeline class of bug entirely.
- Extend HR4 matrix to exercise composition-shaped captures via `composeRoofFromComposition` (not just the legacy free-form path).

Promoted to: None

Related docs/tests: [apps/portal/lib/drawings/state/houseFormGeometryInput.ts](../apps/portal/lib/drawings/state/houseFormGeometryInput.ts), [apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts), [packages/geometry/src/house/roofQa.ts](../packages/geometry/src/house/roofQa.ts), [packages/geometry/src/house/__fixtures__/captured/joined-composite_pitch-mismatch_eave-self-overlap_2026-06-19.json](../packages/geometry/src/house/__fixtures__/captured/joined-composite_pitch-mismatch_eave-self-overlap_2026-06-19.json), [docs/workbench-captured-repro-workflow.md](workbench-captured-repro-workflow.md).

### 2026-06-19 - Workbench House Forms - Straight-Skeleton Split Events (PR-SS-2 part 2)

Area: Workbench House Forms

Status: Active

Decision or mistake: Part 1 laid the orthogonal straight-skeleton foundation (types, validate, bisector, edge-collapse solver) but rejected any reflex vertex with `unsupported_topology`, so only rectangles solved. Part 2 implements the three mechanisms a rectilinear skeleton needs: **split events** (a reflex vertex reaching the strict interior of an opposing eave cuts it, producing two loops that continue evolving in the same circular linked list — no sub-polygon copying), **vertex/coincidence events** (two non-adjacent wavefront vertices arriving at the same point merge and split the loop — this is what resolves the symmetric-L canary's 4-way coincidence at t=2.5 without perturbation), and **ridge finalization** (a 2-vertex loop emits its final ridge edge). Implementing this also surfaced a latent part-1 bug: the merged-vertex velocity averaged the SURVIVING neighbours instead of the two DYING endpoints, which left non-square rectangle ridges open — the part-1 tests never asserted the final ridge node so it shipped green.

Exactness / integer-mm guarantee: orthogonal-skeleton event times and node coordinates are always half-integers (edges never rotate; each node's time is half the gap between two parallel integer edges). The solver works in an internal **2x coordinate space** so every event time and position is an exact integer, with a guard (`time_not_integral_in_2x`) that returns a typed error rather than silently rounding mid-solve. Only at output are coordinates halved and rounded to the nearest millimetre — a node can genuinely fall on a half-mm (e.g. a 10x5 rect), and sub-mm rounding is invisible at roof scale. This isolates the single documented rounding step and keeps the internal solve exact and deterministic (simultaneous events keep the part-1 insertion-order tie-break).

Why it mattered: this is the load-bearing primitive for the composition-roof rewrite (PR-SS-3 translator, PR-SS-4 orchestrator swap, PR-SS-5/6). Getting the exactness model right here — rather than patching float fragility later — is the whole point of the from-scratch rewrite the vision doc committed to ("make the input space match what we can solve"). The reflex topology the composition model produces (L/T/U/H/+) is now solvable by construction without reintroducing the float-precision bug class.

Current guardrail:
- **Scope is the skeleton primitive only.** Nothing is wired into `composeRoofFromComposition`; the regression matrix stays quarantined and unchanged. The composition-corpus fixtures unquarantine in PR-SS-3/PR-SS-4, not here (the single-rect fixture's own `knownFailure.closesIn` is PR-SS-4).
- **Known limitation: N-way simultaneous ridge-line collapse.** Perfectly symmetric shapes where an entire eave-pair collapses to a ridge line in one instant AND reflex valleys arrive at that same instant/point (e.g. a centred-stem T whose bar is exactly 2x the ridge offset) return `unsupported_topology` — a graceful typed error so the orchestrator can fall back, NOT wrong geometry. Pinned by a test; flip it to `ok:true` when a follow-up closes the gap. The 4-way coincidence of the symmetric-L canary IS handled. Real designer composites are not perfectly symmetric (Graham–Oratia is 12500x8000 + 5814x2400), so the corpus is not blocked.
- **Verification posture.** Per the workbench HARD RULE, a solver fix is not "done" from math-test green alone — but part 2's output is not yet in the render path, so the HR1/Playwright/visual-3D gate is explicitly assigned to PR-SS-4 (the orchestrator swap). Part 2's artifact is the expanded `solve.test.ts` (16 → 22 tests) plus the eave-coverage topology bridge that derives correct roof facet/valley topology directly from the skeleton graph.

Promoted to: None

Related docs/tests: [packages/geometry/src/straightSkeleton/solve.ts](../packages/geometry/src/straightSkeleton/solve.ts), [packages/geometry/src/straightSkeleton/solve.test.ts](../packages/geometry/src/straightSkeleton/solve.test.ts), [packages/geometry/src/house/compositionRoofRegressionMatrix.test.ts](../packages/geometry/src/house/compositionRoofRegressionMatrix.test.ts), [docs/house-composition-vision.md](house-composition-vision.md).

### 2026-06-20 - Workbench House Forms - Skeleton Roof Translator (PR-SS-3)

Area: Workbench House Forms

Status: Active

Decision or mistake: `buildSkeletonRoof` ([packages/geometry/src/house/roofSkeleton.ts](../packages/geometry/src/house/roofSkeleton.ts)) translates the pure straight-skeleton graph (PR-SS-2) into `RoofPlane3D[]` + ridge/hip/valley `HouseRoofFeature3D[]` at a pitch + eave height — one coherent hipped roof for any rectilinear footprint the skeleton resolves. Node height = `eaveHeightMm + node.time × tan(pitch)` (the `time` field exists for exactly this). Two design calls worth recording:

1. **Facets are built by angular planar-subdivision traversal (DCEL-style), NOT from the skeleton's left/right edge labels.** The first implementation walked each facet from the skeleton edges labelled with that eave id; it closed for rect/L/T/U but broke at multi-reflex convergences (`+`) where keeping a clean label partition through splits + coincidences is fragile. Switching to a geometry-only walk (at each vertex, take the neighbour whose outgoing angle is the largest one strictly less than the back-angle, wrapping to the global max) traces the interior face robustly without depending on labels. Lesson: derive faces from the embedding, not from bookkeeping that has to stay perfectly consistent across every event type.

2. **Correctness self-guard — never emit a silently-wrong roof.** After building facets the translator checks they partition the footprint (plan areas sum to footprint area within tolerance); if not, it returns a typed error (`facets_do_not_partition`) so the orchestrator (PR-SS-4) can fall back. This is the same "graceful typed error, not wrong geometry" posture as the part-2 symmetric-bar limitation.

Why it mattered: this guard immediately caught a real SS-2 solver gap — see below — instead of shipping overlapping facets that would have passed a naive "facet count == eaves" check.

Current guardrail:
- **Surfaced SS-2 gap: 4-way central convergence of `+` / `H` is unresolved.** The solver leaves the centre disconnected (arm ridge ends dangle; nodes never meet), so facets overlap and the area guard fires. Root cause is the split/coincidence merged-vertex velocity: `cornerVelocity` (normal sum) solves L/T/U but is wrong at the plus centre, while the earlier unified perpendicular-vs-parallel attempt broke T. **PR-SS-2 part 3 (fix that velocity so N-way convergences resolve) is now a prerequisite BEFORE PR-SS-4 can unquarantine the +/H corpus fixtures.** Rect/L/T/U solve cleanly today.
- **Scope (deliberately not done):** fully hipped only (one slope facet per eave); open-gable / Dutch-hip terminal caps, cladding/flashing/solids, the `applyRoofQa` call, and wiring into `composeRoofFromComposition` are all PR-SS-4+. The translator's invariants (partition + facet/valley counts) are the ones QA will later enforce, asserted directly in `roofSkeleton.test.ts`.
- **Verification posture.** Still pre-render; HR1/Playwright/visual-3D gate stays on PR-SS-4. Part 3's artifact is `roofSkeleton.test.ts` (rect 4/0, L 6/1, T, U partition + ridge-height) + the area-conservation guard.

Promoted to: None

Related docs/tests: [packages/geometry/src/house/roofSkeleton.ts](../packages/geometry/src/house/roofSkeleton.ts), [packages/geometry/src/house/roofSkeleton.test.ts](../packages/geometry/src/house/roofSkeleton.test.ts), [packages/geometry/src/straightSkeleton/solve.ts](../packages/geometry/src/straightSkeleton/solve.ts), [docs/house-composition-vision.md](house-composition-vision.md).

### 2026-06-23 - Design Workbench - Retired Model Viewport Mode

Date: 2026-06-23
Area: Design Workbench
Status: Active
Decision or mistake: The old `model` viewport mode was removed from the live `DrawingWorkbenchViewportMode` union and runtime branches. Stale `viewportMode: "model"` UI state is now stripped as opaque legacy input instead of driving a view selection.
Why it mattered: The workbench already presents 3D Review, Plan Editor, and Sheet Output. Keeping a hidden Model Space mode preserved an obsolete render branch and an unreachable footprint-edit callback path.
Current guardrail: Do not add `model` back as a workbench tab, route, or rendering branch. Plan editing belongs in PlanViewport; 3D remains read/select-focused.
Promoted to: None
Related docs/tests: `apps/portal/lib/drawings/state/drawingWorkbenchUiState.test.ts`; `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false --pretty false`

### 2026-06-23 - Design Workbench - Retired Section View Tab

Date: 2026-06-23
Area: Design Workbench
Status: Active
Decision or mistake: The workbench-only `WorkbenchViewTab` was retired, and stale `activeView` UI state is now stripped as opaque legacy input.
Why it mattered: The current workbench chrome exposes 3D Review, Plan Editor, and Sheet Output. Keeping a hidden Section tab in workbench state preserved a stale sheet/status branch that future work could mistake for a live surface.
Current guardrail: Do not reintroduce `section` as a workbench view tab. Future Section output should be derived from `WorkbenchSolvedGeometryArtifact`, not from separate workbench view state or calculator-era section models.
Promoted to: None
Related docs/tests: `apps/portal/lib/drawings/workbenchViewTypes.ts`; `apps/portal/lib/drawings/state/drawingWorkbenchUiState.test.ts`; `docs/design-workbench-architecture.md`

### 2026-07-18 - Calculator Commercial UI - Internal Cost And Quote Handoff

Date: 2026-07-18
Area: Calculator Commercial UI
Status: Promoted
Decision or mistake: The calculator previously labelled cost-engine totals as generic `Total`, displayed blind customer sell prices alongside those internal costs, and allowed warning-free Save to bypass the Preserve/Reprice review entirely. Calculator money is now separated into internal true cost and quote-stage customer add-ons; every valid save exposes the costing-basis choice before persistence; quote creation is a separate explicit post-save action.
Why it mattered: Generic total wording could be mistaken for the customer quote amount, while a silent preserve save could retain an older costing basis without staff seeing the current Live comparison. Combining quote navigation with save would also hide a separate commercial side effect.
Current guardrail: Cost-engine `cost_ex_gst` and `cost_inc_gst` values must be labelled internal true cost. The calculator may display the pergola customer price only through the shared quote-pricing helper: round true cost ex GST multiplied by `1.25`, then apply and round GST. That preview is not persisted and must not alter Save, Preserve/Reprice, or quote totals. Blind customer prices remain separate and excluded from pergola true cost. Existing-estimate Save must compare stored and Live costing and make Preserve versus Reprice explicit. Quote creation must use the exact saved estimate through the quote domain and must not occur until the user selects it.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `apps/portal/lib/quotes/pricing.test.ts`; `apps/portal/lib/quotes/mapping.test.ts`; `apps/portal/app/staff/calculator/CalculatorPricingSummary.test.tsx`; `apps/portal/app/staff/calculator/calculatorPricingComparison.test.ts`; `apps/portal/app/staff/calculator/calculatorEstimateSave.test.ts`; `apps/portal/app/staff/calculator/CalculatorSaveDialogs.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-18 - Calculator Local Drafts - Key Isolation And Visible Protection

Date: 2026-07-18
Area: Calculator Local Drafts
Status: Promoted
Decision or mistake: Calculator draft hydration and persistence previously lived as independent effects in the page client. On a draft-key change with no local snapshot, persistence could become eligible before the target estimate or duplicate finished loading, allowing values from the previous key to be written under the new key. Local write completion and failure were also invisible to staff.
Why it mattered: Project and estimate switching must never cross-contaminate unsaved inputs, and a silent browser write gives staff no reliable signal that work survived a reload. Estimate Save and its local-first server queue are a separate business action and must not be implied by browser-draft protection.
Current guardrail: A draft key is persistence-ready only after a valid local restore, a fresh scratch default, or explicit acceptance of the target external draft. Ignore completions from older keys and older write generations. Show browser-draft status separately from estimate Save/sync state and retain the existing working-copy-first, session-fallback payload contract.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/useCalculatorDraftSession.test.tsx`; `apps/portal/app/staff/calculator/calculatorDraftPersistence.test.ts`; `playwright/portal.calculator.spec.ts`

### 2026-07-18 - Calculator Module Navigation - Canonical Identity And Draft-Only Mutations

Date: 2026-07-18
Area: Calculator Module Navigation
Status: Promoted
Decision or mistake: Module identity and module/pergola actions were split between global array indexes, dropdown labels, and action tiles. The calculator now derives one local ordinal inside each pergola and routes selection plus Add, Duplicate, Move, and Remove through a pure navigation owner.
Why it mattered: Global and local module numbers could disagree across the command bar, drawings, save review, and validation issues. Copying the active module for Add also made a supposedly new module inherit specialist settings and mutable child IDs.
Current guardrail: Module labels are computed as `Pergola N · Module N` and are not persisted or user-editable. Add uses fresh defaults; Duplicate is a deep copy with regenerated flashing/infill IDs; Move changes only `pergolaId` and never reorders; Remove is confirmed, protects the last module, and stays local until the user explicitly saves the estimate.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`; `docs/file-decomposition-and-ownership.md`
Related docs/tests: `apps/portal/app/staff/calculator/calculatorModuleNavigation.test.ts`; `apps/portal/app/staff/calculator/CalculatorModuleNavigator.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-18 - Portal Browser Persistence - Authenticated User Ownership

Date: 2026-07-18
Area: Portal Browser Persistence
Status: Promoted
Decision or mistake: React Query and local-first IndexedDB persistence previously used one browser-global key, so a shared device could hydrate one staff member's private cache, drafts, or mutation queue after another staff member signed in. Persisted data is now keyed by authenticated user ID and the query/local-first providers remount inside the auth boundary.
Why it mattered: Browser persistence is a private data boundary, not only a speed feature. Guessing ownership for legacy unscoped data or leaving queue listeners alive across an auth change risks cross-user disclosure and replay under the wrong session.
Current guardrail: Never hydrate an unscoped legacy key or a different user's key. On owner change, stop queue processing and listeners, clear the old in-memory QueryClient, then hydrate the new owner. Keep unauthenticated query state ephemeral. Sign-out must preserve queued work for the same user's later return or require explicit discard for active sync; it must never silently abandon an in-flight mutation.
Promoted to: `docs/local-first-sync.md`; `docs/security-privacy-quality.md`
Related docs/tests: `apps/portal/lib/localFirst/store.test.ts`; `apps/portal/lib/localFirst/runtime.test.ts`; `apps/portal/components/auth/PortalAuthProvider.test.tsx`; `apps/portal/lib/react-query/persistence.test.ts`; `apps/portal/app/staff/calculator/calculatorDraftPersistence.test.ts`

### 2026-07-18 - Portal Performance Telemetry - Identifier-Free First-Party Retention

Date: 2026-07-18
Area: Portal Performance Telemetry
Status: Promoted
Decision or mistake: Portal performance had local route timing code and an unused browser initializer, but no trustworthy production evidence or retention owner. Core Web Vitals now use a first-party table, a closed canonical route-template contract, staff-only ingestion, admin-only summaries, and automatic 30-day deletion.
Why it mattered: Raw URLs in this portal contain customer/project/contact identifiers. Log-only or free-form telemetry would either be inaccessible for trend analysis or create a new privacy liability.
Current guardrail: Operational performance events may contain only the allowlisted metric, numeric value/rating, route template, navigation type, device class, and optional safe build ID. Never store raw URLs, query strings, record IDs, people data, user IDs, or user-agent strings. Telemetry must fail silently on the client, never block navigation, and must not ship without verified scheduled retention.
Promoted to: `docs/security-privacy-quality.md`; `docs/supabase-schema-map.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/performance/webVitals.test.ts`; `apps/portal/app/api/staff/v1/performance/web-vitals/route.test.ts`; `apps/portal/app/api/admin/performance/web-vitals/route.test.ts`; `supabase/migrations/20260718_000001_portal_performance_metrics.sql`

### 2026-07-18 - Calculator Infills - One Physical Takeoff Owner

Date: 2026-07-18
Area: Calculator Infills And Costing
Status: Promoted
Decision or mistake: Infill geometry and purchasing were duplicated between calculator summaries and the costing BOM. One path approximated a cut list while the other used pooled area plus waste, so displayed pieces, purchased stock, labour, and price could disagree. `calculateInfillsTakeoffV1()` in `@sp/costing` now owns finished geometry, every joiner/support cut, physical stock allocation, pooling, and blockers.
Why it mattered: Total area cannot prove that real rectangles, strips, or kerf-aware linear cuts fit purchasable stock. Duplicated orientation/support rules also caused missing perimeter joiners, double-counted horizontal edges, support quantities without lengths, and false roof-rafter alignment.
Current guardrail: Portal infill code may own draft strings, validation, mapping, and presentation only. BOM, labour, calculator rows, CSV, and job/site pooling must consume the canonical takeoff. Do not add an area fallback; an unplaceable piece is a critical blocker. Existing supports remove only the added 50x50 member, never the acrylic joiner.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `packages/costing/src/engine/infillTakeoff.test.ts`; `packages/costing/src/engine/bom.test.ts`; `packages/costing/src/engine/calculate.test.ts`; `apps/portal/app/staff/calculator/infillCompute.test.ts`; `apps/portal/app/staff/calculator/InfillCutList.test.ts`

### 2026-07-18 - Infill Configurator UX - Requested Choices Are Not Costing Inputs

Date: 2026-07-18
Area: Infill Configurator UX
Status: Superseded
Decision or mistake: The old configurator mixed draft preferences, resolved production choices, planned supports, warnings, preview tabs, and cost comparison in one technical modal. New infills now request automatic material and joiner direction, the canonical takeoff resolves those requests, and the portal maps only resolved values into the unchanged costing payload.
Why it mattered: Treating automatic choices or physically planned 50x50 supports as warnings made valid work look unsafe. Mixing requested `auto` values into `CostInputsV1` would also have leaked portal-only draft state into the costing input contract and risked repricing existing saved estimates.
Current guardrail: Preserve saved manual choices. Keep `auto` portal-only, resolve it through `calculateInfillsTakeoffV1()`, and present added supports as normal production results. Warning counts are for actionable validation or manufacturing blockers, and blocker actions must return to `Opening` or `Existing supports` according to the affected field. Cost comparison stays collapsed and lazy.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/infillConfiguratorPresentation.test.ts`; `apps/portal/app/staff/calculator/InfillConfiguratorDialog.test.tsx`; `apps/portal/app/staff/calculator/calculatorInfillUi.test.ts`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-19 - Portal Navigation Feedback - Keep The Current Surface Usable

Date: 2026-07-19
Area: Portal Navigation Feedback
Status: Promoted
Decision or mistake: Ordinary portal links and Schedule view changes used a delayed or immediate full-screen Blueprint overlay. They now retain the usable current surface, show a thin progress bar immediately, and mark only the control that initiated the route change busy until the route key changes or the safety timeout expires.
Why it mattered: A blocking overlay made routine navigation feel slower than the network work it represented and prevented staff from using information that was already on screen. A global busy state also hid which action was actually in progress.
Current guardrail: Route changes inside an authenticated portal shell use the non-blocking progress owner and pass the initiating control. Projects and Contacts may replace the content area with their truthful pending frames. Reserve full-page Blueprint loading for cold route/authentication boundaries or a separately reviewed unsafe transition; never use it as routine navigation feedback.
Promoted to: `docs/testing-and-qa.md`; `docs/schedule.md`
Related docs/tests: `apps/portal/components/page-state/PortalRouteTransition.test.tsx`; `apps/portal/components/navigation/SidebarRail.test.tsx`; `apps/portal/app/staff/schedule/ScheduleClient.test.tsx`; `playwright/portal.auth-routing.spec.ts`

### 2026-07-19 - Workbench Solve Lifecycle - UI State Reuses Geometry

Date: 2026-07-19
Area: Workbench Solve Lifecycle
Status: Promoted
Decision or mistake: `buildDrawingWorkbenchStore()` combined the expensive object-first geometry solve with lightweight selection, visibility, rail, and viewport state. Because clients correctly memoized that store by `ui`, every UI-only change still reran the solve. The store now accepts a `DrawingWorkbenchSolvedBase` memoized by draft/project identity and derives its UI facade from the same solved-model object.
Why it mattered: Selection and view feedback should be immediate and must not spend geometry work when the authored model did not change. Reusing the north-star solved artifact also makes the source-of-truth boundary clearer rather than adding a second cache or renderer-specific model.
Current guardrail: Estimate, fixture, and embedded drawing clients build the solved base from draft plus geometry identity, then pass it to UI-store derivation. Draft-changing actions still solve the new model. Tests must prove selection/visibility changes preserve solved-model identity. Do not key the expensive solve by viewport mode, selection, hover, camera, or visibility.
Promoted to: `docs/design-workbench-architecture.md`
Related docs/tests: `apps/portal/lib/drawings/state/drawingWorkbenchStore.ts`; `apps/portal/lib/drawings/state/useDrawingWorkbenchStore.ts`; `apps/portal/lib/drawings/state/drawingWorkbenchStore.test.ts`; `apps/portal/lib/drawings/state/useDrawingWorkbenchStore.test.tsx`; `playwright/portal.workbench-performance.spec.ts`

### 2026-07-19 - Calculator Request Lifecycle - Newest Result Wins

Date: 2026-07-19
Area: Calculator Request Lifecycle
Status: Promoted
Decision or mistake: The calculator already debounced and aborted its primary costing request, but the lifecycle lived inline in the large page client and a late success had no explicit post-response abort check. One dedicated hook now owns the timer, `AbortController`, request state, and newest-result protection while preserving the last valid result.
Why it mattered: Rapid edits must never let an obsolete costing response replace a newer calculation. Keeping this behavior in a small owner makes cancellation and error continuity independently testable without moving any pricing logic into the browser.
Current guardrail: Input changes abort the previous request and every success checks its abort signal before publishing. Failed recalculation retains the last valid result and error state continues to block Save until current. Do not put costing rules, input normalization, pricing decisions, or save authority in this hook; those remain in `@sp/costing` and the authenticated server API.
Promoted to: `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/app/staff/calculator/useCalculatorCostingRequest.ts`; `apps/portal/app/staff/calculator/useCalculatorCostingRequest.test.tsx`; `apps/portal/app/staff/calculator/calculatorResultFreshness.test.ts`

### 2026-07-19 - Portal Workflow Bundles - Exact Intent Boundaries

Date: 2026-07-19
Area: Portal Workflow Bundles
Status: Promoted
Decision or mistake: The default Activity tab was first deferred, then restored to the initial bundle because the project shell was also deferred. Once the real project frame and tabs were independently useful, Activity became a measured workflow boundary again. Details shares one responsive lazy boundary, and the 3D viewport loads only for exact `3D Review` intent. Plan and Sheet keep their existing immediate paths.
Why it mattered: Useful content is the real header and usable tabs, not the completion of every tab implementation. Keeping Activity initial added ordinary Project Detail bytes, while eagerly carrying Three/React Three Fiber made users download a large 3D renderer even when they never opened the workbench. Moving code without accounting for its destination would only hide bytes from one route report.
Current guardrail: Keep the project frame and tabs initial and preload only the exact workflow the user signals. A deferred default workflow must show a truthful local loading state inside that usable frame. Evaluate Project Detail and Design Workbench gates together: deferred 3D code belongs to the workbench budget, and neither preserved combined allowance may increase automatically. This is a loading/import boundary only; it does not change workbench props, solved geometry, or costing authority.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/design-workbench-architecture.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/ProjectMainTabs.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectPageShell.test.tsx`; `apps/portal/components/drawings/workbench/WorkbenchChrome.test.tsx`; `apps/portal/app/staff/projects/[projectId]/design-workbench/DesignWorkbenchFixtureClient.test.tsx`; `npm run portal:bundle-budget`

### 2026-07-19 - Portal Project Opening - Cached Summary Before Fresh Snapshot

Date: 2026-07-19
Area: Portal Project Navigation
Status: Promoted
Decision or mistake: Opening a project repeated the full snapshot at the server route boundary even when the browser had prefetched it. Project routes now render without that duplicate full read, show a current-user list/contact-cache summary immediately, and replace it through the existing snapshot query in the background. A direct link without list cache uses one small authenticated project/contact summary API instead of waiting for every workflow relation. The complete snapshot keeps one access-defining project/contact read and one embedded relationship read; an unused audit-event read was removed. Project tabs are intent-preloaded workflow boundaries instead of one initial bundle.
Why it mattered: The duplicate read made a routine project click feel like a 6-8 second page load, while eager first-three-project loading spent bandwidth without user intent. On cold direct links, waiting for email, notes, task, invoice, quote, schedule, estimate, and job-pack data delayed a header that needed only project/contact fields. Treating a failed subordinate read as fresh empty arrays could also mislead staff.
Current guardrail: Derive list summaries only from the authenticated user's QueryClient and canonical project/contact keys. If that cache is absent, use the authenticated summary API; do not read Supabase directly from browser UI. Keep the existing complete snapshot query/key as background authority. A `401`, `403`, or `404` hides known project data; network/server failure may retain it with Retry. An incomplete subordinate snapshot read is a refresh failure, not fresh empty workflow data. Activity and Emails say they are updating until the complete snapshot arrives. Internal navigation uses `/staff/projects`; `/projects` remains compatibility-only. Browser Back clears the instant view and relies on Next retained route state; never cache a server-rendered React node. Keep the lightweight shell initial, workflows lazy, and preloads intent-only. Do not restore server-side full-snapshot blocking or automatic row fan-out.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/queries/projectCache.test.ts`; `apps/portal/lib/queries/projectOpenPreload.test.ts`; `apps/portal/app/staff/projects/[projectId]/ProjectSnapshotPageClient.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectMainTabs.test.tsx`; `playwright/portal.performance.spec.ts`

### 2026-07-19 - Portal Auth Request Scope - Verified And User-Bound

Date: 2026-07-19
Area: Portal Auth Request Scope
Status: Promoted
Decision or mistake: Nested layouts and pages repeated the same verified user and portal-role reads during one server render. They now share one React request-scoped access lookup. A verified-claims alternative was measured and then reverted because fresh-server JWKS/auth work made every cold route slower in the current CI/runtime shape.
Why it mattered: Repeating remote auth and role reads adds latency, but caching private access across requests can cross user boundaries. Replacing server verification with browser claims would reduce correctness rather than latency safely.
Current guardrail: Reuse one verified `auth.getUser()` result and one `portal_users` role lookup only inside the current server render. Do not place private auth state in process-global caches. API requests authenticate independently and use auth-bound RLS clients. Claims/JWKS may replace this only after a cold-safe measured design preserves server verification and role freshness.
Promoted to: `docs/staff-api-auth-contracts.md`; `docs/portal-production-readiness.md`
Related docs/tests: `apps/portal/lib/auth.ts`; `apps/portal/lib/auth.test.ts`; `playwright/portal.performance.spec.ts`

### 2026-07-19 - Portal Projects Index - Useful Frame Before Fresh Data

Date: 2026-07-19
Area: Portal Projects Index
Status: Promoted
Decision or mistake: The Projects page awaited the full project/contact index at the route boundary, then created separate browser queries and showed the global blocking transition overlay. It now renders its useful frame first, loads one combined staff-authenticated read model through React Query, and refreshes current-user cached rows quietly.
Why it mattered: A routine Dashboard-to-Projects action took about two seconds and made staff wait even though the header, filters, and known rows did not depend on fresh network data. Separate browser reads also duplicated ownership and made truthful pending/error/archive states harder to enforce.
Current guardrail: Keep Projects-index data behind `GET /api/staff/v1/projects/index` and the user-owned QueryClient. Active-only data must never populate archived/all scopes. Network/server failure may retain known rows with Retry, while `401`/`403` hides them. Empty states require a fresh success. Preload route and data only from hover, focus, touch, or pointer-down; index links must not invoke the blocking portal overlay. Instant URL feedback is not useful content by itself, and Next may retain the old route while a prefetched server response settles: the persistent portal content boundary must synchronously replace it with the real Projects frame and truthful updating state, keep the incoming route mounted invisibly, and reveal it only after the Projects client signals that it mounted. The page entrypoint must not await search params before handing filter ownership to that client controller.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/staff-api-auth-contracts.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/queries/projectsIndex.test.ts`; `apps/portal/app/api/staff/v1/projects/index/route.test.ts`; `apps/portal/components/navigation/ProjectsIndexLink.test.tsx`; `apps/portal/app/staff/projects/ProjectsIndexClient.test.tsx`; `playwright/portal.performance.spec.ts`

### 2026-07-19 - Portal Contacts Index - Reusable Instant Index Boundary

Date: 2026-07-19
Area: Portal Contacts Index
Status: Promoted
Decision or mistake: The Contacts page waited for Supabase at the route boundary and owned its CSV workflow in the initial client bundle. Contacts now renders a useful frame first, reads the complete paginated list through one staff-authenticated API/query owner, quietly refreshes current-user cached rows, and loads CSV import only from user intent. The Projects-only navigation path was generalized into one portal-index boundary rather than duplicated.
Why it mattered: Routine Contacts navigation took about two seconds and displayed a blocking transition even though the heading, search, actions, and known rows were already usable. Separate cache owners could also leave project contact labels stale after contact creation, editing, or import.
Current guardrail: Keep Contacts-index reads behind `GET /api/staff/v1/contacts/index` and the authenticated user's QueryClient. Network/server failure may retain known rows with Retry; `401`/`403` must hide them; empty states require fresh success. Route/data preloading starts only from hover, focus, touch, or pointer-down, and modified/new-tab behavior plus Projects filters must remain native. Contact mutations update the detail, canonical list, Contacts index, and every Projects-index contact segment through the central cache helper. Keep CSV import route-owned and lazy.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/staff-api-auth-contracts.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/queries/contactsIndex.test.ts`; `apps/portal/app/api/staff/v1/contacts/index/route.test.ts`; `apps/portal/components/navigation/PortalIndexLink.test.tsx`; `apps/portal/app/staff/contacts/ContactsIndexClient.test.tsx`; `playwright/portal.performance.spec.ts`

### 2026-07-18 - Calculator Browser Fixtures - Dedicated Revisioned State

Date: 2026-07-18
Area: Calculator Browser Fixtures
Status: Promoted
Decision or mistake: The stateful calculator trust suite shared `project-with-estimate` with general route smoke, so valid scenario IDs could point at an estimate whose calculator inputs had drifted to a different module shape. The suite now owns a revisioned `calculator-multi-module` scenario that is rebuilt by deterministic upsert on every explicit provisioning run.
Why it mattered: A stale but structurally valid estimate produced misleading browser failures in unrelated module and responsive checks. Weakening those assertions would have hidden fixture drift rather than testing the intended calculator contract.
Current guardrail: Stateful browser suites use a dedicated named scenario and fail with the exact provisioning command when either the state revision or loaded record shape is wrong. Provisioning remains an explicit service-role action restricted to local or staging; routine browser tests remain read-only.
Promoted to: `docs/testing-and-qa.md`; `docs/agent-centric-portal-plan.md`
Related docs/tests: `playwright/support/portalScenarioRegistry.ts`; `scripts/ensure-portal-scenarios.test.ts`; `playwright/portal.calculator.spec.ts`

### 2026-07-19 - Infill Support Confirmation - Uncertainty Must Purchase Safely

Date: 2026-07-19
Area: Infill Configurator UX
Status: Superseded
Decision or mistake: Boolean edge toggles defaulted to present and were labelled only as On, so a user could continue without understanding that they had asserted four real fixing members. The portal draft now records Yes, No, or Unsure for each perimeter edge; new infills default to Unsure and resolve that state as no existing support.
Why it mattered: Optimistic defaults can silently under-order structural support, while migrating old saved booleans to Unsure would silently reprice existing estimates. The presentation state therefore needs an explicit compatibility boundary.
Current guardrail: New uncertain structural inputs must choose the conservative purchasable result without becoming warnings. Saved infills lacking confirmation metadata infer Yes/No from their stored booleans unchanged. Only the four resolved booleans enter `CostInputsV1`; confirmation metadata remains portal-only.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/infillSupportPresentation.test.ts`; `apps/portal/app/staff/calculator/InfillSupportsStage.test.tsx`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-19 - Infill Results - Conservative Defaults Need Calm Presentation

Date: 2026-07-19
Area: Infill Configurator UX
Status: Promoted
Decision or mistake: The structurally safe Unsure default was rendered in an amber warning panel, and finished dimensions, stock allocation, profile notes, and waste were combined into one dense Details cell.
Why it mattered: A normal conservative choice looked like a problem, while fabricators had to decode mixed concepts to distinguish the finished piece from the stock it was allocated to.
Current guardrail: Conservative defaults remain explicit but use neutral presentation. Production tables must visually separate finished dimensions or cut length from allocated stock, while canonical row order and export records remain unchanged.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/infillCutListPresentation.test.ts`; `apps/portal/app/staff/calculator/InfillSupportsStage.test.tsx`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-19 - Infill Triangle Geometry - Collapsed Edges Are Not Materials

Date: 2026-07-19
Area: Calculator Infills And Costing
Status: Promoted
Decision or mistake: Gable presets already represented triangles as mono-slopes with one zero-height endpoint, but the canonical takeoff rejected both endpoints unless they were positive. Simply relaxing that validation would also have emitted a zero-length perimeter joiner and support for the collapsed side.
Why it mattered: A presentation-oriented four-edge model must not create non-physical cuts, support counts, or stock allocations. Rejecting the input also meant the existing gable-triangle preset could not reach an accurate canonical result.
Current guardrail: A mono-slope with exactly one zero endpoint normalizes to a three-vertex polygon. Filter collapsed perimeter edges before creating cuts or counting supports, preserve source traceability for every remaining piece, and reject shapes with no positive area. Portal shape templates remain adapters over the existing saved shape union.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `packages/costing/src/engine/infillTakeoff.test.ts`; `apps/portal/app/staff/calculator/infillOpeningTemplates.test.ts`; `apps/portal/app/staff/calculator/infillCompute.test.ts`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-20 - Portal Project Index Mutations - Optimistic Feedback Is Not Success

Date: 2026-07-20
Area: Portal Project Index Mutations
Status: Promoted
Decision or mistake: Projects-index name, phone, address, stage-correction, archive, and restore actions waited for the server before updating visible state. These reversible writes now patch only the current authenticated QueryClient immediately, retain a small syncing marker, and reconcile through the existing staff APIs in the background.
Why it mattered: Staff were made to wait for routine reversible work even though the portal already had a user-owned cache and precise rollback information. Treating optimistic feedback as durable success, however, would hide permission, validation, schema, and network failures.
Current guardrail: Patch the smallest affected cache field or scope before awaiting the API, show pending state without hiding the new value, and roll back only that field/scope on rejection. Emit success language only after server confirmation. Archive membership and known counts must move across active/archived/all together. Never apply this contract to hard delete, email delivery, money state, public tokens, or other irreversible/customer-facing side effects.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/projects/projectsIndexMutations.test.ts`; `apps/portal/app/staff/projects/ProjectsIndexClient.test.tsx`; `apps/portal/lib/queries/projectCache.test.ts`; `playwright/portal.project-mutation-performance.spec.ts`

Browser evidence: The fixture-safe Chromium journey deliberately holds the sample PATCH for 750 ms. Its first local run recorded 38 ms feedback/useful content and 798 ms background completion, with no blocking overlay or long task. The paired rejection journey restored the previous name and showed the server error. Keep feedback, useful content, and persistence completion separate in future write measurements; a fast API response is not evidence of instant local feedback.

### 2026-07-20 - Portal Project Details - Background Saves Need A Durable Local Owner

Date: 2026-07-20
Area: Portal Project Details / Local-First Sync
Status: Promoted
Decision or mistake: Project Details patched React Query optimistically, but Done awaited the live request and an unmounted/offline component had no durable retry owner. Details now stores the full normalized draft and ordered mutation in the authenticated user's existing local-first boundary. Done closes immediately; the API handler remains authoritative.
Why it mattered: A fast-looking component-only promise is not background work if navigation can lose its retry state. Clearing a working copy after an older request also risks deleting a newer edit.
Current guardrail: Persist the working copy before queueing, serialize full-draft saves by the stable project entity key, and clear a working copy only if its data still matches the successful queue item and no newer item is pending. Transient errors retain optimistic values and retry. Terminal errors roll back confirmed cache data but retain the rejected draft for Review/Retry; access-ending errors also invalidate the protected read boundary. Irreversible actions do not use this path.
Promoted to: `docs/local-first-sync.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/useProjectDetailsDraft.ts`; `apps/portal/components/sync/LocalFirstPortalMutations.test.tsx`; `apps/portal/lib/localFirst/store.test.ts`; `apps/portal/lib/localFirst/queue.test.ts`; `playwright/portal.project-mutation-performance.spec.ts`

### 2026-07-20 - Portal Contact Details - Reuse The Durable Save Contract

Date: 2026-07-20
Area: Portal Contact Details / Local-First Sync
Status: Promoted
Decision or mistake: Contact Detail already patched caches before its autosave, but Done awaited a component-owned request and navigation could lose its retry state. It now stores the normalized contact draft and ordered mutation inside the authenticated user's existing local-first boundary, then reconciles through the staff-authenticated contact API.
Why it mattered: A second bespoke background-save mechanism would drift from Project Details and could leave Contacts, Projects-index contact segments, or the detail cache disagreeing after failure. Immediate feedback also must not be presented as durable success.
Current guardrail: Reuse stable entity keys, per-user working copies, ordered queue processing, and conditional working-copy completion for reversible detail edits. Patch all canonical contact caches together. Transient errors retain desired data and retry; terminal errors restore the exact confirmed contact but retain the rejected working copy for Review/Retry. Keep hard delete and customer-facing side effects server-confirmed.
Promoted to: `docs/local-first-sync.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/contacts/[contactId]/useContactDetailsDraft.ts`; `apps/portal/lib/localFirst/contactDetails.ts`; `apps/portal/components/sync/LocalFirstPortalMutations.test.tsx`; `apps/portal/app/staff/contacts/[contactId]/ContactDetailClient.test.tsx`; `playwright/portal.project-mutation-performance.spec.ts`

Browser evidence: The fixture-safe Chromium journey deliberately held the contact PATCH for 750 ms and recorded 39 ms feedback/useful content versus 824 ms background completion, with no blocking overlay or long task. Its paired 403 journey restored the confirmed contact while preserving the rejected draft for Review/Retry.

### 2026-07-20 - Portal Project Task Mutations - Concurrent Rollback Must Be Field-Owned

Date: 2026-07-20
Area: Portal Project Task Mutations
Status: Promoted
Decision or mistake: Manual task checkboxes were already optimistic, but each failed request restored the entire captured task list. Two overlapping saves could therefore let one late failure erase another task's successful change, and the user had no explicit retry path.
Why it mattered: Background work is not trustworthy if concurrency can silently undo unrelated intent. Some manual tasks also trigger pipeline/automation behavior, so optimistic checkbox feedback must remain distinct from server-confirmed side effects.
Current guardrail: Track pending and failed state by task key. Disable only the task currently saving, restore only its exact previous item on rejection, preserve other task changes, refresh the authenticated snapshot after ambiguity, and expose Retry for that task's desired value. Do not announce stage movement or automation until the API response confirms it.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/automation-email-audit.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/ProjectTasksSidebar.client.tsx`; `apps/portal/components/projects/ProjectPage/projectTaskMutationState.test.ts`; `apps/portal/components/projects/ProjectPage/ProjectTasksSidebar.client.test.tsx`; `playwright/portal.project-mutation-performance.spec.ts`

Browser evidence: With the task checkbox already in view, the fixture-safe Chromium journey recorded 38 ms feedback/useful content while an intercepted save completed at 796 ms, with no blocking overlay or long task. Its paired failure restored the checkbox and the explicit Retry persisted only that task.

### 2026-07-20 - Portal Performance Measurement - Time The Browser State, Not The Test Driver

Date: 2026-07-20
Area: Portal Performance Measurement
Status: Promoted
Decision or mistake: The first mutation fixture measured visual feedback with the Node test driver's wall clock, so Playwright command and assertion round trips could make an already-rendered update look slower than 100 ms on a busy CI runner. Fixture interaction feedback now starts and stops inside Chromium when the target DOM state actually changes; request/background settlement remains separate.
Why it mattered: A performance gate must measure the user's wait, not automation transport noise. Loosening the 100 ms target would have hidden the measurement error and weakened the product contract.
Current guardrail: For fixture interaction feedback, install the browser-side visual observer before the action and end feedback at the first truthful visible state. Keep the 100 ms product target, long-task check, blocking-overlay check, request accounting, and delayed background completion unchanged. Async loading tests must hold mocked requests with controlled promises when they assert the pending state.
Promoted to: `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `playwright/support/portalPerformance.ts`; `playwright/portal.project-mutation-performance.spec.ts`; `apps/portal/app/staff/schedule/ScheduleClient.test.tsx`

### 2026-07-20 - Infill Explicit Selections - Put Decisions Where Supports Are Confirmed

Date: 2026-07-20
Area: Infill Configurator UX
Status: Promoted
Decision or mistake: Material and joiner direction were hidden as automatic preferences on Opening, while edge confirmation offered a third Unsure answer. The workflow now presents Sheet panels/620 strips and Vertical/Horizontal on Existing supports, and each physical edge offers only Yes or No.
Why it mattered: These choices affect the support plan and are easiest to understand beside the labelled support diagram. Automatic and Unsure states made a short fabrication decision look more technical and left users unsure which selections were authoritative.
Current guardrail: New infills and presets use explicit Sheet panels, Vertical joiners and conservative No edge defaults. Legacy `auto` values are pinned to their current canonical resolved choice when entering a later stage, and legacy Unsure answers display as No so the existing conservative purchase result is preserved. Keep `auto` and `unsure` only as read compatibility values; do not expose them as current UI choices. `CostInputsV1`, takeoff geometry, stock planning and costing authority remain unchanged.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/infillSupportPresentation.test.ts`; `apps/portal/app/staff/calculator/InfillSupportsStage.test.tsx`; `apps/portal/app/staff/calculator/calculatorInputs.test.ts`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-20 - Durable Background Jobs - The Queue Is A Pointer, Not The Job

Date: 2026-07-20
Area: Durable Background Jobs
Status: Promoted
Decision or mistake: JOB-01 establishes one logged PGMQ queue and durable service-owned lifecycle, but deliberately keeps the queue message to `jobId` and `contractVersion`. Frozen input lives in an immutable private row, job state has append-only events, provider work has explicit effect checkpoints, and all protected payload reads and worker-owned lifecycle/effect mutations require the current worker ID plus a random per-claim lease token. Administrative cancellation, manual retry, recovery, and repair remain separate service-role RPC boundaries. The shared registry defaults every kind to legacy ownership; no existing workflow is migrated by foundation code.
Why it mattered: Putting customer data or execution input in the queue would widen disclosure and replay risk. Treating PGMQ visibility as state, allowing stale workers to write, or retrying an uncertain provider dispatch without an effect checkpoint could duplicate emails/documents or mark business work complete when it is not.
Current guardrail: Create the ledger, frozen payload, minimal logged message, and enqueue event atomically from a stable intent key, and serialise concurrent first-enqueue calls for the same kind/intent inside PostgreSQL. PostgreSQL computes the canonical SHA-256 from normalized `jsonb`; callers must not supply or claim a matching hash because JavaScript serialization is not the database canonical form. Keep `inputHash` as durable output/identity evidence. Use only the granted service-role RPCs; never grant browser or direct table access. Fence worker-owned payload reads and lifecycle/effect mutations with the application lease. Keep domain handler milestones separate from external effect checkpoints; redispatch uncertain provider work only inside the same live idempotency window. JOB-03 permits one narrow recovery when the explicit uncertainty write was lost: the retry RPC must atomically convert exactly one raw dispatch-started effect to uncertainty without changing its frozen identity; missing, ambiguous, expired, exhausted, provider-accepted, and finalised cases remain blocked. Provider acceptance is not business finalisation. Run static/unit contracts and the isolated Docker-backed PGMQ database contract before deployment or rollout. JOB-02 through JOB-08 remain pending until their own evidence lands.
Promoted to: `docs/target-architecture.md`; `docs/change-routing.md`; `docs/security-privacy-quality.md`; `docs/supabase-schema-map.md`; `docs/environment-auth-supabase.md`; `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `packages/jobs/src/contracts.test.ts`; `test/background-jobs-migration.test.ts`; `test/repo-security.test.ts`; `supabase/tests/background_jobs.sql`; `scripts/test-background-jobs-db.mjs`; `.github/workflows/background-jobs.yml`; `npm run test:jobs`; `npm run test:jobs:db`

### 2026-07-20 - Durable Job Hardening - Freeze Policy And Validate The Exact Durable Object

Date: 2026-07-20
Area: Durable Background Jobs
Status: Promoted
Decision or mistake: Generic key-name filtering, a mutable kind registry lookup, and a queue-message ID alone were not sufficient safety boundaries. JOB-01 now freezes each accepted job's effect/cancellation policy, validates the stored PGMQ body before changing visibility or archiving, constrains each public summary to a context-specific flat allowlist with value-level sensitive-data rejection, and exposes frozen provider-effect identity to a restarted worker only through a lease-fenced service RPC. Claim-time uncertainty handling must live before every retry-exhaustion branch; wrapping only rows returned by an older claim function is unsafe because its internal terminal branches may never yield those rows.
Why it mattered: A registry edit could otherwise change policy beneath accepted work, a stale message ID could mutate the wrong queue item, innocent-looking JSON keys could carry recipients or signed URLs, and a restarted worker could neither reuse the exact provider idempotency identity nor safely finalise accepted work. An early `CONTINUE` inside claim could also hide uncertain commercial work as an ordinary permanent failure.
Current guardrail: Snapshot versioned effect policy at enqueue and make it immutable. Treat queue identity as `(message ID, exact minimal body)` and repair or escalate atomically before changing the ledger. Use separate progress/result/effect/event/worker safe-summary schemas and explicit staff projections. Keep provider keys and payload hashes server-only, but make them recoverable through a current-lease RPC. Audit every branch inside a claim/recovery owner; do not assume an outer wrapper observes rows the inner function archives or skips. Prove the boundary with restart-style, stale-pointer, missing-message, provider-window, and max-attempt uncertainty database tests on real PGMQ.
Promoted to: `docs/supabase-schema-map.md`; `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `supabase/migrations/20260720_000005_background_job_contract_hardening.sql`; `supabase/tests/background_jobs.sql`; `test/background-jobs-migration.test.ts`; `packages/jobs/src/contracts.test.ts`; `packages/jobs/src/policy.test.ts`; `npm run test:jobs`; `npm run test:jobs:db`

### 2026-07-20 - Durable Worker Runtime - Abort Is Advisory Until Code Settles

Date: 2026-07-20
Area: Durable Worker Runtime
Status: Promoted
Decision or mistake: A JavaScript timeout or AbortSignal does not stop already-running handler code. Releasing or retrying its lease while that code is still live could overlap two attempts, and a heartbeat failure during a handler RPC could otherwise permit further checkpoints or completion from an uncertain lease. JOB-02 therefore starts lease renewal before concurrency waiting, keeps it active through handler settlement and terminal mutation, signal-fences every handler RPC before and after its await, and never releases or retries an unsettled attempt. An abort-ignoring handler makes the worker unhealthy and exits through the injected fatal boundary before the configured lease and queue visibility can expire.
Why it mattered: Process shutdown, provider timeouts, and network failures can happen between any two awaits. Treating abort as cancellation rather than a notification could duplicate a commercial effect, let a stale worker complete, or leave a healthy-looking process that no longer owns its work.
Current guardrail: Keep heartbeat interval, RPC timeout, abort-settlement grace, and the termination margin coupled below visibility timeout. Stop claims on lease loss, reject post-abort handler progress/effect reads or writes, and allow graceful-shutdown completion only after the handler has actually settled. Do not retry, release, or acknowledge cancellation while old handler code remains live. Handler implementations must be asynchronous, observe AbortSignal, and yield or offload CPU work within the heartbeat budget. Validate every RPC response exactly, keep execution modes behind the explicit gate and complete handler coverage, and keep the worker dark until a workflow checkpoint owns both producer and handler.
Promoted to: `apps/worker/README.md`; `docs/target-architecture.md`; `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `apps/worker/src/runtime/executeJob.ts`; `apps/worker/src/runtime/worker.ts`; `apps/worker/src/runtime/executeJob.test.ts`; `apps/worker/src/runtime/worker.test.ts`; `apps/worker/src/workerBoundaries.test.ts`; `npm run test:worker`; `npm run test:jobs:db`

### 2026-07-20 - Durable DB Role Tests - Verify Grants Without Triggering The Pinned Image Bug

Date: 2026-07-20
Area: Durable DB Role Tests
Status: Promoted
Decision or mistake: JOB-02 initially proved the new RPC revokes by switching to `authenticated` and catching each expected `insufficient_privilege` error. PostgreSQL 18 passed, but the supported Supabase Postgres `17.6.1.107` image terminated the backend deterministically. The upstream Supabase report identifies a `supautils` `hint_roles` bug in this exact revoked-function path; a targeted fix was released in `supautils` v3.2.2, while the pinned image predates it and later image reports mean version presence alone is not proof. The executable contract now verifies every browser denial and the exact service-role allowlist through the live PostgreSQL privilege catalog instead.
Why it mattered: Re-running or weakening grants would have hidden a deterministic compatibility failure. Direct denial calls are not stronger evidence when the database process crashes before returning the expected permission error; the catalog is the server's authoritative privilege state and works on both supported images.
Current guardrail: Keep explicit revokes, RLS, the exact service-role allowlist, and real-database catalog assertions. Do not call revoked `background_*` functions as `anon` or `authenticated` in this compatibility harness until an upgraded supported image passes the focused reproduction on both matrix legs. When the image changes, re-evaluate call-style probes rather than deleting the catalog checks.
Promoted to: `docs/testing-and-qa.md`
Related docs/tests: `supabase/tests/background_jobs.sql`; `test/background-jobs-migration.test.ts`; `scripts/test-background-jobs-db.mjs`; [supabase/postgres#2112](https://github.com/supabase/postgres/issues/2112); [supautils v3.2.2](https://github.com/supabase/supautils/releases/tag/v3.2.2)

### 2026-07-20 - Repository Secret Incident - Deletion Is Not Rotation

Date: 2026-07-20
Area: Repository Secret Incident
Status: Promoted
Decision or mistake: The repository security test discovered tracked private-key material, and commit `db20ed2e` removed it from the current tree. The material remains reachable in Git history, so file deletion and a now-green current-tree scan do not revoke or remediate the credential.
Why it mattered: Anyone with historical repository access may have obtained the material. Rewriting shared history would be destructive, disruptive, and still would not prove the credential had not already escaped.
Current guardrail: Treat the owning credential as compromised until it is rotated or revoked and downstream use is audited. Keep repository secret scanning in the JOB/security checks, but do not call the incident closed from a passing scan alone. Do not rewrite Git history and do not reproduce key content or sensitive path details in docs, logs, or handoffs.
Promoted to: `docs/security-privacy-quality.md`; `docs/portal-production-readiness.md`
Related docs/tests: `test/repo-security.test.ts`; commit `db20ed2e`; `npm run test:jobs`

### 2026-07-20 - Durable Provider Effects - Acceptance Is Evidence, Not Finalisation

Date: 2026-07-20
Area: Durable Provider Effects
Status: Promoted
Decision or mistake: JOB-03 freezes a Resend request from stable job/effect identity before dispatch: one provider key, exact normalized recipients/subject/content/attachments/token bytes, exact safe tags, request hash, and a conservative 20-hour automatic retry expiry inside the provider's 24-hour retention. `prepared`, `dispatch_started`, `provider_accepted`, `finalised`, and `uncertain` are separate durable facts. A raw-body-verified `email.sent` callback may supply missing acceptance evidence through one narrow reconciliation RPC and append-only minimal receipt, but it cannot perform workflow finalisation.
Why it mattered: A provider can accept a commercial email while the process loses the response or crashes before its checkpoint. Generating a new key, changing any delivery byte beneath the old key, or treating acceptance as completion could duplicate customer email, lose token/artifact identity, or advance quote/invoice/outbox state without its owning transaction.
Current guardrail: After any uncertain dispatch, retry only the frozen key and byte-identical request while both the database-frozen 20-hour window and attempt budget remain live; never create a new key to escape uncertainty. If a cooperative worker loses both the provider response and its explicit uncertainty-checkpoint return, `background_job_schedule_retry` may atomically convert exactly one live `dispatch_started` effect to `uncertain`; it must reject missing or ambiguous provider evidence and preserve the frozen identity. The package fixes that retry configuration below the documented 24-hour provider retention, while the database freezes expiry and rejects a Resend effect beyond `created_at + 24 hours`. Expiry blocks redispatch but not later signature-verified acceptance evidence. Acceptance may supersede only stale provider-outcome classifications; exact payload, frozen-key, provider-message, and effect-identity conflicts remain operator-visible in either lock order. Keep the shared effect-transition graph broad enough for signature-verified reconciliation, but require the generic worker checkpoint command to observe a fresh `dispatch_started` state before recording a new acceptance; exact accepted-state replay remains idempotent. If a local accepted response races a signed callback that already committed a different message ID, or its message ID belongs to another effect, the lease-fenced acceptance RPC must atomically archive the canonical queue message and move the job to `needs_attention` before returning. A conflicting callback discovered after success or cancellation must also reclassify the durable job for attention without replaying business finalisation. Keep mutating PL/pgSQL calls in their own statement before reading their effects, and nest the guard before dereferencing a `record`; boolean subexpressions are neither an ordering nor a short-circuit boundary. Bound the raw webhook stream before verifying the untouched bytes, store only bounded provider/event/message and safe job/effect correlation, let non-conflicting acceptance wake the matching idempotent finaliser, and keep the worker dark until a later checkpoint owns a complete workflow producer and handler.
Promoted to: `docs/target-architecture.md`; `docs/supabase-schema-map.md`; `docs/security-privacy-quality.md`; `docs/automation-email-audit.md`; `docs/quotes-invoices-job-packs.md`; `docs/testing-and-qa.md`; `docs/change-routing.md`; `docs/portal-production-readiness.md`
Related docs/tests: `packages/email-provider`; `apps/worker/src/effects/durableEmailEffect.ts`; `apps/worker/src/effects/durableEmailEffect.faults.test.ts`; `apps/portal/app/api/webhooks/resend/route.test.ts`; `apps/portal/lib/backgroundJobs/providerWebhookRepository.test.ts`; `supabase/migrations/20260720_000007_background_job_provider_reconciliation.sql`; `supabase/tests/background_jobs.sql`; `npm run test:email-provider`; `npm run test:jobs`; `npm run test:worker`; `npm run test:jobs:db`

### 2026-07-20 - Project Command Ownership - Source Work Stays Canonical

Date: 2026-07-20
Area: Project Command Ownership
Status: Promoted
Decision or mistake: The project page, dashboard, stage checklist, automation tasks, follow-up tasks, personal reminders, and legacy project next-action columns previously offered overlapping ways to describe the next step. Stage 2 establishes one owner table and one deterministic selector over open automation/follow-up sources plus genuinely manual actions. Explicit selection stores only source identity and a confirmed outranking hash; command history and critical/reschedule controls have separate bounded records. Legacy project columns are a server-owned Schedule projection, not an editing surface.
Why it mattered: Copying task facts into another general task system would drift completion, assignee, due, and audit state. Letting the projection remain browser-writable would preserve two authorities and could make Dashboard, Overview, and Schedule disagree.
Current guardrail: Add new project work to its owning source, not to copied primary-action fields. Keep stage checks and personal reminders out of the selector. Route owner/action changes through idempotent staff commands, maintain the service-only projection after authoritative success, and treat missing active users as unassigned. Normal overdue stays amber; critical changes and third-plus reschedules require reasons.
Promoted to: `docs/project-command-centre-v1.md`; `docs/project-command-centre-architecture.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/supabase-schema-map.md`; `docs/automation-email-audit.md`
Related docs/tests: `supabase/migrations/20260720_000008_project_command_centre_stage2.sql`; `apps/portal/lib/projects/commandCentre/actionResolver.test.ts`; `test/project-command-centre-stage2-migration.test.ts`; `playwright/portal.command-centre.spec.ts`

### 2026-07-21 - Project Command Centre Reads - Select Only Canonical Schema Columns

Date: 2026-07-21
Area: Project Command Centre Reads
Status: Active
Decision or mistake: Stage 2 project and dashboard reads selected a legacy `projects.status` fallback alongside canonical `pipeline_stage`. The deployed schema has no `projects.status`, so PostgREST rejected the complete select before the application fallback could run.
Why it mattered: A compatibility expression in application code does not make a missing column safe in an explicit PostgREST select. The project shell could remain usable from its independent snapshot while both the command-centre card and dashboard exceptions failed with server errors.
Current guardrail: Explicit command-centre project reads select only canonical schema columns. Keep compatibility normalization behind reads that actually return optional legacy fields, and cover bounded select contracts with focused tests.
Promoted to: None
Related docs/tests: `apps/portal/lib/projects/commandCentre/getProjectCommandCentre.test.ts`; `apps/portal/lib/projects/commandCentre/getProjectCommandExceptions.test.ts`

### 2026-07-21 - Project Command Single Owner - Remove Specialist Project Roles

Date: 2026-07-21
Area: Project Command Single Owner
Status: Promoted
Decision or mistake: The initial Stage 2 contract modeled Sales, Design, and Estimating as three simultaneous project owners. The operating model is one Project Owner from lead through deposit, chosen from Jordan, JP, Joe, or Bruce. Specialist task assignees remain action-level facts and do not create project-owner roles.
Why it mattered: Three required owners made accountability diffuse, created avoidable missing-owner exceptions, and tied project ownership to portal-account provisioning. One stable business owner keeps accountability clear while source-task assignees still identify specialist execution.
Current guardrail: Store one approved owner key per project in `project_owner_assignments`. Admins own project-owner changes. Prefer a valid source assignee for an action, then fall back to the single Project Owner. Keep the retired three-role table read-only as rollback evidence until a later cleanup proves it can be dropped.
Promoted to: `docs/project-command-centre-v1.md`; `docs/project-command-centre-architecture.md`; `docs/project-command-centre-roadmap.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/supabase-schema-map.md`; `docs/staff-api-auth-contracts.md`; `docs/testing-and-qa.md`
Related docs/tests: `supabase/migrations/20260721_000001_project_command_single_owner.sql`; `apps/portal/lib/projects/commandCentre/actionResolver.test.ts`; `test/project-command-centre-single-owner-migration.test.ts`; `playwright/portal.command-centre.spec.ts`

### 2026-07-21 - Narrow Embedded Forms - Use Container Width

Status: Active

Area: Narrow Embedded Forms

Decision or mistake: The primary-action form used a viewport media query even though the card occupies a narrow column on wide desktop layouts. Its four-column grid therefore stayed active inside a roughly 400px card and collapsed the required action-title input to an unusable width.

Why it mattered: The create button correctly required a title, but staff could not enter one, so manual action creation appeared broken.

Current guardrail: Components whose width is controlled by a parent grid must use a container query or intrinsically wrapping layout for their responsive controls. Browser coverage must exercise a narrow component inside a viewport that is still wider than the global mobile breakpoint.

Promoted to: None

Related docs/tests: `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectPrimaryActionCard.module.css`; `playwright/portal.command-centre.spec.ts`

### 2026-07-21 - Project Page Shell - One Full-Width Workflow Surface

Status: Promoted

Area: Project Page Shell

Decision or mistake: Resizable left/right rails, draggable panel slots, a collapsible pipeline header, and a mobile-only Details tab split project context across layout modes and made every workflow narrower. The project page now uses one fixed sticky identity/navigation header and one full-width active tab; stage and local-first details are consolidated into Overview.

Why it mattered: Project facts and lifecycle controls must remain discoverable at every width, while specialist workflows such as Designs and Quotes need the page width. A single tab registry also prevents server/client URL drift such as the previously omitted `invoices` server key.

Current guardrail: Keep project tabs in `lib/projects/projectTabs.ts`, preserve the established query keys and unknown parameters, normalize unavailable tabs to `activity`, and add project facts to the Overview status/details owner rather than recreating rails or responsive-only tabs. Header-layout and rail-layout storage keys are retired and intentionally inert.

Promoted to: `docs/project-command-centre-architecture.md`; `docs/projects-contacts-estimates-calculator.md`

Related docs/tests: `apps/portal/components/projects/ProjectPage/ProjectTabNavigation.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectPageShell.test.tsx`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectStageControl.test.tsx`

### 2026-07-21 - Project Calculator/Commercial - One Authoritative Design And Commercial Surface

Status: Promoted

Area: Project Calculator/Commercial

Decision or mistake: The project page duplicated design ownership in a legacy Estimates/Configurator surface, exposed Quotes and Invoices as unrelated top-level tabs, and retained an Emails UI that did not own delivery. The project now embeds the authoritative Calculator through a fixed-project workspace contract, treats historical estimates as explicit revision sources, groups Quotes/Invoices behind a composition-only Commercial wrapper, and removes the project Emails UI.

Why it mattered: Parallel design editors create conflicting save, lock, recovery, and costing semantics. Commercial composition must preserve quote/invoice side-effect owners, while removing an email view must not remove audit rows, previews, snapshots, or delivery behavior.

Current guardrail: Keep standalone project selection at `/staff/calculator`; pass project/host/navigation context into embedded Calculator mode; never edit a historical source in place; keep quote and invoice mutations in their existing subviews/domains; and normalize retired `tab=emails` to Overview without deleting durable email data or side effects. The separate object-first Design Workbench route remains independent.

Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`

Related docs/tests: `apps/portal/app/staff/calculator/calculatorWorkspace.test.ts`; `apps/portal/components/projects/ProjectPage/tabs/ProjectCalculatorTab.test.tsx`; `apps/portal/components/projects/ProjectPage/tabs/CommercialTab.test.tsx`; `apps/portal/lib/projects/projectTabs.test.ts`

### 2026-07-21 - Project Calculator Chrome - One Compact Context Stack

Status: Promoted

Area: Project shell and embedded Calculator

Decision or mistake: The full-width project shell still stacked a two-row project masthead, a separate project-design toolbar, and the Calculator command bar, repeating project/design context and consuming roughly 300px before editable content. The shared project masthead is now one compact desktop row, and embedded Calculator design navigation is a typed command-bar input owned by the project wrapper. The standalone Calculator remains project-selectable and retains its own heading.

Why it mattered: Calculator staff need the configuration and pricing workspace, design selection, Save, and project navigation visible together. Repeated headings reduced the working viewport without adding context and made the embedded Calculator materially less useful on standard laptop screens.

Current guardrail: Keep project URL/version selection in `ProjectCalculatorTab`; do not add generic command-bar slots or route ownership to `CalculatorGridClient`. Embedded mode may visually compact the browser-draft explanation but must keep its short state visible and its full meaning accessible. Locked or unavailable design states must retain navigation even when the Calculator workspace is not mounted.

Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`

Related docs/tests: `apps/portal/components/projects/ProjectPage/ProjectPageFrame.test.tsx`; `apps/portal/components/projects/ProjectPage/tabs/ProjectCalculatorTab.test.tsx`; `apps/portal/app/staff/calculator/CalculatorCommandBar.test.tsx`; `playwright/portal.calculator.spec.ts`
### 2026-07-21 - Portal UI Foundation - Responsiveness Follows Content Width and Domain Types

Status: Superseded

Area: Portal UI Foundation

Decision or mistake: The catalogue used viewport-only breakpoints inside a variable-width shell and exposed speculative quote/estimate states through public props. Foundation layouts now use intrinsic grids and container queries for owned content width, canonical domain types drive exhaustive status presentation maps, and forced interaction states stay in catalogue/test data attributes.

Why it mattered: Viewport width did not describe the actual working area beside the portal navigation, so controls overlapped or clipped. Speculative display states could also diverge from production business contracts.

Current guardrail: Superseded for rollout direction by the 2026-07-29 Portal UI Authority decision. The technical rules remain current: never clip document overflow to hide layout defects; keep static surfaces server-compatible, interactive boundaries explicit, and public status props canonical. Run the relevant viewport matrix when an explicitly approved change touches a covered surface.

Promoted to: `docs/ui-foundation.md`; `docs/testing-and-qa.md`

Related docs/tests: `apps/portal/components/ui/foundation/FoundationStyles.test.ts`; `apps/portal/components/ui/foundation/SanctuaryStatus.test.tsx`; `playwright/portal.ui-foundation.spec.ts`

### 2026-07-21 - Production-Scale Related Reads - Bound PostgREST ID Filters

Status: Active

Area: Running Jobs and Dashboard project exceptions

Decision or mistake: Related-table reads placed the complete active-project inventory into a single PostgREST `.in(...)` query. With 783 projects, the generated request lines exceeded the gateway limit and every dependent read failed with `Bad Request`.

Why it mattered: Both routes looked correct with small fixtures, but production-scale authenticated browser review produced repeated 500s. Visual readiness cannot be separated from the settled data state that the route is meant to present.

Current guardrail: Use `fetchRowsByIdChunks()` for large ID-filtered reads, keep chunk concurrency bounded, test above one chunk, and require live browser evidence to settle past loading before screenshots or READY claims.

Promoted to: None

Related docs/tests: `apps/portal/lib/list/listLimits.test.ts`; `apps/portal/lib/projects/commandCentre/getProjectCommandExceptions.test.ts`; `playwright/portal.remaining-routes-ui.spec.ts`; `playwright/portal.dashboard-ui.spec.ts`

### 2026-07-21 - Portal Bundle Accounting - Do Not Charge Entry CSS As Lazy

Date: 2026-07-21
Area: Portal Bundle Accounting
Status: Promoted
Decision or mistake: Turbopack repeated route/layout CSS from the client-reference manifest's `entryCSSFiles` inside the Site Visits dynamic loadable entry. The bundle analyser excluded only initial JavaScript and therefore charged the same already-loaded CSS again as lazy bytes.
Why it mattered: Shared Foundation adoption made the repeated CSS large enough to produce a false Schedule lazy-budget regression. Raising the limit or shrinking unrelated production styles would have hidden an accounting defect rather than protecting the actual lazy boundary.
Current guardrail: De-duplicate manifest-declared entry CSS from dynamic-entry totals, keep the established initial-JavaScript metric unchanged, and retain a fixture where the lazy manifest repeats entry CSS. Never raise a route ceiling to compensate for double-counted assets.
Promoted to: `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/performance/portalBundleBudgets.ts`; `apps/portal/lib/performance/portalBundleBudgets.test.ts`; `npm run portal:bundle-budget`

### 2026-07-31 - Project Booklet Media Boundary - Signed Private Storage

Date: 2026-07-31
Area: Project Design Booklet image persistence and PDF delivery
Status: Promoted
Decision or mistake: The first workbench posted every replacement image in one
multipart PDF request and allowed 120 MB at the application layer, but
production Vercel Functions reject request or response payloads above 4.5 MB
before that validation can run.
Why it mattered: Replacing all booklet images reliably produced a production
413 while small/default booklets appeared healthy. Returning a larger generated
PDF through the same function boundary carried the corresponding response risk.
Current guardrail: Resize customer-document images in the browser, upload one
file directly to a server-prepared signed private project path, verify and
normalize the stored bytes before metadata commit, render PDFs from the saved
server-owned draft/assets, and return only a short-lived signed PDF URL. An
upload failure must remain visible and must never create metadata-only success.
Promoted to: `docs/design-booklets.md`; `docs/supabase-schema-map.md`
Related docs/tests: `apps/portal/lib/designBooklets/projectPersistence.ts`;
`apps/portal/lib/designBooklets/projectClient.test.ts`;
`test/project-design-booklets-migration.test.ts`

### 2026-07-30 - Marketing Lifecycle Delivery - Shared Owners, Consent, And At-Least-Once Semantics

Date: 2026-07-30
Area: Marketing lifecycle event ownership, attribution consent, and GA4 delivery
Status: Promoted
Decision or mistake: Quote acceptance tracking was attached to the staff wrapper
instead of the shared acceptance owner used by the public customer path.
Browser filtering also left landing query parameters available and the server
accepted campaign/click fields without independently enforcing marketing
consent. The sender claimed a batch before sequential network calls and could
reclaim rows whose attempt ceiling had already been reached.
Why it mattered: The real customer conversion could be absent while an
internal path appeared covered, denied attribution could persist, and expired
leases or exhausted rows could create duplicate sends or invalid retry state.
Even with those defects fixed, GA4 may accept a generic event before the local
completion checkpoint fails, and Measurement Protocol provides no generic
non-purchase deduplication contract.
Current guardrail: Emit a lifecycle event only after its shared authoritative
business command succeeds and cover every caller of that owner. For a
state-transition conversion, require an affected-row compare-and-swap and a
dedicated database-owned occurrence timestamp that mutable `updated_at` values
cannot refresh. Do not backfill legacy terminal rows from mutable evidence;
fail closed when the immutable occurrence is absent. Bound idempotent replay
repair to the downstream delivery window so an old outcome cannot look new.
Re-apply analytics and marketing consent categories on the server; strip
landing and referrer query/fragment data. Claim one row immediately before dispatch,
terminally fail exhausted eligible rows, and never describe the outbox as
exactly-once. Keep stable delivery identity for reconciliation and document the
residual at-least-once duplicate window.
Promoted to: `docs/security-privacy-quality.md`;
`docs/automation-email-audit.md`; `docs/supabase-schema-map.md`
Related docs/tests:
`apps/portal/lib/commercial/acceptQuote.test.ts`;
`apps/portal/app/api/staff/v1/projects/[projectId]/action/site-visit/confirm/route.test.ts`;
`apps/marketing/lib/attribution.test.ts`;
`apps/portal/lib/marketingAttribution/server.test.ts`;
`apps/marketing/lib/marketingConversionDelivery.test.ts`;
`apps/marketing/lib/marketingConversionDeliveryMigration.contract.test.ts`

### 2026-07-30 - Marketing Measurement CSP - Treat Container Diagnostics As A Release Gate

Date: 2026-07-30
Area: Marketing CSP and GTM/GA4 delivery
Status: Promoted
Decision or mistake: The Google runtime and restored GTM container were present, but the enforced marketing CSP omitted two resources reported by container diagnostics: `connect-src https://ad.doubleclick.net` and `img-src https://www.googletagmanager.com`.
Why it mattered: A tag can be correctly configured and published while browser policy silently blocks part of its measurement path, leaving GTM marked urgent and conversions incomplete.
Current guardrail: Before a tracking release, inspect the live container diagnostics and the deployed CSP header. Add only the reported vendor origins to both enforced and report-only directives, retain consent gating, and keep a source contract test so a later header cleanup cannot remove them unnoticed.
Promoted to: `docs/security-privacy-quality.md`
Related docs/tests: `apps/marketing/next.config.ts`; `apps/marketing/components/trackingConsent.test.ts`

### 2026-07-22 - Dashboard Operational Semantics - Name The Exact Source

Date: 2026-07-22
Area: Dashboard Operational Semantics
Status: Promoted
Decision or mistake: The dashboard labelled every project in the Quoting stage as a `Quote to send` and exposed internal estimate summaries as though they were self-evident customer prices. Stage membership proves only inventory position, while estimate summary totals may represent internal true cost.
Why it mattered: A home-page label can turn a technically correct count into a false operational instruction. Staff could infer that a customer artifact was ready when none existed, or mistake internal cost for a sell price.
Current guardrail: Dashboard labels must state the exact owner and meaning of their source. Keep workflow stage counts as stage counts, use the Project Command Centre projection for due work, and derive an estimate customer price only through the canonical quote-pricing helper. Omit any dashboard metric whose operational owner cannot be named.
Promoted to: `docs/ui-foundation.md`
Related docs/tests: `apps/portal/lib/dashboard/operationalLists.ts`; `apps/portal/lib/dashboard/operationalLists.test.ts`; `apps/portal/lib/dashboard/getDashboardData.ts`; `apps/portal/app/dashboard/DashboardView.test.tsx`; `playwright/portal.dashboard-ui.spec.ts`

### 2026-07-22 - Staff Header Search Pilot - Prove Archetypes Before Rollout

Date: 2026-07-22
Area: Staff Header Search Pilot
Status: Promoted
Decision or mistake: A global search control should not be pasted into every route as isolated chrome. The portal now has an opt-in `StaffPageHeader` composition that preserves the existing Dashboard, index, and detail identities/actions while adding one reusable grouped Projects/Contacts search owner. Only Dashboard, Projects Index, and Project Detail adopt it in the pilot.
Why it mattered: A broad mechanical rollout would make the control appear shared while leaving each route's action hierarchy, tabs, pending states, responsive order, and overlay containment unresolved. It could also confuse global discovery with route-local filtering or invent search fields that the schema does not own.
Current guardrail: Validate each remaining route against an approved pilot archetype before adoption. On wide headers, keep identity, search, and actions in one three-track row with search on the geometric centreline; at 960px of available header width or less, preserve the order identity, search, actions. Measure action descendants against the header bounds because document-level overflow checks cannot reveal content clipped by an ancestor. Keep global discovery server-side through the auth-bound RLS client and the database-verified contract recorded in Global Search Performance; keep local filters local; search only canonical fields; and do not claim company or project-number support until those fields have a canonical schema owner.
Promoted to: `docs/ui-foundation.md`; `docs/staff-api-auth-contracts.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/components/layout/StaffPageHeader.tsx`; `apps/portal/components/layout/GlobalPortalSearch.client.tsx`; `apps/portal/lib/search/serverPortalSearch.test.ts`; `apps/portal/app/api/staff/v1/search/route.test.ts`; `playwright/portal.header-search-ui.spec.ts`

### 2026-07-22 - Staff Header Search Rollout - Route Commit Owns Search Settlement

Date: 2026-07-22
Area: Staff Header Search Rollout
Status: Promoted
Decision or mistake: Correct search-result URLs were not sufficient on Project Detail because the Projects-index instant-navigation provider could keep rendering Project A after the canonical route moved to Project B. Route-child identity alone was not a reliable settlement signal. The provider now releases its instant view when canonical children settle, the observed pathname diverges, or the shared route-transition owner targets a different pathname. Shared search keeps the query and a visible opening state during navigation, uses the portal's non-blocking route progress, clears on route commit, and marks the current result instead of pretending to navigate.
Why it mattered: A route can change while stale client-owned content still masks the destination, making search appear broken and risking work in the wrong project. Closing the result panel immediately also removed the only local feedback during slower navigation. The same shared owner now behaves consistently for mouse, keyboard, and mobile use.
Current guardrail: Adopt `StaffPageHeader` as a composition so route identity, actions, tabs, filters, pending states, and responsive containment keep their existing owners. Cover Project A to Project B navigation from the instant Projects path, current-result handling, route cleanup, and adopted routes in component and authenticated browser tests. Calculator and Design Workbench remain excluded until their unsaved-work navigation contract is explicit.
Promoted to: `docs/ui-foundation.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/schedule.md`; `docs/design-list.md`; `docs/running-jobs.md`
Related docs/tests: `apps/portal/app/staff/projects/ProjectInstantNavigation.tsx`; `apps/portal/components/layout/GlobalPortalSearch.client.tsx`; `apps/portal/components/layout/GlobalPortalSearch.client.test.tsx`; `apps/portal/app/staff/projects/ProjectInstantOpen.test.tsx`; `playwright/portal.header-search-ui.spec.ts`

### 2026-07-22 - Project Tab Perceived Speed - Own Immediate State Above Routing

Date: 2026-07-22
Area: Project Tab Perceived Speed
Status: Promoted
Decision or mistake: The project tab bar and workflow body both derived their visible state exclusively from `useSearchParams()`. A click therefore left the old tab selected and rendered until `router.replace()` completed; the Commercial Quotes/Invoices subview had the same coupling. The project frame now owns one optimistic navigation key shared by the header and body, and Commercial owns its optimistic subview, while the canonical route clears that state after commit.
Why it mattered: Production evidence reproduced p75 selected-state delays of 141-151 ms across routine tabs and 923 ms for Job Packs, even when exact-intent preload was already wired. Rendering from click intent reduced every current tab's p75 feedback and useful-shell time to 36-44 ms without moving URL or data authority into local state.
Current guardrail: When a route-backed tab already knows the user's valid selection, render the selected state and its truthful owned shell from a shared optimistic owner immediately. Keep `router.replace()`, lazy specialist modules, and query settlement in the background; reset optimism from canonical props after commit. Performance coverage must follow the current Overview, Calculator, Commercial Quotes/Invoices, and conditional Job Packs registry rather than a retired Details tab.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/ProjectPageFrame.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectMainTabs.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectTabNavigation.test.tsx`; `apps/portal/components/projects/ProjectPage/tabs/CommercialTab.test.tsx`; `playwright/portal.performance.spec.ts`; `scripts/summarize-portal-performance.mjs`

### 2026-07-22 - Global Search Performance - One Database-Verified Read

Date: 2026-07-22
Area: Global Search Performance
Status: Promoted
Decision or mistake: Global header search issued seven parallel PostgREST field reads, sometimes an eighth linked-project read, after two sequential provider calls for user and portal-role verification. The client also discarded every result between uses. Search now calls one indexed `portal_search_v1()` operation through the request's cookie-bound client. The `SECURITY INVOKER` function reports portal access in-band and leaves Projects/Contacts RLS authoritative. The authenticated user's QueryClient owns a five-minute memory cache, previous successful results remain visible during refresh, and the final debounce is 50 ms. The initially deployed field-level trigram indexes still left the two-character minimum on expensive scans because pg_trgm cannot efficiently index a two-character contains pattern. The first bigram expression-index correction was also wrong: RLS planning recomputed the immutable bigram expression for every row, making the deployed p75 worse. Materializing normalized documents and bigram arrays removed that computation, but Projects/Contacts still invoked the row-independent membership helper while scanning candidates. Their unchanged authenticated `portal_access_all` decision is now wrapped in a scalar `SELECT`, allowing a statement init-plan instead of per-row evaluation. The debounce was reduced only after the measured backend p75 passed its share of the 400 ms budget; superseded queries remain abortable.
Why it mattered: A warm search commonly took about 900-1,150 ms before the old 220 ms debounce. Parallel field requests reduced code complexity but multiplied gateway work, while the generic API auth shape added two serial network round trips before useful search work. The first authenticated v1 performance capture measured 437 ms API p75, 537 ms including debounce, and 544 ms first rendered results against a 400 ms target; cached repeats were already 6.9 ms. The expression-index deployment measured 797 ms API p75, 897 ms including debounce, and 929 ms first rendered results. Materialized columns improved that to 551 ms API p75, 651 ms including debounce, and 567 ms first rendered results, but a zero-match search still cost about as much as a full counted scan. After the RLS init-plan migration, the final warm-route artifact recorded 340 ms API p75, 390 ms including the 50 ms debounce, 335 ms first rendered results, and a 6.4 ms cached repeat with one request. Index presence is not evidence that the planner avoids per-row work. Repeated queries need no network delay when the user's fresh result is already known, while first-time queries need measured planner-safe storage and policy evaluation rather than a lower debounce masking database work.
Current guardrail: Keep global typeahead to one auth-bound, database-verified operation. Do not replace RLS with service-role access, browser Supabase reads, browser identity claims, or process-wide private caches. The optimized request helper is search-specific and must not be copied to mutations or arbitrary RPCs. Keep both the two-character bigram path and three-or-more-character trigram path index-backed, preserve literal wildcard escaping and bounded ranking, invalidate search entries from project/contact mutation owners, and run the focused authenticated gate with 400 ms uncached and 75 ms cached budgets after applying both ordered search migrations.
Promoted to: `docs/staff-api-auth-contracts.md`; `docs/supabase-schema-map.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `supabase/migrations/20260722_000001_portal_search_v1.sql`; `supabase/migrations/20260722_000002_portal_search_bigram_indexes.sql`; `supabase/migrations/20260722_000003_portal_search_materialized_columns.sql`; `supabase/migrations/20260722_000004_portal_search_rls_initplan.sql`; `apps/portal/lib/search/serverPortalSearch.ts`; `apps/portal/lib/queries/portalSearch.ts`; `apps/portal/components/layout/GlobalPortalSearch.client.tsx`; `playwright/portal.search-performance.spec.ts`

### 2026-07-22 - Marketing Evidence - Parallel Project Fields Are Not Independent Truths

Date: 2026-07-22
Area: Marketing guide cluster, product claims and project evidence
Status: Promoted
Decision or mistake: Several project records had an approved-looking top-level summary alongside older `sections` content that described a different roof, structure, accessory system or site. Homepage material meters also converted qualitative differences into unsupported one-to-five performance rankings. The current project record is now internally aligned, contradictory details are retired, and the homepage uses written product and assembly considerations instead of scores.
Why it mattered: Hidden or currently unrendered fields still remain reusable source data, so a future component could republish false specifications without an obvious code change. Numeric-looking UI also reads as measured evidence even when its source is editorial judgement.
Current guardrail: Treat every reusable project field, score, chart and comparison row as a public claim. Keep one evidence record per project, test known corrections at source level, derive guide facts from that record, and require current product or assembly evidence before publishing measurable rankings. If two published dimensions cannot be reconciled from the approved project file, preserve the recorded values only where necessary and flag the discrepancy for Sanctuary approval.
Promoted to: `docs/marketing-claims-register.md`; `docs/landing-pages/pergola-guide-cluster-completion-audit.md`; `docs/landing-pages/seo-landing-page-programme.md`
Related docs/tests: `apps/marketing/data/projects.ts`; `apps/marketing/data/projects.claims.test.ts`; `apps/marketing/components/explore/RoofComparisonSection.tsx`; `playwright/marketing.guide-cluster-final-refinement.spec.ts`

### 2026-07-22 - Calculator Commercial Safety - Enforce At The Saved Mapping Boundary

Date: 2026-07-22
Area: Calculator, estimate save, and quote handoff
Status: Promoted
Decision or mistake: Calculator-only guidance could not guarantee that downstream quote creation used the shown discount or rejected an unpriced blind. Customer pricing now has one shared discount-aware helper; quote mapping returns explicit blocking issues rather than zero-dollar invalid add-ons; save completion previews lines from the exact optimistic saved estimate; and local-first plus server quote paths assert the same mapping readiness.
Why it mattered: A warning visible only while editing can be bypassed by a later create, refresh, revision, offline replay, or preserved-cost save. That could underquote work, hide a missing blind price, or show staff a Live total that was not the basis handed to Quotes.
Current guardrail: Enforce commercial blockers at the estimate-to-quote mapping boundary as well as in UI readiness. Derive handoff previews from the saved estimate object, state discount scope explicitly, require a reason when pricing-affecting changes keep stored costs, and treat post-job actuals as downstream calibration against frozen history rather than a repricing input.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`; `docs/costing-and-geometry.md`; `docs/supabase-schema-map.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/quotes/mapping.test.ts`; `apps/portal/lib/quotes/pricing.test.ts`; `apps/portal/app/staff/calculator/calculatorEstimateSave.test.ts`; `apps/portal/lib/estimateActuals/server.test.ts`; `apps/portal/app/api/staff/v1/estimates/[estimateId]/actual-costs/route.test.ts`

### 2026-07-22 - Calculator Configuration Layout - Group Main-Column Content

Date: 2026-07-22
Area: Calculator Configuration Layout
Status: Promoted
Decision or mistake: The common-template picker was inserted as another direct child of the two-column configuration workspace. At split widths, CSS Grid placed the picker beside the module navigator and then auto-placed the entire configuration form into column one of the next row, constraining every field to the narrow navigator rail.
Why it mattered: The controls and their labels remained technically valid, so component tests and narrow-screen checks passed while desktop staff saw every dropdown stacked into the first column and most of the available editing area left blank.
Current guardrail: The workspace has two structural owners: module navigation and one `configurationMain` stack containing templates plus the form. Any new sibling must declare its grid area or join the correct stack. Browser coverage must assert rendered field-column counts, field containment, document overflow, specialist full-width sections, Advanced mode, and both split and stacked breakpoints.
Promoted to: `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorGridClient.tsx`; `apps/portal/app/staff/calculator/CalculatorGrid.module.css`; `playwright/portal.calculator-foundation-ui.spec.ts`

### 2026-07-22 - Calculator Draft Removal - Defer Modal Decisions To Save

Date: 2026-07-22
Area: Calculator Draft Removal
Status: Promoted
Decision or mistake: Module and infill removal interrupted staff with confirmation dialogs even though both actions changed only the recoverable browser draft and the estimate still required an explicit Save decision.
Why it mattered: Repeated prompts slowed ordinary calculator editing, trained staff to dismiss warnings reflexively, and duplicated the decision point already owned by the Save confirmation and validation preflight.
Current guardrail: Calculator-draft removal is immediate. Keep the final-module structural invariant at the control, retain the existing infill Undo, and reserve modal validation and commercial decisions for Save. This does not relax confirmation for durable deletion outside calculator drafts.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorModuleNavigator.test.tsx`; `playwright/portal.calculator.spec.ts`; `playwright/portal.calculator-infills.spec.ts`

### 2026-07-23 - Calculator Template Application - Select Plus Apply Is Sufficient Intent

Date: 2026-07-23
Area: Calculator Template Application
Status: Promoted
Decision or mistake: Applying a common job template required staff to select the template, press Apply to active module, and then confirm the same replacement in a second modal.
Why it mattered: The duplicate confirmation added friction without adding meaningful protection because the change still affected only the browser draft and remained subject to the existing Save review.
Current guardrail: The explicit select-and-apply sequence is sufficient intent for calculator templates. Apply the template immediately, preserve the pergola name and site allowances, and reserve modal validation and commercial decisions for Save.
Promoted to: `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorJobTemplatePicker.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-23 - Calculator Blind Pricing - Separate Core Uplift From Fixed Add-Ons

Date: 2026-07-23
Area: Calculator blind pricing, saved estimates, and quote handoff
Status: Promoted
Decision or mistake: Blind table values were converted to GST-inclusive totals without the required `1.15x` core selling uplift. The correction belongs in `@sp/costing`, before GST, while the `$900 inc GST` motor and `$44/m` flashing or `$145/m` pelmet remain fixed GST-inclusive retail add-ons.
Why it mattered: Applying or omitting GST and selling uplift at the wrong stage directly underquotes blind work and erodes margin. Recalculating cover charges in the calculator or quote mapper would also allow the displayed and handed-off prices to diverge.
Current guardrail: Price blind core, motor, and roll cover as explicit components in `@sp/costing`; charge roll covers from entered width, sum authoritative inclusive line totals, and derive aggregate ex-GST display totals from them. Missing historical roll-cover selections normalize to No cover. New or refreshed draft quotes use current pricing, while existing issued quote versions remain frozen.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `packages/costing/src/blinds.test.ts`; `apps/portal/app/staff/calculator/calculatorBlindUi.test.ts`; `apps/portal/app/staff/calculator/calculatorInputs.test.ts`; `apps/portal/lib/quotes/mapping.test.ts`; `apps/marketing/app/api/enquiry/route.test.ts`; `playwright/portal.calculator.spec.ts`

### 2026-07-23 - Overview and Enquiry Pricing - Preserve Customer-Price Truth

Date: 2026-07-23
Area: Project Overview, quote handoff, and marketing enquiry draft pricing
Status: Promoted
Decision or mistake: Project Overview read `summary_json.total` as customer price even though affected summaries represented internal true cost. Marketing enquiries also calculated email and saved estimate pricing independently while the saved module described four posts and the costing engine priced two.
Why it mattered: Staff could quote or discuss the wrong amount without any design change, and the persisted estimate could not explain the price sent to the customer.
Current guardrail: Estimate-led Overview pricing must use the same deterministic saved-snapshot quote-handoff projection as quote creation. Never substitute an ambiguous summary or a partial total when mapping is blocked. Marketing enquiry email budgets, saved calculator inputs, and saved outputs must come from one canonical two-post costing snapshot; costing failure remains non-blocking.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/costing-and-geometry.md`; `docs/automation-email-audit.md`
Related docs/tests: `apps/portal/lib/quotes/estimateHandoffPreview.test.ts`; `apps/portal/lib/projects/commandCentre/getProjectCommandCentre.test.ts`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectCurrentDesignCommercialCard.test.tsx`; `apps/marketing/app/api/enquiry/route.test.ts`; `playwright/portal.command-centre.spec.ts`

### 2026-07-23 - Calculator Pricing Preview - Full Customer Total, Internal Costs Admin-Only

Date: 2026-07-23
Area: Calculator pricing preview, estimate Save review, and quote handoff
Status: Promoted
Decision or mistake: The calculator headline represented only pergola/site selling price while blinds appeared in a separate add-on block, and staff-facing views exposed internal costs across the preview, BOM, comparisons, and Save dialogs. The preview now sums the same line-level pergola/site, blind, and preserved-lighting amounts used for quote handoff. Infills remain visibly included in their pergola price. Internal calculator cost views are presentation-gated to admins, with the aggregate section collapsed by default.
Why it mattered: A partial headline made multi-item jobs hard to reconcile with the eventual quote, while broad internal-cost visibility obscured the customer price staff actually needed and exposed margin inputs unnecessarily.
Current guardrail: Build calculator customer totals from exact quote-line cents, derive ex GST from the inclusive total, label invalid items as unpriced, and never add pooled infills twice. Use one calculator-level admin permission for internal-cost presentation and optional detail requests; staff retain customer prices, quantities, validation, and Save decisions. This UI gate does not claim server-payload secrecy.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `apps/portal/app/staff/calculator/calculatorPricingPreview.test.tsx`; `apps/portal/app/staff/calculator/CalculatorPricingSummary.test.tsx`; `apps/portal/app/staff/calculator/CalculatorSaveDialogs.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-23 - Project Header Density - Two Rows Own The Chrome

Date: 2026-07-23
Area: Staff project-page header
Status: Promoted
Decision or mistake: The project masthead repeated the project ID, address context, a nine-stage pipeline graphic, and tabs across a tall multi-row surface before staff reached their work. The header now uses one command row containing project name, current-stage badge, global search, owner, and permitted route actions, followed by one tabs-only row.
Why it mattered: The repeated context consumed a large share of laptop height without helping the next staff action, and pushed Overview and Calculator work below the fold.
Current guardrail: Keep project identity and commands in row one and project tabs in row two. Do not restore the project ID or pipeline tracker to the masthead. Keep search on the desktop header centreline with equal outer grid tracks, narrowing its own track before changing layout. At narrow widths contain horizontal overflow within the command row and prove the final permitted command remains reachable; never hide permission-gated actions or create document overflow merely to preserve two rows.
Promoted to: `docs/ui-foundation.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/components/layout/PageHeader.test.tsx`; `apps/portal/components/projects/ProjectPage/ProjectPageFrame.test.tsx`; `playwright/portal.command-centre.spec.ts`

### 2026-07-24 - Admin API Cache Policy - Apply At The Shared Response Boundary

Date: 2026-07-24
Area: Authenticated admin API responses
Status: Promoted
Decision or mistake: Costing estimate-preview routes set `private, no-store` individually, while configuration history and editor responses used the shared admin response helpers without a cache policy.
Why it mattered: Authenticated configuration data and failure payloads could be reused by browser or intermediary caches even though adjacent routes were protected.
Current guardrail: Every `jsonOk()` and `jsonError()` response from `apps/portal/lib/api/adminApi.ts` carries `Cache-Control: private, no-store`. Apply the policy at the shared admin boundary rather than relying on success-only route code.
Promoted to: `docs/staff-api-auth-contracts.md`
Related docs/tests: `apps/portal/lib/api/adminApi.test.ts`; `apps/portal/app/api/admin/costing/configurations/route.test.ts`; `playwright/portal.costing-control-smoke.spec.ts`

### 2026-07-24 - Staff Search Overlay - Escape Responsive Scroll Containers

Date: 2026-07-24
Area: Shared staff-header search overlay
Status: Promoted
Decision or mistake: The project command row becomes a horizontal scroll container at narrower desktop widths. The global search panel was absolutely positioned inside that row, so CSS overflow clipped the complete panel even though the input focused and search state opened correctly.
Why it mattered: A common desktop viewport, Windows display scaling, browser zoom, or an open browser sidebar could cross the command-rail breakpoint and make global navigation appear completely unresponsive for one staff member while wider development screens worked.
Current guardrail: Render the search results panel through `document.body`, keep it fixed and anchored to the input, reposition it on viewport or ancestor scroll/resize, and treat the portalled panel as inside the control for outside-click handling. Authenticated browser coverage must open search from Project Detail at the command-rail breakpoint and prove the panel is visible outside the clipping row.
Promoted to: `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `apps/portal/components/layout/GlobalPortalSearch.client.tsx`; `apps/portal/components/layout/GlobalPortalSearch.client.test.tsx`; `playwright/portal.header-search-ui.spec.ts`

### 2026-07-23 - Marketing Public Boundaries - Fail Closed And Retry One Identity

Date: 2026-07-23
Area: Marketing public tokens, enquiry intake/uploads, and optional tracking
Status: Promoted
Decision or mistake: Token expiry checks were duplicated and did not protect every download path; enquiry uploads relied on process-local or absent abuse state and unbound pending paths; contact/project/enquiry inserts could partially complete or duplicate on retry; and GTM still had an unconditional noscript request.
Why it mattered: An expired link could retain a protected read surface, a forged or abandoned upload could cross submission boundaries, retries could create inconsistent customer records, and optional vendors could receive a network request before the visitor chose a consent category.
Current guardrail: Resolve active public-token state before any protected quote/invoice read or mutation. Give every enquiry attempt one browser-generated UUID and serialize it inside a service-only transactional RPC backed by a unique constraint. Require durable public rate limits, a short-lived exact upload binding, type/size/content checks, origin validation, and scheduled cleanup. Keep every optional loader behind the applicable regional/category decision in `docs/security-privacy-quality.md`; never add a noscript or other unconditional vendor request.
Promoted to: `docs/security-privacy-quality.md`; `docs/automation-email-audit.md`; `docs/supabase-schema-map.md`; `docs/platform-workflow.md`; `docs/quotes-invoices-job-packs.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/publicTokenExpiry.domain.test.ts`; `apps/marketing/lib/enquiryStoredAttachments.test.ts`; `apps/marketing/lib/enquiryIntake.test.ts`; `apps/marketing/lib/marketingEnquiryMigration.contract.test.ts`; `apps/marketing/app/api/enquiry/route.test.ts`; `playwright/marketing.consent.spec.ts`

### 2026-07-24 - Marketing Contact Form - One Form Tree And Synchronous Submission Lock

Date: 2026-07-24
Area: Marketing contact form
Status: Promoted
Decision or mistake: The contact route duplicated desktop and mobile form markup inside a viewport-locked page, relied on placeholders for core labels, and disabled submission only after asynchronous React state began. The route now renders one responsive form tree, receives supported enquiry preselection through the server page, and claims the submit attempt with a ref before attachment or API work starts.
Why it mattered: The mobile layout visually ended before the message and submit controls, desktop controls could become illegible against the dark treatment, and two clicks in the same render window could create two API requests. Duplicate responsive trees also made values, errors and accessibility behavior likely to diverge.
Current guardrail: Keep one contact form DOM at every width. Match required fields to the enquiry intake contract, use persistent labels plus a focused error summary and result feedback, retain user values after failures, preserve one browser-generated submission UUID across retries, and acquire the synchronous submit lock before uploads, analytics or network work. Build and parse enquiry links through the shared non-personal context contract. Preserve the residential, commercial, and professional attachment policy, attribution, consent, and privacy contracts when changing presentation.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/contact/ContactEnquiryForm.tsx`; `apps/marketing/app/contact/contactFormModel.ts`; `playwright/marketing.contact.spec.ts`

### 2026-07-24 - Marketing Enquiry Secret Rollout - Preserve The Security Property Without An Outage

Date: 2026-07-24
Area: Marketing enquiry production configuration
Status: Promoted
Decision or mistake: Durable public rate limiting introduced a new production-only `MARKETING_ABUSE_HASH_SECRET` and failed every enquiry when the deployment did not yet contain it, even though the route already required a server-only service credential.
Why it mattered: The fail-closed privacy control protected rate-limit identifiers but turned a configuration rollout gap into a complete public lead-intake outage.
Current guardrail: Prefer the dedicated marketing HMAC secret. If it is absent, derive a domain-separated HMAC subkey from the already-required `SUPABASE_SERVICE_ROLE_KEY`; never hash client addresses with a public or static repository value, and still fail closed when no server-side secret exists. Cover both the secure fallback and the no-secret production failure.
Promoted to: `docs/environment-auth-supabase.md`; `docs/security-privacy-quality.md`
Related docs/tests: `apps/marketing/lib/marketingPublicRequest.ts`; `apps/marketing/lib/marketingPublicRequest.test.ts`; `apps/marketing/app/api/enquiry/route.ts`

### 2026-07-24 - Marketing Enquiry Schema Rollout - Exercise The Real RPC Contract

Date: 2026-07-24
Area: Marketing enquiry production schema
Status: Promoted
Decision or mistake: The atomic intake migration installed `marketing_enquiry_intake`, but the function wrote indicative-pricing columns that existed only in the legacy root `enquiry_requests.sql` snapshot. Production's already-existing table therefore accepted the function while lacking the columns it used, and every valid enquiry rolled back with `undefined_column`.
Why it mattered: Function existence, grants, rate-limit success, and application unit tests all appeared healthy while the public conversion path still failed at the first real insert.
Current guardrail: Every column consumed by a new RPC must be present in an ordered forward migration, even when a root baseline snapshot already declares it. Before rollout, invoke the real RPC inside an explicit rollback-only transaction against the exact target project and fail readiness on any database error.
Promoted to: `docs/automation-email-audit.md`; `docs/environment-auth-supabase.md`; `docs/supabase-schema-map.md`
Related docs/tests: `supabase/migrations/20260724043000_marketing_enquiry_budget_columns.sql`; `apps/marketing/lib/marketingEnquiryMigration.contract.test.ts`

### 2026-07-24 - Marketing Mobile Navigation - One Breakpoint And Reversible Lock

Date: 2026-07-24
Area: Shared public mobile header
Status: Promoted
Decision or mistake: The menu CSS remained active through 900px while its JavaScript rejected opening from 721px, and only the homepage preserved reading position when the menu fixed the body. The closed portalled links also relied on `aria-hidden` without inert state, and the menu omitted commercial and professional pathways.
Why it mattered: Tablet visitors could see a non-working Menu control, non-home visitors could lose their reading position, keyboard focus could leave the locked navigation, and important audience routes were hard to discover.
Current guardrail: Keep the responsive CSS and JavaScript breakpoint at the same 901px boundary. Capture scroll before applying fixed-body styles, restore prior inline/class state on dismissal, let destination/history navigation own the new route's scroll, and close stale menus on Back or route changes. Keep closed portal content inert, cycle focus through the visible trigger and links, preserve route-aware enquiry context, and cover 430px, 390px, 360px, tablet and short-height behavior. Do not add a global fixed CTA until it can coexist with consent and every route-local overlay/form without obstruction.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/components/Header.test.tsx`; `apps/marketing/components/headerNavigation.test.ts`; `playwright/marketing.shared-header.spec.ts`

### 2026-07-25 - Marketing Enquiry Routing - Unknown Is Not Residential

Date: 2026-07-25
Area: Public enquiry links, route context, and conversion analytics
Status: Promoted
Decision or mistake: The shared header inferred residential for every route except the exact commercial service and contact paths. Commercial project headers were therefore misclassified, product links forced residential without evidence, and direct-form analytics overwrote validated lower-case context with display labels.
Why it mattered: Prominent actions contradicted the page audience, lost reliable project or product identity, and produced inconsistent conversion dimensions even though page-owned project CTAs were already correct.
Current guardrail: Build every major enquiry destination through the shared utility. Resolve known services and projects from explicit parity-tested route metadata, keep mixed, product and unknown routes neutral unless reliable context supplies an audience, retain canonical item slugs, and apply validated context after other analytics properties so it cannot be overwritten.
Promoted to: `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/enquiryContext.test.ts`; `apps/marketing/components/Header.test.tsx`; `playwright/marketing.shared-header.spec.ts`; `playwright/marketing.contact.spec.ts`; `playwright/marketing.acrylic-copy-variant.spec.ts`

### 2026-07-25 - Marketing Enquiry Form Contract - One Intake Rule

Date: 2026-07-25
Area: Direct and embedded public enquiry forms
Status: Superseded
Decision or mistake: Direct and embedded forms separately defined audience labels, validation, field order, roof terminology and upload instructions. Embedded routes required email, suburb and a project brief even though the enquiry API requires only project type, name and phone, and successful direct submissions replaced the form and discarded the entered context.
Why it mattered: The same enquiry meant different things depending on its entry page, optional business information looked mandatory, upload claims could drift from backend validation, and visitors lost the brief they had just submitted.
Current guardrail: Superseded by the 2026-07-29 Marketing Enquiry
Reachability decision. The shared contract now requires email as well as project
type, name and phone. Its remaining audience, context, upload, ordering and
submission-lock rules still apply.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/enquiryFormContract.test.ts`; `apps/marketing/app/contact/contactFormModel.test.ts`; `playwright/marketing.contact.spec.ts`; `playwright/marketing.seo-landing.spec.ts`; `playwright/marketing.seo-programme.spec.ts`

### 2026-07-25 - Marketing Disclosure Hydration - Stable Before JavaScript

Date: 2026-07-25
Area: Shared responsive disclosures and route adapters
Status: Promoted
Decision or mistake: Responsive disclosures emitted open server markup and initialized client state as desktop, then a passive effect closed them on mobile. Large supporting regions could therefore paint open before hydration and visibly collapse. Product and project adapters also duplicated the viewport-state implementation.
Why it mattered: Mobile visitors could lose their reading position or see a large layout jump even though the final native disclosure state, keyboard behavior and no-JavaScript content were individually correct.
Current guardrail: Keep one native semantic tree and one shared viewport-state owner. Server markup remains open so no-JavaScript users retain complete content. When scripting is enabled, the shared breakpoint CSS hides only a pending mobile body and keeps its controls unfocusable; hydration then resolves native closed mobile or open desktop state without changing the disclosure box height. Keep supported breakpoints explicit and test pre/post-hydration height, hash reveal, keyboard focus, reduced motion, desktop expansion and a separate JavaScript-disabled journey.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/mobile-content-density-refinement.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/components/marketing-foundation/Interactions.test.tsx`; `playwright/marketing.mobile-content-density.spec.ts`; `playwright/marketing.projects.spec.ts`; `playwright/marketing.products.spec.ts`

### 2026-07-23 - Costing Configuration Provenance - Bind Version To Result

Date: 2026-07-23
Area: Costing configuration, calculator results, and estimate persistence
Status: Promoted
Decision or mistake: Calculator Save previously fetched costing metadata independently after calculation. A configuration publication between those requests could make an estimate claim a different costing basis from the one that produced its totals. Immediate override writes also changed all future calculations without a draft, preview, or immutable version.
Why it mattered: Historical estimates could not reliably explain or reproduce their costing basis, and an admin edit could affect production pricing before its impact was understood.
Current guardrail: `@sp/costing` owns the exact typed configuration and all algorithms. Carry the configuration version/hash (or the complete pre-publication legacy snapshot) on the server calculation response and persist that exact provenance with frozen estimate outputs. Publish drafts through the atomic admin RPC with validation, diff, representative impact, confirmation, and audit; never store executable formulas or silently fall back from a published version.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/supabase-schema-map.md`; `docs/staff-api-auth-contracts.md`
Related docs/tests: `packages/costing/src/controlConfig.test.ts`; `apps/portal/lib/costing/configurationResolver.test.ts`; `apps/portal/lib/costing/configurationAdmin.test.ts`; `apps/portal/lib/estimates/costingConfigurationProvenance.test.ts`; `apps/portal/app/staff/calculator/calculatorEstimateSave.test.ts`

### 2026-07-25 - Repository Security Scan - Search Git Content, Not Binary Evidence

Date: 2026-07-25
Area: Repository security CI
Status: Promoted
Decision or mistake: The private-key guard synchronously decoded every tracked file, including screenshot evidence, and crossed its fixed CI timeout as visual review artifacts accumulated.
Why it mattered: A healthy security check failed after an unrelated marketing UI merge, obscuring the real result and making future evidence additions progressively riskier.
Current guardrail: Search tracked, non-binary Git content for exact private-key markers through Git's own index-aware grep. Do not decode every repository blob or respond by repeatedly increasing the timeout.
Promoted to: `docs/testing-and-qa.md`
Related docs/tests: `test/repo-security.test.ts`; `.github/workflows/background-jobs.yml`

### 2026-07-25 - Marketing Server Rendering - Public Content Must Not Need A Reveal Script

Date: 2026-07-25
Area: Marketing App Router template, loading boundary, and public-page landmarks
Status: Promoted
Decision or mistake: The global route template was a client component that wrapped page-owned `main` landmarks in another animated `main`, while the top-level `loading.tsx` boundary streamed the real route into a hidden segment. Raw response tests found all copy, but a browser with JavaScript disabled kept showing the empty loading shell because the replacement script never ran.
Why it mattered: Search and response-level checks looked healthy while visitors without working JavaScript could not see the proposition, evidence, supporting content, or conversion action. Hydrated pages also exposed duplicate main landmarks.
Current guardrail: Keep the root marketing template server-rendered and use only a non-landmark presentation wrapper; each page owns its single `main`. Do not restore a top-level App Router loading boundary unless a JavaScript-disabled browser proves that the actual page remains visible. Preserve route progress and restrained CSS entry motion as progressive enhancement, remove that motion for reduced-motion users, and test a visible H1, CTA, complete server-open disclosure content, and one main landmark with JavaScript disabled. Raw HTML string presence is necessary but not sufficient.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/template.tsx`; `apps/marketing/components/AnimatedRouteTemplate.tsx`; `apps/marketing/app/globals.css`; `playwright/marketing.mobile-content-density.spec.ts`

### 2026-07-25 - Marketing Fragment Navigation - Responsive Detail Must Reveal Its Target

Date: 2026-07-25
Area: Marketing responsive disclosures and route scroll
Status: Promoted
Decision or mistake: Moving established section anchors into closed mobile disclosures made a valid homepage deep link land on hidden content, while the global route scroll reset sent a separate commercial form fragment back to the top even though the URL retained its hash.
Why it mattered: Meaningful internal links still existed in the DOM and passed response/attachment checks, but visitors did not reach the comparison or enquiry section promised by the action.
Current guardrail: A responsive disclosure must open when it contains the current fragment target. Global route scroll handling must scroll to a valid target inside or outside a disclosure before applying its no-hash top reset. Test a real source-link click, destination visibility and Back navigation; direct `page.goto()` and URL assertions alone do not prove the interaction.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/components/marketing-foundation/Disclosure.tsx`; `apps/marketing/components/ScrollReset.tsx`; `playwright/marketing.mobile-content-density.spec.ts`

### 2026-07-25 - Marketing Editorial Consolidation - One Decision Path

Date: 2026-07-25
Area: Marketing service and product first layers
Status: Promoted
Decision or mistake: The first density pass reduced visible copy by moving a large information architecture into responsive disclosures, but product routes still divided one decision across seven controls and mounted the same gallery inventory twice. Residential and custom still carried guide-series framing, four projects and long process sequences.
Why it mattered: Lower closed-state word counts did not by themselves reduce interaction effort, repeated image work or the sense of reading an article before making contact.
Current guardrail: Measure visible and expanded first-layer copy, major regions, disclosures, gallery DOM, unique image requests and page height together. Residential and custom keep no more than six major regions, three projects, three stages and one support gateway. Product detail uses the typed decision view model, exactly three purposeful groups and one shared controlled gallery with one active image. Preserve complete server/no-JavaScript detail, honest evidence states, canonical routes and neutral source-aware product enquiries.
Promoted to: `docs/mobile-ux-roadmap-v2.md`; `docs/mobile-content-density-refinement.md`; `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/components/products/productDetailViewModel.ts`; `apps/marketing/components/products/productHubViewModel.ts`; `playwright/marketing.phase-three.spec.ts`; `artifacts/mobile-ux-phase-3/`

### 2026-07-26 - Marketing Guide First Layers - Shared Structure, Route-Owned Meaning

Date: 2026-07-26
Area: SEO guide view models and mobile first-layer evidence
Status: Promoted
Decision or mistake: The first shared guide transformation correctly preserved authored content but generated the same generic supporting H2s on every route. It also measured selected project cards as `article` elements even though the governed card primitive is a link.
Why it mattered: A structurally reusable component created avoidable duplicate SEO headings, while the evidence file falsely recorded zero first-layer projects even though browser assertions saw the correct card.
Current guardrail: Share the transformation and renderer, but require each guide config to own meaningful supporting headings, selected project and return route. Test heading uniqueness across the complete guide programme and make measurement selectors match the actual governed primitive. Preserve every authored paragraph, project and useful link in the resulting view model.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/components/seo-landing/seoLandingViewModel.ts`; `apps/marketing/components/seo-landing/seoLandingViewModel.test.ts`; `playwright/marketing.phase-four.spec.ts`; `artifacts/mobile-ux-phase-4/`

### 2026-07-26 - Marketing Static Root Routing - Canonicalise Before Header Decisions

Date: 2026-07-26
Area: Shared public route-aware production routing
Status: Promoted
Decision or mistake: Next's optimized static root rendered `usePathname()` as the filesystem alias `/index`, although the public URL and matched route were `/`. The shared header treated that alias as unknown, so the production homepage lost its residential estimate audience, emitted `source_path=/index` and missed its desktop hero-overlay state. Development checks received `/` and stayed green. A separate short-viewport test could also move focus before the menu's scheduled first-link focus had settled, making its final-link assertion timing-dependent.
Why it mattered: The most prominent homepage enquiry action contradicted the canonical Phase 1 context contract in raw production HTML, and the same raw alias later leaked through the shared footer, while a real menu focus contract looked flaky only because the test raced its owner.
Current guardrail: Canonicalise the production static root alias once for every shared route-aware navigation and conversion owner before hero, audience or enquiry decisions. Verify the optimized generated root HTML and deployed raw/browser output, including header and footer destinations, not only development routing. In focus tests, first observe the component's promised initial focus, then move focus to another target.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/enquiryContext.ts`; `apps/marketing/components/headerNavigation.ts`; `apps/marketing/components/Header.tsx`; `apps/marketing/components/SiteFooter.tsx`; `apps/marketing/components/headerNavigation.test.ts`; `apps/marketing/components/Header.test.tsx`; `playwright/marketing.home-project-finder.spec.ts`; `playwright/marketing.shared-header.spec.ts`; `playwright/marketing.phase-four.spec.ts`

### 2026-07-26 - Marketing Enquiry Reconciliation - One Opaque Identifier

Date: 2026-07-26
Area: Marketing enquiry analytics and durable intake
Status: Promoted
Decision or mistake: The direct and embedded forms generated one UUID for the durable submission and a second unrelated UUID for the analytics lead event. Both were safe opaque values, but the production event could not be joined exactly to the accepted intake.
Why it mattered: Phase 5 requires one successful form submission to reconcile with one success event. Matching only timestamp and route context is weaker evidence and can miscount concurrent enquiries.
Current guardrail: Reuse the intake boundary's validated client-generated submission UUID as `lead_event_id`. Keep it opaque and never add names, contact details, messages, dimensions, filenames or upload contents to analytics. Preserve the same submission UUID across a retry and emit the success event only after the API confirms acceptance.
Promoted to: `docs/security-privacy-quality.md`; `docs/mobile-ux-phase-5-validation.md`
Related docs/tests: `apps/marketing/app/contact/ContactEnquiryForm.tsx`; `apps/marketing/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.tsx`; `playwright/marketing.contact.spec.ts`; `playwright/marketing.phase-four.spec.ts`

### 2026-07-25 - Enquiry Email Preview Delivery - Explain Readiness At The Control

Date: 2026-07-25
Area: Marketing autoresponder staging review
Status: Promoted
Decision or mistake: The fixture page disabled its Send button whenever the server reported `sendReady=false`, but did not render the accompanying configuration reason. A deployment that could render previews and show the fixed recipient therefore presented only an unexplained grey button when `RESEND_API_KEY_PREVIEW` was absent from that deployment.
Why it mattered: Reviewers could not distinguish a deliberate safety lock from a broken control, and adding an environment value without rebuilding the deployment did not change the already-running function.
Current guardrail: Show the safe server-owned readiness reason beside the Send control, including the exact missing variable and redeploy instruction. The Vercel `RESEND_API_KEY_PREVIEW` value must be the actual provider secret, not its Resend display name. Keep Send disabled until all checks pass; do not solve configuration gaps by accepting browser-supplied recipients, credentials or content.
Promoted to: `docs/automation-email-audit.md`; `docs/environment-auth-supabase.md`
Related docs/tests: `apps/marketing/lib/email/sendWebsiteAutoresponderPreview.test.ts`; `apps/portal/app/staff/email-previews/emailPreviewOptions.test.ts`; `apps/portal/app/api/staff/v1/email-previews/website-autoresponder/route.test.ts`

### 2026-07-25 - Enquiry Email Layout Comparison - Preview Before Promotion

Date: 2026-07-25
Area: Marketing autoresponder layout exploration
Status: Promoted
Decision or mistake: Three materially different customer-email layouts were needed for an evidence-based design choice, but replacing the active production renderer before inbox review would have coupled exploration to a live conversion path.
Why it mattered: Screen previews cannot reproduce every Gmail, Outlook or Apple Mail colour transformation, and differing fixture data would make layout comparisons unreliable. An exploratory template could otherwise change live customer communication without an explicit approval point.
Current guardrail: Keep alternatives behind the staff-only fixture workbench until one is approved. Render all alternatives from one governed content model and synchronized fixture, send only the exact validated layout to the fixed staging inbox with a differentiated subject, and preserve the production renderer. Use desktop/mobile and forced light/dark views for comparison, but require actual inbox evidence before promotion.
Promoted to: `docs/automation-email-audit.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/websiteAutoresponderAlternatives.test.ts`; `apps/portal/app/staff/email-previews/EmailPreviewClient.test.tsx`; `apps/portal/app/api/staff/v1/email-previews/website-autoresponder/route.test.ts`

### 2026-07-26 - Enquiry Email Preview Access - Separate Rendering From Delivery

Date: 2026-07-26
Area: Staff website-autoresponder review
Status: Promoted
Decision or mistake: The staff API reused the preview-delivery environment gate for its read-only GET renderer. After the workbench reached `main`, authenticated production requests returned `404` before rendering and the page reported a rendering failure even though no provider credential was needed.
Why it mattered: A safety restriction on Resend delivery made a side-effect-free staff review tool appear broken and incorrectly suggested that production needed preview credentials.
Current guardrail: Keep authenticated rendering and provider delivery as separate capabilities. Production may render governed repository fixtures read-only; sending remains locked to local/test or Vercel Preview and must explain `environment_not_allowed` beside disabled actions.
Promoted to: `docs/automation-email-audit.md`; `docs/environment-auth-supabase.md`
Related docs/tests: `apps/portal/app/api/staff/v1/email-previews/website-autoresponder/route.ts`; `apps/portal/app/api/staff/v1/email-previews/website-autoresponder/route.test.ts`

### 2026-07-26 - Marketing Project Gallery - Preserve The Natural Mobile Strip

Date: 2026-07-26
Area: Marketing project-detail gallery
Status: Promoted
Decision or mistake: The Phase 2 controlled carousel made every mobile project image occupy one fixed interaction frame with buttons and a count. The product owner found that less natural than the earlier horizontal strip, where the photographs kept different aspect-ratio heights and aligned along their top edge.
Why it mattered: The technically accessible control model changed the tactile rhythm and visual character of a high-value project proof surface in a way that made browsing feel harder to the product owner.
Current guardrail: Below 900 px, render the governed project gallery as one native horizontally scrollable, keyboard-focusable region with lazy images, captions, scroll snap, alternating 4:3 and 3:4 frames and top alignment. A compact control row may add Previous/Next, position, edge state and keyboard support outside the strip, but must not turn it back into a single-frame carousel or normalize the image heights. Keep the desktop mosaic unchanged. Do not replace this route-owned project interaction with a single-frame controlled carousel without explicit product-owner approval; the controlled product gallery is unaffected.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`; `docs/mobile-ux-roadmap-v2.md`
Related docs/tests: `apps/marketing/app/projects/ProjectGallery.tsx`; `apps/marketing/app/projects/projects.css`; `playwright/marketing.projects.spec.ts`

### 2026-07-26 - Marketing Release Identity - Prove The Deployed Revision

Date: 2026-07-26
Area: Marketing deployment and semantic parity evidence
Status: Promoted
Decision or mistake: Production route checks could prove HTTP success, stable responsive layout and matching semantic markers, but the public response exposed no repository revision. A deployment catching up after a review also made earlier production findings stale while still leaving no exact way to prove the change.
Why it mattered: Cache-busted and ordinary responses can look identical while serving an unknown release. Without an exact revision, production closure and regression attribution depend on inference.
Current guardrail: Add `X-Sanctuary-Release` to every marketing response from an explicitly supplied or provider commit SHA, accept only bounded hexadecimal revisions, and expose only `local` outside a revisioned build. Post-deployment validation must see one value across the complete normal/cache-busted route matrix and may pin the expected SHA. Keep route-owned semantic markers in the same contract; HTTP 200, cache state and visual similarity alone are not deployment identity.
Promoted to: `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`; `docs/mobile-ux-phase-5-validation.md`
Related docs/tests: `apps/marketing/lib/releaseIdentity.ts`; `apps/marketing/next.config.ts`; `playwright/marketing.phase-five.spec.ts`

### 2026-07-26 - Enquiry Email Production Layout - Promote Through The Canonical Renderer

Date: 2026-07-26
Area: Marketing website autoresponder
Status: Promoted
Decision or mistake: After staff workbench and inbox review, the product owner explicitly approved Editorial Refined as the live website-enquiry autoresponder layout.
Why it mattered: Switching only the public send adapter or only the workbench would let live delivery, staff previews and governed fixtures render different customer emails.
Current guardrail: Promote an approved layout through `renderWebsiteAutoresponder`, retain the stable template IDs, customer subjects and delivery contract, and make the active workbench layout render the same adaptive HTML and plain text. Keep Image-led and Compact preview-only until separately approved.
Promoted to: `docs/automation-email-audit.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/lib/websiteAutoresponder.ts`; `apps/marketing/lib/websiteAutoresponderAlternatives.test.ts`; `apps/marketing/lib/websiteAutoresponderPreviewFixtures.test.ts`

### 2026-07-27 - Enquiry Email Optional Pricing - Confirm Every Valid Brief

Date: 2026-07-27
Area: Marketing website autoresponder
Status: Promoted
Decision or mistake: The public intake correctly accepted short residential and commercial enquiries without dimensions, but the autoresponder path treated a missing indicative range as fatal and exited before rendering or calling the provider.
Why it mattered: Valid customer enquiries, including enquiries with uploaded files, were saved successfully while neither the customer nor the staff BCC received a confirmation.
Current guardrail: Keep indicative pricing optional in the autoresponder contract. When a valid brief has no costing snapshot, render and send the stable residential or commercial template without the investment panel or estimate wording, and retain the normal idempotent outbox and audit path.
Promoted to: `docs/automation-email-audit.md`
Related docs/tests: `apps/marketing/app/api/enquiry/route.test.ts`; `apps/marketing/lib/websiteAutoresponderAlternatives.test.ts`

### 2026-07-27 - Enquiry Attachment Readiness - Never Lose Selected Files Silently

Date: 2026-07-27
Area: Marketing enquiry attachments
Status: Promoted
Decision or mistake: The application and migration expected a private `enquiry-attachments` bucket, but the exact production Supabase project had never provisioned it. Signed-upload preparation failed and the browser deliberately downgraded selected files to metadata, so the enquiry and autoresponder continued without deliverable attachments.
Why it mattered: Customers and staff saw successful enquiries and file counts even though no Storage object existed and Resend had nothing to attach.
Current guardrail: Verify the bucket in the target environment before release. Once a customer selects files, signing and every direct upload must succeed before submission; otherwise show a retry/remove-files error and do not claim the files were received.
Promoted to: `docs/automation-email-audit.md`
Related docs/tests: `supabase/migrations/20260701_000001_enquiry_attachments_bucket.sql`; `apps/marketing/lib/enquiryAttachments.test.ts`

### 2026-07-26 - Marketing Homepage Promotion - Replace The Owner, Not The Responsibilities

Date: 2026-07-26
Area: Public homepage promotion and legacy retirement
Status: Promoted
Decision or mistake: The approved first-design-conversation prototype replaced the long-form production homepage. Keeping the prototype, former root implementation and production route as separate maintained trees would have left duplicate content, analytics contracts and regression suites.
Why it mattered: A visual promotion can silently discard canonical metadata, structured data, crawlable Auckland capability, process and enquiry pathways, while preserving every old page as a fallback creates permanent drift and bloat.
Current guardrail: Move the approved experience into one production owner, explicitly transfer SEO, proof, capability, process, enquiry, consent and no-JavaScript responsibilities, then delete the superseded implementation. Keep comparison URLs only as permanent redirects to the canonical root and prove the production page plus redirects in one focused browser lane.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/_home-project-finder/`; `apps/marketing/app/page.tsx`; `apps/marketing/app/home-project-finder/route.ts`; `playwright/marketing.home-project-finder.spec.ts`; `playwright/marketing.phase-four.spec.ts`; `playwright/marketing.phase-five.spec.ts`

### 2026-07-26 - Marketing Homepage Interaction - Test The Actual Handoff

Date: 2026-07-26
Area: Public homepage first-question interaction
Status: Promoted
Decision or mistake: The hero action targeted the outer conversation section, so the repeated introduction consumed the viewport and left every answer below the fold at 320px and the 360px by 400px CSS viewport used for 200 percent zoom. Arrow, Home and End changed the radio state without reaching the click-only analytics listener. A later equal-specificity hover rule also replaced the selected olive surface while leaving inverse text in place, and the selected focus ring used the same olive as its background.
Why it mattered: The page looked coherent in static desktop review while its primary mobile handoff exposed no immediate action, keyboard engagement was undercounted, and a selected answer could become unreadable or lose its visible focus indication.
Current guardrail: Keep one visible question introduction and point the hero fragment to it with an explicit header offset; assert that the first answer substantially intersects narrow and zoomed viewports before any test scroll. Route semantic radio keyboard changes through the same consent-gated activation path as pointer selection. Scope unselected hover explicitly, use contrasting focus colours on selected and inverse surfaces, and assert computed colours rather than only the presence of an outline. Repeated project actions must have project-specific accessible names, and governed project mappings fail closed if their source record is missing. When refining answer copy or governed matches in a way that can affect engagement, advance the homepage variant while keeping stable event names.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/security-privacy-quality.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/_home/DesignConversation.tsx`; `apps/marketing/app/_home/HomepageDesignConversationTracker.tsx`; `apps/marketing/app/_home/homepage.module.css`; `apps/marketing/app/_home/matching.test.ts`; `playwright/marketing.homepage.spec.ts`

### 2026-07-27 - Calculator Add Actions - Do Not Pass DOM Events Into Optional Seeds

Date: 2026-07-27
Area: Calculator add actions and serializable draft state
Status: Active
Decision or mistake: The Blinds editor bound a zero-intent Add button directly to a controller function whose optional argument was a partial blind seed. React therefore passed the click event as the seed, allowing an `HTMLButtonElement` and React fiber cycle into calculator state.
Why it mattered: The next costing-request serialization failed with a circular-JSON error and replaced the Calculator with the global error screen.
Current guardrail: Wrap zero-argument UI actions before passing them to event handlers whenever the target function accepts optional data. Component tests must assert the callback receives no arguments, not only that it was called.
Promoted to: None
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorBlindsEditor.tsx`; `apps/portal/app/staff/calculator/CalculatorBlindsEditor.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Rafter Explainability - One Fact For Diagram And Working

Date: 2026-07-27
Area: Calculator rafter cut-length workings and Section annotations
Status: Promoted
Decision or mistake: The Section presenter independently estimated rafter length from visible bearings, symmetric gable edges, and a two-end width-based allowance. The costing takeoff instead used attachment/gutter-specific deductions, separate gable sides, the engine-selected pitch, and a depth-based angle-cut allowance.
Why it mattered: Both values looked plausible but were not equivalent, so an explanatory diagram could undermine trust while presenting the wrong manufacturing length.
Current guardrail: Package-owned derivation publishes one versioned explanation contract. Written workings and Section cut annotations consume its exact plane facts. Input-fallback or unsupported geometry fails closed instead of recreating a formula in the portal.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `packages/costing/src/engine/rafterExplanation.ts`; `packages/costing/src/engine/derive.test.ts`; `apps/portal/app/staff/calculator/ModuleRafterTrustIntegration.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Trusted Breakdowns - Explain The Actual Rows

Date: 2026-07-27
Area: Calculator whole-job material and labour explanations
Status: Promoted
Decision or mistake: The Result Inspector ordered raw BOM lines by internal cost and raw labour actions by minutes, truncated materials to ten rows, and exposed engine-oriented labels without one compact explanation contract. Valid BOM output can also repeat a source line ID when separate cut groups choose the same stock item.
Why it mattered: Staff could not see the complete procurement or work-stage picture, and a UI keyed only by source ID could duplicate or omit valid rows while appearing to be a trustworthy explanation.
Current guardrail: Build everyday groups, labels, ownership, quantities, waste/rounding facts, time, and multipliers from the exact package-owned BOM lines and install actions. Preserve each original ID for traceability, add a separate unique instance ID for presentation, and keep raw trace export diagnostic-only. Bound complete groups with native disclosures keyed by stable group ID; open only the first by default and preserve user state while mounted. Routine copy uses purchasing/crew language, while unchanged package IDs stay behind nested technical disclosure. Portal components disclose this contract but never reconstruct or truncate the quantity rules.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`
Related docs/tests: `packages/costing/src/engine/breakdownExplanation.ts`; `packages/costing/src/engine/breakdownExplanation.test.ts`; `apps/portal/app/staff/calculator/CalculatorTrustedBreakdowns.test.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Quote Reconciliation - Prove The Whole Commercial Chain

Date: 2026-07-27
Area: Calculator Live pricing, estimate Save, and proposed quote handoff
Status: Promoted
Decision or mistake: Calculator preview and saved-estimate quote mapping already shared pricing owners, but the save outcome did not explicitly prove that a repriced design produced the same exact-cent customer total. A validation pass also showed that the two valid presentations order blind and preserved-lighting rows differently.
Why it mattered: Staff need evidence that the displayed total survives Save and quote handoff. Treating row order as commercial identity would create a brittle false failure, while checking only the rounded headline could hide a real cents-level mismatch.
Current guardrail: Run representative inputs through actual costing, Live preview, repriced estimate persistence, and saved-estimate quote mapping. Compare the complete priced inclusion multiset and exact-cent total, not presentation order. Show an exact match after Reprice and disable Create quote on an unexpected mismatch; Preserve remains explicitly tied to its stored costing basis.
Promoted to: `docs/calculator-trust-and-explainability-goal.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/calculatorTrustValidation.test.ts`; `apps/portal/app/staff/calculator/calculatorSaveOutcome.test.ts`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Responsive Ownership - Measure The Container And Scroll Owner

Date: 2026-07-27
Area: Calculator configuration containment, sticky chrome, and issue routing
Status: Promoted
Decision or mistake: Template and Flashings controls reflowed from viewport breakpoints even when the split configuration pane was much narrower, while sticky offsets assumed viewport scrolling. Mobile `overflow-x: hidden` on `html/body` also computed into an unintended vertical scroll container and disabled the expected sticky chain.
Why it mattered: Controls could be clipped while the document itself reported no overflow; Save could scroll under fixed chrome; and Issue Jump could focus a field outside the usable viewport.
Current guardrail: Reflow composite controls from their own container width. Discover the nearest real vertical scroll owner at runtime. Apply external portal/project offsets only when the embedded Calculator participates in document scrolling; use local `top: 0` inside Calculator-owned scrollports. Use document `overflow-x: clip` for horizontal containment. Issue Jump must reveal an Advanced-only section before locating its target and prefer the invalid descendant inside composite fields. Verify full rects plus centre hit ownership after deep scrolling.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/calculator-ui-ux-refinement-plan.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorJobTemplates.module.css`; `apps/portal/app/staff/calculator/CalculatorGrid.module.css`; `apps/portal/app/staff/calculator/calculatorViewportNavigation.ts`; `playwright/portal.calculator-foundation-ui.spec.ts`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Automatic Defaults - Present The Authoritative Resolution

Date: 2026-07-27
Area: Calculator automatic pitch and downpipe inputs
Status: Promoted
Decision or mistake: The form displayed raw blank pitch and downpipe `0`, while costing legitimately resolved those automatic values to concrete normalized output and the routine helper copy was suppressed.
Why it mattered: Staff could read the entered and costed values as contradictory, and recreating the default rule in the portal would introduce a second costing source of truth.
Current guardrail: Keep raw automatic inputs unchanged. Add presentation-only cues from the selected `CostOutputV1` result, label current versus retained freshness explicitly, make no numeric claim before a valid result, suppress cues for explicit inputs/no-gutter downpipes, and let validation errors replace the cue in `aria-describedby`.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/calculator-trust-and-explainability-goal.md`
Related docs/tests: `apps/portal/app/staff/calculator/calculatorResolvedDefaults.ts`; `apps/portal/app/staff/calculator/useCalculatorResultPresentation.ts`; `apps/portal/app/staff/calculator/CalculatorConfigurationForm.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Result Hierarchy - One Lead Answer, Owned Navigation

Date: 2026-07-27
Area: Calculator stacked task order, Result Inspector navigation, pricing precision, and Workings order
Status: Promoted
Decision or mistake: The stacked Calculator made staff pass the whole form before finding results, repeated a rounded price hero inside Pricing, kept tab state inside the Inspector, and presented the diagram before the written answer.
Why it mattered: Result discovery depended on layout knowledge; switching desktop tasks could reopen at an arbitrary deep scroll position; repeated rounded totals competed with exact-cent commercial detail; and Workings led with evidence before its conclusion.
Current guardrail: `CalculatorWorkspaceView` owns the active result task, result rail, and explicit stacked result/back focus routes. Show exactly one rounded customer summary per layout and preserve exact cents in Pricing detail, Save review, and quote handoff. A genuine tab change resets only an independent result rail; ordinary stacked tab changes do not move the page. Present the authoritative result and written working before its diagram.
Promoted to: `docs/calculator-ui-ux-refinement-plan.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/calculator-trust-and-explainability-goal.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorWorkspaceView.tsx`; `apps/portal/app/staff/calculator/CalculatorResultInspector.tsx`; `apps/portal/app/staff/calculator/CalculatorPricingSummary.tsx`; `apps/portal/app/staff/calculator/CalculatorPricingDetails.tsx`; `playwright/portal.calculator.spec.ts`

### 2026-07-27 - Calculator Readiness Presentation - Causes Are Not Checks

Date: 2026-07-27
Area: Calculator command order, readiness summary, Quote Status, and Save gating
Status: Promoted
Decision or mistake: Narrow CSS visually moved Save ahead of controls that remained earlier in DOM/focus order, while one invalid input appeared as both an input blocker and an independent Engine blocker. The compact status also used check counts and broken singular grammar as though each blocked check were a separate correction.
Why it mattered: Keyboard order disagreed with the screen, and staff could overestimate how many problems needed correction or mistake an Updating wait for a new defect.
Current guardrail: Render identity, readiness, Basic, Advanced, and one Save in that source/focus order at every width. Derive presentation-only root-cause, blocked-check, and review counts from the complete existing status rows. A dependent Engine row declares `blockedBy: 'inputs'`; waits and independent errors remain distinct. Never remove a status row, change `hasStatusBlockers`, or make Save eligible through presentation deduplication.
Promoted to: `docs/calculator-ui-ux-refinement-plan.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/calculator-trust-and-explainability-goal.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/calculator/CalculatorCommandBar.tsx`; `apps/portal/app/staff/calculator/calculatorReadinessSummary.ts`; `apps/portal/app/staff/calculator/calculatorQuoteStatusUi.ts`; `apps/portal/app/staff/calculator/QuoteStatusCard.tsx`; `apps/portal/app/staff/calculator/CalculatorCommandBar.test.tsx`; `apps/portal/app/staff/calculator/calculatorReadinessSummary.test.ts`; `apps/portal/app/staff/calculator/QuoteStatusCard.test.tsx`

### 2026-07-28 - Calculator Infill Pricing - Attribute The Pooled Cost, Do Not Reprice It

Date: 2026-07-28
Area: Calculator infill costing, customer-price explanation, and quote handoff
Status: Superseded
Decision or mistake: A selected-infill marginal rerun already existed, but it was module-only true cost, excluded job pooling, and could not provide additive rows. The approved staff presentation instead needs customer-price contributions that preserve pooled purchasing and the one-line-per-pergola quote.
Why it mattered: Independently recalculating every infill can charge the same sheet or bar more than once, lose shared waste savings, and produce child amounts that do not equal the pergola staff just priced.
Current guardrail: Superseded by the no-infill baseline entry below. Keep pooled purchase traceability, one-line-per-pergola quote mapping, exact-cent reconciliation, and role-gated internal costs, but do not describe a proportional share of the whole pergola as the amount an infill added.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `packages/costing/src/engine/infillCostAttribution.ts`; `packages/costing/src/engine/infillCostAttribution.test.ts`; `apps/portal/app/staff/calculator/calculatorInfillPricing.ts`; `apps/portal/app/staff/calculator/calculatorPricingPreview.test.tsx`; `apps/portal/app/staff/calculator/calculatorTrustValidation.test.ts`

### 2026-07-28 - Infill Incremental Pricing - Stable Base And Single-Installer Labour

Date: 2026-07-28
Area: Calculator infill pricing, costing baseline, and labour calibration
Status: Promoted
Decision or mistake: Proportionally allocating the whole pergola cost made the displayed structure/roof remainder lower than the same pergola without infills, because the infill inherited existing overhead. The labour model also omitted or compressed measurement, handling, cutting, deburring, acrylic edge finishing, drilling, support preparation, sealing, film removal, and cleanup.
Why it mattered: Staff reasonably read the infill row as "what this added", while the model showed a broader share of total price. A 1.2m by 1.0m sheet infill with four added supports carried only 102.82 minutes and `$128.52 ex GST`, despite the business using predominantly single-installer crews.
Current guardrail: Run one package-owned site baseline with all infills removed and the same remaining inputs/configuration. Reconcile current minus baseline materials, labour, overhead, shared cost, and total; allocate that incremental pool across pooled infills; price the base and delta through the existing customer-price sequence; and keep quote mapping unchanged. The active v1.8 defaults retain `$75/h ex GST` but expand the existing action meanings and minutes to include the missing preparation/fabrication work. Explicit v1.7 control compatibility preserves previously published numeric action settings until a v1.8 configuration is deliberately published.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `packages/costing/src/engine/infillIncrementalBaseline.ts`; `packages/costing/src/engine/infillCostAttribution.test.ts`; `packages/costing/src/controlConfig.test.ts`; `apps/portal/app/staff/calculator/calculatorTrustValidation.test.ts`

### 2026-07-28 - Commercial Workflow Trust - Exact Intent, Revision, And Recovery

Date: 2026-07-28
Area: Calculator saves, quote drafts/delivery, public acceptance, deposit invoices, email checkpoints, and audit
Status: Promoted
Decision or mistake: Request-local orchestration allowed duplicate or stale commercial actions, estimate creation could borrow the latest saved snapshot when the initiating snapshot was absent, provider acceptance and database finalisation had no durable handoff, and the UI described retry or completion more strongly than the stored evidence.
Why it mattered: Staff could send a quote other than the one they reviewed, concurrent saves could overwrite newer pricing, a lost response could create duplicate versions or invoices, and accepted customers could see a success state that hid an undelivered invoice.
Current guardrail: Give estimate/quote creates and deliveries stable intent IDs; require the exact calculator snapshot for a new save; use a monotonic quote commercial revision and atomically reserve that revision before dispatch; freeze one provider request/key/token/attachment set; checkpoint provider acceptance before an idempotent business finaliser; make acceptance plus invoice identity one atomic command; and expose provider-confirmed, retryable, and staff-attention states without claiming automatic retries. Treat unfinished-delivery discovery as optional read enrichment: a missing commercial migration must preserve read-only quote/PDF/history review, keep affected actions unavailable, and make delivery/recovery routes fail explicitly as schema-not-ready rather than using legacy writes.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/quotes-invoices-job-packs.md`; `docs/local-first-sync.md`; `docs/automation-email-audit.md`; `docs/staff-api-auth-contracts.md`; `docs/architecture.md`
Related docs/tests: `supabase/migrations/20260728_000001_commercial_workflow_trust.sql`; `apps/portal/lib/commercial`; `apps/portal/app/api/quotes/_lib/quoteDeliveryRoute.test.ts`; `apps/portal/app/api/projects/[projectId]/estimates/route.test.ts`; `apps/marketing/app/api/quotes/[quoteId]/accept/route.test.ts`

### 2026-07-28 - Commercial Revision Conflicts - Do Not Use Serialization Failure

Date: 2026-07-28
Area: Quote draft concurrency, PostgreSQL RPC errors, and staging migration validation
Status: Promoted
Decision or mistake: The quote update RPC raised stale commercial revisions with SQLSTATE `40001`, PostgreSQL's serialization-failure class. The staging data path retried that application conflict for roughly two minutes and eventually returned `500` instead of the intended immediate `409`.
Why it mattered: Staff received a slow generic failure for a normal stale-editor conflict, while automated retry obscured the exact recovery action.
Current guardrail: Raise `QUOTE_STALE` as a non-retryable application exception, normalize it at the quote owner, and prove the API returns immediate `409`. Execute migration rollback/apply/replay in disposable PostgreSQL and run the provider-free authenticated staging quote smoke before production review.
Promoted to: `docs/quotes-invoices-job-packs.md`; `docs/testing-and-qa.md`; `docs/environment-auth-supabase.md`
Related docs/tests: `supabase/migrations/20260728000002_commercial_quote_stale_conflict.sql`; `supabase/tests/commercial_workflow_trust.sql`; `playwright/portal.commercial-workflow-staging.spec.ts`

### 2026-07-28 - Quote PDF Asset Runtime - Resolve The Server Bundle Output

Date: 2026-07-28
Area: Quote PDF Asset Runtime
Status: Promoted
Decision or mistake: Direct tests saw module-relative font URLs as `file:` URLs, but Next/Webpack rewrote the same server import to `/_next/static/media/<hash>.ttf`. Passing either the foreign URL object or browser URL to `readFile` failed, while draft update swallowed artifact refresh failure and still returned success.
Why it mattered: Staff could save a quote successfully while its regenerated PDF remained stale or unavailable.
Current guardrail: Keep the source asset module-relative, read native production `file:` URLs directly, and map only webpack development's exact hashed media URL to the current isolated server output. Do not probe source roots. The staging quote-update smoke must inspect server errors and fail if artifact refresh is swallowed.
Promoted to: `docs/quotes-invoices-job-packs.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/quotes/quotePdfAssets.ts`; `scripts/run-commercial-staging-smoke.mjs`; `apps/portal/lib/quotes/pdf.test.ts`

### 2026-07-29 - Marketing Copy Reduction - Remove The Repeated Decision

Date: 2026-07-29
Area: Marketing mobile copy, navigation, forms and conversion hierarchy
Status: Promoted
Decision or mistake: Earlier density work often preserved the same narrative
inside responsive disclosures, while navigation, form introductions and final
CTAs repeated decisions already owned by the page or shared footer. A
sitemap-only claims review also missed public noindex entry flows.
Why it mattered: Mobile visitors still had to scan repeated explanations and
conversion prompts, and unsafe consent or performance wording could survive
outside the sitemap.
Current guardrail: Delete or combine repeated copy at its source before adding
a disclosure. Keep one useful action per decision point, one compact optional
technical group in forms and no generic final CTA after an embedded form.
Preserve governed evidence, metadata, schema, canonicals, enquiry payloads,
attribution and analytics names. Advance the homepage variant when material
copy changes, and include public noindex flows in claims review.
Promoted to: `docs/mobile-content-density-refinement.md`;
`docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`;
`docs/marketing-claims-register.md`
Related docs/tests: `playwright/marketing.mobile-content-density.spec.ts`;
`playwright/marketing.homepage.spec.ts`; `playwright/marketing.contact.spec.ts`;
`playwright/marketing.products.spec.ts`; `playwright/marketing.projects.spec.ts`;
`playwright/marketing.acrylic-copy-variant.spec.ts`

### 2026-07-29 - Portal Operational Lists/Create - Bound Reads And Confirm The Command

Date: 2026-07-29
Area: Projects, Contacts, project creation, and commercial delivery recovery
Status: Promoted
Decision or mistake: Projects and Contacts index screens downloaded broad record
sets and then filtered/rendered them in the browser. Project creation also split
contact/project persistence across browser-owned steps, making partial success
and retry safety difficult to state truthfully.
Why it mattered: Ordinary list cost grew with the database, retained rows could
be mistaken for a newly selected scope, and staff could not know whether a
failed create left one of its records behind.
Current guardrail: Staff index routes return stable, exact-count, maximum-100-row
RPC pages and include the query identity used to build the response. The client
must suppress retained data whose scope/filter/page identity differs. Project
creation submits stable contact/project IDs to one server coordinator, checks
strong normalized contact duplicates first, runs the existing automation owner,
and returns a server-confirmed record receipt with a separate setup-automation
state. Matching command replay must not repeat automation or claim it was
rechecked. A setup failure preserves the confirmed records and returns an
attention receipt; verified compensation is limited to an unused contact after
a definitively failed project write. Indeterminate writes or unverifiable
cleanup must return an explicit do-not-retry reconciliation state.
Promoted to: `docs/projects-contacts-estimates-calculator.md`;
`docs/staff-api-auth-contracts.md`; `docs/supabase-schema-map.md`;
`docs/quotes-invoices-job-packs.md`
Related docs/tests: `apps/portal/lib/projects/createProjectCommand.test.ts`;
`apps/portal/app/api/staff/v1/projects/route.test.ts`;
`apps/portal/app/staff/projects/ProjectsIndexClient.test.tsx`;
`apps/portal/app/staff/contacts/ContactsIndexClient.test.tsx`;
`test/portal-operational-lists-migration.test.ts`

### 2026-07-29 - Portal UI Authority - Current Rendered System Is Canonical

Date: 2026-07-29
Area: Portal and marketing UI ownership
Status: Promoted
Decision or mistake: The portal Foundation document mixed current component
contracts with replacement-migration language, while readiness and feature docs
described different rollout boundaries. That contradiction encouraged agents
to treat the catalogue, compatibility names and the separate marketing
Foundation as direction to change current portal screens.
Why it mattered: A documentation label could trigger broad visual churn,
removal of active specialist or compatibility presentation, or cross-app design
adoption without a verified product defect or user approval.
Current guardrail: The checked-in portal implementation and rendered behavior
are the current portal UI canon. Portal and marketing own separate UI systems.
Catalogues provide shared-component discovery and regression evidence; they are
not target mockups. Preserve active specialist, route-owned and compatibility
presentation. A cross-route restyle, shared-token replacement or UI-system
migration requires explicit user approval. Inspect current code, tests and
rendered behavior before correcting a UI claim.
Promoted to: `AGENTS.md`; `docs/README.md`; `docs/architecture.md`;
`docs/change-routing.md`; `docs/ui-foundation.md`;
`docs/marketing-ui-foundation.md`; `docs/portal-production-readiness.md`;
`docs/portal-ux-roadmap.md`
Related docs/tests: `apps/portal/app/layout.tsx`;
`apps/portal/app/globals.css`;
`apps/portal/components/layout/PageHeader.tsx`;
`apps/portal/components/ui/foundation`;
`apps/marketing/components/marketing-foundation`;
`playwright/portal.ui-foundation.spec.ts`;
`playwright/marketing.foundation.spec.ts`

### 2026-07-29 - Schedule Mutation Trust - Preview, Roll Back, Then Commit Atomically

Date: 2026-07-29
Area: Schedule Board/Gantt optimistic state, affected-job confirmation, cache
authority, and Gantt resize commands
Status: Promoted
Decision or mistake: The Schedule client forced every V2 command immediately,
so existing server impact previews could never reach staff. Several optimistic
paths had no exact rollback, Board and Gantt caches could disagree, transient
toasts were the only failed/stale signal, and Gantt resize saved duration and
pinning through two separate requests.
Why it mattered: One failed or cancelled action could leave the screen ahead
of the database, a later view could show a different schedule, and a partial
Gantt save could persist timing the user never approved.
Current guardrail: Preview each V2 mutation with `force: false`; show a named
before/after impact review only when the server reports that other jobs move;
after explicit approval, re-preview immediately and send `force: true` only if
the affected job identities and dates are unchanged. Keep one mutation in
flight across mounted/remounted owners, checkpoint the complete affected local
Schedule state before optimism, keep that optimism out of shared query caches,
and restore it on rejection, cancellation, changed preview, or a competing
action. Fail closed unless success, confirmation, impacts, dates, UUIDs, and
nested schedules match their complete contracts. Complete-list reorders must
exactly match the current crew-item set. Apply accepted Board state only to a
compatible cache; accepted Gantt commands restore the trusted checkpoint and
refetch the authoritative range before presentation. Invalidate incompatible
snapshots. Require explicit `ok: true`; reconcile network, HTTP 408, unexpected
5xx, and malformed-response ambiguity without claiming success. HTTP 501 is
the documented pre-commit schema/RPC-unavailable exception. Keep failed/stale
state visible until a successful command or authoritative refresh. Commit
Gantt start, duration, pin mode, and recomputed forecasts through one
`schedule_v2_apply_job_patch` RPC-backed `/job/adjust` command. The client
re-preview is not a database revision guard: guarded RPC or per-crew revision
protection remains required for near-simultaneous staff edits.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests:
`apps/portal/app/staff/schedule/ScheduleClient.test.tsx`;
`apps/portal/app/api/staff/v1/schedule/job/adjust/route.test.ts`;
`apps/portal/app/staff/schedule/ScheduleBoardView.test.tsx`;
`apps/portal/app/staff/schedule/ScheduleGanttView.test.tsx`;
`npm run test:portal:schedule`

### 2026-07-30 - Supabase Migration Versions - Exact Files Over A Colliding Ledger

Date: 2026-07-30
Area: Supabase migration promotion and remote history
Status: Promoted
Decision or mistake: The repository's `20260729_000001` through `_000004`
filenames look ordered to a reader, but Supabase CLI treats only `20260729` as
their shared migration version. Staging also has a sparse historical ledger.
Why it mattered: `db push`, `migration up`, or `migration repair 20260729`
could apply unrelated history or falsely associate one shared version with the
wrong file.
Current guardrail: Positively identify the linked target and a distinct
production ref. Hash each exact reviewed file, inspect prerequisites and
collisions, rehearse its body inside a rollback transaction, apply only that
file through the linked query boundary, and verify readiness, catalog shape,
function body, and grants. Preserve deployment evidence separately; do not
repair the colliding ledger until migration naming/history has a dedicated
reviewed remediation.
Promoted to: `docs/environment-auth-supabase.md`;
`docs/project-work-items-and-follow-up.md`
Related docs/tests:
`supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql`;
`supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql`;
`scripts/check-project-work-v2-readiness.mjs`

### 2026-07-30 - Schedule Continuity And Switching - Never Show Known-Old State

Date: 2026-07-30
Area: Schedule Board/Gantt request ordering, confirmed Gantt presentation, and
in-page view switching
Status: Promoted
Decision or mistake: After an accepted Gantt command, the client restored the
old checkpoint before fetching the authoritative range, so a bar visibly
jumped backward and forward. A late Board/Gantt read could also arrive after a
save and overwrite newer local state. Switching Board/Gantt through App Router
navigation rebuilt the server page, while the inactive Board model was still
derived during Gantt renders.
Why it mattered: Staff could briefly see known-wrong dates after a successful
save, mistake a stale response for the accepted result, and wait through
avoidable navigation and rendering work every time they changed planning view.
Current guardrail: Acquire mutation ownership and cancel current reads before
optimism. Stamp Board and Gantt reads separately when they start; after any
mutation settles, reject reads that began before that boundary, and never
apply an older read after a newer read for the same view. Do not order the
different Board and Gantt datasets against each other. Roll back only
rejection, cancellation, or ambiguous failure. Once `ok: true` is validated
for Gantt, retain the confirmed direct
target preview while the authoritative range loads; atomically replace it on
success, or keep it visible as stale and block writes on refresh failure.
Switch Board/Gantt within the mounted client, update browser history without a
server-page rebuild, prefetch the target query and lazy view from pointer/focus
intent, synchronize canonical URL changes, and derive only the active view
model. This changes continuity and performance, not portal colours, fonts, or
visual language.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests:
`apps/portal/app/staff/schedule/ScheduleClient.test.tsx`;
`apps/portal/app/staff/schedule/scheduleSnapshotRequestTracker.test.ts`;
`apps/portal/app/staff/schedule/ScheduleViewTabs.test.tsx`;
`apps/portal/app/staff/schedule/page.test.tsx`;
`apps/portal/lib/queries/schedule.test.ts`;
`npm run test:portal:schedule`

### 2026-07-31 - Schedule Trusted Job Context - Identify And Review Before Commit

Date: 2026-07-31
Area: Schedule Board/Gantt job identity, bounded reads, and timing-change review
Status: Promoted
Decision or mistake: Board and Gantt primarily exposed project name and timing,
while customer/site context was incomplete or reconstructed differently by
cards, rows, and dialogs. Gantt also loaded the full schedulable project pool
to identify only the jobs already present in its bounded range, and pointer
drag/resize invoked the mutation callback as soon as the pointer was released.
Why it mattered: Similar project names were easy to confuse, staff could not
reliably verify the customer, site, crew, and exact current/proposed timing at
the moment of change, and a range-scoped view paid for an unbounded identity
read. That increased both operational error risk and large-schedule latency.
Current guardrail: Keep project name primary and derive one deduplicated
customer/site identity, search string, crew label, and current timing through
`ScheduleJobPresentation.ts`. Project identity remains server-owned and must be
selected only for the projects in the active Board/Gantt read model. Before a
Gantt move/resize calls the existing command controller, show authoritative
current timing plus the requested start/duration and fail stale if the item
changed. Do not derive an exact proposed finish in the browser. Preserve the
subsequent affected-job preview, immediate re-preview, explicit confirmation,
optimistic rollback, ambiguous-outcome reconciliation, and API/RPC ownership.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests:
`apps/portal/app/staff/schedule/ScheduleJobPresentation.test.ts`;
`apps/portal/app/staff/schedule/ScheduleGanttView.test.tsx`;
`apps/portal/app/staff/schedule/ScheduleActionModals.test.tsx`;
`apps/portal/lib/scheduling/scheduleV2Server.test.ts`;
`apps/portal/app/qa/schedule-ops-fixture/fixtures.test.ts`;
`npm run test:portal:schedule`

### 2026-07-31 - Schedule Authoritative Timing - Request Locally, Calculate On The Server

Date: 2026-07-31
Area: Schedule Gantt timing review and small-screen operation
Status: Promoted
Decision or mistake: The local Gantt drag review derived and displayed an exact
proposed finish with browser weekday arithmetic. The server forecast also owns
crew calendars, regional holidays, closures, and affected-job sequencing, so
the displayed finish could disagree with the next authoritative preview. The
desktop Gantt controls were also compressed into phone height until the
timeline had almost no useful operating space.
Why it mattered: Staff could approve a date consequence the server had never
calculated, then experience the committed result as a surprise. Phone users
received a technically responsive canvas rather than a purposeful operational
mode.
Current guardrail: A drag/resize may collect requested start and duration, but
the local review shows only those inputs alongside the authoritative current
forecast. The server impact preview/re-preview owns the exact resulting finish
and every affected job. At 640 CSS pixels or narrower, render a read-only crew
agenda from the same Gantt model, retain essential view context, and route
schedule changes to Board; do not create another read model or phone write path.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests:
`apps/portal/app/staff/schedule/useScheduleGanttTimingReview.ts`;
`apps/portal/app/staff/schedule/ScheduleGanttCompactView.tsx`;
`apps/portal/app/staff/schedule/ScheduleGanttView.test.tsx`;
`playwright/portal.schedule-tasks-ui.spec.ts`;
`npm run test:portal:schedule`

### 2026-07-29 - Project Work V2 - Prove The Hosted API Cache

Date: 2026-07-29
Area: Project Work V2 migration, PostgREST schema cache, and project reads
Status: Promoted
Decision or mistake: The V2 migration created its tables and sent a schema
reload notification inside the DDL transaction, while several readers
classified projects through an embedded
`projects -> project_work_model_versions` relationship. The first staging
rehearsal left PostgREST reporting both the relationship and the new tables as
missing from its schema cache, so every individual project snapshot failed
before it could classify a legacy project.
Why it mattered: Successful SQL execution did not prove that authenticated API
reads could observe the new schema. One unavailable optional classification
relationship took down the complete project-detail route.
Current guardrail: Read marker inventory through
`projects/workItems/modelBoundary.ts` and operational state through its direct
bounded owner, not a PostgREST embedded relationship.
Until the marker table is deployed, that boundary logs the exact
missing-marker-table condition and preserves legacy reads; it must not swallow
authentication, permission, network, or unrelated schema failures.
That compatibility applies only to bounded per-project classification.
Staff-wide marker inventory fails the complete Work Queue read if the table is
missing or the 5,000-row safety ceiling is reached; it must never return a
fresh-looking partial queue.
For new-table rollout, commit DDL before sending the PostgREST reload
notification. Canonicalize the expected named `project_id -> projects.id`
foreign keys with `ON DELETE CASCADE` rather than accepting any relationship
on `project_id`. Before resuming project or enquiry writers, run
the production-refusing read-only readiness probe and prove a direct marker read
plus an authenticated legacy-project snapshot against the exact target
environment. Cached Work Queue/Overview rows are read-only after refresh
failure, and a missing V2 contract must render a named not-ready state with no
actions. If an idempotent `create table if not exists` migration may have met a
partial table, add a forward relationship repair rather than editing the applied
migration.
Promoted to: `docs/project-work-items-technical-plan.md`;
`docs/project-work-items-and-follow-up.md`;
`docs/portal-production-readiness.md`
Related docs/tests:
`supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql`;
`apps/portal/lib/projects/workItems/modelBoundary.test.ts`;
`apps/portal/lib/projects/workItems/teamQueue.test.ts`;
`apps/portal/lib/projects/getProjectPageSnapshot.test.ts`;
`scripts/check-project-work-v2-readiness.mjs`;
`test/project-work-items-v2-migration.test.ts`;
`test/project-work-v2-readiness.test.ts`

### 2026-07-29 - Marketing Enquiry Reachability - One Public Conversion Contract

Date: 2026-07-29
Area: Public marketing conversion, enquiry reachability and retired start flows
Status: Promoted
Decision or mistake: The public site maintained a short contact form, embedded
service-page forms and an unlinked eight-step `/start` system. Email was
optional even though an invalid phone value could pass the non-empty check.
Embedded forms also defaulted to GET without JavaScript, and a rejected
attachment could be forgotten before submit.
Why it mattered: The same customer intent had competing routes and inconsistent
recovery. Personal information could enter a URL, a lead could be unreachable,
or a customer could believe a file was supplied when it was not.
Current guardrail: Keep `/contact` and embedded service-page forms as the one
public conversion system. Require project type, name, phone and email through
the shared client/server validator. Reuse one browser-generated submission UUID
across enhanced retries, assign each no-JavaScript POST a server UUID, and keep
any rejected attachment visibly blocking until the customer removes or
replaces it. Do not restore `/start` or `/start/explore` without an explicit
product decision and a replacement plan for the current conversion owner.
Promoted to: `docs/platform-workflow.md`;
`docs/marketing-ui-foundation.md`; `docs/security-privacy-quality.md`;
`docs/automation-email-audit.md`
Related docs/tests: `apps/marketing/lib/enquiryFormContract.test.ts`;
`apps/marketing/app/api/enquiry/route.test.ts`;
`playwright/marketing.contact.spec.ts`;
`playwright/marketing.seo-landing.spec.ts`

### 2026-07-29 - Portal Staging Auth Callback - Exchange One-Time Links Server-Side

Date: 2026-07-29
Area: Portal Staging Auth Callback
Status: Promoted
Decision or mistake: A controlled staging magic link redirected directly to a
protected Projects route. Portal middleware ran before the browser could
establish a fragment session, redirected to Login, and left access and refresh
tokens in the address bar. The login form then correctly rejected the user's
unrelated password because localhost was using a separate staging auth
project.
Why it mattered: The link appeared to be a password failure, exposed
short-lived bearer credentials in browser history and a screenshot, and still
did not create the cookie required by protected server routes.
Current guardrail: Generate only a hashed `magiclink` token for controlled
local/staging QA and exchange it at `/login/callback`. Require the session
cookie write to succeed, redirect only through the shared same-origin callback
normalizer, strip fragments, reject backslash/control-character redirects, and
apply `private, no-store` plus `Referrer-Policy: no-referrer`. Prove the
callback with a clean cookie jar, a subsequent protected GET, one individual
project, and rejected token replay. Never log, screenshot, or persist token
values.
Promoted to: `docs/environment-auth-supabase.md`;
`docs/staff-api-auth-contracts.md`; `docs/security-privacy-quality.md`
Related docs/tests:
`apps/portal/app/login/callback/route.test.ts`;
`apps/portal/lib/supabase/serverClient.test.ts`;
`apps/portal/lib/portalAccess.test.ts`;
`apps/portal/proxy.test.ts`

### 2026-07-29 - Project Work Queue And Triage - One Current Row, Reviewed Migration

Date: 2026-07-29
Area: V2 Project Work Queue, legacy Contacted review, and confirmation correction
Status: Promoted
Decision or mistake: A team work surface must not turn every pipeline record or personal reminder into a task. The approved replacement uses one server-composed current row per V2 project, keeps the Dashboard preview bounded, and keeps old Contacted records out until an admin reviews one project and records an explicit disposition.
Why it mattered: Bulk task creation or accepting classifier recommendations as truth would flood staff, invent outreach evidence, and make legacy compatibility fields a second authority. Deleting an incorrect confirmation would also hide why later state became inconsistent.
Current guardrail: Keep queue precedence, specialist selection, and effective responsibility server-owned. The Contacted classifier is read-only and omits linked customer contact fields; migration is optimistic, idempotent, one-project-at-a-time, and never seeds the new-lead cadence. Confirmation correction appends a retraction and visible review signal. Personal reminders remain separate, Site Visits stays hidden/manual and outside work items, and Project Overview visual direction remains governed by its separately approved handover.
Promoted to: `docs/project-work-items-and-follow-up.md`; `docs/project-work-items-technical-plan.md`; `docs/automation-email-audit.md`; `docs/staff-api-auth-contracts.md`; `docs/supabase-schema-map.md`; `docs/ui-foundation.md`
Related docs/tests: `supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql`; `apps/portal/lib/projects/workItems/teamQueue.test.ts`; `apps/portal/components/projects/workQueue/workQueuePresentation.test.ts`

### 2026-07-29 - Project Work Review Concurrency - Bind Commands To Reviewed Evidence

Date: 2026-07-29
Area: Confirmation correction reconciliation and legacy Contacted migration
Status: Promoted
Decision or mistake: A project-scoped correction review command resolved every open correction signal, so a stale browser could clear a newer signal. Legacy Contacted migration compared only `projects.updated_at` even though classification also depended on quote, invoice, design, schedule, Running Jobs, task, follow-up, and manual-action rows.
Why it mattered: Both commands could record a durable success for evidence the administrator had not actually reviewed.
Current guardrail: Queue repair rows carry the exact repair-signal ID and row version; reconciliation locks and resolves only that unchanged row. The Contacted classifier returns an opaque SHA-256 fingerprint from every project and related field used by its recommendation; migration recomputes it after the project lock and rejects mismatch before any V2 write. Keep the internal fingerprint helper ungranted. This remains an optimistic related-evidence boundary: closing the residual post-verification commit window requires shared project locking across every legacy evidence writer, not broad ad hoc table locks.
Promoted to: `docs/project-work-items-and-follow-up.md`; `docs/project-work-items-technical-plan.md`; `docs/staff-api-auth-contracts.md`; `docs/supabase-schema-map.md`; `docs/testing-and-qa.md`
Related docs/tests: `supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql`; `test/project-work-items-v2-work-queue-migration.test.ts`; `apps/portal/lib/projects/workItems/legacyTriage`

### 2026-07-30 - Project Overview V2 Handover - One Trusted Operational Surface

Date: 2026-07-30
Area: Project Overview product direction, information architecture, visual scope, and implementation ownership
Status: Promoted
Decision or mistake: The historical V1 and roadmap documents still directed agents toward calls, Site Visit tasks, four always-visible lead-to-quote workstream cards, legacy action selection, and a lead-to-quote-only page. The current repository now has a staging-verified Project Work V2 foundation, and the user approved a substantial Overview redesign using the current portal visual system.
Why it mattered: A fresh implementation task could follow the older higher-authority text, rebuild retired task concepts, add unavailable full-journey facts in the browser, or mistake approval to change composition for approval to re-theme the portal.
Current guardrail: Start with `project-command-centre-architecture.md` section `Approved Overview V2 Implementation Handover (READ FIRST)`. Keep one Project Work surface, email-only communication, Site Visits outside work items and normal navigation except for the approved active-V2 `site_visit` stage link, and strict design/commercial precedence. Keep completion as a separate manual fact with no automatic stage or Schedule side effect. Preserve the current portal tokens and components while changing route composition. Add deposit, Schedule/Running Jobs readiness, communication, timeline, or exception facts only through bounded specialist-owned server projections; otherwise omit them truthfully. The 2026-07-31 Project Work Portfolio Adoption entry supersedes this entry's former mixed-model requirement.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/project-command-centre-roadmap.md`; `docs/project-command-centre-v1.md`; `docs/project-work-items-and-follow-up.md`; `docs/project-work-items-technical-plan.md`; `docs/portal-ux-roadmap.md`; `docs/README.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/tabs/OverviewTab.tsx`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkCommandCard.tsx`; `apps/portal/lib/projects/workItems/types.ts`; `apps/portal/lib/projects/commandCentre/types.ts`; `playwright/portal.command-centre.spec.ts`

### 2026-07-30 - Overview V2 Bundle Exception - Keep Unrelated Debt Visible

Date: 2026-07-30
Area: Project Overview V2 completion and portal route bundle budgets
Status: Promoted
Decision or mistake: The completed Overview V2 slice passed its unchanged Project Detail budget, but the repository aggregate remained red on Contacts and Calculator. The same fail-closed analyser reproduced both overruns at approved baseline `060bea19`, proving that changing those routes or their ceilings was not part of the Overview implementation. The user accepted a narrow handoff exception rather than mixing unrelated optimization into the slice.
Why it mattered: Treating the aggregate failure as caused by Overview would expand scope and risk unrelated routes; silently raising limits or calling the whole bundle gate green would instead hide real performance debt.
Current guardrail: A scope-specific exception may unblock only the verified changed surface. Keep the Contacts and Calculator ceilings unchanged and retain the historical failure evidence; the later separately approved optimization must carry its own proof that both routes and the aggregate gate are green. Do not reuse this exception for a new regression or another route without fresh baseline and changed-route evidence.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/project-command-centre-roadmap.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/performance/portalBundleBudgets.ts`; `apps/portal/lib/performance/portalBundleBudgets.test.ts`; `npm run portal:bundle-budget`

### 2026-07-30 - Contacts/Calculator Bundle Owners - Remove Shared And Domain Eagerness

Date: 2026-07-30
Area: Portal Contacts/Calculator initial bundles, shared menus/popovers, and costing material configuration
Status: Promoted
Decision or mistake: Four bounded menu/popover consumers pulled the complete Radix dropdown package through the shared shell, while Calculator infill takeoff loaded the full costing configuration merely to resolve material stock lengths. The portal now owns one small portalled floating-panel primitive with explicit menu versus interactive-dialog semantics, and `@sp/costing` owns a material-only catalogue loader that the unchanged full config composes.
Why it mattered: Shared-shell weight reached every monitored staff route, and Calculator paid for manifest, rules, overhead, hardware, install-action, and BOM inputs before they were needed. A route-only lazy split could not remove the shared cost, while copying material data into the app would break the costing source of truth.
Current guardrail: Inspect every consumer before replacing a shared interaction primitive. Preserve outside/Escape dismissal, focus return, disabled items, arrow/Home/End/typeahead menu navigation, and dialog semantics for interactive form controls. Keep material merging package-owned; narrow takeoff defaults may load materials only, but explicit `CostingConfigV1` callers and full commercial calculations retain the existing contract and behavior. Verify focused behavior/costing parity, an isolated production build, independent route analysis, and every unchanged bundle ceiling.
Promoted to: `docs/ui-foundation.md`; `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`; `docs/portal-production-readiness.md`
Related docs/tests: `apps/portal/components/ui/PortalFloatingPanel.tsx`; `apps/portal/components/ui/PortalFloatingPanel.test.tsx`; `apps/portal/components/navigation/UserMenu.test.tsx`; `packages/costing/src/engine/materialsConfig.test.ts`; `packages/costing/src/engine/infillTakeoff.test.ts`; `npm run portal:bundle-budget`

### 2026-07-30 - Project Snapshot Cache Policy - Protect Every Response Path

Date: 2026-07-30
Area: Authenticated Project Detail snapshot responses
Status: Promoted
Decision or mistake: Authenticated production verification found that the complete Project Detail snapshot returned customer and project data with the framework's cacheable `public, max-age=0, must-revalidate` policy even though adjacent summary, Command Centre, and Work Queue reads were explicitly private.
Why it mattered: A successful authenticated read could be retained or reused by a browser or intermediary cache, weakening the access-ending and stale-data safeguards at the main Overview data boundary.
Current guardrail: `GET /api/projects/[projectId]/snapshot` must apply `Cache-Control: private, no-store` to success, authentication, validation, not-found, and server-failure responses. Cover those branches in the route test and verify the deployed header through an authenticated GET before production closure; do not infer safety from development behavior or framework defaults.
Promoted to: `docs/staff-api-auth-contracts.md`; `docs/portal-production-readiness.md`
Related docs/tests: `apps/portal/app/api/projects/[projectId]/snapshot/route.ts`; `apps/portal/app/api/projects/[projectId]/snapshot/route.test.ts`

### 2026-07-31 - Project Work Portfolio Adoption - Adoption Is A Release Gate

Date: 2026-07-31
Area: Project Work portfolio rollout, legacy task retirement, and operational visibility
Status: Promoted
Decision or mistake: The new-project-only V2 foundation was technically healthy, but almost the whole existing portfolio remained outside it. The empty Work Queue and missing Active/Waiting/Closed views therefore reflected non-adoption, not a usable operating system.
Why it mattered: Calling the foundation production-ready hid the practical release requirement: existing projects had no fresh review obligation, staff could not see lifecycle state across the portfolio, and unused legacy task/action concepts still occupied product and code surfaces.
Current guardrail: Roll out Project Work V2 to every existing project before deploying the dependent application. Use one fixed rollout timestamp so each eligible project behaves as if it just entered its current detailed stage; preserve any stronger existing V2 state/work and specialist-owned facts. Keep the nine detailed stages for workflow compatibility, group them into the five presentation phases Enquiry, Proposal, Confirmed, Delivery and Settled, and read Active/Waiting/Closed/Archived only from server-owned state. Retain retired legacy rows only as database audit/rollback evidence: normal application code must neither read nor write them, and shared-data QA remains GET/catalog-only.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/project-work-items-and-follow-up.md`; `docs/portal-production-readiness.md`; `docs/ui-foundation.md`; `docs/supabase-schema-map.md`; `docs/environment-auth-supabase.md`
Related docs/tests: `supabase/migrations/20260731000002_project_work_portfolio_rollout.sql`; `test/project-work-portfolio-rollout-migration.test.ts`; `apps/portal/lib/projects/projectJourney.test.ts`; `apps/portal/lib/projects/projectsIndexContract.test.ts`; `apps/portal/lib/projects/workItems/stateCounts.test.ts`

### 2026-07-31 - Project Work Rollout Durability - Keep Cohort And Delete Invariants Independent

Date: 2026-07-31
Area: Project Work rollout replay, retired work, and full-project deletion
Status: Promoted
Decision or mistake: Rollout replay was inferred from per-project events, so
an empty initial cohort or deletion of every original project erased the
sentinel. The generic work-item RPC could reopen a cancelled
`LEGACY_REVIEW`, while governed child triggers also rejected legitimate
foreign-key cascades from the existing confirmed admin project-delete route.
Why it mattered: A later migration replay could restart timing for post-rollout
projects, retired work could become operational again, and administrators
could no longer delete a V2 project.
Current guardrail: Store one-time cohort closure in a private
project-independent ledger and keep per-project events as detail, not as the
sentinel. Enforce terminal source identities at the database command boundary.
For guarded and append-only child rows, permit deletion only when the owning
project or sanctioned quote parent is already absent in the real cascade;
continue rejecting direct child deletion. Test an empty-cohort replay, direct
legacy `REOPEN`, and the route's quote-first/project-second deletion order with
a repair signal in disposable PostgreSQL.
Promoted to: `docs/project-work-items-and-follow-up.md`;
`docs/project-work-items-technical-plan.md`; `docs/supabase-schema-map.md`;
`docs/staff-api-auth-contracts.md`; `docs/testing-and-qa.md`
Related docs/tests:
`supabase/migrations/20260731000002_project_work_portfolio_rollout.sql`;
`test/project-work-portfolio-rollout-migration.test.ts`

### 2026-07-31 - Project Booklet Signed-Image CSP - Verify The Browser Display Boundary

Date: 2026-07-31
Area: Project booklet private image previews and portal Content Security Policy
Status: Promoted
Decision or mistake: Project-linked replacement images uploaded, normalized,
and persisted successfully, and their signed Storage URLs returned the expected
image bytes. The production portal CSP nevertheless omitted the Supabase host
from `img-src`, so the working local blob preview became a broken image when
the upload completed and the client switched to the saved URL.
Why it mattered: Storage health and a successful server-side URL fetch made the
workflow appear durable while the customer-facing browser preview failed at
the exact persistence handoff.
Current guardrail: Keep private booklet images in the governed Storage bucket,
retain `https://*.supabase.co` in the production portal `img-src` directive,
and cover that header contract with a focused test. Do not treat
`connect-src` permission or a successful upload as proof that an `<img>` can
render the saved asset.
Promoted to: `docs/design-booklets.md`
Related docs/tests: `apps/portal/next.config.ts`;
`apps/portal/next.config.test.ts`

### 2026-07-31 - Regional Marketing Tracking - NZ Default, Fail Closed Elsewhere

Date: 2026-07-31
Area: Marketing analytics, advertising attribution, privacy, and regional policy
Status: Promoted
Decision or mistake: The business approved a bannerless automatic tracking
default for NZ traffic while retaining the existing consent route everywhere
else.
Why it mattered: Reading geography in the root layout would make public pages
request-specific, while treating a regional default as an explicit user choice
would create inaccurate attribution evidence.
Current guardrail: Begin denied. Resolve only the Vercel country code through a
private/no-store first-party endpoint; enable both optional categories only for
exact `NZ`, and fail closed to the banner for every other or unknown result.
Keep a saved user choice authoritative, record `regional_default` versus
`user_choice`, and retain only the coarse policy in session storage so public
pages remain static and cacheable.
Promoted to: `docs/security-privacy-quality.md`;
`docs/automation-email-audit.md`
Related docs/tests: `apps/marketing/app/api/tracking-region/route.ts`;
`apps/marketing/components/ConsentProvider.tsx`;
`playwright/marketing.consent.spec.ts`

### 2026-07-31 - Project Overview Hierarchy - Present One Authority Once

Date: 2026-07-31
Area: Project Overview hierarchy, Project Work ranking, commercial ownership, and read recovery
Status: Promoted
Decision or mistake: The Overview repeated operational state and current-work counts beside the orientation owner, rendered a decorative empty secondary-work slot, explained ordinary work with browser-authored copy, exposed a deposit mutation from inferred stage permission, and could offer two Retry controls for one failed command-centre read.
Why it mattered: Repetition and equal-weight boxes weakened the single next action, browser explanation and stage inference blurred server/specialist authority, ambiguous confirmation labels looked like the external action itself, and duplicate recovery made one unavailable read look like two independent failures. Responsive containment alone did not make the real composition easy to scan.
Current guardrail: Require the server projection to supply an ordinary work-item ranking reason. Keep one strong route-owned action heading and status rail, with explicit labels that distinguish doing external work from recording its outcome. Keep the badge categorical and the exact timestamp in one Due field. Omit expected-empty secondary work and facts already owned by the shared header or context. Keep Overview commercial presentation read-only, show its exceptions before metrics, and quiet source/history content; lifecycle/payment commands stay with bounded specialist owners. One failed read owns one recovery action. Verify the real composition, long content, visual hierarchy, and containment at every standard width, using mobile-priority one-column order at and below 768 CSS pixels.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/projects/workItems/primaryAction.ts`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectWorkSection.tsx`; `apps/portal/components/projects/ProjectPage/tabs/OverviewTab.tsx`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectCurrentDesignCommercialCard.tsx`; `playwright/portal.command-centre.spec.ts`

### 2026-07-31 - Schedule Board Gestures - Commit What Staff Were Shown

Date: 2026-07-31
Area: Schedule Board drag/drop, command feedback, and job actions
Status: Promoted
Decision or mistake: Board targeting followed the dragged card centre, changed
layout with an insertion element, recomputed the destination on release, and
allowed a gesture to begin while another Schedule command could not commit.
The affected card also did not own the difference between pending, saved,
restored, and reconciled outcomes, while one flat menu exposed redundant
duration commands.
Why it mattered: A visually plausible drop could commit somewhere other than
the last cue, fail only after release, or appear to spring back without saying
whether the server saved it. That makes everyday planning feel non-authoritative
even when the V2 command contract is correct.
Current guardrail: Derive pointer targets from activation coordinates plus drag
delta, keep source geometry stable, render non-layout-shifting cues with the
exact queue position, and remeasure current geometry on release. Commit that
valid result, falling back to the last visible valid target only if final
collision data disappears. Resolve the zero-based command position in one pure
post-removal order owner shared by optimistic production handling and the
in-memory QA fixture. Reject no-op/restricted destinations and
disable move/action controls before an uncommittable gesture. Keep the
preview/save/rollback/reconciliation lifecycle out of the drag owner; present
only the action-required outcome under the newer silent-persistence guardrail.
Never infer persistence in the drag owner. Group job commands by intent and
keep duration shortcuts inside the duration dialog. Prove every insertion
position, representative rendered beginning/middle/end and cross-crew moves,
and all transaction states against the in-memory fixture, never shared data.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`;
`docs/portal-production-readiness.md`
Related docs/tests: `apps/portal/app/staff/schedule/useScheduleBoardDragController.ts`;
`apps/portal/app/staff/schedule/useScheduleBoardMutationNotice.ts`;
`apps/portal/app/staff/schedule/scheduleBoardOrder.ts`;
`apps/portal/app/staff/schedule/ScheduleBoardActions.tsx`;
`playwright/portal.schedule-board-confidence-fixture.spec.ts`

### 2026-07-31 - Pipeline Accountability - Put Owner And Next Attention At Triage Boundaries

Date: 2026-07-31
Area: Dashboard, Projects index, Work Queue, stage correction, and Project Overview
Status: Promoted
Decision or mistake: The detailed Projects list exposed journey, stage, and state but omitted Project Owner and the current server-ranked obligation. The full Work Queue had authoritative ranking but no practical search or owner/stage/urgency filters. Projects also allowed an inline stage edit whose consequences were not explicit.
Why it mattered: Staff could not reliably answer "who owns this, what happens next, and when?" without opening records one by one, and a seemingly small stage edit can replace stage-review work.
Current guardrail: Keep journey, detailed stage, and operational state as separate facts. Filter Project Owner before server pagination, enrich only the current Projects page from the authoritative queue owner, and filter the already-ranked full queue without reranking it. Every stage correction opens an explicit review step that names Project Work recalculation and customer-communication non-effects. Use shared human labels for owner, timing, responsibility, and closed outcome across Dashboard, Projects, Queue, and Overview.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/project-work-items-and-follow-up.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/staff-api-auth-contracts.md`; `docs/supabase-schema-map.md`
Related docs/tests: `apps/portal/lib/projects/serverProjectsIndex.ts`; `apps/portal/components/projects/ProjectStageCorrectionDialog.tsx`; `apps/portal/components/projects/workQueue/workQueueFilters.ts`; `test/project-work-portfolio-rollout-migration.test.ts`

### 2026-08-01 - Project Journey Action Eligibility - One Ranking Across Overview And Queue

Date: 2026-08-01
Area: Project Work ranking, Site Visit specialist routing, quote eligibility, Overview, and Work Queue
Status: Promoted
Decision or mistake: A current estimate caused `Prepare the quote` to outrank the real enquiry journey in New and Contacted projects, the generic `Open next step` CTA did not communicate or reliably reach its owning workflow, and Overview and Queue risked describing different next actions.
Why it mattered: Staff could be told to quote before the normal site visit, could not predict what the primary button would do, and could not trust the portfolio queue as the same operational authority shown inside a project.
Current guardrail: Derive recovery, stage-aware specialist action, and quote eligibility in one server adapter consumed by Overview and Work Queue. New keeps enquiry qualification/cadence primary; Contacted arranges a visit; Site Visit books/confirms and records completion; Quoting alone may create from a valid estimate. Treat an explicitly reasoned correction to Quoting as the no-visit decision. Supply explicit labels and canonical destinations in the server projection, recognize visit completion from durable confirmation/retraction history, and keep browser presenters unable to rerank or infer readiness.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/project-work-items-and-follow-up.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/schedule.md`; `docs/platform-workflow.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/projects/workItems/domainActionAdapters.ts`; `apps/portal/lib/projects/workItems/getProjectWorkDomainActions.ts`; `apps/portal/lib/projects/workItems/teamQueue.ts`; `apps/portal/lib/projects/workItems/confirmationFacts.ts`; `playwright/portal.project-journey-actions.spec.ts`; `playwright/portal.project-work-queue-fixture.spec.ts`

### 2026-08-01 - Project Phase Ownership Handoffs - Manual Stages, Explicit Accountability

Date: 2026-08-01
Area: Project Owner, Enquiry inactivity review, and phase handoffs
Status: Promoted
Decision or mistake: The single-owner model had a generic roster and no phase-specific accountability. It also had no safe all-activity boundary for identifying old Enquiry projects before a Lost closure.
Why it mattered: New leads could remain unassigned or move between staff without a clear owner, delivery handoff could be missed, and `projects.updated_at` alone could wrongly classify a project that had recent notes, email, work, commercial, or specialist activity.
Current guardrail: Assign active New/Contacted projects to Ellen at project creation or manual re-entry. Keep pipeline-stage changes manual; select the Proposal owner only after entering Proposal, then manually hand over and assign Dave before leaving Proposal. Keep the owner required through Delivery. Before any bulk `Lost - No response` command, run the read-only inactivity report, review future Waiting rows, and bind approval to its activity timestamp and evidence fingerprint. Exclude migration/system-only V2 events from evidence of staff/customer handling.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/platform-workflow.md`; `docs/automation-email-audit.md`; `docs/supabase-schema-map.md`; `docs/testing-and-qa.md`
Related docs/tests: `supabase/migrations/20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql`; `apps/portal/lib/projects/commandCentre/projectOwners.ts`; `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectOwnerControls.tsx`; `test/project-owner-handoff-migration.test.ts`; `npm run portal:enquiries:inactive`

### 2026-08-01 - Schedule Operational Presentation - One Scan Model Across Views

Date: 2026-08-01
Area: Schedule Board and Gantt operational presentation
Status: Promoted
Decision or mistake: Board lane attention counted only attached Schedule issues
while Gantt also counted required client updates and drift beyond flex. Cards,
crew rows and the phone agenda repeated qualified state in different visual
orders, and Gantt hid useful bar labels at widths that could support them.
Why it mattered: Staff could see different attention totals for the same
server-owned schedule, compare crew load only indirectly, and work harder to
distinguish routine state from a conflict or uncommitted plan.
Current guardrail: Keep commitment/flex wording, factual attention signals and
summed forecast-day scan aids in `ScheduleOperationalPresentation.ts`. Board
and Gantt must count the same server facts, name every attention reason without
colour alone, and never describe summed forecast days as a capacity limit.
Desktop Gantt keeps sticky crew identity and labels bars when legible; phone
and constrained 200%-zoom layouts use the same model in a single-column
read-only agenda with a clear route to Board for changes. Gantt retains the
route-level persistence status; Board follows the newer silent-persistence
guardrail and never implies confirmation before the command/reconciliation
lifecycle completes.
Promoted to: `docs/schedule.md`
Related docs/tests: `apps/portal/app/staff/schedule/ScheduleOperationalPresentation.ts`;
`apps/portal/app/staff/schedule/ScheduleBoardCards.tsx`;
`apps/portal/app/staff/schedule/ScheduleGanttModel.ts`;
`playwright/portal.schedule-board-confidence-fixture.spec.ts`

### 2026-08-01 - Schedule Board Silent Persistence - The Placed Card Is Normal Feedback

Date: 2026-08-01
Area: Schedule Board drag/drop persistence and reconciliation presentation
Status: Promoted
Decision or mistake: Board exposed checking, reviewing, saving, reconciling,
saved, verified, and restored banners around ordinary moves, and an ambiguous
command error rolled the optimistic card back before the authoritative read.
That could produce an old-position/new-position jump when the command had
actually committed.
Why it mattered: Staff judge Schedule by whether a job remains exactly where
they place it. Routine lifecycle narration and forward/back correction made a
server-safe command path look unreliable and duplicated the card, toast, and
route-level account of one event.
Current guardrail: On Board, the placed card is normal feedback. Keep routine
persistence state silent. Placement controls remain available through the
resource-scoped intent queue; only affected resources pause for unverifiable
recovery. A definitive rejection restores once and owns one inline Retry.
For a commit-ambiguous outcome, retain the optimistic placement while two
bounded authoritative reads allow a late commit to appear; if server truth
matches, remain silent, if it differs apply it once with Retry, and if the read
fails retain the placement with one Refresh action. Never infer saved state in
the browser, weaken affected-job preview/re-preview or confirmation, write to
the shared query cache as optimism, or surface a duplicate toast/page banner.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/schedule/scheduleBoardPlacementIntent.ts`;
`apps/portal/app/staff/schedule/useScheduleBoardMutationNotice.ts`;
`apps/portal/app/staff/schedule/ScheduleClient.test.tsx`;
`playwright/portal.schedule-board-confidence-fixture.spec.ts`

### 2026-08-01 - Schedule Board Intent Queue - Newer Placement Must Win

Date: 2026-08-01
Area: Schedule Board placement concurrency, response ordering, and scoped recovery
Status: Promoted
Decision or mistake: A page-wide pending flag serialized every Board write and
made all placement controls unavailable for the full API round trip. Simply
removing that flag would let an older response or rollback overwrite newer
visual intent.
Why it mattered: Staff could not continue planning while a save ran, and slow
responses made a correctly placed card feel provisional. Concurrent requests
without resource ownership would have traded that delay for lost ordering.
Current guardrail: Maintain a confirmed component-local base plus ordered
placement operations. Apply intent immediately; run disjoint crew resources
concurrently; serialize commands sharing a project or source/destination lane;
merge validated responses into confirmed state and replay every remaining
operation. Definitive failure removes only its operation. Ambiguous failure
keeps the operation and blocks only its resources until bounded read recovery.
Do not publish optimism as shared Schedule truth, bypass V2 commands, weaken
preview/re-preview/confirmation, or treat this as multi-staff revision safety.
Promoted to: `docs/schedule.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/app/staff/schedule/scheduleBoardCommandController.ts`;
`apps/portal/app/staff/schedule/ScheduleClient.test.tsx`;
`playwright/portal.schedule-board-confidence-fixture.spec.ts`

### 2026-08-01 - Marketing Project Switching - One Persistent Desktop Owner

Date: 2026-08-01
Area: Marketing project detail navigation, browser history, scroll ownership and hero media
Status: Promoted
Decision or mistake: Canonical project links were allowed to traverse the dynamic route normally, so the global reset and framework remount returned both the document and the rail's internal scroller to their starts. A URL-only History API change also risks stale route consumers or a later framework Back/Forward remount when private router state is copied incorrectly.
Why it mattered: The visible project image, rail position, filters and keyboard focus jumped even though the visitor was making a local portfolio selection. An early image swap could add a blank frame, while a purely local state change could break canonical URLs, metadata or native history.
Current guardrail: At desktop widths, keep canonical project-detail selection in one mounted client owner. Preserve real anchors and enhance only an unmodified primary click. Load the governed record and decode the exact responsive hero candidate before committing selection, History API state, runtime metadata and structured data. Preserve the hero viewport anchor when it intersects; otherwise align the new hero beneath the fixed header. Strip framework-private markers before calling its patched History API. Capture only explicitly marked project-detail Back/Forward entries before framework traversal, then synchronize pathname consumers without replacing the subtree. Keep rail DOM, filter state, internal scroll and focus intact. Mobile, direct loads, refresh, modified clicks and no-JavaScript access continue through canonical route documents.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/projects/ProjectDetailExperience.tsx`; `apps/marketing/lib/projectDetailNavigation.ts`; `playwright/marketing.projects-switching.spec.ts`

### 2026-08-01 - Project Lost Close Reasons - Structured Outcome Is Sufficient

Date: 2026-08-01
Area: Project operational state and remaining-work cancellation
Status: Promoted
Decision or mistake: Closing a project with a structured Lost outcome also
required staff to enter a separate cancellation reason, even though both fields
described the same business decision.
Why it mattered: The duplicate mandatory input slowed a routine state change
without adding reliable operational truth and made the close control feel more
burdensome than the business rule.
Current guardrail: Treat the selected structured Lost outcome as the business
reason. Keep one optional additional note for useful context and derive a
neutral outcome-specific cancellation explanation on the server for remaining
open work. Continue requiring explicit reasons for Waiting, Cancelled, and
Complete so this convenience does not weaken unrelated state safeguards.
Promoted to: `docs/project-work-items-and-follow-up.md`;
`docs/projects-contacts-estimates-calculator.md`
Related docs/tests:
`apps/portal/lib/projects/workItems/closePolicy.test.ts`;
`apps/portal/app/api/staff/v1/projects/[projectId]/state/commands/route.test.ts`;
`apps/portal/components/projects/ProjectPage/tabs/overview/useProjectWorkCommandController.test.tsx`

### 2026-08-01 - Project Close Journey - Explicit Outcomes And Revalidated Bulk Approval

Date: 2026-08-01
Area: Project Overview lifecycle controls, Work Queue, and stale Enquiry operations
Status: Promoted
Decision or mistake: Project closure was buried inside a generic operational-state form, mixed Waiting/Reopen/Close intent, hid the consequences, and allowed a read-only inactivity report to remain disconnected from a safe staff approval workflow.
Why it mattered: Staff could not quickly predict whether stage, current work, queue membership, or customer communication would change. A portfolio close based only on an earlier list could also act on projects whose evidence had changed.
Current guardrail: Use one visible Close Project entry point and a dedicated Lost/Cancelled/Complete dialog. Keep Lost structured with an optional note, require reasons for Cancelled and Complete, name the exact final action, preserve stage, cancel remaining work through the normal state command, remove committed closures from the current queue, and keep Reopen separate. For stale Enquiries, select none by default, show the exact evidence list, protect future Waiting rows, require a second confirmation, and atomically revalidate the original fingerprint plus current activity/source before any project closes. Drift rejects the whole batch. Production/shared-data closures always stop for explicit approval of the exact final list.
Promoted to: `docs/project-command-centre-architecture.md`; `docs/platform-workflow.md`; `docs/ui-foundation.md`; `docs/supabase-schema-map.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/components/projects/ProjectPage/tabs/overview/ProjectCloseDialog.tsx`; `apps/portal/app/staff/projects/work-queue/InactiveEnquiryReview.client.tsx`; `supabase/migrations/20260801000002_project_enquiry_bulk_close.sql`; `test/project-enquiry-bulk-close-migration.test.ts`; `playwright/portal.command-centre.spec.ts`; `playwright/portal.project-work-queue-fixture.spec.ts`

Release evidence: exact rollback rehearsals and schema-only applies passed in staging and production; production retained 1,149/1,149 state coverage and zero batch receipts. Protected staging and live production then passed authenticated GET-only Overview/Work Queue evidence, including opening Close Project without submitting. Production's first smoke correctly failed closed on the previously staging-only V3 Projects-index prerequisite; applying its already-reviewed exact read migration restored the route to `200` before release handoff.

### 2026-08-03 - Marketing Welcome Stacking - Shell Chrome Must Be Verified Visually

Date: 2026-08-03
Area: Marketing homepage welcome veil, shared header and progressive enhancement
Status: Promoted
Decision or mistake: The first cinematic welcome veil used a larger local
`z-index` than the fixed shared header, but its page ancestor established a lower
stacking context. DOM assertions confirmed that the veil itself contained no
header or controls while the rendered header remained visible above it.
Why it mattered: The production opening contradicted the approved headerless
welcome moment, and a structural browser test could not see the visual layering
failure. Hiding the header without considering no JavaScript would have fixed the
enhanced path by making the fallback navigation disappear permanently.
Current guardrail: For page-owned fullscreen presentation above shared shell
chrome, verify the actual first paint. Use a stable page-presence hook to hide,
disable and remove the shared header from visibility while the veil exists, then
restore it when the veil unmounts. Pair that rule with an explicit `<noscript>`
override so the page content and navigation remain available without hydration.
Promoted to: `docs/marketing-ui-foundation.md`;
`docs/sanctuary-project-led-visual-finder-homepage-prototype.md`;
`docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/styles/header.css`;
`apps/marketing/app/_home-project-finder/CinematicHero.tsx`;
`playwright/marketing.home-project-finder.spec.ts`

### 2026-08-03 - Marketing Cinematic Hero - Bounded Gestures And Mobile Art Direction

Date: 2026-08-03
Area: Marketing homepage hero interaction and mobile starting-point hierarchy
Status: Promoted
Decision or mistake: Continuous native scrolling made the pinned image-to-story
transition easy to enter but did not guarantee that the next deliberate gesture
would leave the story. The wide hero crop and image-led starting-point cards also
gave narrow screens less useful composition and weaker choice hierarchy.
Why it mattered: The opening felt staged without having a dependable second
step, while mobile visitors spent valuable viewport space on repeated imagery
instead of the three decisions.
Current guardrail: While the cinematic hero is active, consume at most one
forward wheel gesture, upward swipe or forward keyboard scroll per stage. On
touch devices, cancel native panning from the first forward movement rather
than waiting for the swipe threshold, keep the gesture consumed until touchend,
and suppress touch panning while the welcome veil is present. Then release input
at the finder boundary and leave reverse scrolling native. Use a
responsive priority picture for genuine mobile art direction. The second stage
must target the measured inner finder opening, centre it when its complete bounds
fit between the live header and visual viewport, and top-align it beneath the
header when they do not; never infer this landing from outer section padding.
Limit the
text-only, oversized ruled-row treatment to the primary mobile directions; keep
the nested professional chooser and wider layouts image-led. Verify rendered
current image source, two-gesture advancement, reduced motion, choice-image
visibility, landing top/bottom containment and horizontal containment.
Promoted to: `docs/marketing-ui-foundation.md`;
`docs/sanctuary-project-led-visual-finder-homepage-prototype.md`;
`docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/_home-project-finder/CinematicHero.tsx`;
`apps/marketing/app/_home-project-finder/projectFinderHomepage.module.css`;
`playwright/marketing.home-project-finder.spec.ts`

### 2026-08-03 - Simple Cover Pathway - Separate Conversion Intent From Acrylic SEO

Date: 2026-08-03
Area: Marketing homepage continuation, acrylic SEO ownership and residential conversion
Status: Promoted
Decision or mistake: The homepage Simple cover result was sent directly to the
indexable acrylic research page, forcing one route to act as both a technical
guide and a focused sales continuation. The initial pathway definition also
treated side blinds as evidence that a project belonged in Custom design.
Why it mattered: Visitors who had already selected a straightforward cover met
a comparison-led experience instead of a concise buying journey, while the
product boundary understated a useful option that remains compatible with a
fixed acrylic-roof pergola.
Current guardrail: Keep `/acrylic-roof-pergolas-auckland` as the sole indexable
acrylic research owner. Send Simple cover to the distinct, self-canonical,
noindex and sitemap-excluded `/simple-pergolas-auckland` conversion route.
Define simple by the clarity of the fixed roof and structural scope, not by the
absence of optional side blinds. Keep complex forms, mixed roofs, lined
ceilings, extensive integrated services and difficult connections as the
Custom design off-ramp. Preserve closed homepage context, enquiry attribution,
no-JavaScript access and claims governance on both routes.
Promoted to: `docs/marketing-ui-foundation.md`;
`docs/security-privacy-quality.md`;
`docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
Related docs/tests: `apps/marketing/app/simple-pergolas-auckland/**`;
`apps/marketing/lib/projectFinderContinuation.ts`;
`playwright/marketing.simple-pergolas.spec.ts`;
`playwright/marketing.home-project-finder.spec.ts`

### 2026-08-04 - Simple Cover Sales Page - Concise Image-Led Conversion Route

Date: 2026-08-04
Area: Simple Cover Sales Page
Status: Promoted
Decision or mistake: The first Simple cover conversion page repeated extended
guide copy, FAQs, process detail and governed project cards after a homepage
journey that had already established intent. That made a straightforward product
feel more complex and required a destination test to treat project evidence as a
universal contract. A future price configurator was also valuable, but adding an
unconnected price or inactive controls would create a false promise before the
portal costing boundary is designed.
Why it mattered: These visitors usually recognise a pitched acrylic pergola and
need fast confidence about fit, finish, options and likely next action. Repeating
research content weakens momentum. Pricing is a high-trust claim and must be
connected to governed costing inputs before it is presented as an estimate.
Current guardrail: Keep `/simple-pergolas-auckland` image-led and concise. Show
the approved Simple product-fit limits, Sanctuary finish, inclusions, acrylic and
blind choices, honest Simple-versus-Custom boundary, governed reviews and the
existing attributed enquiry form. Do not require project cards on this route.
Keep the fit section directly after the hero as the named future pricing
integration point, but implement the configurator in a separate costing-aware
change with no duplicated engine logic, synthetic price or inert controls.
Promoted to: `docs/marketing-ui-foundation.md`;
`docs/marketing-claims-register.md`;
`docs/landing-pages/sanctuary-pergola-guide-ecosystem-roadmap.md`
Related docs/tests: `apps/marketing/app/simple-pergolas-auckland/**`;
`playwright/marketing.simple-pergolas.spec.ts`;
`playwright/marketing.home-guided.spec.ts`

### 2026-08-04 - Simple Cover Responsive Containment - Content-Growing Hero Boundaries

Date: 2026-08-04
Area: Simple Cover Responsive Containment
Status: Promoted
Decision or mistake: The desktop hero combined a definite viewport height with
a smaller fixed minimum height. On short screens the grid items honoured their
content height while the hero itself stayed shorter, so the copy, media and
proof rail overlapped the following fit or saved-brief section. The existing
viewport tests asserted the hero boundary only at taller desktop sizes and did
not compare each section with its children or next sibling.
Why it mattered: A page could pass ordinary overflow and hero-height checks
while still allowing visible sections to occupy the same vertical space.
Current guardrail: Use a content-growing minimum-height hero rather than a
definite height. Preserve exact one-viewport ownership only when the content
fits. Test plain and attributed route states at breakpoint edges and short
heights, asserting child containment, contiguous section boundaries, proof-rail
text containment, header clearance, text spacing and horizontal overflow both
before and after anchor scrolling.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/simple-pergolas-auckland/simple-pergolas-auckland.module.css`;
`playwright/marketing.simple-pergolas.spec.ts`

### 2026-08-04 - Public Simple Cover Pricing - Published-Only Frozen Boundary

Date: 2026-08-04
Area: Public Simple Cover Pricing
Status: Promoted
Decision or mistake: The existing marketing estimator calculated against
package defaults while the portal could apply a mutable active configuration.
Reusing that path for a public calculator would make a polished price diverge
silently after a staff pricing publication. Returning an engine result directly
would also expose internal cost structure.
Why it mattered: Public price trust depends on configuration identity and exact
input parity, not merely sharing a formula package. The calculator,
autoresponder and saved enquiry must eventually be able to reference one frozen
calculation without exposing its internal evidence to the browser.
Current guardrail: Resolve only the singleton immutable published version on the
marketing server, then validate, hash and apply it through the server-only
`@sp/costing` boundary. Use the same fixed `SiteInputsV1`, canonical site engine
and package-owned customer-price sequence as portal parity tests. Keep complete
inputs, outputs, exact price and provenance in one server-side frozen result,
then return an explicit customer-safe allow-list. Missing or invalid publication
removes price. Keep marketing presentation independent from portal UI and
drawings, and leave the live autoresponder unchanged until production
publication and parity are confirmed.
Promoted to: `docs/costing-and-geometry.md`; `docs/target-architecture.md`;
`docs/marketing-ui-foundation.md`; `docs/testing-and-qa.md`
Related docs/tests: `packages/costing/src/server/publishedConfiguration.ts`;
`packages/costing/src/commercial/customerPricing.ts`;
`apps/marketing/lib/simpleCoverPricing.server.ts`;
`test/simple-cover-pricing-parity.test.ts`;
`playwright/marketing.simple-cover-calculator.spec.ts`

### 2026-08-04 - Marketing Pricing Version 1 - Shared Publication

Date: 2026-08-04
Area: Marketing calculator and autoresponder pricing
Status: Promoted
Decision or mistake: The public calculator used the published-only resolver, but the enquiry autoresponder still calculated against package defaults. That allowed the two public price paths to drift after a staff publication.
Why it mattered: A customer could receive an email estimate based on a different costing version from the price shown by the calculator, and the saved enquiry estimate lacked the immutable version provenance needed to explain the result.
Current guardrail: Both marketing price paths resolve the singleton immutable published configuration and pass that exact resolved config into `@sp/costing`. The autoresponder reuses one result for its budget and saved estimate and stores the published provenance. Missing publication remains non-blocking for enquiry intake but removes the base estimate; package defaults are never a fallback. The Simple cover input allow-list includes only fascia, facade and soffit connections.
Version 1 may publish an empty configuration diff only while the active source is still legacy-effective pricing, so the current portal totals can become the immutable shared baseline without an artificial price change. Later unchanged drafts remain blocked.
A first draft created under an older compatible package manifest must be reset to the complete active snapshot—including `baseManifestVersion` and all supported settings—before baseline publication; matching only representative prices is insufficient provenance.
Promoted to: `docs/costing-and-geometry.md`; `docs/automation-email-audit.md`
Related docs/tests: `apps/marketing/lib/publishedEnquiryPricingSnapshot.server.ts`; `apps/marketing/lib/enquiryPricingSnapshot.ts`; `apps/marketing/app/api/enquiry/route.test.ts`; `test/simple-cover-pricing-parity.test.ts`

### 2026-08-05 - Portal Browser Session Refresh - Transport Failure Is Not Sign-Out

Date: 2026-08-05
Area: Portal browser authentication and QA viewer reliability
Status: Promoted
Decision or mistake: The root auth provider awaited `supabase.auth.getSession()`
without handling a rejected token refresh. A temporary network failure therefore
escaped as an unhandled promise and Next development rendered a full-page
`Failed to fetch` overlay above an otherwise independent Design Booklet fixture.
Why it mattered: A transport failure looked like a broken booklet renderer and
could interrupt any portal page even when the server render already held a
truthful authenticated or unauthenticated state.
Current guardrail: Treat browser session-read failure as temporary
unavailability, not proof of sign-out. Preserve the server-known state, map only
an unresolved loading state to `lookup_failed`, and cover rejected `getSession()`
with a provider-level regression test. Successful reads still reconcile through
the normal role owner.
Promoted to: `docs/environment-auth-supabase.md`
Related docs/tests: `apps/portal/components/auth/PortalAuthProvider.tsx`;
`apps/portal/components/auth/PortalAuthProvider.test.tsx`

### 2026-08-05 - Costing Version 2 - Published Policy Gate

Date: 2026-08-05
Area: Costing Version 2
Status: Promoted
Decision or mistake: Version 2 Simple/Bespoke policy and engineering/consent allowances are package-owned and activated by the published base manifest, not by deployment alone.
Why it mattered: Deploying new package code while Version 1 was published could otherwise silently change portal, public calculator, and autoresponder prices. Approval allowances also risked receiving markup or discounts twice.
Current guardrail: Preserve older manifest semantics, make a fresh draft the explicit upgrade point, freeze requested/resolved classification and approval results with the estimate, and quote approval from that frozen direct-sell line with GST only.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/automation-email-audit.md`
Related docs/tests: `packages/costing/src/commercial/simpleRangePricing.test.ts`; `apps/portal/app/staff/calculator/calculatorPricingPreview.test.ts`; `apps/portal/lib/quotes/mapping.test.ts`

### 2026-08-05 - Costing Stock Optimisation - Whole Purchase Before Unit Rate

Date: 2026-08-05
Area: Costing BOM stock selection
Status: Promoted
Decision or mistake: Non-continuous extrusion groups selected the lowest cost per metre before evaluating the complete purchase. Thirteen 2.87m rafters therefore chose thirteen 4m bars because their unit rate was fractionally lower, even though seven 6m bars cost less and created far less waste.
Why it mattered: A negligible unit-rate difference added `$190.52 ex GST` and `10m` of waste to the 7.2m by 3m example, overstating true cost and customer price.
Current guardrail: For non-continuous cuts, compare whole-bar total purchase cost first, then waste, bar count and cost per metre. Preserve the splice-minimising rule for continuous runs and gate the corrected ranking by the published base manifest.
Promoted to: `docs/costing-and-geometry.md`
Related docs/tests: `packages/costing/src/engine/bom.test.ts`; `packages/costing/src/config/bom/bom_strategy_v1.1.json`

### 2026-08-05 - Costing Version 5 - Additional Simple Price Increase

Date: 2026-08-05
Area: Simple customer pricing
Status: Promoted
Decision or mistake: Version 5 increases the complete Version 4 Simple customer price by a further 10%. Because policy uplift is measured against the post-markup base, the frozen uplift moves from 10% to 21% (`1.10 × 1.10 = 1.21`) rather than to 20%.
Why it mattered: Adding ten percentage points would produce only a 9.09% increase on the live Version 4 price and would not match the approved commercial change.
Current guardrail: Gate the 21% uplift behind manifest `v2.2`, preserve published `v2.1` at 10%, and continue freezing the resolved uplift in every Simple costing output consumed by the portal, marketing calculator, autoresponder and quote handoff. Bespoke and approval allowances remain unchanged.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/automation-email-audit.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `packages/costing/src/commercial/simpleRangePricing.test.ts`; `apps/marketing/lib/simpleCoverPricing.server.test.ts`; `apps/portal/app/staff/calculator/calculatorPricingPreview.test.ts`

### 2026-08-05 - Costing Version 6 - Longer Rafter Labour Curve

Date: 2026-08-05
Area: Rafter labour takeoff
Status: Promoted
Decision or mistake: The initial proposed curve was lower than the administrator-edited Version 5 production curve and would have reduced long-rafter labour, contrary to the stated goal. Version 6 instead keeps the live 2m and 3m points at `0.50` and `1.00`, then raises the 4m, 5m and 6m points to `3.75`, `6.50` and `7.80`.
Why it mattered: Long rafters are materially harder to handle and install, but a projection threshold or app-local surcharge would create cliffs and pricing drift.
Current guardrail: Use actual package-derived sloped cut length and total installed rafter metres, interpolate between configuration points, preserve historical controls, and activate a changed curve only through a new published base manifest consumed by the portal, marketing calculator and autoresponder.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/automation-email-audit.md`; `docs/quotes-invoices-job-packs.md`
Related docs/tests: `packages/costing/src/engine/calculate.test.ts`; `packages/costing/src/controlConfig.test.ts`; `apps/marketing/lib/simpleCoverPricing.server.test.ts`; `apps/portal/app/staff/calculator/calculatorPricingPreview.test.ts`

### 2026-08-05 - Costing Version 4 - Mobilisation Does Not Create Mobilisation

Date: 2026-08-05
Area: Simple labour, overhead and customer pricing
Status: Promoted
Decision or mistake: Site-day rounding used fixed mobilisation and recurring daily-cycle hours to decide whether another day was required. A 1m by 1m Simple pergola therefore received two setup, pack-down and tidy cycles, while the old `$2,000` minimum overhead obscured the underlying threshold cliff.
Why it mattered: Mobilisation became a disproportionate share of the smallest jobs, and a recurring allowance could create the extra occurrence that it was intended only to price.
Current guardrail: From manifest `v2.1`, derive Simple site days and progressive overhead from productive installation actions only. Charge one-time mobilisation/demobilisation once and day-cycle actions once per resulting site day. Start Simple overhead at `$750 ex GST` for the first productive crew-day, add `$500` per additional productive crew-day pro-rated, and freeze the 10% Simple customer-price uplift in the output policy for every shared consumer. Preserve `v2.0` and earlier published behavior.
Promoted to: `docs/costing-and-geometry.md`; `docs/projects-contacts-estimates-calculator.md`; `docs/automation-email-audit.md`
Related docs/tests: `packages/costing/src/engine/simpleSiteDayPolicy.test.ts`; `packages/costing/src/commercial/simpleRangePricing.test.ts`; `apps/marketing/lib/simpleCoverPricing.server.test.ts`; `apps/portal/app/staff/calculator/calculatorPricingPreview.test.ts`; `apps/portal/lib/quotes/mapping.test.ts`

### 2026-08-06 - Simple Calculator Enquiry Handoff - Browser State Is Presentation, Not Price Authority

Date: 2026-08-06
Area: Marketing calculator, enquiry intake and autoresponder
Status: Promoted
Decision or mistake: The public Simple calculator displayed a governed price but its enquiry continuation had no CTA or durable calculation identity. Copying the displayed amount or hidden dimensions into the form would have made browser state a competing pricing source, while recalculating against whichever version was current at submission could change the customer's result.
Why it mattered: Sanctuary could lose the selected connection and level, save a fascia-assumption estimate that did not match the page, or allow a modified browser payload to influence staff pricing. Custom and pricing-unavailable states could also accidentally fall through to a generic estimate.
Current guardrail: A priced public result includes one compact authenticated encrypted reference containing validated inputs, immutable published provenance and a hash of the full frozen result. Enquiry intake decrypts it server-side, resolves that exact historical published version, recalculates through the shared frozen-calculation owner and requires a constant-time full-result hash match. Only that verified result may populate the linked amount, inputs, output and provenance; browser price/dimensions remain presentation only. Invalid, Custom, unavailable and unconfigured continuations still submit but cannot manufacture a fallback base price. References stay out of URLs, analytics, application logs, stored raw payload and email variables.
The priced continuation may say `Request a site measure` only when adjacent form and success copy make clear that Sanctuary reviews the request and confirms the next step; the CTA is not a booked visit or quote promise. Custom and unavailable continuations keep review wording.
Promoted to: `docs/costing-and-geometry.md`; `docs/security-privacy-quality.md`; `docs/automation-email-audit.md`; `docs/marketing-ui-foundation.md`
Related docs/tests: `apps/marketing/lib/simpleCoverCalculationRef.server.ts`; `apps/marketing/lib/publishedEnquiryPricingSnapshot.server.ts`; `apps/marketing/app/api/enquiry/route.test.ts`; `apps/marketing/app/acrylic-roof-pergolas-auckland/AcrylicPergolaEnquiryForm.test.tsx`

### 2026-08-06 - Contact Enquiry Pathways - Sales Intent Is Not Intake Audience

Date: 2026-08-06
Area: Marketing contact journey
Status: Promoted
Decision or mistake: The direct contact form previously asked for Residential, Commercial or Professional before distinguishing the two materially different residential sales journeys. Treating Simple, Custom and Commercial / Professional as three new intake types would have duplicated forms and broken the canonical audience contract.
Why it mattered: Simple needs the governed price-first handoff, Custom needs the existing project brief, and business enquiries need organisation, role, stage and scope. Pathway switching also risked carrying hidden branch-only values into the wrong enquiry.
Current guardrail: Keep pathway as closed presentation state over one form and one API. Resolve Simple and Custom to residential; require commercial or professional inside the combined business path. Retain shared project/contact values when switching, unmount branch-only fields, and build the submitted payload only from the active branch. Reuse the authenticated Simple calculation reference and keep personal/free-text state out of URLs and analytics.
Promoted to: `docs/marketing-ui-foundation.md`; `docs/security-privacy-quality.md`; `docs/automation-email-audit.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/marketing/app/contact/contactJourney.ts`; `apps/marketing/app/contact/ContactEnquiryForm.tsx`; `apps/marketing/lib/simpleCoverEnquiryPayload.ts`; `playwright/marketing.contact.spec.ts`

### 2026-08-06 - Design Booklet PDF Authority - Preview The Downloaded Drawing Artifact

Date: 2026-08-06
Area: Project Design Booklet drawing preview, media states and PDF delivery
Status: Superseded
Decision or mistake: Independently drawing the architectural sheet in responsive HTML and in `pdf-lib` left two implementations whose typography and image placement could drift. Project PDF requests also publish to one stable `exports/latest.pdf` path, so overlapping requests could let an older generation overwrite the newer artifact.
Why it mattered: Drawing sheets are technical customer documents; a preview that is merely similar to the download is not sufficient. Silent broken images and Toni fixture imagery in a new customer's booklet also made unfinished project state look complete.
Current guardrail: Superseded by the instant-preview entry below. Keep the on-demand PDF authoritative, invalidate its cache after draft or media-source changes, serialize generations before using the stable project export, and block download while project media is not durably saved. Every project-linked draft continues to use explicit neutral media sources, including older saved drafts; Toni defaults remain available only to standalone QA.
Promoted to: `docs/design-booklets.md`
Related docs/tests: `apps/portal/app/staff/design-booklets/useDesignBookletPdfArtifact.ts`; retired PDF.js drawing-preview component; `apps/portal/app/staff/design-booklets/DesignBookletPreviewImage.test.tsx`; `apps/portal/app/staff/design-booklets/DesignBookletProjectPersistence.test.tsx`; `playwright/portal.design-booklet-workbench.spec.ts`

### 2026-08-06 - Design Booklet Instant Preview - Keep Persistence Off The Paint Path

Date: 2026-08-06
Area: Project Design Booklet drawing preview and media persistence
Status: Promoted
Decision or mistake: The project replacement path compressed a selected file before creating its local preview URL, and selecting a drawing page generated the complete booklet PDF before the sheet could be inspected. Large drawings therefore appeared blank or loading for tens of seconds even though neither compression nor PDF publication was required to show the user's selection.
Why it mattered: Staff need immediate visual confirmation that the correct drawing was assigned. Coupling paint to compression, upload, server rendering, and PDF.js made a local editing action feel unreliable and increased the chance of repeated selections racing each other.
Current guardrail: Create the local object URL first and render drawing sheets from the shared landscape-A4 HTML geometry. Queue same-slot compression and uploads in selection order, let only the newest operation update UI, keep its local preview mounted until the returned signed source preloads, and then swap atomically. Keep saving and failure states explicit. Generate the authoritative PDF only on download, after all project media and draft changes are saved.
Promoted to: `docs/design-booklets.md`
Related docs/tests: `apps/portal/app/staff/design-booklets/useProjectDesignBookletController.ts`; `apps/portal/app/staff/design-booklets/DesignBookletPages.tsx`; `apps/portal/app/staff/design-booklets/DesignBookletProjectPersistence.test.tsx`; `playwright/portal.design-booklet-workbench.spec.ts`

### 2026-08-06 - Portal Routine Project Opening - Follow The Current Cache Owner

Date: 2026-08-06
Area: Projects Index, Project Detail opening and portal navigation preload
Status: Promoted
Decision or mistake: Routine project opening had regressed to a 1,329 ms useful-content p75 even though the Projects Index already held the required project/contact shell. The project cache helper still searched only retired canonical list keys, so it called the small summary API while the complete snapshot and Overview Command Centre also started. At the same time, visible sidebar links allowed framework viewport prefetch for unrelated routes.
Why it mattered: The delay looked like a database-structure problem, but the useful data was already in memory. Adding a new table, persisted browser database, or broader local-first model would have added complexity without addressing the broken cache handoff, while automatic sidebar prefetch spent server work on routes the user had not signalled.
Current guardrail: Read the freshest matching combined Projects-index response from the authenticated user's QueryClient before compatibility list keys. Keep the authenticated complete snapshot as background authority, preserve access-ending data hiding, and use the small summary API only when no known shell exists. Set sidebar links to `prefetch={false}` and start route/data preload only from hover, focus, pointer-down, or touch. Do not introduce persisted local project data or redesign the database until a remaining measured journey identifies that boundary as the owner.
Promoted to: `docs/projects-contacts-estimates-calculator.md`; `docs/portal-production-readiness.md`; `docs/testing-and-qa.md`
Related docs/tests: `apps/portal/lib/queries/projectCache.ts`; `apps/portal/lib/queries/projectCache.test.ts`; `apps/portal/components/navigation/PortalSidebarPanel.tsx`; `apps/portal/components/navigation/SidebarRail.tsx`; `playwright/portal.performance.spec.ts`
