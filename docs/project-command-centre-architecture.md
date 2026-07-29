# Project Operational Command Centre Architecture

Status: Current architecture plus the approved implementation handover for the next Project Overview redesign.

Current implementation baseline: `3cd6f9b5` on 2026-07-30.

Current product authority for the redesign: `## Approved Overview V2 Implementation Handover (READ FIRST)` below, together with `project-command-centre-vision.md` and the Project Work contract in `project-work-items-and-follow-up.md`.

`project-command-centre-v1.md` remains the historical V1 product baseline and the source of non-conflicting design/commercial precedence rules. This handover supersedes its call, Site Visit, legacy task-selection, four-card workstream, communication-channel, and lead-to-quote-only presentation rules.

## Approved Overview V2 Implementation Handover (READ FIRST)

Approved on 2026-07-30. No application code was changed by this handover.

This section is the single implementation contract for the next Project Overview slice. A future task must inspect the current rendered portal and current source owners before editing, but it must not reopen or silently reinterpret the locked decisions below.

### 1. Outcome

The Overview is the operational command centre for one project. Within seconds, a staff member should be able to identify the project and customer, understand the server-confirmed stage and operational state, see who owns the project, know the one Sanctuary action that should happen next and why, notice anything blocking progress, trust the exact current design and commercial source, and open the specialist workflow that owns deeper work.

The page summarises and routes. It does not become another project database, task manager, CRM, calculator, commercial editor, Schedule, Running Jobs sheet, or Design Workbench.

### 2. Authority And Superseded Rules

When an older command-centre document conflicts with this section, use this section:

| Older direction | Approved current direction |
| --- | --- |
| Call actions, call tasks, or calling as a fallback | Sanctuary lead and quote communication is email-only. Do not render or create a Call action. |
| Site Visit tasks, workstream actions, or normal navigation | Site Visits remains hidden and manual. It is not a project-work source, destination, or stage side effect. |
| Separate command card, task list, follow-up list, and manual-action surface | Every project has exactly one Project Work region. V2 uses one `ProjectWorkProjection`; legacy compatibility content may survive only as internal children of that same region. |
| Legacy `tasks`, `followup_tasks`, and `project_manual_actions` as the long-term selector | They are legacy-only compatibility sources. Do not expand them or copy them into V2. |
| Four always-visible lead-to-quote workstream cards | Use one compact journey/readiness region only when bounded server-owned evidence exists. Do not create another editable status system. |
| Overview ending at quote outcome | The composition must remain useful through deposit, scheduling, installation, invoicing, completion, and settlement, while omitting facts that do not yet have a trustworthy summary contract. |
| A new visual language, marketing tokens, olive accent, or a portal-wide restyle | Use the current staff portal visual system. The page composition may change substantially; the portal system may not. |
| A complete timeline assembled from whatever records happen to load | Current notes and activity remain a bounded recent-history preview until a normalized meaningful-activity contract exists. |

The following existing decisions remain authoritative:

- The default staff label is `Overview`; the internal URL/tab key remains `activity`.
- The two-row project header, global search, tab registry, lazy workflow boundaries, optimistic tab navigation, and access-ending cache clearing remain. The header is sticky above the mobile breakpoint and returns to normal document flow on mobile.
- The current quote/design resolver remains strict: newest accepted quote, then sent, then draft, then eligible estimate; declined is never current.
- A quote may use only its exact source estimate and stored GST-inclusive total. Missing source or price stays unavailable; no estimate fallback or repricing is allowed.
- Project stage, project operational state, and project work are three different facts.
- New V2 projects use Project Work. Unmarked projects remain legacy until individually reviewed. The Overview must support both without pretending they are the same model.
- Workbench, Calculator, Commercial, Job Packs, Schedule V2, and Running Jobs keep their existing source-of-truth and mutation boundaries.

### 3. Observed Current Baseline

At baseline the rendered Overview has:

- one fixed two-row project header with project name, stage, global search, owner, actions, and tabs;
- three equal top cards for Status & Details, Current Design & Commercial, and Project Command;
- a lower Activity card and a separate Tasks card;
- for V2 projects, the same `ProjectWorkProjection` rendered once in `ProjectWorkCommandCard` and again in `ProjectWorkItemsSidebar`;
- a dormant empty Stage 3 workstreams slot;
- trustworthy current-design and price precedence; and
- truthful command-centre pending, refreshing, stale, mismatch, failure, and access-ending states.

The duplicated V2 command/task presentation is the clearest current information-architecture problem. The current visual system itself is not a defect and must be preserved.

The current server payload does not yet provide complete, bounded summaries for deposit invoices, scheduling readiness, active installation, or a normalized meaningful timeline. Those facts must not be inferred in browser presentation code or from pipeline stage alone.

### 4. Locked Product Decisions

- Communication is email-only. The existing autoresponder is automatic; the first personal email, one follow-up, and close review are manual. The approved quote follow-up is also manual.
- Do not add an inbox integration, automatic personal send, automatic closure, or call fallback.
- If the Site Visit completion fact is needed, record only the existing bounded manual `SITE_VISIT_COMPLETED` confirmation. It creates no task, stage change, or Schedule side effect.
- V2 shows one primary action derived on the server. It includes the server-provided reason or ranking basis, effective owner, and due state when relevant. Specialist and recovery candidates also show their provided prerequisite/context, expected result, and owning destination. Work-item presentation must not invent fields that its server contract does not supply.
- Blocked work is an exception, not an enabled primary action.
- Other open V2 work may appear inside the same Project Work region. It must not become a second Tasks card.
- Personal Dashboard reminders remain separate and private.
- Archive is administrative housekeeping, not a synonym for Lost. Waiting, Closed, and Archived remain explicit operational states.
- Completing work never independently sends an email, changes stage, accepts a quote, records payment, mutates Design, confirms Schedule, or completes Running Jobs.
- No old Contacted project is automatically migrated, tasked, closed, or archived.
- Missing or incomplete evidence is labelled `Not recorded`, `Unknown`, or `Unavailable`; it is never converted into Ready.

### 5. Approved Information Architecture

The page uses stable regions in this order:

