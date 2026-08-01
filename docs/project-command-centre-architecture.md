# Project Operational Command Centre Architecture

Status: Current architecture. The Overview V2 composition and portfolio-wide Project Work rollout are deployed to production. Staging is isolated on its own Supabase project and passed authenticated read-only verification. Production database/application postflight and the authenticated GET-only production browser proof are complete. The earlier narrow Contacts/Calculator bundle exception remains historical and did not raise either ceiling.

Approved handover baseline: `060bea19` on 2026-07-30.

Current product authority for the redesign: `## Approved Overview V2 Implementation Handover (READ FIRST)` below, together with `project-command-centre-vision.md` and the Project Work contract in `project-work-items-and-follow-up.md`.

`project-command-centre-v1.md` remains the historical V1 product baseline and the source of non-conflicting design/commercial precedence rules. This handover supersedes its call, Site Visit, legacy task-selection, four-card workstream, communication-channel, and lead-to-quote-only presentation rules.

## Approved Overview V2 Implementation Handover (READ FIRST)

Approved on 2026-07-30. The handover commit itself changed no application code.

This section is the single implementation contract for the current Project Overview slice. Any implementation or follow-up task must inspect the current rendered portal and current source owners before editing, but it must not reopen or silently reinterpret the locked decisions below.

### 1. Outcome

The Overview is the operational command centre for one project. Within seconds, a staff member should be able to identify the project and customer, understand the server-confirmed stage and operational state, see who owns the project, know the one Sanctuary action that should happen next and why, notice anything blocking progress, trust the exact current design and commercial source, and open the specialist workflow that owns deeper work.

The page summarises and routes. It does not become another project database, task manager, CRM, calculator, commercial editor, Schedule, Running Jobs sheet, or Design Workbench.

### 2. Authority And Superseded Rules

When an older command-centre document conflicts with this section, use this section:

| Older direction | Approved current direction |
| --- | --- |
| Call actions, call tasks, or calling as a fallback | Sanctuary lead and quote communication is email-only. Do not render or create a Call action. |
| Site Visit tasks, workstream actions, or global navigation | Site Visits remains hidden from global navigation and outside the work-item table. The server may rank one bounded specialist action for `Contacted` or `Site Visit` and route it to the retained Schedule-owned booking/confirmation workflow; that action never changes stage or Schedule state by itself. |
| Separate command card, task list, follow-up list, and manual-action surface | Every project has exactly one Project Work region backed by one `ProjectWorkProjection`. |
| Legacy `tasks`, `followup_tasks`, `project_task_checks`, and `project_manual_actions` as the long-term selector | They are retired audit/rollback evidence. They have no normal UI, reader, writer, or selection role after the portfolio rollout. |
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
- Every project uses Project Work after the portfolio migration. Existing projects enter V2 as though they had just entered their stored stage at the single rollout timestamp; no browser code derives that state.
- Workbench, Calculator, Commercial, Job Packs, Schedule V2, and Running Jobs keep their existing source-of-truth and mutation boundaries.

### 3. Observed Approved-Handover Baseline

At approved commit `060bea19`, the rendered Overview had:

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
- The shared server ranking is journey-aware: `New` keeps enquiry qualification/cadence work primary; `Contacted` ranks arranging a site visit; `Site Visit` ranks booking, confirmation, and completion until the durable `SITE_VISIT_COMPLETED` fact exists; and `Prepare the quote` is eligible only at `Quoting` with a valid current estimate. A reasoned stage correction directly to `Quoting` is the explicit no-visit decision.
- If the Site Visit completion fact is needed, record only the existing bounded manual `SITE_VISIT_COMPLETED` confirmation. It creates no task, automatic stage change, or Schedule side effect. The specialist action and completion control remain separate commands within the one Project Work surface.
- V2 shows one primary action derived on the server. It includes the server-provided reason or ranking basis, effective owner, and due state when relevant. Specialist and recovery candidates also show their provided prerequisite/context, expected result, and owning destination. Work-item presentation must not invent fields that its server contract does not supply.
- Blocked work is an exception, not an enabled primary action.
- Other open V2 work may appear inside the same Project Work region. It must not become a second Tasks card.
- Existing projects are converted atomically and idempotently. `New` receives the existing lead initializer; non-terminal later stages receive one server-owned five-business-day stage review only when no other current open/blocked work exists; `Paid` becomes `Closed - Complete`; archived projects expose no active work.
- Later stage changes replace only the prior stage-review watchdog. They do not erase cadence, commercial, design, confirmation, or specialist-domain facts.
- Legacy task rows remain queryable only as immutable audit/rollback evidence. Call, Site Visit, and all other legacy task rows have no product presentation or mutation path.
- Personal Dashboard reminders remain separate and private.
- Archive is administrative housekeeping, not a synonym for Lost. Waiting, Closed, and Archived remain explicit operational states.
- Completing work never independently sends an email, changes stage, accepts a quote, records payment, mutates Design, confirms Schedule, or completes Running Jobs.
- The rollout does not contact customers, change stored pipeline stage, close non-Paid projects, or archive anything.
- Missing or incomplete evidence is labelled `Not recorded`, `Unknown`, or `Unavailable`; it is never converted into Ready.

