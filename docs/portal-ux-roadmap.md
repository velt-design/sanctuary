# Portal UX Roadmap

Status: Active evolving roadmap.

Last updated: 2026-07-30.

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
   - The historical Stage 2 legacy-project implementation is complete but remains Yellow: the project header shows one canonical Project Owner from the approved Jordan/JP/Joe/Bruce roster; legacy Overview derives one primary action from project tasks, follow-up tasks, or controlled manual actions; conflicts, critical reasons, compact audit history, and dashboard project exceptions are surfaced. Its separate executable migration and authenticated real-project gates remain.
   - Project shell Slices 1-2 are present in the current repository: the page is full width with project facts and stage in Overview; the authoritative Calculator replaces the legacy Designs/configurator surface; Quotes and Invoices share Commercial; the Emails UI is retired while delivery/audit data and side effects remain unchanged. Staff-facing tabs are Overview, Calculator, Commercial, and conditional Job Packs; compatibility keys remain `activity`, `estimates`, `quotes`, `invoices`, and `job-packs`.
   - The Project Work V2 new-project foundation, Work Queue, Dashboard preview, guarded legacy review, and authenticated staging command smoke are complete in the repository; production remains unchanged.
   - Implemented slice: the approved Overview V2 composition in `project-command-centre-architecture.md`. Five required top-level owners compose orientation, one mixed-model Project Work region, current design/commercial, and bounded recent notes/events; extracted subordinate owners separate V2 controls, V2/legacy command orchestration, legacy conflict/history, shared visibility policy, and cache patching/invalidation. Legacy stage rows are filtered read-only; Call and Site Visit work is hidden; prohibited server-selected legacy work is labelled `Legacy work needs review` without browser replacement selection.
   - Focused/component, production-owner fixture, responsive/accessibility, unchanged Project Detail budget, build/static, manual authenticated inspection, and automated authenticated read-only staging evidence passed on 2026-07-30. Completion is accepted under the narrow user-approved exception for the aggregate Contacts/Calculator overruns reproduced at `060bea19`; keep their ceilings unchanged and handle route optimization separately.

3. **Activity System V2**
   - Goal: turn activity into a useful cross-workflow timeline, not just a note list.
   - Add event categories over time: project note, quote sent, quote accepted, invoice sent, design package requested, schedule changed, task completed.
   - Use small coloured pills so staff can scan event types quickly.

4. **Tasks And Follow-Ups**
   - Goal: make personal and project-linked execution visible.
   - Keep personal Dashboard reminders separate from the server-owned Project Work model.
   - Project obligations use the full Work Queue and one Project Work region in Overview. Do not rebuild a generic task manager, copy specialist actions, or add a second project task surface.

5. **Quote And Estimate State Clarity**
   - Goal: make commercial state obvious and safe.
   - Staff should instantly understand editable vs locked, draft vs sent vs accepted, current design source, quote version, invoice status, and safest next action.
   - Prefer a consistent state summary across estimate/quote/invoice surfaces over one-off badges in each tab.

6. **Schedule UX Simplification**
   - Goal: reduce visual competition in the most operationally dense surface.
   - Make today, this week, blockers, unassigned work, and site visits more prominent.
   - Group actions and reduce competing controls before adding new schedule features.

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
    - Track core workflows: new lead to personal email, email follow-up to quote, quote to invoice, accepted quote to scheduled job, and design package to running job. Site Visits remains outside normal workflow QA until reactivation is approved.
    - Score each workflow by clicks, confusion points, failure recovery, and confidence that saved data is current.

## Current Sequence

1. Project Pages Speed revalidation and measured bottleneck fixes against the current checked-in portal UI.
2. Current project-tab intent, useful-shell, and bundle-boundary performance.
3. Restore the baseline Contacts/Calculator aggregate bundle gate in a separately approved owner scope without raising ceilings casually.
4. Resolve the pre-existing Contacts/Calculator aggregate bundle-budget failures in their separately approved owner scope; do not raise their ceilings from the Overview slice.
5. Bounded full-journey summary contracts for deposit, Schedule/Running Jobs readiness, and meaningful activity where evidence exists.
6. Activity category expansion and timeline clarity.
7. Dashboard/Project Work evolution without merging personal reminders.
8. Quote/estimate state summary standardisation.
9. Remaining Schedule priority-view simplification for unassigned work.
10. Workbench state and diagnostics simplification.

## Update Notes

- When a UX pass lands, update the relevant item with the new current state and next gap.
- When user feedback changes the order, update `## Current Sequence` instead of adding a separate plan doc.
- When a UX change crosses data flow, auth, source-of-truth, or readiness boundaries, update the owning canonical doc as well.