| Order | Region | Persistence | Content and boundary |
| ---: | --- | --- | --- |
| 1 | Project header | Always | Existing project name, stage badge, global search, Project Owner summary, project actions, and tabs. Do not add a third header row. |
| 2 | Orientation band | Always | Customer name and email, site address, region, reference, operational state, server freshness, and one Edit details entry point. Do not repeat the project title or owner controls. |
| 3 | Critical exception strip | Conditional | Render only from a bounded server-owned exception summary that names the problem, owner, and safe recovery. Until that contract exists, keep blocked work and commercial warnings inside their owning above-the-fold regions. Do not claim a global all-clear until all required sources are complete. |
| 4 | Command grid | Always | One Project Work region for either V2 or clearly labelled legacy compatibility, plus one Current Design & Commercial region. These are the desktop above-the-fold working surfaces. |
| 5 | Journey and readiness | Conditional by evidence and lifecycle | Compact journey position plus bounded milestone/readiness facts. Pipeline stage is position only, never a readiness score or percentage. |
| 6 | Recent notes and events | Always when the complete snapshot is ready | User-authored notes and the bounded current activity preview. Call it `Recent notes and events`, not a complete timeline. |
| 7 | History and administration | Progressive disclosure | Project Work command history, resolved issues, confirmation correction, legacy migration context, and other admin-only controls. |

#### Above The Fold

Wide and compact desktop must show without scrolling where normal viewport height permits:

- identity and current stage;
- customer/site orientation;
- operational state and freshness;
- any critical blocker;
- one primary Project Work action with owner, reason, and due state;
- exact current design/commercial source, GST-inclusive value or explicit unavailable state, and quote status; and
- direct links to the owning specialist workflow.

#### Persistent Versus Conditional

Persistent:

- header;
- orientation;
- one Project Work region;
- current design and commercial summary; and
- recent notes/events once the full snapshot is ready.

Conditional:

- exceptions;
- deposit invoice status;
- quote expiry or delivery recovery;
- design readiness;
- schedule readiness;
- scheduled/running/completed installation state;
- other lifecycle milestones; and
- admin history/correction controls.

A conditional region is omitted when it is irrelevant. When it is relevant but the source is missing or failed, show a truthful unavailable state. Do not render empty decorative cards.

#### Specialist Links

- Customer/detail editing stays with the current project/contact detail mutation owner.
- Design summary links to the exact selected estimate or Design Workbench only when that link is valid.
- Calculator owns estimate editing and price calculation.
- Commercial owns quotes, acceptance, invoices, PDFs, emails, and public-token effects.
- Job Packs remains conditional.
- Schedule Board/Gantt owns install planning and actual timing.
- Running Jobs owns its current operational fields.
- Site Visits is never a normal Overview link.

#### Remove From The Overview Composition

- Any separate Tasks card. Legacy stage-task presentation may survive only as an internal child of the one Project Work region.
- The empty Stage 3 workstreams slot.
- Duplicate Project Owner management.
- Repeated project title or stage content that adds no new meaning.
- Call actions or categories.
- Site Visit links/tasks.
- Generic green health claims.
- Multiple equal-weight warning cards.
- Full quote, invoice, estimate, Schedule, Running Jobs, Workbench, or Job Pack detail.

### 6. Layout Maps

Desktop:

```text
+------------------------------------------------------------------------------+
| EXISTING PROJECT HEADER - sticky above mobile, normal flow on mobile          |
| Project + stage | search | owner | actions                                   |
| Overview | Calculator | Commercial | Job Packs                               |
+------------------------------------------------------------------------------+
| ORIENTATION: customer/email | site/region | reference | state/freshness       |
+------------------------------------------------------------------------------+
| CRITICAL EXCEPTION - only when active                                         |
+------------------------------------------+-----------------------------------+
| PROJECT WORK                             | CURRENT DESIGN & COMMERCIAL       |
| One next action, why, owner, due         | Exact source/version/status      |
| Blocker/recovery or server-confirmed CTA | GST-inclusive value/unavailable  |
| Other open work in the same surface      | Links to owning workflow         |
+------------------------------------------+-----------------------------------+
| JOURNEY / READINESS - only supported, relevant canonical facts               |
+------------------------------------------------------+-----------------------+
| RECENT NOTES AND EVENTS                              | CONTEXT / HISTORY     |
+------------------------------------------------------+-----------------------+
```

Mobile priority:

```text
Existing two-row project header in normal mobile flow, with scroll-contained tabs
Critical exception, when present
Project Work
Current Design & Commercial
Orientation/details
Journey/readiness, when relevant
Recent notes and events
History/admin disclosure
```

At 390px, project identity, stage, blocker, primary action, owner, due state, current commercial source, value/unavailable state, and quote status must remain visible without an accordion. Secondary history and administration may use disclosure.

### 7. Interaction And Trust Contract

| State | Required behavior |
| --- | --- |
| Pending direct load | Render the usable project frame; skeleton only unknown Overview regions. |
| Summary | Show known authenticated identity/context and mark incomplete regions Updating. No Project Work mutation. |
| Fresh | Show server-confirmed facts and permitted commands. |
| Background refresh | Retain known facts, show Updating, and pause Project Work commands. |
| Refresh failed with cached data | Retain last known facts, show when refresh failed, provide Retry, and keep commands paused. |
| Work-model mismatch | Show no legacy or V2 mutation controls; refresh the shared Project Work reads. |
| Initial command-centre failure | Show a bounded failure state with Retry; never fake empty design, work, or exceptions. |
| `401`/`403`/`404` | Hide protected cached information through the existing unavailable boundary. |
| Command pending | Disable duplicate submission and keep the stable command identity for an ambiguous retry. |
| Command committed | Say `Saved on the server` only after the committed response. Patch/invalidate through the shared Project Work cache owner. |
| Command outcome unknown | Do not invent success. Retry the same intent/command ID or require reconciliation. |
| Waiting | Show wake date, reason, actor where available, and the review action; omit ordinary current work until wake-up. |
| Closed | Show the explicit outcome and reopening path where permitted; retain the genuine pipeline stage reached. |
| Archived | Show administrative archive state and no active Project Work. |