### 5. Approved Information Architecture

The page uses stable regions in this order:

| Order | Region | Persistence | Content and boundary |
| ---: | --- | --- | --- |
| 1 | Project header | Always | Existing project name, stage badge, global search, Project Owner summary, project actions, and tabs. Do not add a third header row. |
| 2 | Orientation band | Always | Journey phase, detailed stage, customer name and email, site address, region, reference, operational state, server freshness, and one Edit details entry point. Do not repeat the project title or owner controls. |
| 3 | Critical exception strip | Conditional | Render only from a bounded server-owned exception summary that names the problem, owner, and safe recovery. Until that contract exists, keep blocked work and commercial warnings inside their owning above-the-fold regions. Do not claim a global all-clear until all required sources are complete. |
| 4 | Command grid | Always | One Project Work region backed by V2 plus one Current Design & Commercial region. These are the desktop above-the-fold working surfaces. |
| 5 | Journey and readiness | Conditional by evidence and lifecycle | Compact journey position plus bounded milestone/readiness facts. Pipeline stage is position only, never a readiness score or percentage. |
| 6 | Recent notes and events | Always when the complete snapshot is ready | User-authored notes and the bounded current activity preview. Call it `Recent notes and events`, not a complete timeline. |
| 7 | History and administration | Progressive disclosure | Project Work command history, resolved issues, confirmation correction, and other admin-only controls. |

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
- Site Visits has no general Overview or global-navigation link. The shared server-owned specialist adapter may expose only the bounded `Contacted` and `Site Visit` journey actions, with explicit labels and the canonical retained booking/confirmation destination.

#### Remove From The Overview Composition

- Any separate Tasks card or legacy project-task presentation.
- The empty Stage 3 workstreams slot.
- Duplicate Project Owner management.
- Repeated project title or stage content that adds no new meaning.
- Call actions or categories.
- Site Visit tasks or generic/discovered links outside the approved server-owned specialist action and its manual completion control.
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
| Work-model mismatch | Show no mutation controls; refresh the shared Project Work reads. After rollout this is an environment/read-coordination failure, not a supported product model. |
| Initial command-centre failure | Show a bounded failure state with Retry; never fake empty design, work, or exceptions. |
| `401`/`403`/`404` | Hide protected cached information through the existing unavailable boundary. |
| Command pending | Disable duplicate submission and keep the stable command identity for an ambiguous retry. |
| Command committed | Say `Saved on the server` only after the committed response. Patch/invalidate through the shared Project Work cache owner. |
| Command outcome unknown | Do not invent success. Retry the same intent/command ID or require reconciliation. |
| Waiting | Show wake date, reason, actor where available, and the review action; omit ordinary current work until wake-up. |
| Closed | Show the explicit outcome and reopening path where permitted; retain the genuine pipeline stage reached. |
| Archived | Show administrative archive state and no active Project Work. |

Stage correction remains a deliberate stage command. Work completion and confirmations do not silently change stage.

Closing is also a deliberate lifecycle command, not a value inside a generic state form. Active and Waiting projects expose one visible **Close project** entry point. Its dedicated dialog requires an explicit Lost, Cancelled, or Complete path, states that stage is preserved and remaining work is cancelled, names the exact final action, and keeps Lost free text optional after a structured Lost outcome. Waiting and reopening remain separate controls. A committed close patches the Overview projection and removes the project from the cached Work Queue immediately before the shared authoritative invalidation runs.

The admin-only stale-Enquiry review belongs to Work Queue, not Project Overview. It shows the exact read-only 30-day activity report, selects nothing by default, protects future Waiting rows, and requires a second exact-list confirmation. Its server command validates both the submitted report fingerprint and current evidence for every selected project before closing the whole list atomically as `Lost - No response`. A stale row rejects the complete batch; browser code cannot reconstruct or weaken that evidence.

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
| Legacy task evidence | Retired database tables under revoked/guarded write access | Audit/rollback evidence only. Do not read it into product views or use it to select work. |
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
- Recompose from the Overview's available content width, not viewport width alone: the 60/40 command grid stacks when the Overview is 800 CSS pixels or narrower, keeps Orientation first on desktop/tablet, and uses the approved mobile-priority DOM order at 768 CSS pixels and below.

The redesign should feel like one calm ruled operational sheet, not a collection of equal generic cards. Route-owned composition is expected. Do not change shared tokens or primitives unless a genuine second current consumer justifies it. Do not import the marketing UI system.

### 10. Code Ownership And Required Extraction

Keep:

