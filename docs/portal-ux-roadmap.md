# Portal UX Roadmap

Status: Active evolving roadmap.

Last updated: 2026-06-01.

Purpose: keep the highest-leverage usability work visible as the portal matures from a capable internal tool into a fast, trusted operating system for staff. This doc is intentionally product-facing: it tracks workflow clarity, visual hierarchy, user confidence, and the next UX passes worth doing.

## Read First

- Use this doc before planning dashboard, project page, schedule, quote, invoice, task, activity, or workbench UX work.
- Keep this roadmap current when UX priorities change, a workflow is polished, or user feedback reveals a sharper problem.
- Use `docs/platform-workflow.md` for the business workflow and `docs/portal-production-readiness.md` for production readiness; this doc owns usability priorities.
- Prefer improving existing workflows before adding new surfaces.

## UX Direction

The portal has the right product shape: Projects are the operational centre, Dashboard is the daily overview, Schedule is execution, and Quotes/Invoices/Job Packs are the commercial flow. The next gains should make those existing workflows feel guided, current, and trustworthy.

The main UX standard:

- Staff should always know what changed, what needs action, what is blocked, and what is safe to do next.
- Dense operational pages should surface priority and next action before secondary detail.
- Technical migration states should become plain user states: ready, needs review, unsupported, saved, unsaved, stale, locked, or failed.

## Highest-Leverage UX Work

1. **Project Page Command Centre**
   - Goal: make the project page the clearest operational hub.
   - Improve current status, next action, latest note/activity, current design/quote state, and obvious primary actions.
   - Current PR1: polish the project page Activity/default view first, keeping the current-design snapshot on top, making Activity/project notes the wider left column, moving Tasks into a compact right action rail, and moving Details to a tab on laptop/stacked layouts so the command centre stays visible. A dedicated Next Action card remains deferred.

2. **Activity System V2**
   - Goal: turn activity into a useful cross-workflow timeline, not just a note list.
   - Add event categories over time: project note, quote sent, quote accepted, invoice sent, design package requested, schedule changed, task completed.
   - Use small coloured pills so staff can scan event types quickly.

3. **Tasks And Follow-Ups**
   - Goal: make personal and project-linked execution visible.
   - Build on dashboard personal tasks with project-linked tasks, due dates, mine/team views, and overdue/stale surfacing.
   - Keep task interactions lightweight; avoid turning v1 personal reminders into a complex project-management module too early.

4. **Quote And Estimate State Clarity**
   - Goal: make commercial state obvious and safe.
   - Staff should instantly understand editable vs locked, draft vs sent vs accepted, current design source, quote version, invoice status, and safest next action.
   - Prefer a consistent state summary across estimate/quote/invoice surfaces over one-off badges in each tab.

5. **Schedule UX Simplification**
   - Goal: reduce visual competition in the most operationally dense surface.
   - Make today, this week, blockers, unassigned work, and site visits more prominent.
   - Group actions and reduce competing controls before adding new schedule features.

6. **Workbench User Confidence**
   - Goal: keep the design workbench powerful without exposing migration complexity.
   - Default to user-facing states and clear recovery: ready, needs review, unsupported, saved, unsaved, stale.
   - Hide technical diagnostics unless the user asks for detail or the state blocks progress.

7. **Global Search / Quick Open**
   - Goal: reduce navigation friction across projects and contacts.
   - Add a fast project/contact jump by name, phone, address, or quote reference.
   - This is likely high-impact for daily staff use once core project-page clarity improves.

8. **Consistent Empty, Loading, Error, And Recovery States**
   - Goal: every surface should answer what is happening, why it matters, and what to do next.
   - Replace dead-end errors with practical recovery actions.
   - Make local-first pending, retry, conflict, and locked states consistent across staff workflows.

9. **UI System Pass**
   - Goal: make the portal feel cohesive.
   - Standardise card headers, section spacing, pills, buttons, segmented controls, table rows, hover states, badges, and action links.
   - Use recent Dashboard and Recent Activity refinements as the direction for dense internal tooling: compact, scannable, and restrained.

10. **Workflow-Based QA**
    - Goal: judge usability by complete staff journeys, not only by pages.
    - Track core workflows: new lead to site visit, site visit to quote, quote to invoice, accepted quote to scheduled job, design package to running job.
    - Score each workflow by clicks, confusion points, failure recovery, and confidence that saved data is current.

## Current Sequence

1. Project Page Command Centre polish.
2. Activity category expansion and timeline clarity.
3. Dashboard/project task evolution.
4. Quote/estimate state summary standardisation.
5. Schedule priority-view simplification.
6. Workbench state and diagnostics simplification.

## Update Notes

- When a UX pass lands, update the relevant item with the new current state and next gap.
- When user feedback changes the order, update `## Current Sequence` instead of adding a separate plan doc.
- When a UX change crosses data flow, auth, source-of-truth, or readiness boundaries, update the owning canonical doc as well.