Stage correction remains a deliberate stage command. Work completion and confirmations do not silently change stage.

Status semantics:

- orange: primary action, selected/current, or real attention;
- amber: normal overdue, warning, or review;
- red: explicit critical, blocking, failed, or conflicted state;
- neutral: unavailable, unknown, historical, or informational;
- green: only a specific durable success, never general project health.

Status must never rely on colour alone. Disabled controls require nearby explanatory copy.

### 8. Current And Future Fact Ownership

| Overview fact | Current owner | Redesign rule |
| --- | --- | --- |
| Project identity/contact/site/reference/stage | `ProjectPageSnapshot` and project detail mutation owner | Recompose; do not add a second browser store. |
| Project type | No current Project Overview contract | Omit until an owning source and bounded projection are explicitly approved; do not infer it from a name, estimate, enquiry, or stage. |
| Project operational state and V2 work | `ProjectWorkProjection` from the server command-centre/work-item owners | One Project Work surface only. |
| Legacy project work | Existing legacy command/task owners | Compatibility presentation only, composed inside the same single Project Work region; do not expand. |
| Project Owner | Existing project-owner contract | Summarise in header; one management entry point only. |
| Current design, estimate, quote, price, warnings | `ProjectCommandCentreCurrentDesign` and strict server resolver | Preserve exact precedence and source identity. |
| Notes | Existing note route/snapshot owner | Keep authoring and permissions unchanged. |
| Current activity preview | Existing snapshot activity | Label as bounded recent events, not complete history. |
| Deposit/invoice position | Commercial/invoice domain | Add only through a bounded server summary contract. |
| Schedule readiness and scheduled/running state | Schedule V2 | Add only through a bounded server adapter; never infer from stage. |
| Materials/roofing readiness | Running Jobs V2 metadata | Add only through a bounded server adapter. |
| Meaningful communication/timeline | Future normalized read model | Do not assemble opportunistically in the browser. |
| Exceptions | Owning domain facts plus a bounded server resolver | Specific/actionable only; no manual health field. A future global strip requires a bounded summary containing stable key/category, severity, title, reason, owner label, recovery label/link, and generated time. |

The first redesign slice must not claim deposit, readiness, running-job, communication, or global exception truth unless the implementation also adds and contract-tests the named bounded server projection. Existing `ProjectWorkPrimaryCandidate` work-item variants may show only their title, server-ranked due state, effective owner, responsibility/source, and supplied blocker facts; expected results and links belong only to candidate variants that provide them. Layout may reserve no visible placeholder for future facts.

### 9. Visual Contract

Use the current staff portal system from `ui-foundation.md`:

- Inter for operational text and Barlow Condensed for selected headings/major metrics.
- Warm off-white surfaces, black structure, and orange for primary/current/attention meaning.
- Square panels, 2px control radii, 4px overlays, one-pixel rules, and no decorative shadows.
- Four-pixel spacing foundation and current standard/compact density.
- Foundation controls, alerts, data states, status badges, operational grids, and page-header owners where they fit.
- Lucide outline icons, native semantics, visible focus, reduced motion, and 44px mobile/coarse-pointer targets.

The redesign should feel like one calm ruled operational sheet, not a collection of equal generic cards. Route-owned composition is expected. Do not change shared tokens or primitives unless a genuine second current consumer justifies it. Do not import the marketing UI system.

### 10. Code Ownership And Required Extraction

Keep:

- `ProjectSnapshotPageClient.tsx`: summary/full/unavailable page state.
- `ProjectPageFrame.tsx`, `ProjectHeader.tsx`, and tab owners: two-row shell and navigation, sticky above mobile and in normal flow on mobile.
- `OverviewTab.tsx`: command-centre query, snapshot/command state coordination, access-ending reporting, and composition only.
- `ProjectStatusDetailsCard.tsx` plus `useProjectDetailsDraft`: local-first details and retry ownership.
- `ProjectCurrentDesignCommercialCard.tsx`: strict read-only design/commercial presentation.
- `lib/projects/commandCentre/**`: command-centre selection/read contract.
- `lib/projects/workItems/**`: V2 state, work, ranking, commands, confirmation, queue, and mixed-model boundaries.
- `projectWorkCache.ts`: the only cross-surface Project Work cache patch/invalidation owner.

Do not grow:

- `ProjectWorkCommandCard.tsx` (610 lines at baseline);
- `ProjectPrimaryActionCard.tsx`;
- `ProjectTasksSidebar.client.tsx`;
- `pipelineDefinition.ts`;
- command-centre route handlers; or
- specialist Commercial, Schedule, Running Jobs, Workbench, or Calculator hotspots.

Before adding redesigned Project Work behavior, extract:

```text
tabs/overview/
  ProjectOverviewLayout.tsx          route-owned composition
  ProjectOrientationBand.tsx         identity/context presentation
  ProjectWorkSection.tsx             one V2 work surface
  ProjectWorkList.tsx                secondary open/blocked rows inside that surface
  useProjectWorkCommandController.ts browser command, retry, and feedback orchestration
```

Names may vary if current code suggests a clearer boundary, but responsibilities may not be recombined in `OverviewTab.tsx` or the 610-line command card. The V2 sidebar presentation should be retired after consumer proof. `ProjectTasksSidebar.client.tsx` may remain for unmarked legacy projects only as an internal child of `ProjectWorkSection`; it must not retain a second outer Tasks card.

Presentation adapters may format and arrange server facts. They may not rank work, derive commercial truth, infer readiness, issue lifecycle transitions, call Supabase directly, or become a second project-state source.

### 11. Largest Safe First Implementation Slice

Implement one coherent, visibly complete Overview composition using the current trusted contracts:

1. Extract the V2 Project Work controller and presentation owners.
2. Replace the V2 Project Command plus Tasks duplication with one Project Work region.
3. Recompose the current project details, Project Work, and design/commercial facts into the approved orientation/command layout.
4. Compose the clearly labelled legacy command/stage-task compatibility path inside the same single Project Work region without expanding legacy logic.
5. Remove the empty workstreams slot and obsolete V2 presentation after zero-consumer proof.
6. Make pending, summary, refreshing, stale, mismatch, failure, Waiting, Closed, and Archived states fit the new hierarchy.
7. Update the command-centre fixture and authenticated read-only smoke for the new composition.
8. Update current-state owner docs after behavior changes.

