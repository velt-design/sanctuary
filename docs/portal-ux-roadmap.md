# Portal UX Roadmap

Status: Active evolving roadmap.

Last updated: 2026-07-29.

Purpose: keep the highest-leverage usability work visible as the portal matures from a capable internal tool into a fast, trusted operating system for staff. This doc is intentionally product-facing: it tracks workflow clarity, visual hierarchy, user confidence, and the next UX passes worth doing.

## Read First

- Use this doc before planning dashboard, project page, schedule, quote, invoice, task, activity, or workbench UX work.
- Keep this roadmap current when UX priorities change, a workflow is polished, or user feedback reveals a sharper problem.
- Use `docs/platform-workflow.md` for the business workflow and `docs/portal-production-readiness.md` for production readiness; this doc owns usability priorities.
- Prefer improving existing workflows before adding new surfaces.
- The current checked-in and rendered portal UI is canonical. This roadmap can
  prioritize verified usability problems, but it does not authorize a broad
  restyle, Foundation migration, or marketing-to-portal UI adoption.

## UX Direction

The portal has the right product shape: Projects are the operational centre, Dashboard is the daily overview, Schedule is execution, and Quotes/Invoices/Job Packs are the commercial flow. The next gains should make those existing workflows feel guided, current, and trustworthy.

The main UX standard:

- Staff should always know what changed, what needs action, what is blocked, and what is safe to do next.
- Dense operational pages should surface priority and next action before secondary detail.
- Technical migration states should become plain user states: ready, needs review, unsupported, saved, unsaved, stale, locked, or failed.

## Highest-Leverage UX Work

1. **Project Pages Speed**
   - Goal: make finding, opening, navigating, and revisiting a project feel immediate on the current UI foundation.
   - Treat the existing Wave 1 timings as historical evidence after any performance-relevant change to the current shared shell or project composition; re-run a fresh production build, bundle gate, and five authenticated repetitions before drawing a new conclusion.
   - Prioritise Projects Index, Projects-to-project, browser Back, cold Project Detail, then Overview/Calculator/Commercial/Job Packs tab intent in that order. Warm feedback stays under 100 ms and useful content under 500 ms; fresh settlement remains separate and non-blocking.
   - Optimize only the slowest measured owner. Preserve current-user cache isolation, truthful pending/cached/failure states, exact-intent preload, specialist bundle boundaries, and server authority.
   - Measure create flows after the everyday journeys are green. Prefer immediate truthful pending feedback and an idempotent staff API before committing to offline provisional-project complexity.

2. **Project Page Command Centre**
   - Goal: make the project page the clearest operational hub.
   - Improve current status, next action, latest note/activity, current design/quote state, and obvious primary actions.
   - Stage 1 complete: the activity-key default is now labelled Overview; a strict server-owned card shows exact current design, quote/estimate version, stored customer price, delivery, costing freshness, source failures, and newer-estimate context. Customer context, notes, tasks, and specialist workflows remain available.
   - Stage 2 repository implementation is complete but remains Yellow: the project header shows one canonical Project Owner from the approved Jordan/JP/Joe/Bruce roster; Overview derives one primary action from project tasks, follow-up tasks, or controlled manual actions; conflicts, critical reasons, compact audit history, and dashboard project exceptions are surfaced. Executable smoke for both Stage 2 migrations and authenticated real-project Playwright remain the completion gates.
   - Project shell Slices 1-2 are present in the current repository: the page is full width with project facts and stage in Overview; the authoritative Calculator replaces the legacy Designs/configurator surface; Quotes and Invoices share Commercial; the Emails UI is retired while delivery/audit data and side effects remain unchanged. Staff-facing tabs are Overview, Calculator, Commercial, and conditional Job Packs; compatibility keys remain `activity`, `estimates`, `quotes`, `invoices`, and `job-packs`.
   - Stage 3 lead-to-quote workstreams are the next implementation stage after Stage 2 environment verification. V1 remains bounded at quote outcome.