- `ProjectSnapshotPageClient.tsx`: summary/full/unavailable page state.
- `ProjectPageFrame.tsx`, `ProjectHeader.tsx`, and tab owners: two-row shell and navigation, sticky above mobile and in normal flow on mobile.
- `OverviewTab.tsx`: command-centre query, snapshot/command state coordination, access-ending reporting, and composition only. One failed command-centre read owns one recovery action for the unavailable Project Work and commercial regions.
- `ProjectOrientationBand.tsx` plus `useProjectDetailsDraft`: active Overview details, stage-correction presentation, local-first save, and retry ownership.
- `ProjectStatusDetailsCard.tsx`: compatibility wrapper around `ProjectOrientationBand` for the existing detail-mutation fixture and focused local-first tests; it is not an Overview V2 composition owner.
- `ProjectHeader.tsx` plus `ProjectHeaderOwnerControl.tsx`: the single header Project Owner summary and management entry point.
- `ProjectCurrentDesignCommercialCard.tsx`: strict read-only design/commercial presentation. It does not infer lifecycle permission or expose deposit/payment mutation controls.
- `lib/projects/commandCentre/**`: command-centre selection/read contract.
- `lib/projects/workItems/**`: V2 state, work, ranking, commands, confirmation, queue, portfolio completeness, and model-integrity boundaries.
- `projectWorkCache.ts`: the only Project Work cache patch/invalidation module. `patchProjectCommandCentreCache` is the sole complete command-centre response patch owner; `patchProjectWorkProjectionCaches` owns V2 projection fan-out to command-centre, snapshot, and summary caches; `invalidateProjectWorkReads` owns project, Work Queue, and Dashboard invalidation.
- `ProjectCloseDialog.tsx`: explicit close-path selection, consequence presentation, and final action label. It does not own lifecycle validation or state truth.
- `app/staff/projects/work-queue/InactiveEnquiryReview.client.tsx` plus `lib/projects/inactiveEnquiries/**`: admin review/selection presentation and its HTTP contract. The evidence calculation, revalidation, atomicity, and close command remain database-owned.

Do not grow:

- `OverviewTab.tsx`;
- `ProjectWorkSection.tsx`;
- `ProjectWorkControls.tsx`;
- `pipelineDefinition.ts`;
- command-centre route handlers; or
- specialist Commercial, Schedule, Running Jobs, Workbench, or Calculator hotspots.

Before adding redesigned Project Work behavior, extract:

```text
tabs/overview/
  ProjectOverviewLayout.tsx          route-owned composition
  ProjectOrientationBand.tsx         identity/context presentation
  ProjectWorkSection.tsx             one V2 Project Work surface
  ProjectWorkList.tsx                secondary open/blocked rows inside that surface
  useProjectWorkCommandController.ts browser command, retry, and feedback orchestration
```

Names may vary if current code suggests a clearer boundary, but responsibilities may not be recombined in `OverviewTab.tsx`. The old command/sidebar/task presentations and legacy browser controllers are retired after consumer proof.

Presentation adapters may format and arrange server facts. They may not rank work, derive commercial truth, infer readiness, issue lifecycle transitions, call Supabase directly, or become a second project-state source.

### 11. Largest Safe First Implementation Slice

Implement one coherent, visibly complete Overview composition using the current trusted contracts:

1. Extract the V2 Project Work controller and presentation owners.
2. Replace the V2 Project Command plus Tasks duplication with one Project Work region.
3. Recompose the current project details, Project Work, and design/commercial facts into the approved orientation/command layout.
4. Convert every existing project into V2 from its stored stage with one fixed rollout timestamp, and retire legacy task presentation/read/write paths without deleting audit rows.
5. Remove the empty workstreams slot and obsolete V2 presentation after zero-consumer proof.
6. Make pending, summary, refreshing, stale, mismatch, failure, Waiting, Closed, and Archived states fit the new hierarchy.
7. Update the command-centre fixture and authenticated read-only smoke for the new composition.
8. Update current-state owner docs after behavior changes.

The original composition slice required no migration. The approved portfolio follow-on uses one forward migration because server-owned model markers, fresh stage-entry timing, read-only retirement, and portfolio state/index projections cannot be made truthful in browser code. Deposit, Schedule/Running Jobs readiness, normalized timeline, and complete exception aggregation remain separate follow-on contracts.

#### Portfolio rollout follow-on

`20260731000002_project_work_portfolio_rollout.sql` is the sole rollout owner. It uses one statement timestamp for every pre-rollout project and is safe to replay:

- `New` uses the existing two-open-hour/four-open-hour lead initializer.
- `Contacted`, `Site Visit`, `Quoting`, `Sent`, `Deposit`, `Scheduled`, and `Completed` receive one stage-appropriate progress review due after five Auckland business days when no stronger current work exists. The shared specialist ranking may supersede that review in presentation: Contacted and Site Visit route to the retained visit workflow, while quote creation is confined to Quoting with a valid estimate. No Site Visit task is created.
- `Paid` becomes `Closed - Complete`.
- Archived projects retain their stage, present as Archived, and receive no active work.
- A later stage transition cancels/replaces only `STAGE_REVIEW` work and preserves all specialist and communication facts.

The staff Projects index and Dashboard expose the five presentation phases (Enquiry, Proposal, Confirmed, Delivery, Settled) while retaining the nine detailed stages. They also expose the authoritative Active, Waiting, Closed, and Archived states. Journey grouping is presentation/filtering only; it does not derive readiness or lifecycle truth.

The Projects index also exposes the same Project Owner and one page-scoped server-ranked action/reason/timing summary used by Project Work. Project Owner filtering happens in the bounded server reader before pagination. The full Work Queue retains authoritative ranking and adds client-side search plus effective-owner, detailed-stage, and due-state (`When`) filters before its existing bounded pagination. Dashboard's compact queue uses the same human owner, action, reason, and timing labels. Stage correction always uses an explicit review dialog and states that Project Work is recalculated; it is never presented as a silent or task-neutral edit.