This slice does not require a database migration and must not add one merely for presentation. A bounded additive server read-model extension is allowed only when it is necessary for an approved visible fact, uses the specialist owner, has contract tests, and does not introduce a new write or side effect. Deposit, Schedule/Running Jobs readiness, normalized timeline, and complete exception aggregation should remain separate follow-on contracts unless they meet that standard inside the reviewed scope.

### 12. Explicit Non-Goals

- No portal-wide restyle or shared-token replacement.
- No marketing UI imports.
- No automatic customer email or external side effect.
- No call workflow.
- No Site Visit navigation, task, or scheduling integration.
- No Contacted bulk migration.
- No automatic stage movement, closure, archive, payment, quote acceptance, or Schedule command.
- No new manually editable health, progress, workstream, readiness, or commercial status.
- No detailed specialist editor embedded in Overview.
- No workbench, drawings, geometry, or costing-input change.
- No service-role path reachable from browser code.
- No production/shared customer-data mutation during QA.

### 13. Workbench And Costing Boundary

- Applicable Design Workbench legacy-cull row: N/A.
- Removes or builds on Workbench legacy: neither.
- Explicit Workbench build-on approval required: no.
- Phase 2 costing-input dependency: none.
- Consumer rule: Overview may display the current server-selected design summary and link to the separate Workbench route. It must not read, synthesize, reprice, or change Workbench geometry or Calculator inputs.

### 14. Acceptance And Verification

Product acceptance:

1. An unfamiliar project can be oriented within seconds: project/customer/site, stage, operational state/freshness, owner, one next action and reason, blocker, exact current design/commercial source, and specialist destination.
2. Every project has exactly one Project Work region and no separate Tasks card. V2 has no duplicate action controls; legacy compatibility children remain within that one region.
3. No Call or Site Visit action, task, or normal navigation link appears.
4. Pipeline stage is not presented as readiness, percentage complete, or proof of a downstream artifact.
5. Missing evidence never appears ready, sent, paid, scheduled, or complete.
6. Design and commercial precedence remains byte-for-byte equivalent at the owning resolver boundary.
7. Legacy and V2 projects remain visibly and behaviorally truthful.
8. Every controlled success reflects a committed server result and duplicate-submit/replay safety remains.

Required fixture states:

- new lead with first email due and missing email;
- follow-up due and close review;
- normal, critical, overdue, today, future, and blocked work;
- no owner, no action, Waiting, Closed, Archived, and correction review;
- legacy and V2 models;
- estimate-only, sent, accepted, declined, newer unrelated estimate, missing source, and unavailable price;
- pending, summary, refreshing, stale cached data, model mismatch, initial error, retry, `401`, `403`, and `404`;
- deposit, Schedule, Running Jobs, communication, or full exception states only if their new bounded server projections are implemented.

Required automated and manual checks:

- focused pure selector, route, cache, controller, and component tests;
- `npm run test:portal:project-work`;
- `npm run test:portal:projects`;
- command-centre fixture/browser coverage;
- authenticated read-only project smoke against a positively identified non-production environment;
- responsive visual regression at 1440x1000, 1280x800, 1024x900, 768x1024, and 390x844;
- 200% zoom, one document scrollbar, no document overflow, no cropped action, and no hidden lifecycle control;
- keyboard order, visible focus, heading/landmark structure, status not dependent on colour, reduced motion, and 44px touch targets;
- portal TypeScript, lint, production build, unchanged Project Detail bundle/performance budgets, docs impact/guard, architecture changed, and changed-file/dead-code checks where applicable; and
- explicit proof that Overview QA sent no email and changed no quote, invoice, payment, Schedule, Running Jobs, public token, or customer artifact.

### 15. Fresh-Task Start Prompt

```text
Implement the approved Project Overview redesign.

Treat `docs/project-command-centre-architecture.md` section
`Approved Overview V2 Implementation Handover (READ FIRST)` as the canonical
product and implementation contract. Read its linked owner docs, inspect the
current rendered authenticated Overview and current source consumers before
editing, and preserve the current portal visual system.

Implement the largest safe first slice defined in the handover: one Project
Work surface, approved orientation/command composition, truthful mixed-model
and loading/recovery states, and the required ownership extractions. Do not
introduce calls, Site Visit work, browser-derived lifecycle/commercial truth,
specialist side effects, workbench/costing changes, or production data writes.
Preserve unrelated worktree changes and verify the full responsive,
accessibility, contract, bundle, and authenticated read-only smoke matrix.
```

## How To Use This Document

- Read the approved handover above first. Use later sections for current repository history and non-conflicting implementation detail.
- Read the later-stage communication, migration, and risk sections before proposing Stage 3 or later work.
- Treat repository evidence as current-state fact. Treat the handover as the approved product delta over the historical V1 specification.
- Do not add a later specialist workflow by extending browser presentation. Add a bounded server-owned summary contract or omit it.
- Keep this document, the roadmap, the project current-state doc, and testing commands aligned when implementation changes.

## 1. Repository baseline and commit

The Stage 0 assessment used clean repository head `ea1641c6c6647d22603d07b9f980cc3a1dad95fc`. Stage 1 was committed locally as `8770198f`; that commit is the Stage 2 baseline.

The project-page architecture at the baseline already had the performance and trust foundations Stage 1 needed:

- A user-owned TanStack Query client.
- An immediate current-user project/contact summary followed by the complete project snapshot.
- Five truthful project read states.
- Access-ending data hiding.
- A synchronous project frame and lazy workflow tabs.
- Responsive desktop rails and a narrow-layout `Details` tab.
- Existing Project Detail bundle and authenticated performance budgets.

Workbench Gate 0 is `N/A`. Stage 1 does not touch drawings, geometry, workbench routes, or costing inputs. It removes the unsafe current-design fallback rather than building on it, and it has no Phase 2 workbench/cost-engine dependency.

## 2. Repository documentation and change routing

Stage 1 is owned by the staff-workflow-spine lane in `target-architecture.md`.