3. **Activity System V2**
   - Goal: turn activity into a useful cross-workflow timeline, not just a note list.
   - Add event categories over time: project note, quote sent, quote accepted, invoice sent, design package requested, schedule changed, task completed.
   - Use small coloured pills so staff can scan event types quickly.

4. **Tasks And Follow-Ups**
   - Goal: make personal and project-linked execution visible.
   - Build on dashboard personal tasks with project-linked tasks, due dates, mine/team views, and overdue/stale surfacing.
   - Keep task interactions lightweight; avoid turning v1 personal reminders into a complex project-management module too early.

5. **Quote And Estimate State Clarity**
   - Goal: make commercial state obvious and safe.
   - Staff should instantly understand editable vs locked, draft vs sent vs accepted, current design source, quote version, invoice status, and safest next action.
   - Prefer a consistent state summary across estimate/quote/invoice surfaces over one-off badges in each tab.

6. **Schedule UX Simplification**
   - Goal: reduce visual competition in the most operationally dense surface.
   - Current Board pass: larger screens wrap up to four crews per row without horizontal lane scrolling, cards prioritise timing over routine state, and a browser-saved view filter can hide empty or selected crews without changing access or Schedule truth.
   - Current Gantt pass: Board and Gantt share the saved crew preference; planning controls are grouped apart from view options; the visual scale defaults to eight weeks without changing the 12-week data range; current week/today, row timing, crew counts, and existing attention facts are easier to scan.
   - Remaining gap: make unassigned work more prominent. Site Visits remains dormant unless its reactivation is separately approved.

7. **Workbench User Confidence**
   - Goal: keep the design workbench powerful without exposing migration complexity.
   - Default to user-facing states and clear recovery: ready, needs review, unsupported, saved, unsaved, stale.
   - Hide technical diagnostics unless the user asks for detail or the state blocks progress.

8. **Global Search / Quick Open**
   - Goal: reduce navigation friction across projects and contacts.
   - Add a fast project/contact jump by name, phone, address, or quote reference.
   - This is likely high-impact for daily staff use once core project-page clarity improves.

9. **Consistent Empty, Loading, Error, And Recovery States**
   - Goal: every surface should answer what is happening, why it matters, and what to do next.
   - Replace dead-end errors with practical recovery actions.
   - Make local-first pending, retry, conflict, and locked states consistent across staff workflows.

10. **UI System Stewardship**
    - Goal: preserve the current portal system while correcting verified,
      route-specific usability or consistency defects.
    - Reuse the existing owner for new controls and states. Record a proposed
      cross-route standardisation or restyle as a finding and obtain explicit
      approval before changing current screens.
    - Do not treat Dashboard, the Foundation catalogue, marketing patterns, or
      a compatibility label as blanket visual direction for another route.

11. **Workflow-Based QA**
    - Goal: judge usability by complete staff journeys, not only by pages.
    - Track core workflows: new lead to site visit, site visit to quote, quote to invoice, accepted quote to scheduled job, design package to running job.
    - Score each workflow by clicks, confusion points, failure recovery, and confidence that saved data is current.

## Current Sequence

1. Project Pages Speed revalidation and measured bottleneck fixes against the current checked-in portal UI.
2. Current project-tab intent, useful-shell, and bundle-boundary performance.
3. Project Command Centre authenticated completion gate.
4. Project Command Centre Stage 3 lead-to-quote workstreams.
5. Activity category expansion and timeline clarity.
6. Dashboard/project task evolution.
7. Quote/estimate state summary standardisation.
8. Remaining Schedule priority-view simplification for unassigned work.
9. Workbench state and diagnostics simplification.

## Update Notes

- When a UX pass lands, update the relevant item with the new current state and next gap.
- When user feedback changes the order, update `## Current Sequence` instead of adding a separate plan doc.
- When a UX change crosses data flow, auth, source-of-truth, or readiness boundaries, update the owning canonical doc as well.