### 12. Explicit Non-Goals

- No portal-wide restyle or shared-token replacement.
- No marketing UI imports.
- No automatic customer email or external side effect.
- No call workflow.
- No Site Visit task, global navigation, or automatic scheduling integration; retain only the bounded server specialist link for `Contacted` and `Site Visit` plus the separate manual completion fact.
- No browser-driven or evidence-classifier migration; the server migration converts the whole portfolio deterministically from stored stage.
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
- The `Open booklet workbench` specialist link may carry the existing app project ID to `/staff/design-booklets`. Overview does not read or mutate booklet state; the route-owned Design Booklet API, private Storage boundary, and `docs/design-booklets.md` own that separate customer-document draft and its return path.

### 14. Acceptance And Verification

Product acceptance:

1. An unfamiliar project can be oriented within seconds: project/customer/site, stage, operational state/freshness, owner, one next action and reason, blocker, exact current design/commercial source, and specialist destination.
2. Every project has exactly one Project Work region and no separate Tasks card or legacy task presentation.
3. No Call action or Site Visit task/category/global-navigation link appears. The only Site Visit destination is the trusted server specialist candidate for `Contacted` or `Site Visit`, and its manual completion fact remains separate.
4. Pipeline stage is not presented as readiness, percentage complete, or proof of a downstream artifact.
5. Missing evidence never appears ready, sent, paid, scheduled, or complete.
6. Design and commercial precedence remains byte-for-byte equivalent at the owning resolver boundary.
7. The portfolio migration is atomic/replay-safe, and an incomplete environment fails closed instead of presenting a mixed portfolio as ready.
8. Every controlled success reflects a committed server result and duplicate-submit/replay safety remains.

Required fixture states:

- new lead with first email due and missing email;
- follow-up due and close review;
- normal, critical, overdue, today, future, and blocked work;
- no owner, no action, Waiting, Closed, Archived, and correction review;
- portfolio-converted V2 projects at each stage;
- stage review, Waiting, Closed, Archived, rollout-incomplete, and malformed server-response states;
- estimate-only, sent, accepted, declined, newer unrelated estimate, missing source, and unavailable price;
- pending, summary, refreshing, stale cached data, model mismatch, initial error, retry, `401`, `403`, and `404`;
- deposit, Schedule, Running Jobs, communication, or full exception states only if their new bounded server projections are implemented.

Required automated and manual checks:

- focused pure selector, route, cache, controller, and component tests;
- `npm run test:portal:project-work`;
- `npm run test:portal:projects`;
- command-centre fixture/browser coverage;
- `npm run test:portal:command-centre:read-only-auth` against a positively identified non-production environment;
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
Work surface, approved orientation/command composition, the portfolio-wide V2
rollout, and truthful loading/recovery states. Do not
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

`ProjectPageSnapshot` remains the complete project-detail read model for identity, pipeline, notes, bounded activity, and emails. Legacy project tasks are no longer part of the snapshot contract.

The snapshot remains shared with project routes and workbench route context, so putting commercial version arrays or estimate inputs into it would enlarge unrelated reads and weaken its ownership. The command-centre endpoint is therefore a separate read model and query key.

The Overview composes:

- Header/project identity from the existing project snapshot/summary.
- Customer/site/reference context from the existing project snapshot/summary.
- Current design and commercial facts from the dedicated command-centre response.
- The single V2 Project Work region from the command-centre response's Project Work projection when present; the snapshot is not a second V2 work authority.
- Notes and bounded recent events only after the full project snapshot is ready.

Placeholder task/note arrays never produce a false empty state.

## 7. Canonical ownership

Stage 2 owns one project assignment in `project_owner_assignments`, keyed by project. The approved owner roster is Ellen, Jordan, JP, Joe, Bruce, and Dave. A row stores only the stable business key; no row means unassigned. Ellen is the server-enforced owner for active `New` and `Contacted` projects. After a manual move into Proposal, an admin explicitly selects its Proposal owner; before the project leaves Proposal, that owner performs the manual handoff and assigns Dave for Confirmed and Delivery work. Pipeline-stage changes remain manual and no ownership rule advances a project.

The forward migration prefers an existing active Sales assignment, then Design and Estimating, only when the legacy assignee name maps to the approved roster. Unknown identities remain unassigned. The legacy three-role table is retained read-only as rollback evidence and has no current writer or read-model consumer.

## 8. Current Project Work system

`project_operational_states`, `project_work_items`, confirmation facts, repair signals, command receipts, and immutable events are the only project-work authority. `project_work_queue_v3()` emits at most one current server-ranked obligation per project. The Overview and full Work Queue act through the existing semantic Project Work commands with stable command IDs and row versions.

`tasks`, `followup_tasks`, `project_manual_actions`, `project_task_checks`, the legacy primary-action selector/control/audit tables, and their browser/API writers are retired. Rows remain available to privileged database audit/rollback work only; normal product reads and writes do not use them. Personal Dashboard reminders are a separate private scratch feature and are not project truth.