Required owner and guardrail docs are:

- `project-command-centre-v1.md`: historical product baseline plus retained non-conflicting design/commercial rules.
- `project-command-centre-roadmap.md`: programme stage and evidence.
- This document: repository ownership and implementation contract.
- `projects-contacts-estimates-calculator.md`: project snapshot, project page, estimate locks, and current Overview behavior.
- `staff-api-auth-contracts.md`: staff API and auth-bound client behavior.
- `quotes-invoices-job-packs.md`: quote history, totals, and status ownership.
- `portal-ux-roadmap.md`: staff-facing command-centre priority.
- `portal-production-readiness.md`: readiness and budget status.
- `testing-and-qa.md`: commands, fixtures, browser, bundle, smoke, and performance gates.
- `maintainability-principles.md`, `file-decomposition-and-ownership.md`, and `code-retirement-and-bloat-control.md`: small-owner and retirement rules.

`change-routing.md` routes `apps/portal/lib/projects/**`, staff project APIs, Project Page components, and command-centre fixtures/tests to this owner set.

## 3. Existing project-page architecture

The route `apps/portal/app/staff/projects/[projectId]/page.tsx` keeps the internal default tab key `activity`. The staff-facing label is `Overview`; preserving the key keeps URLs, old links, lazy-loading boundaries, and tests compatible.

`ProjectSnapshotPageClient.tsx` owns the project summary/full-snapshot transition and page-level unavailable state. `ProjectPageFrame.tsx` owns the two-row project header and full-width body; the header is sticky above the mobile breakpoint and returns to normal flow on mobile. `ProjectTabNavigation.tsx` owns the shared tab registry, grouped active state, URL normalization, and intent preloading; `ProjectMainTabs.tsx` owns active workflow rendering. `CommercialTab.tsx` owns Quotes/Invoices composition and quote Edit/Preview URL state without taking over either subview's side effects. The retired rail, panel-slot, drag, resize, collapsible-header, and narrow-layout Details-tab systems have no runtime compatibility path.

The Overview implementation is a lazy module at `tabs/OverviewTab.tsx`. It is allowed to render during the snapshot `summary` state because its commercial read is independent; snapshot-owned notes and tasks remain explicitly updating until the full snapshot is ready.

The current staff-facing lazy navigation owners are:

- Overview (`activity` key), the default project workflow.
- Calculator (`estimates` key), embedded with fixed project context.
- Commercial (`quotes` navigation key), with separate Quotes and Invoices inner views retaining the `quotes` and `invoices` keys.
- Job Packs (`job-packs` key) when available.

The project Emails UI is retired; `tab=emails` normalizes to Overview. Durable email audit data, preview APIs, snapshot fields, and quote/invoice delivery side effects are unchanged. The separate Design Workbench route remains available from the project header.

Project details and stage correction are part of Overview at every width. The pipeline is no longer rendered in the header.

Stage 1 did not add logic to the specialist tabs. The later shell Slice 2 retired the legacy Estimates/Configurator owner in favour of the authoritative Calculator and deliberately left the critical `QuotesTab.tsx` mutation boundary unchanged.

## 4. Existing current-design resolution

The baseline browser bar used three client queries and `lib/projects/currentDesign/resolve.ts`. Its quote source lookup could silently fall back to an active or latest unrelated estimate, and quote price formatting could fall back to estimate price. Those behaviors conflicted with the approved V1 contract.

Stage 1 retires that resolver, summarizer, and bar. The server-owned selector now lives in `apps/portal/lib/projects/commandCentre/resolve.ts` and applies:

1. Newest created `ACCEPTED` quote.
2. Else newest created `SENT` quote.
3. Else newest created `DRAFT` quote.
4. Else newest unlocked draft estimate.
5. Else newest non-archived draft estimate.
6. Else no current design.

Additional strict rules:

- `DECLINED` is historical and never current.
- A selected quote may use only `source_estimate_version_id`.
- A missing exact source produces `Source design unavailable`; no other estimate is borrowed.
- A selected quote may use only its raw stored `total_inc_gst_cents`.
- A missing or invalid quote total produces `Price unavailable`; no estimate price is borrowed.
- Estimate price uses the canonical quote-handoff projection from the selected saved estimate snapshot. The read does not invoke costing, and never treats `summary_json.total` as customer price.
- A blocked or zero-value estimate projection produces `Price unavailable` plus `estimate_price_unavailable`; partial line totals are not presented as a customer total.
- Accepted quote plus a newer unrelated estimate keeps the accepted quote authoritative and reports the newer estimate separately.
- Multiple accepted quotes select the newest deterministically and emit an integrity warning.

## 5. Estimate and quote domain ownership

Estimate persistence and locks remain owned by `apps/portal/lib/estimates`. Quote status, totals, send history, public tokens, PDFs, email, invoice creation, and job-pack effects remain owned by `apps/portal/lib/quotes` and their specialist routes.

The command centre is a read model only. It reuses `computeEstimateEditability()` to identify the unlocked active draft boundary. It does not change statuses, editability, line items, totals, tokens, source metadata, artifacts, or downstream records.

Estimate design labels reuse quote module formatters. Costing freshness is derived only from stored `outputs.pricing_sync_state`:

- `current` -> Current costing.
- `stale` -> Stored costing may be stale.
- Other retained output -> Stored costing.
- No usable output -> Costing unavailable.

No costing engine or costing input layer is imported.

## 6. Existing project snapshot

`ProjectPageSnapshot` remains the complete project-detail read model for identity, pipeline, tasks, notes, activity, and emails. Stage 1 does not extend it.

The snapshot remains shared with project routes and workbench route context, so putting commercial version arrays or estimate inputs into it would enlarge unrelated reads and weaken its ownership. The command-centre endpoint is therefore a separate read model and query key.

The Overview composes:

- Header/project identity from the existing project snapshot/summary.
- Customer/site/reference context from the existing project snapshot/summary.
- Current design and commercial facts from the dedicated command-centre response.
- Both V2 work regions from the command-centre response's single Project Work projection when present; the snapshot is not a second V2 work authority.
- Notes and stage tasks only after the full project snapshot is ready.

