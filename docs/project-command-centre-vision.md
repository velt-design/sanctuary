# Project Operational Command Centre Vision

Status: Permanent product direction  
Owner: Sanctuary Pergolas  
Applies to: Staff portal project experience  
Related documents:

- `project-command-centre-v1.md`: authoritative V1 product contract
- `project-command-centre-roadmap.md`: programme stage and implementation sequence
- `project-command-centre-architecture.md`: repository-grounded technical contract created during Stage 0

## Product purpose

Sanctuary needs each project to operate as a reliable internal business record rather than a collection of tabs that experienced staff must interpret. The Project Operational Command Centre exists to make the most important project truth immediately understandable, to make responsibility explicit, and to reduce missed follow-ups, duplicated interpretation, internal status questions, and dependence on knowledge held by a small number of people.

It should help staff act, not merely display information.

## North star

Any staff member should be able to open a project and immediately understand:

1. What design is current.
2. What price, estimate, or quote is current.
3. What must happen next.
4. Who owns that action.
5. When it is due and whether it is overdue.
6. What is blocking or warning against progress.
7. What the customer was most recently told.
8. The project's broad operational position.

V1 implements this outcome from lead receipt through quote outcome. Later versions may extend the same principles through accepted quote, design completion, scheduling, installation, completion, defects, and warranty, but future scope must not make V1 broad or unreliable.

## Product principles

### 1. Truth before completeness

The Command Centre must show only what the portal can establish from canonical evidence. `Unknown`, `Not recorded`, or `Source unavailable` is better than confident but incorrect information.

### 2. Derived state, not duplicate manual status

Current design, quote state, price, workstream state, overdue state, communication summary, and blockers must be derived from the records that own those facts. The product must not introduce another manually maintained project-health field.

### 3. One primary next action

Every active project should have one clear Sanctuary-owned action that is most likely to progress the project. It must have an owner and due date. Other tasks may still exist, but the Command Centre must identify the one action staff should focus on next.

### 4. Clear ownership

Responsibility must be named. Missing ownership is an exception, not an invisible absence. A person may hold more than one project role where that reflects how Sanctuary works.

### 5. Exceptions receive attention

Blockers, required approvals, failed customer communications, missing ownership, and overdue work should be easy to see. Healthy work should provide compact reassurance without occupying most of the screen.

### 6. Historical commercial records remain historically accurate

A sent or accepted quote must continue to identify the exact estimate and design that produced it. A later estimate, changed project detail, or revised design must not silently rewrite what was previously quoted.

### 7. Specialist workflows remain canonical

The Command Centre summarises and routes. Designs, calculator estimates, quotes, emails, project details, site visits, and later specialist workflows remain the places where their records are created and edited.

### 8. Unknown is a valid operational state

The system must not turn missing evidence into a green state. Unknown information should be visible, understandable, and linked to the action needed to resolve it.

### 9. Additional administration must be justified

A small amount of deliberate entry is worthwhile for ownership, a primary next action, and important customer communication. Staff should not be asked to re-enter design, price, quote, or workflow status that the portal already owns.

### 10. One shared page, permission-controlled detail

Office staff should learn one common project view. Sensitive commercial values and restricted actions should be controlled by permissions rather than separate role-specific page designs.

### 11. Small, trustworthy releases

Each stage should produce a narrow, reviewable improvement with explicit acceptance criteria. Later-stage functionality must not be pulled forward merely because it is technically convenient.

### 12. Business outcomes before technical novelty

The product exists to save staff time, prevent ambiguity, improve follow-up, protect commercial truth, and strengthen handoffs. New infrastructure, automation, or AI is justified only when it improves those outcomes.

## What the product is

The Project Operational Command Centre is:

- The trusted default staff view of a project.
- A concise operational and decision surface.
- The place where staff identify current design, current commercial position, responsibility, next action, and meaningful exceptions.
- A bridge from project-wide understanding into specialist workflows.
- A shared reference that reduces internal status questions and dependence on individual memory.
- A controlled summary with a few high-value actions.
- A long-term framework for consistent project handoffs.

## What the product is not

The Project Operational Command Centre is not:

- A second manually maintained project status.
- A complete project-management platform.
- A replacement for the calculator.
- A replacement for Designs, estimates, or Quotes.
- A replacement for specialist email, site-visit, schedule, or job-pack workflows.
- A general task-management system.
- A full CRM rebuild.
- A construction scheduling system.
- A reporting dashboard filled with charts.
- A manually maintained health score.
- A place to expose every project field.
- An excuse to copy canonical data into a new table.
- An AI-generated assessment of project health.

## Long-term direction

After the lead-to-quote V1 is proven, later versions may extend the same project-centred operating model into:

- Accepted quote and deposit handoff.
- Design completion and construction release.
- Engineering and consent tracking where required.
- Procurement and material readiness.
- Installation readiness and schedule handoff.
- Builder-facing project information.
- Completion evidence and commercial close-out.
- Defects, repairs, and warranty cases.
- Management exceptions derived from trusted project records.

Each later area must have a clear owner, canonical evidence, and narrow business purpose before it appears in the Command Centre.

## Success measures

The product is succeeding when:

- Staff use it as the default project view.
- Current design and commercial position are clear without opening several tabs.
- At least 90-95% of active projects have a named owner and primary next action.
- Staff ask fewer internal questions to establish project status.
- Overdue follow-ups and missing responsibilities are visible and acted on.
- Staff believe the page saves time rather than creates administration.
- Displayed design, quote, price, and communication information is trusted.
- New staff can interpret a project without relying on a verbal explanation from an experienced colleague.
- Specialist workflows remain the clear source of truth.

## Failure conditions

The product has failed if:

- It becomes another manually maintained project status.
- It creates a duplicate or competing task system.
- It requires excessive data entry.
- It becomes a dense page containing every available field.
- It displays a misleading design, quote, or price.
- Staff routinely ignore its warnings.
- Staff still need several tabs or another person to explain basic project status.
- Historical quote or estimate context becomes ambiguous.
- It grows beyond the approved release scope before earlier stages are trusted.
- It relaxes data, access, performance, or recovery controls to make the summary appear complete.

## Document governance

- This vision controls long-term product direction.
- `project-command-centre-v1.md` controls the approved behaviour of V1.
- `project-command-centre-architecture.md` records how the current repository implements the product contract.
- `project-command-centre-roadmap.md` records the current programme stage.
- A Codex goal may implement one approved stage, but may not redefine this vision or the V1 product contract.
- Product-rule changes require an explicit update to the V1 specification before implementation.