## 9. Existing communication and activity sources

Stage 1 retains project notes and existing snapshot activity capability. It does not merge quote events, outbox events, calls, messages, site visits, audits, or tasks into a new timeline.

Current sources remain independently owned:

- Project notes by the project-note domain and note routes.
- Email summaries/outbox activity by the project snapshot and email domains.
- Quote send history by `quote_send_logs` and quote domain helpers.
- Site visits, audit events, automation, and task history by their existing domains.

Stage 4 owns the future normalized communication/timeline read model.

## 10. Existing auth and permissions

Command-centre reads and owner/Project Work commands use `requireStaffContext()` and the returned auth-bound Supabase client. RLS plus security-definer command checks remain authoritative. The compatibility projection is refreshed inside transactional V2 commands; no browser or service-role caller has execute permission on its helper, and retired task routes/functions have no write grant.

The response is `private, no-store`, carries standard request diagnostics, returns `401`/`403` from the auth helper, returns `404` only when the authenticated project read is absent, and returns a stable `500` when a bounded subordinate read fails.

No raw tokens, token hashes, internal true cost, margin, service-role data, or oversized estimate inputs leave the endpoint.

## 11. Existing loading, caching, and local-first model

The query key is `qk.projects.commandCentre(host, projectId)`. It uses the authenticated user's existing QueryClient and a one-day garbage-collection window. It is stale immediately and refetches whenever Overview remounts, so a return from Calculator or Commercial refreshes current commercial state without adding cache logic to those critical workflows.

Accepted V2 commands use `patchProjectWorkProjectionCaches` to fan the returned projection into matching command-centre, snapshot, and summary caches. Header-owner commands use `patchProjectCommandCentreCache` as the sole complete command-centre response patch owner. Both paths then use `invalidateProjectWorkReads` to refresh project, Work Queue, and Dashboard consumers. No Overview component calls `setQueryData` for those caches directly. Project Work controls are enabled only while their owning reads are fresh and the snapshot and command-centre agree; cached background-refresh, refresh-failed, rollout-incomplete, or model-mismatch facts stay visible without mutation controls.

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
| Notes and bounded events | Existing project snapshot | Render only when full snapshot is ready |
| Specialist links | Existing tab routes | Read-only navigation |
| Project owner | `project_owner_assignments` | One approved owner, required/missing state, and admin edit permission |
| Project state/work | V2 operational state, work-item, confirmation, repair, receipt, and event tables | Server-ranked projection and semantic commands |
| Legacy task rows | Retired legacy tables | Privileged audit/rollback evidence only; no product consumer |

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
- One normalized Project Owner summary and permission.
- One V2 `ProjectWorkProjection`, including operational state, server-selected primary candidate, open/blocked items, confirmations, and generated time.

The server performs one auth-bound `projects` relation read for estimate metadata, quote versions, and send logs, followed by one exact selected-estimate detail read for `inputs`, `outputs`, and costing trace fields. Only the bounded normalized response reaches the browser.

## 15. Required migrations

The historical Stage 1 composition required no migration. Project Work is owned by its ordered foundation migrations and the current rollout migration:

- `20260720_000008_project_command_centre_stage2.sql` promotes task/follow-up setup into migration truth; adds the initial owner/action/control/selection/audit tables, updated timestamps, focused indexes, select-only portal RLS, transactional idempotent commands, active-user backfills, and compatibility projection columns. Source-table triggers maintain candidate versions and the Schedule projection; Design Package source-task changes use a bounded staff RPC after direct authenticated source writes are revoked.
- `20260721_000001_project_command_single_owner.sql` replaces the initial three-role owner contract with one Project Owner and performs the deterministic legacy backfill. `20260801_000001_project_owner_handoffs_and_enquiry_inactivity.sql` extends the roster with Ellen and Dave, assigns Ellen to active Enquiry projects at the server boundary, preserves manual Proposal/Delivery handoffs, and adds an admin/service read-only inactivity report without closing or advancing projects.
- `20260731000002_project_work_portfolio_rollout.sql` processes every pre-rollout project exactly once from its current stored stage, including already-V2 rows. A private project-independent ledger closes the cohort even when it was empty or its project events are later removed by a valid hard delete, while one event per project retains detailed audit. It seeds fresh server-owned stage timing, closes Paid as Complete, keeps Archived out of current work, cancels prohibited and legacy-review work, makes retired reviews terminal, initializes later direct inserts through a deferred invariant, rejects future Call/Site Visit work at the database boundary, preserves the existing confirmed admin hard-delete cascade, retires legacy writers, exposes `staff_projects_index_v2` and `staff_project_state_counts_v1`, and lifts the queue safety cap to 5,000. The server queue pages hosted-safe ranges and fails closed at that ceiling without changing the response shape.
- `20260731000003_project_pipeline_accountability_reads.sql` owns the Project Owner/state-aware V3 Projects index required by the current application. `20260801000002_project_enquiry_bulk_close.sql` adds only the private receipt and authenticated-admin command needed to atomically revalidate an exact approved stale-Enquiry list before delegating to normal close truth.