Placeholder task/note arrays never produce a false empty state.

## 7. Canonical ownership

Stage 2 owns one project assignment in `project_owner_assignments`, keyed by project. The approved owner roster is Jordan, JP, Joe, and Bruce. A row stores only the stable business key; no row means unassigned. This project owner carries the project from `new` through `deposit` and remains visible afterward when assigned.

The forward migration prefers an existing active Sales assignment, then Design and Estimating, only when the legacy assignee name maps to the approved roster. Unknown identities remain unassigned. The legacy three-role table is retained read-only as rollback evidence and has no current writer or read-model consumer.

## 8. Existing next-action and task systems

The project snapshot already resolves stage tasks from `pipelineDefinition.ts` and `project_task_checks`. Those tasks remain visible in Overview and retain their existing mutation owner.

Stage 2 candidates are open `tasks`, open `followup_tasks`, and `project_manual_actions`. The pure `actionResolver.ts` owns precedence, owner fallback, Auckland due state, explicit selection, conflict detection, and the 25-option bounded response. Stage checks, personal reminders, generic statuses, undated automatic candidates, approvals, and blockers are excluded.

`project_primary_action_selections` records explicit focus and the confirmed outranking hash. `project_action_controls` records critical state and lifetime reschedule count. `project_command_audit` is append-only command history. `project_action_versions` is trigger-maintained optimistic concurrency support for the complete candidate set. Source tasks remain canonical records rather than copied action rows.

## 9. Existing communication and activity sources

Stage 1 retains project notes and existing snapshot activity capability. It does not merge quote events, outbox events, calls, messages, site visits, audits, or tasks into a new timeline.

Current sources remain independently owned:

- Project notes by the project-note domain and note routes.
- Email summaries/outbox activity by the project snapshot and email domains.
- Quote send history by `quote_send_logs` and quote domain helpers.
- Site visits, audit events, automation, and task history by their existing domains.

Stage 4 owns the future normalized communication/timeline read model.

## 10. Existing auth and permissions

Command-centre reads and owner/action commands use `requireStaffContext()` and the returned auth-bound Supabase client. RLS plus security-definer command checks remain authoritative. The compatibility projection is refreshed inside the transactional action command; no browser or service-role caller has execute permission on its helper, and the retired Details writer or current task routes cannot write the legacy project columns.

The response is `private, no-store`, carries standard request diagnostics, returns `401`/`403` from the auth helper, returns `404` only when the authenticated project read is absent, and returns a stable `500` when a bounded subordinate read fails.

No raw tokens, token hashes, internal true cost, margin, service-role data, or oversized estimate inputs leave the endpoint.

## 11. Existing loading, caching, and local-first model

The query key is `qk.projects.commandCentre(host, projectId)`. It uses the authenticated user's existing QueryClient and a one-day garbage-collection window. It is stale immediately and refetches whenever Overview remounts, so a return from Calculator or Commercial refreshes current commercial state without adding cache logic to those critical workflows.

Accepted Project Work commands use `projectWorkCache.ts` to patch the matching command-centre, snapshot, and summary projection and invalidate project, Work Queue, and Dashboard reads together. Project Work controls are enabled only while their owning reads are fresh and the snapshot and command-centre agree on `legacy` versus `v2`; cached background-refresh, refresh-failed, or model-mismatch facts stay visible without either legacy or V2 mutation controls.

Overview states are explicit:

- Pending without data: updating current design and commercial state.
- Fresh: current server response.
- Background refresh: cached facts remain visible with an updating marker and Project Work commands paused.
- Refresh failure with cached data: last known facts remain visible with Retry and Project Work commands paused.
- Initial network/server failure: failure state with Retry, never a fake no-design state.
- `401`/`403`/`404`: no cached commercial or project data is rendered.

On access-ending command-centre responses, the child reports to `ProjectSnapshotPageClient`, which removes the current user's project, estimate, quote, invoice, and job-pack query families for the host and switches the page to unavailable. Local-first mutation ownership is unchanged.

## 12. Existing tests and performance gates

Stage 1 must retain:

- `npm run test:portal:projects`.
- Repository typecheck and lint.
- Portal production build.
- `npm run portal:bundle-budget` with unchanged Project Detail allowance.
- `npm run test:portal:browser` for fixture-safe visual/state coverage.
- Authenticated smoke and performance when credentials and compatible data are available.
- Docs and architecture changed guards.

The existing authenticated Project Detail journey already measures the active tab workflow before background completion. No latency or bundle budget may be raised to accommodate Stage 1.

## 13. Canonical V1 data ownership map

| V1 fact | Canonical Stage 1 source | Stage 1 behavior |
| --- | --- | --- |
| Project identity | Existing project summary/snapshot | Reuse header and customer context |
| Current quote | `quote_versions` | Strict accepted > sent > draft |
| Quote source design | `source_estimate_version_id` | Exact match only |
| Quote customer price | Raw `total_inc_gst_cents` | No fallback |
| Estimate selection | `estimates` plus quote-derived lock state | Active eligible draft, then latest non-archived |
| Estimate customer price | Canonical quote-handoff projection from saved `inputs` + `outputs` | No live costing; blocked projections are unavailable |
| Design labels | Selected estimate `inputs.modules` | Largest module plus additional count |
| Costing freshness | Selected estimate `outputs.pricing_sync_state` | Stored status only |
| Quote delivery | Selected quote status and send logs | Accepted/sent/failed/draft only |
| Notes and tasks | Existing project snapshot | Render only when full snapshot is ready |
| Specialist links | Existing tab routes | Read-only navigation |
| Project owner | `project_owner_assignments` | One approved owner, required/missing state, and admin edit permission |
| Primary action sources | Open `tasks`, `followup_tasks`, `project_manual_actions` | Referenced and selected, never copied |
| Selection/conflict | `project_primary_action_selections` plus selector hashes | Explicit selection with later outranking conflict |
| Critical/reschedule state | `project_action_controls` | Explicit red reason and lifetime count |
| Command history | `project_command_audit` | Latest 20 in project read model |

Later-stage workstreams, communications, normalized timeline, blockers, and approvals remain intentionally absent.