The rollout migration is applied in positively identified staging and production. Preview is wired only to the staging Supabase project, while Production is wired only to production. Before the production transaction, the unchanged migration was rehearsed with rollback against the real portfolio and a completed physical backup was verified. The exact file SHA-256 was `a9e91e48e0a894bbe9201cc39c7ba5e83c4d33b9d8912c0b6d369bf058755ef3`. Production postflight found all 1,151 projects marked V2 with operational state, one durable rollout ledger row, 1,151 rollout events, no active prohibited work, and all four legacy tables preserved at their preflight counts.

The Pipeline Accountability and stale-Enquiry bulk-close migrations are also applied in both positively identified environments. Production used rollback rehearsals after confirming completed physical backup; exact hashes were `4297d1acd87d9ec523b71d13e962379fe8a47f4c12393d9bb6ad028e75a00c0b` and `f04793197301526f4c0b5d15e434bbede43ef51ace73f48b903bdf769d10a8ef`. Postflight found 1,149/1,149 current projects with state and zero bulk-close receipts. No project was closed during deployment or QA.

Legacy `projects.next_action*` and `follow_up_date` are a read-only Schedule compatibility projection. Server-owned V2 Project Work commands alone refresh them through the guarded projection owner. Project Details, Dashboard controls, retired project-task completion, and AutomationRunner do not own those fields.

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

Current supporting routes include:

- `GET /api/staff/v1/staff-directory`.
- `PATCH /api/staff/v1/projects/[projectId]/command-centre/owners`.
- the existing V2 Project Work semantic command routes;
- `GET /api/staff/v1/projects/index`, backed by `staff_projects_index_v2`; and
- the Dashboard route, which uses the state-count and Work Queue projections.

Every response, including errors, is `private, no-store`. Mutations require UUID command IDs and optimistic versions, are transactional/idempotent, and return committed success with `refreshRequired` rather than inviting a retry after a post-commit refresh failure.

## 17. Component reuse plan

Overview V2 component boundaries:

- `OverviewTab.tsx`: query/state orchestration, access-ending reporting, and composition handoff only. One failed command-centre read owns one recovery action for the unavailable Project Work and commercial regions.
- `overview/ProjectOverviewLayout.tsx`: route-owned responsive composition for orientation, Project Work, current design/commercial, and bounded recent notes/events.
- `overview/ProjectOrientationBand.tsx`: active Overview owner for journey, customer, site, region, reference, operational state, freshness, local-first details editing/retry, and stage correction without repeating project identity, owner management, or the detailed stage already presented in the header.
- `overview/ProjectStatusDetailsCard.tsx`: compatibility adapter that renders `ProjectOrientationBand` in compatibility mode for `ProjectDetailsMutationFixtureClient` and focused local-first tests. `OverviewTab` does not mount it.
- `overview/ProjectWorkSection.tsx`: the single Project Work region and high-level V2/state presentation.
- `overview/ProjectWorkList.tsx`: secondary V2 open/blocked rows inside that region.
- `overview/ProjectWorkControls.tsx`: V2 mutation-control presentation for manual work, operational-state changes, confirmation correction, and the existing manual Site Visit completion fact. It exposes no Site Visit task, global navigation, or automatic Schedule integration; it avoids duplicating the ranked specialist destination and renders no controls for Archived projects.
- `overview/useProjectWorkCommandController.ts`: V2 browser command, stable retry identity, duplicate suppression, committed/unknown feedback, input state, V2 projection cache patching, and shared invalidation orchestration.
- `overview/projectWorkVisibilityPolicy.ts`: the shared fail-closed Call/Site Visit identity filter for V2 primary candidates/items/manual titles and bounded recent events. Contextual state-review reasons are not treated as action identity.
- `overview/ProjectCurrentDesignCommercialCard.tsx`: read-only selected design/commercial presentation. It does not infer lifecycle permission or expose deposit/payment mutation controls.
- `overview/ProjectRecentNotesEvents.tsx`: bounded recent-notes/events composition, including suppression of legacy Call and Site Visit event content. It delegates note authoring to `ProjectNotesPanel.client.tsx`.
- The old legacy command/action/history/task-sidebar owners and the duplicate V2 command/sidebar owners are retired after zero-consumer proof.
- `ProjectHeader.tsx` plus `ProjectHeaderOwnerControl.tsx`: project identity, the single Project Owner summary/management modal, project actions, and horizontally scrollable tab navigation. Accepted owner commands patch through `patchProjectCommandCentreCache`, never a header-local cache writer.
- `lib/queries/projectWorkCache.ts`: sole cache patch/invalidation module. `patchProjectCommandCentreCache` owns complete server-returned command-centre patches, `patchProjectWorkProjectionCaches` owns V2 projection fan-out, and `invalidateProjectWorkReads` owns the complete refresh set.
- Dashboard Project portfolio: five journey-phase counts, authoritative Active/Waiting/Closed/Archived counts, and a compact preview of the same V2 Work Queue used by the full route. Personal reminders remain independent.

The `activity` module loader now resolves to `OverviewTab`; the old Activity component, three-query snapshot bar, fallback resolver, and summarizer are removed after consumer search proved no remaining code consumer.