## 14. Required read models

Stage 1 adds `ProjectCommandCentreResponse` under `lib/projects/commandCentre/types.ts`.

The payload contains:

- `projectId` and `generatedAt`.
- One `currentDesign` object.
- Selected source and status presentation.
- Design availability and bounded design summary.
- Price source and nullable stored total.
- Selected estimate identity/version/saved/lock/source/costing facts.
- Selected quote identity/reference/version/status/timestamps/delivery facts.
- Optional newer unrelated estimate.
- Optional declined historical outcome when no quote is current.
- Explicit integrity/source/price warnings.
- Existing specialist-tab links.
- Three normalized owner summaries and permissions.
- Current primary action or explicit no-action state.
- Up to 25 sorted candidate options plus total/revision.
- Explicit-selection conflict and allowed operations.
- Latest 20 command-audit events and project exception flags.

The server performs one auth-bound `projects` relation read for estimate metadata, quote versions, and send logs, followed by one exact selected-estimate detail read for `inputs`, `outputs`, and costing trace fields. Only the bounded normalized response reaches the browser.

## 15. Required migrations

Stage 1 required no migration. Stage 2 is owned by two ordered forward migrations:

- `20260720_000008_project_command_centre_stage2.sql` promotes task/follow-up setup into migration truth; adds the initial owner/action/control/selection/audit tables, updated timestamps, focused indexes, select-only portal RLS, transactional idempotent commands, active-user backfills, and compatibility projection columns. Source-table triggers maintain candidate versions and the Schedule projection; Design Package source-task changes use a bounded staff RPC after direct authenticated source writes are revoked.
- `20260721_000001_project_command_single_owner.sql` replaces the initial three-role owner contract with one Project Owner from the approved Jordan/JP/Joe/Bruce roster, performs the deterministic legacy backfill, and replaces the owner command.

Both migrations must pass the executable environment smoke before Stage 2 can move from Yellow to complete.

Legacy `projects.next_action*` and `follow_up_date` are a read-only Schedule compatibility projection. The transactional action command alone refreshes them through an internal helper. Project Details, dashboard controls, stage-task completion, and AutomationRunner no longer own those fields.

## 16. Required API boundaries

Implemented Stage 1 route:

`GET /api/staff/v1/projects/[projectId]/command-centre`

Contract:

- Staff-authenticated, auth-bound Supabase only.
- `private, no-store`.
- Stable small JSON response.
- Project access determined by the parent project row under RLS.
- Any errored bounded relationship or selected-detail read fails the complete response.
- No side effects.
- No direct browser Supabase reads.

Existing summary and complete snapshot routes remain unchanged and independent.

Stage 2 extends that GET response with `operations` and adds:

- `GET /api/staff/v1/staff-directory`.
- `PATCH /api/staff/v1/projects/[projectId]/command-centre/owners`.
- `POST /api/staff/v1/projects/[projectId]/command-centre/primary-action/commands`.
- `GET /api/staff/v1/dashboard/project-exceptions`.

Every response, including errors, is `private, no-store`. Mutations require UUID command IDs and optimistic versions, are transactional/idempotent, and return committed success with `refreshRequired` rather than inviting a retry after a post-commit refresh failure.

## 17. Component reuse plan

Implemented component boundaries:

- `OverviewTab.tsx`: query, mixed-model/state orchestration, access-ending reporting, and current responsive composition. The approved redesign keeps it as an orchestrator and moves composition into the named route-owned children in the handover.
- `overview/ProjectCurrentDesignCommercialCard.tsx`: read-only selected design/commercial presentation.
- `overview/ProjectStatusDetailsCard.tsx`: pipeline stage, stage correction, and user-owned local-first project details.
- Existing `ProjectNotesPanel.client.tsx`: project note/activity column.
- Existing `ProjectTasksSidebar.client.tsx`: legacy-only stage-task action card.
- Existing `ProjectWorkCommandCard.tsx` plus `ProjectWorkItemsSidebar.client.tsx`: current duplicated V2 presentation over one projection; the approved redesign replaces them with one extracted Project Work surface.
- Project Header: project identity, owner, actions, and the horizontally scrollable tab navigation.
- `overview/ProjectPrimaryActionCard.tsx`: legacy owner/action/conflict/manual/history compatibility controls; do not expand it for V2.
- Project Header: always-visible single Project Owner summary.
- Dashboard Project Action Queue: read-only bounded projection of canonical primary actions, filtered by Today, Next 7 days, or All due. Personal reminders remain independent. The legacy project-exceptions endpoint remains available as a bounded diagnostic read, but the staff Dashboard no longer queries or renders it because missing owner/action adoption across historical projects is not a useful home-page workload.

The `activity` module loader now resolves to `OverviewTab`; the old Activity component, three-query snapshot bar, fallback resolver, and summarizer are removed after consumer search proved no remaining code consumer.

## 18. Test and fixture strategy

Focused coverage includes:

- Pure selector precedence and exact-source tests.
- Raw server normalization, quote/estimate price ownership, blocked-estimate pricing, delivery, freshness, missing-source, and complete-read failure tests.
- Auth route response and failure tests.
- Query preloading and preserved activity-key tab tests.
- Overview pending/fresh/stale/failure/access-ending tests.
- Page-level protected cache clearing tests.
- Current design/commercial component tests.
- Environment-gated, customer-data-free fixture route.
- Browser matrix for the nine Stage 1 commercial scenarios plus primary, empty, conflict, critical, and undated Stage 2 states at 1600, 1366, 1024, 768, and 390 px.
- 390px no-horizontal-overflow and always-visible action facts.

Fixture route: `/qa/project-command-centre-fixture?scenario=...&action=...`, enabled only by `ENABLE_PORTAL_QA_FIXTURES=1`.

Stage 1 verification completed on 2026-07-20:

- Strict selector, loader, and route tests passed.
- Overview, card, preload, fixture, proxy/shell, and access-ending cache-clear tests passed.
- `npm run test:portal:projects` passed 322 tests across 61 files.
- `npm run test:portal:browser` passed 15 checks with one conditional workbench test skipped; all nine command-centre scenarios and the 390px check passed.
- `npm run test:portal:performance:fixture` passed nine checks.
- Repository typecheck and lint passed, including docs, package, cache, brand, and mojibake guards.
- An isolated production build generated 64 pages while the user's pre-existing port-3001 dev server remained untouched.
- The unchanged bundle-budget assertions passed against that isolated build. Project Detail measured 662.8 KiB raw / 190.5 KiB gzip initial and 1,771.0 KiB raw / 371.5 KiB gzip lazy; its largest lazy entry measured 1,526.9 KiB raw / 308.7 KiB gzip.
- Authenticated smoke and production performance were not rerun because `PORTAL_TEST_EMAIL` and `PORTAL_TEST_PASSWORD` were unavailable.

## 19. Historical PR Sequence And Current Next Slice

- Stage 0: repository assessment and architecture record. Complete.
- Stage 1A: strict selector, normalized read model, staff API, and query. Implemented.
- Stage 1B: Overview label/module, commercial card, customer context, truthful states, and legacy retirement. Implemented.
- Stage 1C: deterministic unit/route/component/browser fixtures, docs, bundle/performance verification. Complete in the working tree.
- Stage 2A-C: present in the current repository; executable migration smoke plus authenticated real-project quality gates remain before completion.
- Historical Stage 3: four lead-to-quote workstream cards. Superseded as the next step by the approved Overview V2 handover; do not implement it directly.
- Stage 4: communications and timeline. Not started.
- Stage 5: exceptions and approvals. Not started.
- Stage 6: final responsive QA, pilot, and rollout. Not started.
- Current next slice: `## Approved Overview V2 Implementation Handover (READ FIRST)`, section 11.

## 20. Technical risks

- Nested PostgREST relationship naming or RLS drift can fail the complete read. Route tests and live authenticated smoke remain required.
- Historical rows may contain invalid timestamps, missing totals, or missing source records. Normalization must preserve unknown/unavailable rather than fabricate data.
- Quote/estimate mutations do not directly update the new endpoint cache. Immediate staleness plus remount/focus refetch is the Stage 1 coherence mechanism; do not add logic to the critical tabs casually.
- Estimate inputs can be large. The metadata-first plus exact-detail read prevents all historical inputs reaching the browser or being fetched for every estimate.
- Multiple accepted quotes are an integrity issue. Stage 1 warns but does not mutate history.
- A future stage could accidentally duplicate task, communication, or issue truth in the command-centre payload. Extend only through an approved owner contract.

## 21. Confirmed implementation decisions

- Keep `activity` as the internal/default tab key and label it `Overview`.
- Keep `ProjectPageSnapshot` unchanged.
- Use a separate server-owned command-centre read model and query key.
- Use auth-bound staff access only.
- Apply accepted > sent > draft and exact source only.
- Never select declined quotes.
- Never fall back from quote source or quote price to an estimate.
- Read stored estimate summary and freshness; do not run costing.
- Keep existing project identity, notes, tasks, lazy boundaries, and compatible URL keys while consolidating details and stage correction into Overview.
- Clear protected user-owned caches on command-centre access-ending responses.
- Remove the legacy fallback resolver/summarizer/bar after zero-consumer proof.
- Make no Stage 1 migration or specialist mutation change.
- Keep task/follow-up rows canonical; manual rows represent only genuinely manual actions.
- Keep stage checks and personal dashboard reminders outside selection.
- Store staff dates at 5:00pm Auckland and preserve source timestamps.
- Keep overdue amber; critical is explicit and reasoned.
- Keep the compatibility projection service-owned and non-authoritative.
- The command-centre Stage 2 kept specialist workflows, workbench/drawings, geometry, and costing inputs unchanged. The later project-shell Slice 2 replaced only the obsolete project Estimates/Configurator composition with the authoritative Calculator; it did not change costing inputs or the separate Workbench route.

## 22. Unresolved technical questions

No unresolved question blocks Stage 1.

Later-stage questions remain deliberately open:

- Structured inbound/outbound communication schema.
- Timeline normalization and pagination.
- Workstream override and progress storage.
- Blocker/approval ownership, visibility, and audit.
- Stage 6 pilot cohort, measurement, and rollback procedure.

Those questions require their owning stage and must not be answered implicitly by extending Stage 1.

## 23. Repository evidence index

- Route/default key: `apps/portal/app/staff/projects/[projectId]/page.tsx`.
- Summary/full page state: `ProjectSnapshotPageClient.tsx`.
- Frame/shell/responsive details: `ProjectPageFrame.tsx`, `ProjectPageShell.tsx`.
- Tab labels/lazy module/preload: `ProjectMainTabs.tsx`, `projectTabModules.tsx`, `projectTabDataPreload.ts`.
- Snapshot owner: `lib/projects/getProjectPageSnapshot.ts`, `lib/projects/types.ts`.
- Command domain: `lib/projects/commandCentre/**`.
- Staff API: `app/api/staff/v1/projects/[projectId]/command-centre/**`.
- Query key/options: `lib/queries/keys.ts`, `lib/queries/projects.ts`.
- Overview components: `components/projects/ProjectPage/tabs/OverviewTab.tsx`, `tabs/overview/**`.
- Estimate lock truth: `lib/estimates/editability.ts`.
- Quote/estimate stored schemas: `supabase/portal_schema.sql` and ordered migrations.
- Fixture/browser evidence: `app/qa/project-command-centre-fixture/**`, `playwright/portal.command-centre.spec.ts`.

## 24. Update rules

- Update this document when the command-centre response, resolver precedence, auth boundary, cache behavior, component ownership, fixture matrix, or stage sequence changes.
- Update `project-command-centre-roadmap.md` whenever stage status or completion evidence changes.
- Update `projects-contacts-estimates-calculator.md` for current project-page behavior.
- Update `staff-api-auth-contracts.md` when route/auth/response contracts change.
- Update `testing-and-qa.md` when commands or browser fixtures change.
- Update `portal-production-readiness.md` and `portal-ux-roadmap.md` when readiness or UX status changes.
- Do not copy the full V1 product specification into this architecture record.
- Do not mark a later stage complete from partial or Stage 1 evidence.