The current Project Work presentation consumes a required server-owned ranking reason for ordinary work items. It uses categorical due badges (`Critical`, `Overdue`, `Due today`, or `Upcoming`) while leaving the exact timestamp to the Due field, omits active-state counts already visible elsewhere, and does not render an empty secondary-work slot. Its action title is the strongest route-owned heading, one orange or critical rail marks the server-ranked obligation, and command labels distinguish doing external work from recording its outcome. Waiting/Closed/Archived details appear only when they add state-specific truth.

The route body shares the 1440px portal content ceiling and uses an approximately 62/38 Project Work/commercial split on wide screens. The context band is deliberately quiet, does not repeat the detailed stage owned by the project header, and groups journey/state separately from customer/site facts. Commercial exceptions render before customer-price/quote metrics; design/source facts and recent history are subordinate. At 800 CSS pixels or less the grid stacks from the component's available width, while at and below 768 CSS pixels the DOM and visual order is Project Work, commercial, context, then recent history. Empty exception rows do not reserve grid space.

## 18. Test and fixture strategy

Implemented focused coverage for the Overview V2 slice includes:

- Pure selector precedence and exact-source tests.
- Raw server normalization, quote/estimate price ownership, blocked-estimate pricing, delivery, freshness, missing-source, and complete-read failure tests.
- Auth route response and failure tests.
- Query preloading and preserved activity-key tab tests.
- Overview pending/fresh/stale/failure/access-ending tests.
- Page-level protected cache clearing tests.
- Current design/commercial, journey/orientation, layout, recent notes/events, Project Work section/list/controls, V2 command-controller, rollout failure, visibility-policy, portfolio-index/state-count, and shared-cache tests.
- Environment-gated, customer-data-free fixture route that composes the real production `OverviewTab` path and its extracted `ProjectOverviewLayout`, `ProjectOrientationBand`, `ProjectWorkSection`, `ProjectCurrentDesignCommercialCard`, and `ProjectRecentNotesEvents` owners with synthetic server responses.
- Fixture data for the approved V2 work/read-state catalogue, including long project/customer/site/action content, fresh stage review, Waiting/Closed/Archived, stale/mismatch/access-ending, rollout-unavailable, and strict commercial-source cases.
- Current fixture Playwright assertions cover the strict read-only commercial catalogue, V2 Project Work/read states, one recovery action per failed read, prohibited Call/Site Visit identities, responsive composition, accessibility, and the project shell. No legacy task/action row is rendered or selected.
- Responsive assertions and attached rendered evidence at 1600x1000, 1440x1000, 1280x800, 1024x900, 768x1024, and 390x844; a 640 CSS-pixel 200%-zoom simulation; long-content resilience at every standard width; the 1440px content ceiling; one-column recomposition at 768px and below; one visually dominant server-ranked action; exception-before-metrics ordering; no document horizontal overflow, nested vertical scroll owner, or cropped control; semantic headings/regions; actual mobile Tab order; visible focus; reduced motion across descendants; prohibited lifecycle-control absence; and 44px coarse-pointer controls.
- `npm run test:portal:command-centre:read-only-auth` as the authenticated read-only portfolio/Overview smoke. It runs the portfolio-readiness and credential preflights, rejects production-like or ambiguous hosts, proves the fresh Projects Journey/Stage/State columns and Dashboard journey/state/Work Queue presentation, discovers one RLS-visible project, opens the integrated Overview, checks the extracted regions and absence of duplicate/prohibited controls, suppresses only the identifier-free Web Vitals transport before navigation, and aborts plus reports every other non-`GET`/`HEAD`/`OPTIONS` request.
- `npm run test:portal:project-work:production-read-only-auth` as the protected, manually dispatched `main` production smoke. It accepts only the exact production portal origin and Supabase ref, reuses the same browser contracts, suppresses Web Vitals, and aborts plus reports every other non-read request.

Fixture route: `/qa/project-command-centre-fixture?scenario=...&work=...&state=...`, enabled only by `ENABLE_PORTAL_QA_FIXTURES=1`.

The broader acceptance matrix in section 14 remains required where the current browser specs do not yet assert a catalogued state or accessibility property. On 2026-07-30, the owned Overview V2 evidence passed:

- `npm run test:portal:project-work`: 55 files and 321 tests.
- `npm run test:portal:projects`: 100 files and 520 tests.
- Focused Overview/header/cache coverage passed; the final bundle-analyser regression pass adds 9 passing tests.
- `npm run test:portal:browser`: 70 checks passed, with the existing Workbench Plan Editor check skipped by design.
- `npm run test:portal:command-centre:read-only-auth`: the staging-readiness and credential preflights, authenticated setup, and integrated Overview smoke passed against the positively identified CLI-linked staging project. Identifier-free Web Vitals transport was suppressed and every other non-read request remained fail-closed; no business mutation was attempted.
- `npm run test:portal:project-work:production-read-only-auth`: authenticated Projects/Dashboard, one real Overview, and the 779-entry paginated Work Queue passed against the exact production portal origin and Supabase ref. The guard blocked every non-read application request; a short-lived labelled QA login was hard-deleted immediately afterward and left no portal-access residue.
- Full typecheck, lint, production portal build, docs impact/guard, architecture changed, changed-file, dead-code, and diff checks.
- The unchanged Project Detail budget passed at the implementation checkpoint at 642.4 KiB raw / 184.9 KiB gzip initial, 978.5 KiB raw / 219.9 KiB gzip lazy total, and 858.6 KiB raw / 186.4 KiB gzip largest lazy entry. A fresh isolated build after the later intentional merge still passed at 642.6 KiB raw / 184.9 KiB gzip initial with the same lazy totals.
- Historical pre-rollout evidence also included a 390x844 authenticated read-only inspection on one RLS-visible project. The portfolio follow-on requires fresh post-migration evidence and does not reuse that legacy-boundary result as rollout proof.

At the handoff, the aggregate `npm run portal:bundle-budget` gate failed only for Contacts and Calculator initial budgets; an isolated clean build at approved baseline `060bea19` reproduced those overruns while Project Detail remained within its unchanged allowance. The narrow exception did not raise either ceiling or authorize unrelated Overview changes. A later isolated `.next-route-optimization` production build brought both routes within their unchanged ceilings and passed the aggregate assertion. Production cutover then returned ready authenticated Work Queue, legacy snapshot, Command Centre, and Overview reads without migrating or backfilling a pre-cutover project; the snapshot-cache hotfix subsequently made every explicit snapshot response `private, no-store`.

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
- Stage 1C: deterministic unit/route/component/browser fixtures, docs, bundle/performance verification. Complete in the current repository.
- Stage 2A-C: present in the current repository; executable migration smoke plus authenticated real-project quality gates remain before completion.
- Historical Stage 3: four lead-to-quote workstream cards. Superseded as the next step by the approved Overview V2 handover; do not implement it directly.
- Stage 4: communications and timeline. Not started.
- Stage 5: exceptions and approvals. Not started.
- Stage 6: final responsive QA, pilot, and rollout. Not started.
- Current slice: the original Overview composition and portfolio-wide V2 conversion are deployed and verified through production postflight `6832a9dd`. The current hierarchy refinement keeps Project Work ranking reasons server-owned, commercial presentation read-only, recovery singular, and tablet/mobile composition explicit without expanding domain truth.
- Next-slice boundary: no deposit, Schedule/Running Jobs readiness, normalized meaningful activity, complete exception aggregation, or other lifecycle expansion is approved until a bounded specialist-owned server projection is separately reviewed.

## 20. Technical risks

- Nested PostgREST relationship naming or RLS drift can fail the complete read. Route tests and live authenticated smoke remain required.
- Historical rows may contain invalid timestamps, missing totals, or missing source records. Normalization must preserve unknown/unavailable rather than fabricate data.
- Quote/estimate mutations do not directly update the new endpoint cache. Immediate staleness plus remount/focus refetch is the Stage 1 coherence mechanism; do not add logic to the critical tabs casually.
- Estimate inputs can be large. The metadata-first plus exact-detail read prevents all historical inputs reaching the browser or being fetched for every estimate.
- Multiple accepted quotes are an integrity issue. Stage 1 warns but does not mutate history.
- A future stage could accidentally duplicate task, communication, or issue truth in the command-centre payload. Extend only through an approved owner contract.

## 21. Confirmed implementation decisions

- Keep `activity` as the internal/default tab key and label it `Overview`.
- Keep `ProjectPageSnapshot` focused on current project facts; retired legacy task rows are no longer part of it.
- Use a separate server-owned command-centre read model and query key.
- Use auth-bound staff access only.
- Apply accepted > sent > draft and exact source only.
- Never select declined quotes.
- Never fall back from quote source or quote price to an estimate.
- Read stored estimate summary and freshness; do not run costing.
- Keep existing project identity, notes, lazy boundaries, and compatible URL keys while consolidating details and stage correction into Overview; remove retired project-task presentation.
- Clear protected user-owned caches on command-centre access-ending responses.
- Remove the legacy fallback resolver/summarizer/bar after zero-consumer proof.
- Make no Stage 1 migration or specialist mutation change.
- Keep retired task/follow-up/manual-action rows as database audit/rollback evidence only, with normal reads and writes revoked.
- Keep personal Dashboard reminders separate from project work; retired stage-task checks have no application consumer.
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
- Fixture/browser evidence: `app/qa/project-command-centre-fixture/**`, `playwright/portal.command-centre.spec.ts`, and the authenticated read-only command-centre smoke.

## 24. Update rules

- Update this document when the command-centre response, resolver precedence, auth boundary, cache behavior, component ownership, fixture matrix, or stage sequence changes.
- Update `project-command-centre-roadmap.md` whenever stage status or completion evidence changes.
- Update `projects-contacts-estimates-calculator.md` for current project-page behavior.
- Update `staff-api-auth-contracts.md` when route/auth/response contracts change.
- Update `testing-and-qa.md` when commands or browser fixtures change.
- Update `portal-production-readiness.md` and `portal-ux-roadmap.md` when readiness or UX status changes.
- Do not copy the full V1 product specification into this architecture record.
- Do not mark a later stage complete from partial or Stage 1 evidence.
