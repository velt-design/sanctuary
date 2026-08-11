# Project Operational Command Centre V1

Status: Historical V1 product baseline. Non-conflicting design/commercial truth rules remain active.
Current implementation authority: `project-command-centre-architecture.md` section `Approved Overview V2 Implementation Handover (READ FIRST)`
Programme stage: Overview V2 is implemented and verified in `20a8adee`, entered production in the controlled 2026-07-30 Project Work cutover, and this file remains the historical V1 baseline
V1 lifecycle scope: Lead received through quote outcome  
Staff-facing default tab: `Overview`  
Related documents:

- `project-command-centre-vision.md`
- `project-command-centre-roadmap.md`
- `project-command-centre-architecture.md` after Stage 0

The approved 2026-07-30 handover supersedes this V1 document where it refers to calls, Site Visit work/tasks/navigation, separate legacy action/task systems, four always-visible workstream cards, structured call/SMS logging, or a lead-to-quote-only Overview composition. Do not implement those superseded rules. Strict current-design, quote-source, price, historical-record, permission, access-ending, and failure-state rules continue unless the handover says otherwise.

## Index

- [V1 outcome](#1-v1-outcome)
- [Scope and users](#2-scope-and-users)
- [Current design resolution](#7-current-design-resolution)
- [Commercial resolution](#8-commercial-resolution)
- [Data ownership and repository mapping](#17-data-ownership-and-repository-mapping)
- [Acceptance criteria](#20-acceptance-criteria)
- [Open business decisions](#22-open-business-decisions-for-jordan)

## 1. V1 outcome

V1 replaces the existing Activity default with a trusted Overview that lets any office staff member identify the current design, current commercial position, primary next action, responsible person, due state, material exception, and latest meaningful customer communication within 60 seconds.

V1 is a read-focused summary with a few controlled operational actions. It is not a complete project-management surface.

## 2. Scope and users

### Included lifecycle

V1 covers:

1. Lead received.
2. Customer contact and follow-up.
3. Site information and site-visit progress relevant to quoting.
4. Design and estimating.
5. Draft, sent, accepted, or declined quote outcome.

The architecture may anticipate later lifecycle stages only where necessary to avoid a poor data model. Later workflows must not appear as incomplete V1 features.

### Users

The same core Overview serves:

- Administration staff.
- Sales staff.
- Architectural designers.
- Estimators.
- Directors.
- Other authorised office staff.

V1 must not create a separate layout for each role. Permissions may alter sensitive values and available actions.

### Existing project experience

- The staff-facing default tab label becomes `Overview`.
- The internal `activity` tab key may remain if that preserves routes, links, tests, and lazy-loading boundaries.
- Existing notes, stage tasks, current-design information, and activity capability are retained, reorganised, or linked.
- The staff-facing project tabs are Overview, Calculator, Commercial, and conditional Job Packs.
- The compatibility route keys remain `activity`, `estimates`, `quotes`, `invoices`, and `job-packs`; Commercial groups the `quotes` and `invoices` views.
- The standalone project Emails UI is retired. Durable email audit data, previews, and quote/invoice delivery side effects remain with their specialist owners. Project details are consolidated into Overview.

## 3. Staff decisions supported by V1

### General office staff

The Overview must answer:

- Am I looking at the right customer and project?
- What is the broad lead-to-quote stage?
- What design is current?
- What estimate or quote is the commercial source?
- What customer price is current?
- What is the quote outcome?
- What must Sanctuary do next?
- Who owns that action?
- When is it due?
- Is any information unreliable or blocking progress?
- What was the customer most recently told?
- Which specialist workflow should I open next?

### Administration

The Overview must help administration decide:

- Does the project have a Project Owner?
- Is initial contact or follow-up overdue?
- Is the customer contact information usable?
- Is the site address verified?
- Is a site visit waiting to be arranged or confirmed?
- Has a material customer communication failed?
- Does the project need an owner or primary next action assigned?

### Sales

The Overview must help sales decide:

- Has personal contact occurred?
- What was most recently communicated?
- What customer decision is outstanding?
- Which design and price should be discussed?
- Is the primary next action mine?
- Is the project waiting on Sanctuary or on the customer?
- Should the next step be contact, site visit, estimating, quote preparation, follow-up, revision, or archive?

### Design

The Overview must help design decide:

- Which estimate-backed design is current?
- Is that design the exact source of a current quote?
- Is a newer design present but not commercially current?
- Is the source design unavailable or contradictory?
- Is design work still in progress, ready for estimating, or locked by a quote?
- Who owns the design work?

### Estimating

The Overview must help estimating decide:

- Which estimate and costing state support the current price?
- Is costing current, deliberately preserved, stale, or unavailable?
- Is the selected quote linked to the correct estimate?
- Is the estimate editable or quote-locked?
- Is a commercial review or approval needed?
- Who owns the estimating work?

### Directors

The Overview must help directors decide:

- Is the project stalled or unowned?
- Is the primary action materially overdue?
- Is the current design or commercial source unreliable?
- Is an approval required?
- Is a staff member knowingly accepting a commercial exception?
- Does the project need intervention rather than more routine follow-up?

## 4. Core concepts and language

### Lifecycle stage

The existing project pipeline remains the broad lifecycle indicator. V1 does not create another top-level stage system.

### Workstream

A workstream is an evidence-derived summary of one supporting area. V1 has four workstreams:

1. Sales and customer commitment.
2. Site information.
3. Design and estimating.
4. Quote and commercial.

### Primary next action

The one Sanctuary-owned action most likely to progress the project. It has one owner and due date.

### Blocker

A condition that means the project cannot safely or legitimately take the affected next step.

### Warning

A condition staff should understand, but which does not universally prevent work from continuing.

### Approval required

A condition that may proceed only after an authorised person accepts a defined exception.

### Critical exception

A visually urgent condition. It may be a blocker, a missing approval, a failed material communication, or an urgent overdue action. Red presentation does not automatically mean every project operation is disabled.

### Unknown

The portal lacks enough trustworthy evidence to determine a state. Unknown must not be presented as Ready.

## 5. Information architecture

The sections appear in this order:

1. Project identity/navigation header and Overview status/details card.
2. Critical exceptions strip.
3. Current design and commercial record.
4. Primary next action.
5. Lead-to-quote workstreams.
6. Latest customer communication.
7. Meaningful project timeline.

### 5.1 Project identity, navigation, status, and details

#### Purpose

Confirm project identity and ownership in the fixed header, then expose editable project facts and lifecycle state in Overview before staff act.

#### Information displayed

- Project name.
- Customer name.
- Contact phone and email.
- Site address.
- Site-address verification state.
- Quote reference when available.
- Existing pipeline stage.
- Project Owner.
- Last successful Overview refresh time.

#### Primary actions

- Call customer.
- Email customer.
- Open map.
- Edit contact or project details through the owning workflow.
- Assign or change an owner, subject to permission.

#### Canonical source

- `projects` for project identity, address, quote reference, and pipeline stage.
- `contacts` for customer identity and contact details.
- Canonical project-owner records confirmed during Stage 0.
- Existing authenticated project snapshot and query boundary.

#### Visibility

Always visible.

- Project Owner is shown from lead through deposit and remains visible afterward when assigned.
- The approved owner choices are Jordan, JP, Joe, and Bruce.
- A missing owner is shown explicitly, not omitted.

#### Desktop

One fixed sticky header and one Overview card:

- Header top row: identity, Project Owner, Projects, Design Workbench, and the admin delete action.
- Header bottom row: horizontally scrollable specialist tabs using the established URL keys.
- Overview Status & Details: current stage, contact, site, region, and shared project/quote reference, with local-first detail editing.
- The lifecycle pipeline is not repeated in the header.

#### Tablet

- Identity and Project Owner remain in the header.
- Status & Details spans the Overview row above commercial and primary-action cards.
- Tabs remain horizontally scrollable and keyboard accessible.

#### Mobile

- Project name and Project Owner remain in the sticky header.
- Header tabs scroll horizontally without widening the page.
- Status & Details, commercial state, and primary action stack in that order with stage and core facts always visible.

#### Loading

Render known authenticated summary information immediately. Show a small `Updating project` indicator while the complete snapshot or Command Centre read model refreshes.

#### Unknown

Use `Not recorded` or `Not assigned` for individual fields. Do not hide the label.

#### Stale

Retain the last known permitted data and show `Could not refresh - showing last known details`.

#### Failure

Provide Retry without removing known permitted identity information.

#### Unavailable

For access-ending 401, 403, or 404 states, hide protected cached project information and use the existing unavailable project boundary.

---

### 5.2 Critical exceptions strip

#### Purpose

Expose the small number of conditions requiring immediate review.

#### Information displayed

Only active issues, including reliable V1 examples such as:

- Quote source design unavailable.
- Current design and current quote source conflict.
- Critical pricing or estimate validation failure.
- Accepted quote missing reliable stored commercial information.
- Material customer communication failed with no later success.
- Required commercial approval missing.
- Lead response outside the configured SLA.
- Critical primary action materially overdue.

Missing owner, no next action, unverified address, and normal overdue work are warnings unless a later approved rule makes them blockers.

#### Primary actions

Every issue has exactly one leading action, for example:

- Review quote source.
- Open estimate issue.
- Retry quote send.
- Assign owner.
- Set next action.
- Review approval.

#### Canonical source

A server-owned V1 issue resolver reading canonical records. The resolver does not store a manually selected overall issue state.

#### Visibility

- Show directly beneath the header when any critical exception exists.
- When only warnings exist, show a compact warning count with a Review action.
- When no critical issue exists, show one quiet confirmation: `No critical lead-to-quote exceptions`.

#### Desktop

One full-width, compact strip. Do not render many equal-sized alert cards.

#### Tablet

Stack at most two issue summaries before a `View all` action.

#### Mobile

Critical issues appear before current design. One issue is expanded; remaining issues are counted.

#### Loading

Retain last known exceptions with an updating indicator.

#### Unknown

If issue evidence is incomplete, show `Exception status unavailable` rather than a green state.

#### Stale

Retain the last known issue and label it stale until authoritative refresh succeeds.

#### Failure

Provide a Retry action and do not claim the issue has cleared.

#### Unavailable

Hide protected issue detail with the project access boundary.

---

### 5.3 Current design and commercial record

#### Purpose

Answer the two highest-priority questions:

1. What design is current?
2. What price, estimate, or quote is current?

#### Information displayed

##### Current design

- Source type:
  - Accepted quote.
  - Sent quote.
  - Draft quote.
  - Estimate.
  - No design.
- Exact estimate version label.
- Saved date.
- Shape.
- Primary dimensions.
- Roofing.
- Additional-module count.
- Design completeness summary.
- Costing state:
  - Current.
  - Stored costing retained.
  - Stale.
  - Unavailable.
- Estimate editability or quote-lock state.
- Neutral notice when a newer estimate exists but is not the selected quote source.

##### Commercial record

- Quote reference.
- Quote version.
- Quote status:
  - Draft.
  - Sent.
  - Accepted.
  - Declined as historical outcome only.
- Customer price including GST.
- Sent date when reliable.
- Accepted or declined date when reliable.
- Delivery state:
  - Not sent.
  - Sent.
  - Send failed.
  - Accepted.
  - Declined.

##### Sensitive values

For authorised users only:

- Internal true cost.
- Estimated margin.
- Material discount or adjustment indicator.

These values remain visually secondary.

#### Primary actions

State-dependent actions may include:

- Open current design.
- Open estimate.
- Open quote.
- Create quote from estimate.
- Review stale costing.
- Retry failed quote send.
- Create or open a revision.

#### Canonical source

- `estimates`.
- `quote_versions`.
- Quote send and delivery records.
- Existing estimate and quote query helpers.
- A strict Command Centre current-design resolver.

#### Visibility

Always visible, including a truthful empty state.

#### Desktop

The largest above-the-fold card. Current design and commercial data should read as related, but exact estimate and quote sources remain explicit.

#### Tablet

One full-width card. Design summary precedes secondary metadata. Actions wrap beneath.

#### Mobile

Display before the primary next action because design and commercial truth are the highest-priority questions.

Always show without an accordion:

- Source.
- Exact version.
- Shape or incomplete-design label.
- Customer price or unavailable label.
- Quote status.
- Primary actions.

#### Loading

Show known design and commercial data only when it belongs to the authenticated user and project. Mark placeholder or cached data as updating.

#### Unknown

Use explicit labels such as:

- `No design recorded`.
- `Source design unavailable`.
- `Price unavailable`.
- `Quote status unavailable`.

#### Stale

Retain the last known exact source and display `Could not refresh`. Never substitute a different estimate because it loaded successfully.

#### Failure

Keep the last known reliable record and link to Retry or the owning workflow.

#### Unavailable

Hide protected commercial and design data when access ends.

---

### 5.4 Primary next action

#### Purpose

Answer what Sanctuary must do next, who owns it, and when it is due.

#### Information displayed

- Action title.
- Owner.
- Due date or time.
- Relative due state:
  - Due today.
  - Due tomorrow.
  - Due in N days.
  - Overdue by N days.
- Source:
  - Automated workflow task.
  - Quote follow-up task.
  - Manual action.
- Direct workflow link when one exists.
- Short context or required outcome.
- Last changed by and changed time.
- Critical or normal classification.

#### Primary actions

Subject to source and permission:

- Open.
- Complete.
- Reschedule.
- Reassign.
- Change primary action.
- Create manual action.

#### Canonical source

A canonical primary-action selector that references existing authoritative tasks where possible. It may own manual-action data only when no existing source task represents the work.

The final data model is a Stage 0 architecture decision. V1 must not rely indefinitely on several compatibility project columns as competing sources.

#### Visibility

Always visible for active lead-to-quote projects.

After a project leaves the V1 lifecycle, an existing action may remain visible, but V1 must not invent construction actions.

#### Desktop

Prominent card beside the current design and commercial record.

#### Tablet

Full-width card immediately after current design.

#### Mobile

Immediately after current design. Action, owner, and due state remain visible without expansion.

#### Loading

Retain the last known action and label it updating.

#### Unknown

Use:

- `No next action set`.
- `Owner not assigned`.
- `Action source unavailable`.

#### Stale

Keep the last known action with disabled destructive or completion controls until the source refreshes, unless the owning mutation contract safely supports action.

#### Failure

Provide Retry or Review. A failed completion must not advance to another candidate.

#### Unavailable

Hide protected action details with the project boundary.

---

### 5.5 Lead-to-quote workstreams

#### Purpose

Provide compact, evidence-based reassurance about the supporting work without creating a second pipeline.

#### Information displayed

For each of the four workstreams:

- Plain-language state.
- Owner.
- Most important supporting evidence.
- Active warning or blocker.
- One relevant action or workflow link.

#### Primary actions

Open the specialist workflow that owns the evidence. Workstream state itself is not directly editable.

#### Canonical source

A server-owned workstream resolver over canonical project, contact, site-visit, estimate, quote, communication, and action records.

#### Visibility

Always show all four workstreams. `Not required` may be used only where an explicit, auditable requirement decision exists.

#### Desktop

Four compact cells or cards in one row.

#### Tablet

Two columns.

#### Mobile

One compact row per workstream.

#### Loading

Show known states as updating. Do not convert missing placeholder arrays into Ready.

#### Unknown

Use `Unknown` with the missing evidence described.

#### Stale

Show the last known state and its evidence as stale.

#### Failure

Show `Could not assess` with a link to the owning workflow or Retry.

#### Unavailable

Hide protected workstream evidence with the project boundary.

---

### 5.6 Latest customer communication

#### Purpose

Answer what the customer was most recently told and whether a newer response exists.

#### Information displayed

##### Latest outbound update

- Channel.
- Date and time.
- Staff author or automated sender.
- Short summary.
- Delivery state.
- Source link.

##### Latest customer response

Display separately when it is newer than the latest outbound update:

- Quote accepted or declined.
- Recorded inbound call, SMS, or message.
- Recorded customer decision.

#### Primary actions

- Log call.
- Log message.
- Add note.
- Open email or quote event.
- Retry failed communication.
- Create or open follow-up action.

#### Canonical source

A merged communication read model over:

- Customer-facing `email_outbox` records.
- Quote send records and outcomes.
- Quote accept or decline events.
- Structured project communication records based on the existing notes boundary.
- Relevant site-visit confirmations.

#### Visibility

Always visible.

When only an automated acknowledgement exists, state:

`Automated acknowledgement sent; no personal contact recorded.`

#### Desktop

One compact full-width summary beneath the primary design and action row.

#### Tablet

Full-width summary.

#### Mobile

One card showing latest outbound update and, when relevant, latest response.

#### Loading

Retain last known communication with an updating label.

#### Unknown

Use `No meaningful customer communication recorded`.

#### Stale

Retain the exact communication event with a stale label.

#### Failure

Communication delivery failure remains visible even after the preview or timeline read fails.

#### Unavailable

Hide protected communication detail with the project boundary.

---

### 5.7 Meaningful project timeline

#### Purpose

Provide a readable business history that replaces the current note-only interpretation of Activity.

#### Information displayed

Included event categories:

- Internal staff note.
- Logged customer call.
- Logged SMS or message.
- Customer decision.
- Customer-facing email queued, sent, or failed.
- Site visit booked, confirmed, changed, or completed.
- Estimate created or materially revised.
- Quote created.
- Quote sent or resent.
- Quote revised.
- Quote accepted.
- Quote declined.
- Pipeline stage changed.
- Primary action created, changed, completed, or rescheduled.
- Approval requested, approved, rejected, or invalidated.

Technical child events generated by one business action are grouped.

#### Primary actions

- Filter by category.
- Add note.
- Log customer contact.
- Open source workflow.
- Expand technical detail when needed.

#### Canonical source

A server-owned merged timeline over:

- `project_notes`.
- `email_outbox`.
- `audit_events`.
- Quote versions and send logs.
- Site-visit records.
- Primary-action history.

#### Visibility

Below the fold. Newest meaningful events first.

#### Desktop

Timeline uses the main lower-content width. It must not become a technical audit log.

#### Tablet

Full-width timeline.

#### Mobile

Full-width chronological feed with compact event cards.

#### Loading

Retain known events while refreshing.

#### Unknown

Only show `No activity recorded` after a fresh successful read across the included sources.

#### Stale

Retain last known events and show refresh failure.

#### Failure

One source failure must not cause partial data to be presented as a complete fresh timeline. Either expose partial status clearly or retain the previous complete known timeline.

#### Unavailable

Hide protected event content with the project boundary.

## 6. Above-the-fold wireframes

### Desktop

```text
+------------------------------------------------------------------------------+
| PROJECT / CUSTOMER                              STAGE       OWNERS            |
| Name, verified address, contact actions         Quoting     Sales: Jordan    |
| Quote reference                                             Estimator: Joe   |
+------------------------------------------------------------------------------+

+------------------------------------------------------------------------------+
| CRITICAL EXCEPTION, OR QUIET "NO CRITICAL LEAD-TO-QUOTE EXCEPTIONS"          |
+------------------------------------------------------------------------------+

+--------------------------------------------+---------------------------------+
| CURRENT DESIGN AND COMMERCIAL RECORD       | PRIMARY NEXT ACTION             |
|                                            |                                 |
| Accepted / Sent / Draft / Estimate         | Call client about revised quote |
| Exact estimate version                     | Owner: Ellen                    |
| Shape, size, roofing                       | Due: Today, 3:00 pm             |
|                                            | Status: Due today               |
| $XX,XXX inc GST                            |                                 |
| Quote Q-#### - Version N - Sent            | [Open] [Complete]               |
| Costing current / stored / stale           | [Reschedule] [Reassign]         |
|                                            |                                 |
| [Open design] [Open quote]                 |                                 |
+--------------------------------------------+---------------------------------+

+----------------+----------------+----------------+---------------------------+
| SALES          | SITE INFO      | DESIGN/EST.    | QUOTE/COMMERCIAL          |
| In progress    | Ready          | Ready          | Waiting on customer       |
+----------------+----------------+----------------+---------------------------+

+------------------------------------------------------------------------------+
| LAST CUSTOMER UPDATE                                                        |
| Quote sent by Ellen, Monday 2:14 pm. Latest response: none. [Open timeline]  |
+------------------------------------------------------------------------------+
```

### Mobile

```text
Project name
Customer - Stage
[Call] [Email] [Map]

Critical exception, only when present

Current design and commercial
- Source and exact version
- Shape and size
- Customer price
- Quote status
[Open design] [Open quote]

Next action
- Action
- Owner
- Due / overdue
[Open] [Complete] [More]

Workstreams
- Sales
- Site information
- Design and estimating
- Quote and commercial

Latest customer update
[Log contact] [Open timeline]

Timeline
```

### Responsive rules

- Current design, current price, quote state, next action, owner, due state, and critical exception must not be hidden behind an accordion.
- Use one page-owned scrollbar.
- No horizontal scrolling at 390 px.
- Internal cost and margin remain secondary even for authorised users.
- Primary actions remain keyboard and touch accessible.

## 7. Current design resolution

### 7.1 Eligible quote selection

Select one eligible quote version in this order:

1. Most recently created `ACCEPTED` quote version.
2. Otherwise, most recently created `SENT` quote version.
3. Otherwise, most recently created `DRAFT` quote version.
4. Otherwise, no current quote.

`DECLINED` quote versions never become current.

Accepted base and add-on families may coexist legitimately. Select the most recent accepted version as the current design source, but raise a data-integrity warning only when more than one accepted version exists within the same commercial family.

### 7.2 Design selection when a quote exists

When an eligible quote exists, the current design is the quote version's exact source estimate.

The Overview must not substitute:

- The active draft estimate.
- The latest estimate.
- The most recently edited estimate.
- Another quote's estimate.

### 7.3 Missing or unavailable quote source estimate

When the selected quote's source estimate is missing or unavailable:

- Keep the selected quote as the commercial source.
- Show its stored quote price only when reliable.
- Show `Source design unavailable`.
- Raise a blocker.
- Provide `Review quote source`.
- Do not display geometry or design description from another estimate.

### 7.4 Design selection when no eligible quote exists

Use:

1. Active draft estimate, when one exists and is eligible.
2. Otherwise, most recently created eligible, non-archived estimate.
3. Otherwise, no current design.

Stage 0 must verify the authoritative definition of active draft and estimate eligibility.

### 7.5 Multiple estimate versions

Always expose:

- Exact estimate version label.
- Saved date.
- Active-draft state.
- Whether it is the current quote source.
- Whether a newer eligible estimate exists.

A newer estimate does not replace a sent or accepted quote's source design.

When relevant, show:

`A newer estimate exists, but it is not the source of the current quote.`

### 7.6 Declined quotes

- Declined quotes remain in history and timeline.
- They never become current design or current quote.
- When no accepted, sent, or draft quote exists, fall back to the selected estimate.
- Show `Latest quote declined` as a commercial outcome.
- The primary next action should normally become follow-up, revise, or archive, based on existing work and staff selection.

### 7.7 No design

No design is a normal state for an early lead. It becomes a blocker only when the current lifecycle or commercial record requires a design, for example:

- A draft, sent, or accepted quote claims a source design that cannot be identified.
- Quote preparation is being treated as ready without a reliable estimate source.

## 8. Commercial resolution

### 8.1 Current quote

Use the eligible quote selected in Section 7.

### 8.2 Quote price

When an eligible quote exists:

- For a sent or draft quote, use that quote version's stored total including GST.
- For accepted work, sum the newest accepted stored total from the base family and every accepted add-on family.
- Do not recalculate.
- Do not merge artifacts or replace a missing quote total with an estimate total.
- Show `Quote price unavailable` when any stored total required by the displayed accepted-project total is missing or invalid.

### 8.3 Estimate price

When no eligible quote exists:

- Use the selected estimate's stored customer-price summary.
- Label it `Estimate price`.
- Show `No quote created`.

### 8.4 Quote delivery and outcome

Derive from the owning quote and send records:

- Draft.
- Ready to send, only when the quote domain can establish readiness.
- Sent.
- Waiting on customer.
- Accepted.
- Declined.
- Send failed.
- Unknown.

The Command Centre must not duplicate quote-domain send-readiness rules.

### 8.5 Costing state

Use the saved estimate's authoritative pricing and freshness metadata.

Allowed Overview labels:

- `Costing current`.
- `Stored costing retained`.
- `Costing may be stale`.
- `Costing unavailable`.

The Overview must not run the costing engine.

Stale or preserved costing is normally a warning, not a universal blocker. The quote workflow remains responsible for deciding whether a particular commercial action may proceed.

### 8.6 Historical accuracy

- Sent and accepted quote values remain historical records.
- Later estimate or design changes do not rewrite them.
- Current project contact or address changes do not silently rewrite historical quote snapshots.
- The Overview clearly distinguishes current editable project facts from `as estimated` or `as quoted` facts where both are shown.

### 8.7 Commercial conflict conditions

The Overview must not claim a reliable current commercial source when:

- Selected quote references a missing estimate.
- Loaded design does not match the selected quote source.
- Selected quote has no reliable stored price.
- Multiple incompatible records claim accepted state.
- Quote data is available but access to its source design has ended.

These conditions require review rather than a latest-record fallback.

## 9. Ownership

### 9.1 Required owner

- `new`, `contacted`, `site_visit`, `quoting`, `sent`, and `deposit` require one Project Owner.
- `scheduled`, `completed`, and `paid` retain and display an existing assignment but do not create a missing-owner exception.
- The owner roster is Jordan, JP, Joe, and Bruce.
- Project Manager or specialist-role ownership is outside V1.

### 9.2 Owner display

Display:

- Name.
- Project Owner label.
- Missing state.
- Change action, subject to permission.

Store a stable approved owner key and resolve its display label from the canonical owner roster.

### 9.3 When a workflow starts

Owner applicability follows the pipeline-stage table in 9.1. It is not inferred from notes, project creator, task author, quote sender, or a manually selected workstream state.

Owner backfill prefers the legacy Sales assignment, then Design and Estimating, only when the active assignee name maps to Jordan, JP, Joe, or Bruce. Unknown identities remain unassigned rather than being guessed.

### 9.4 Missing owner behaviour

- Show an amber warning.
- Provide `Assign owner`.
- Include the project in an exception queue.
- Do not universally block project editing.

Admins may assign, reassign, or unassign the Project Owner. Staff cannot change project ownership. Action reassignment remains a separate staff capability.

## 10. Primary next action

### 10.1 Definition

The primary next action is one concrete Sanctuary-owned action most likely to progress the project.

Use:

`Call Sarah to confirm timber or acrylic roofing.`

Do not use:

`Waiting on customer.`

When the customer owes a decision, a Sanctuary staff member still owns the dated follow-up.

### 10.2 Qualifying sources

A primary-action candidate may come from:

1. An open automation `tasks` record.
2. An open `followup_tasks` record.
3. A canonical manual project action.

Exclude:

- Personal dashboard reminders.
- Project checklist and stage actions.
- Completed tasks.
- Skipped tasks.
- Undated tasks from automatic selection; expose them as selectable work requiring a due date.
- Generic status labels.
- Approval and blocker-resolution actions until Stage 5.

### 10.3 Selection precedence

Open automation and follow-up candidates always precede manual candidates. Within each source class select:

1. Overdue customer-facing action.
2. Other overdue action.
3. Action due today.
4. Earliest future action.

Break ties by earliest exact due time, oldest creation time, then stable source kind and ID. A manual action wins automatically only when no qualifying automation or follow-up candidate exists.

Customer-facing task types are `REVIEW_NEW_LEAD`, `BOOK_SITE_VISIT`, `ATTEND_SITE_VISIT`, `FINALIZE_SEND_QUOTE`, `FOLLOWUP_CALL`, `FOLLOWUP_EMAIL`, `SCHEDULE_INSTALL_WINDOW`, `CONFIRM_FINAL_SCHEDULE`, and `RESEND_EMAIL`. Manual Call, Site visit, Quote, and Follow-up categories are customer-facing.

### 10.4 Automation and manual control

- Automation may create or propose an action from a meaningful business event.
- Authorised staff may select a different existing candidate.
- Authorised staff may create a manual action.
- Selecting a primary action does not delete other tasks.
- A manual change records actor and time.
- Creating a manual action selects it and records the current outranking-candidate hash.
- A later higher-ranked candidate or material ranking change creates a conflict; a lower-ranked candidate does not.
- During conflict, regular staff may complete the selected action but may not reschedule, reassign, reselect, or change criticality.
- An admin resolves conflict by retaining the selected action or selecting a current outranking candidate. Retaining records the new outranking hash.

### 10.5 Owner resolution

Use:

1. Explicit source-task assignee.
2. Explicit manual-action owner.
3. The single Project Owner, regardless of action category.
4. Unassigned.

An invalid, deleted, or banned source assignee is treated as unassigned before applying the role fallback.

### 10.6 Due date

- Every primary action requires a due date or due time.
- Store unambiguous `timestamptz` values.
- Display and overdue calculations use `Pacific/Auckland`.
- Staff-entered dates resolve to 5:00pm Auckland time, including daylight saving. Exact source timestamps remain exact.
- `REVIEW_NEW_LEAD` is due at 5:00pm on the next business day, excluding weekends, national/Auckland holidays, and company closures.
- The contacted-project follow-up remains two business days and is persisted as a follow-up task rather than a project-column write.

### 10.7 Completion

Completion must:

- Persist through the source task's owning API when linked.
- Record actor and completion time.
- Optionally capture a short outcome.
- Wait for authoritative success before claiming completion or automation side effects.
- Re-run candidate selection.
- Show the next candidate immediately after confirmed completion.

### 10.8 Rescheduling

- Update the owning source where supported.
- Preserve prior due date and actor in history.
- If a linked source cannot be rescheduled, create a clearly related replacement action rather than silently rewriting unrelated task data.
- The third and every later lifetime reschedule requires a reason.

### 10.9 Reassignment

- Update the source owner where supported.
- Otherwise update the canonical primary-action assignment.
- Preserve assignment history.
- Any staff member may reassign the current action to any active staff member. This permission is separate from project-owner permissions.

### 10.10 No primary action

Show:

`No next action has been set.`

Provide:

- Set next action.
- Select from open work.

Add the project to the exception queue. Do not universally block other work.

### 10.11 No action owner

Show:

`This action has no owner.`

Provide:

- Assign owner.
- Assign to me.

### 10.12 Relationship to existing task systems

V1 must preserve the distinction between:

- Stage checks: evidence that a stage requirement is done.
- Automation tasks: event-created staff obligations.
- Follow-up tasks: quote follow-up obligations.
- Personal dashboard reminders: private scratch reminders.
- Primary action: the selected project-wide focus.

The primary action references existing tasks where possible. It is not a fifth general task list.

### 10.13 Severity and audit

- Overdue actions remain amber regardless of elapsed time.
- Red/critical is explicit only. Setting or clearing it requires a reason and audit event.
- Completion, rescheduling, reassignment, selection, conflict resolution, critical changes, manual creation, and owner changes are audited.
- Full audit data is retained. Project Overview displays the latest five events inline and the latest 20 in recent history.

## 11. V1 workstreams

### 11.1 Shared workstream rules

Allowed shared states are:

- Unknown.
- Not started.
- In progress.
- Waiting on customer.
- Ready.
- Blocked.
- Not required, only with explicit evidence.

A workstream may use a more specific user-facing label while mapping to one of these meanings.

Rules:

- State is derived on the server.
- Staff cannot manually select Ready.
- Every state has inspectable evidence.
- Missing evidence produces Unknown, not Ready.
- Every blocker or warning links to its owning workflow.
- Workstreams do not replace the main pipeline.

---

### 11.2 Sales and customer commitment

#### Purpose

Show whether Sanctuary has established personal contact and a clear customer-facing path forward.

#### Canonical evidence

- Pipeline stage.
- Project Owner.
- Primary next action.
- Personal customer communication.
- Site-visit progress.
- Quote response.
- Recorded customer decision.

#### Derived states

**Not started**

- Project is an early lead.
- No personal customer communication is recorded.

**In progress - contact required**

- Lead exists.
- Personal contact has not occurred.
- A Sanctuary contact action is open or should be created.

**In progress**

- Personal contact has occurred.
- Sanctuary owns an open next action.
- No customer decision is the immediate dependency.

**Waiting on customer**

- A recorded outbound request or quote requires a customer decision.
- Sanctuary has a dated follow-up action.

**Ready**

- The project has progressed into site information, design, estimate, or quote work with no active Sales blocker.

**Blocked**

- No usable customer contact method.
- A recorded customer commitment materially conflicts with the current design or commercial record.
- A required approval blocks the promised next step.

**Unknown**

- The communication or ownership evidence cannot establish a state.

#### Warnings

- Project Owner missing.
- No primary next action.
- No personal contact.
- Normal action overdue.
- Stage unusually old, using an approved threshold.

#### Owner

Project Owner.

#### Actions and links

- Call or email customer.
- Log contact.
- Set or open next action.
- Open Site Visits.
- Open Designs or Quotes.

---

### 11.3 Site information

#### Purpose

Show whether customer and site information is sufficiently reliable for the current lead-to-quote step.

#### Canonical evidence

- Project site address.
- Explicit address-verification evidence.
- Site-visit event and status.
- Explicit site-visit requirement decision.
- Structured customer or site-information records when introduced.

#### Derived states

**Not started**

- No meaningful site address.
- No site-visit activity.
- No explicit `not required` decision.

**In progress - address incomplete**

- An address value exists but is not verified.
- This includes website projects where `site_address` may initially contain only a suburb.

**In progress - site visit to arrange**

- A site visit is explicitly required.
- No booked visit exists.

**In progress - site visit booked**

- A site visit has a scheduled time and an active booked status.

**In progress - information under review**

- Site information or a completed visit exists.
- Design or estimating review remains open.

**Ready**

One of these evidence paths is true:

- Address is verified and a required site visit is complete.
- Address is verified and a site visit is explicitly marked not required with a reason.
- Stage 0 identifies another existing canonical evidence path that provides equivalent confidence.

Ready for this V1 workstream means sufficient lead-to-quote site context. It does not certify construction measurements, engineering, consent, or installation readiness.

**Blocked**

- Site cannot be reliably identified.
- A required visit cannot proceed because of an explicit critical issue.
- Contradictory critical site information is recorded.

**Not required**

Use only for the site-visit element after an explicit decision and reason. The workstream still reports address quality.

**Unknown**

- Requirement or verification evidence is unavailable.

#### Warnings

- Address unverified.
- Site visit not confirmed.
- Non-critical site information incomplete.
- Site information has not been reviewed recently.

#### Explicit non-blockers

V1 must not treat these as universal hard blockers:

- Engineering complete.
- Consent complete.
- Critical measurements complete.

Those may become project-specific controls in later lifecycle work.

#### Owner

Project Owner.

#### Actions and links

- Edit project address.
- Verify address.
- Book or open site visit.
- Mark site visit not required with reason, subject to permission.
- Open communication timeline.
- Open current estimate.

---

### 11.4 Design and estimating

#### Purpose

Show whether a reliable estimate-backed design and customer price exist for the current commercial state.

#### Canonical evidence

- Strict current-design resolver.
- Exact source estimate.
- Estimate status and version.
- Estimate completeness.
- Costing freshness.
- Estimate warnings and validation.
- Estimate editability and quote lock.
- Project Owner.

#### Derived states

**Not started**

- No eligible estimate exists.

**In progress**

- An estimate exists.
- Design or pricing work is incomplete, editable, or awaiting review.
- No critical source conflict exists.

**Review required**

- Costing is stale.
- Stored costing was deliberately retained after price-affecting changes.
- A newer estimate exists than the current quote source.
- Non-critical warnings require staff review.

**Ready**

- Exact source estimate is identifiable.
- Required design summary is available.
- A stored customer price exists.
- No critical validation or source conflict exists.

**Ready - locked**

- The reliable source estimate is locked by a sent, accepted, or declined quote.
- This is a commercial-history protection, not a problem.

**Blocked**

- Selected quote source estimate is missing or unavailable.
- Loaded design conflicts with the selected quote source.
- Critical pricing or validation failure.
- No reliable customer price when the current workflow requires one.

**Unknown**

- Estimate or design evidence cannot be loaded.

#### Warnings

- Project Owner missing.
- Costing may be stale.
- Newer unquoted estimate exists.
- Design summary incomplete.
- Non-critical estimate warnings.

#### Owner

- Project Owner, with an explicit source-task assignee taking precedence for the primary action when present.

#### Actions and links

- Open current estimate.
- Open calculator.
- Open Design Workbench when applicable.
- Review costing.
- Open or create quote.

---

### 11.5 Quote and commercial

#### Purpose

Show the current customer-facing commercial outcome and next commercial action.

#### Canonical evidence

- Quote versions.
- Exact quote source estimate.
- Stored quote totals.
- Quote send records.
- Accept or decline state.
- Required commercial approvals.
- Quote follow-up actions.

#### Derived states

**Not started**

- No quote exists.

**In progress - draft**

- Current eligible quote is Draft.
- It is not yet established as ready to send.

**Ready**

- The quote domain can establish that required send conditions and approvals are satisfied.
- The Overview must call or reuse the owning readiness logic rather than duplicate it.

**In progress - sent**

- Current quote is Sent.
- Successful send evidence exists.
- A response is not yet recorded.

**Waiting on customer**

- Current quote is Sent.
- A customer decision is outstanding.
- Sanctuary has a dated follow-up action.

**Ready - accepted**

- Current quote is Accepted.

**In progress - declined**

- No accepted, sent, or draft quote remains current.
- The latest quote outcome is Declined.
- A follow-up, revision, or archive decision is needed.

**Blocked - send failed**

- A material quote send was attempted and failed.
- No later successful send exists.

**Blocked**

- Quote source design unavailable.
- Required approval missing.
- Stored commercial total unavailable.
- Quote state is internally inconsistent.

**Unknown**

- Quote evidence cannot be loaded.

#### Warnings

- Quote follow-up overdue.
- Newer estimate exists than the quote source.
- Successful customer delivery cannot be confirmed.
- Sent quote has remained unanswered beyond an approved threshold.

#### Owner

Project Owner for progression, with the explicit source-task assignee owning specialist pricing correction when present.

#### Actions and links

- Open quote.
- Send or retry through the quote workflow.
- Follow up.
- Open source estimate.
- Create revision.
- Request or review commercial approval.
- Archive decision through the owning workflow.

## 12. Site information clarification

V1 does not claim that a project is ready for installation or construction.

The Site information workstream is limited to lead-to-quote confidence and may consider:

- A verified full site address.
- Site-visit requirement.
- Site-visit booking or completion.
- An explicit `site visit not required` decision with reason.
- Relevant customer and site context.

It must not infer:

- A populated address is verified.
- A completed visit proves all measurements are construction-ready.
- Engineering or consent is not required.
- A design is ready to build.
- Materials can be ordered.
- The project can be scheduled.

Stage 0 must assess whether address-verification and site-visit-requirement evidence already exists. If it does not, it should recommend the smallest auditable record rather than a broad site-survey system.

## 13. Customer communication

### 13.1 Latest meaningful outbound update

Show the most recent qualifying outbound event by actual occurrence or send time:

- Personal email.
- Recorded outbound phone call.
- Recorded outbound SMS.
- Recorded outbound message.
- Site-visit confirmation or change sent to the customer.
- Indicative estimate sent.
- Quote sent or revised.
- Material design or price update.
- Customer-decision request.

### 13.2 Latest customer response

When newer than the latest outbound update, separately show:

- Quote accepted.
- Quote declined.
- Recorded inbound phone call.
- Recorded inbound SMS or message.
- Recorded customer decision.

### 13.3 Automated acknowledgements

Automated enquiry acknowledgements:

- Remain visible in the full timeline.
- Are labelled `Automated`.
- Are visually secondary.
- Do not satisfy the Sales workstream's personal-contact requirement.

### 13.4 Logging calls and messages

Extend the existing project-note domain or another existing canonical activity record with optional structured metadata, subject to Stage 0.

Minimum semantics:

- Activity type:
  - Internal note.
  - Customer call.
  - SMS.
  - Message.
  - Customer decision.
- Direction:
  - Inbound.
  - Outbound.
- Occurred at.
- Short outcome or summary.
- Customer-facing flag where appropriate.
- Existing author and permission rules.

Historical notes remain ordinary internal notes.

### 13.5 Delivery failure

- A failed material communication remains visible.
- A later successful retry does not erase the failed historical event.
- Current summary reflects the latest effective delivery outcome.
- Retry occurs through the owning workflow.

## 14. Meaningful project timeline

### Included business events

- Staff note.
- Logged customer call.
- Logged SMS or message.
- Customer decision.
- Customer-facing email queued, sent, or failed.
- Site visit booked, confirmed, changed, or completed.
- Estimate created or materially revised.
- Quote created, sent, resent, revised, accepted, or declined.
- Pipeline stage changed.
- Primary action created, selected, changed, completed, rescheduled, or reassigned.
- Approval requested, approved, rejected, or invalidated.

### Hidden technical noise

Hide by default:

- Query refreshes.
- Cache updates.
- Local-first queue mechanics.
- Debug exports.
- Routine PDF regeneration.
- Idempotency duplicates.
- Background implementation diagnostics.
- Technical request metadata.
- Low-value audit records that do not change staff understanding.

### Grouping

Group related child events into one business event.

Example:

```text
Quote Q-1042 v3 sent to Sarah
Monday 2:14 pm by Ellen
PDF generated successfully - Email sent
```

The full technical detail may remain expandable for troubleshooting.

### Ordering

- Order by business occurrence time.
- Use creation time only when no better event time exists.
- Preserve deterministic ordering for equal timestamps.

### Completeness

A failed subordinate source read must not present partial arrays as a fresh complete timeline. Use the existing complete-snapshot or last-known-data posture.

## 15. Blockers, warnings, approvals, and severity

### 15.1 Definitions

**Blocker**

The affected next step cannot safely or legitimately proceed.

**Warning**

Work may continue, but staff should understand a risk, missing fact, or possible inconsistency.

**Approval required**

The affected action may proceed only after an authorised person accepts the specific exception.

**Critical exception**

A red, urgent presentation. It may be a blocker, a missing approval, a material failed communication, or an urgent overdue action.

### 15.2 Reliable V1 blocker candidates

Implement only after Stage 0 verifies deterministic evidence.

| Condition | Classification | Behaviour |
| --- | --- | --- |
| Eligible quote references a missing or unavailable source estimate | Blocker | Show quote and reliable stored price; hide borrowed design; require source review |
| Loaded design does not match selected quote source | Blocker | Do not claim current design; require source conflict review |
| Accepted quote has no reliable stored total | Blocker | Do not substitute estimate price; require accepted-quote review |
| Critical estimate or pricing validation failure | Blocker for affected commercial step | Open estimate issue |
| Required commercial approval missing | Approval required | Open approval |
| Material customer communication failed with no later success | Critical exception; blocker only when delivery is required for the next step | Retry through owning workflow |
| Lead-response SLA breached | Critical exception, not a data blocker | Contact lead |
| Critical primary action materially overdue | Critical exception, not universal project lock | Complete, reschedule, or reassign |

### 15.3 Warnings

| Condition | Behaviour |
| --- | --- |
| Project Owner missing from lead through deposit | Assign owner; include in exception queue |
| No primary next action | Set or select action; include in exception queue |
| Normal action overdue | Show due severity and action |
| No personal customer contact | Make or log contact |
| Site address unverified | Verify address |
| Costing may be stale | Review costing; do not recalculate in Overview |
| Newer estimate exists than current quote source | Compare versions; do not silently replace source |
| Latest quote declined | Follow up, revise, or archive |
| Project unusually long in stage | Review project using approved threshold |
| Customer decision outstanding | Ensure dated follow-up action |

### 15.4 Context-sensitive no-design state

`No design` is not a red issue for an early lead.

It becomes a blocker only when:

- A quote claims a source design that cannot be identified.
- Quote preparation or send is being treated as ready without the required estimate source.
- Another approved business rule explicitly requires a design at that point.

### 15.5 V1 commercial approvals

Potential approval categories:

- Low margin.
- Discount above an approved threshold.
- Material manual price adjustment.
- Significant free work or credit.

Do not implement an approval trigger until:

- Source values are reliable.
- Threshold is approved by Jordan.
- The approval can bind to a specific estimate or quote version.
- Material commercial changes invalidate the approval.

### 15.6 Approval record semantics

An approval must record:

- Project.
- Approval type.
- Status.
- Requested by and time.
- Reason.
- Relevant estimate or quote version.
- Commercial context or context hash.
- Approved or rejected by and time.
- Decision note.
- Invalidated time and reason.

An approval is not a permanent project-wide waiver.

## 16. Permissions

The current portal has `admin` and `staff` access. V1 uses that model without inventing security roles that do not yet exist.

### Staff may

- View the shared Overview.
- View customer price and quote state.
- View workstreams and timeline.
- Add an internal note.
- Log a customer call or message.
- Manage primary actions and ownership where the owning API permits.
- Open specialist workflows.

### Staff may not

- View internal true cost or margin.
- Approve commercial exceptions.
- Perform restricted overrides.
- Directly edit derived current design, quote, price, blocker, or workstream state.
- Edit another author's communication record outside existing permission rules.

### Admin may additionally

- View internal true cost and margin.
- Approve or reject V1 commercial exceptions.
- Reassign any project owner or primary action.
- Review issue diagnostics.
- Perform an approved override with a recorded reason.
- Use existing admin rights for project-note correction.

### Future capability model

A later capability-based model may distinguish:

- Director.
- Sales.
- Designer.
- Estimator.
- Project Manager.
- Builder.
- Marketing.

Potential capabilities:

- `view_internal_cost`.
- `view_margin`.
- `approve_commercial_exception`.
- `manage_project_ownership`.
- `release_design`.
- `manage_installation_readiness`.

Until that model exists, V1 sensitive internal commercial values are admin-only.

## 17. Data ownership and repository mapping

Stage 0 must verify every path and schema assumption against the current repository.

| Overview value | Canonical source | Known repository anchor to verify | V1 need |
| --- | --- | --- | --- |
| Project identity and pipeline | `projects` | `apps/portal/lib/projects/getProjectPageSnapshot.ts` | Existing snapshot |
| Customer identity and contact | `contacts` | Project snapshot and contact/project APIs | Existing snapshot |
| Site address | `projects.site_address` | Project snapshot and project details | Existing value; verification evidence may be new |
| Address verification | Explicit canonical evidence | No approved V1 source yet | Stage 0 decision; likely small record |
| Site-visit requirement | Explicit canonical evidence | Site-visit workflow | Stage 0 decision |
| Site-visit state | `site_visit_events` | Project snapshot and Schedule Site Visits | Existing source |
| Current quote selection | `quote_versions` | Existing quote queries and current-design resolver | Reuse with strict rules |
| Current design | Exact selected quote source estimate, otherwise selected estimate | `apps/portal/lib/projects/commandCentre/resolve.ts` | Strict server-owned resolver implemented in Stage 1 |
| Design summary | Selected estimate snapshot | Current-design summariser and estimate detail query | Existing helper, stricter failure state |
| Customer price | Selected quote stored total, otherwise selected estimate stored summary | Quote and estimate domain | Reuse without cross-source fallback |
| Costing freshness | Estimate pricing metadata | Estimate persistence and calculator outcome | Expose read-only |
| Estimate lock | Quote-backed editability rules | Estimate domain | Expose read-only |
| Quote send result | Quote send logs and owning email result | Quote domain and email/outbox records | New summary read model |
| Project Owner | `project_owner_assignments` approved owner key | Legacy Sales/Design/Estimating role rows remain rollback evidence | Stage 2 single-owner migration |
| Primary next action | Existing source task plus canonical selector | Project next-action fields, automation tasks, follow-up tasks | Architecture decision and likely schema work |
| Primary-action owner | Source task or project owner | Existing tasks can have assignee; current project snapshot does not | New read model |
| Workstream state | Derived server helper | No existing canonical V1 helper | New read model; no status table |
| Latest customer update | Customer-facing outbox/send events plus structured communication records | `email_outbox`, quote send logs, project notes | Merged read model |
| Latest customer response | Quote outcomes plus structured inbound communication | Quote state and project activity | Merged read model |
| Timeline | Notes, outbox, audit, quotes, site visits, action history | Existing snapshot activity is partial | Expanded merged read model |
| Blockers and warnings | Derived issue resolver | No approved canonical helper | New server helper |
| Commercial approval | Version-bound approval record | No approved source yet | Stage 5 only |
| Internal true cost and margin | Selected estimate/quote commercial domain | Specialist commercial records | Admin-only read summary |
| Loading and access state | Authenticated project query | `ProjectSnapshotPageClient` and project query helpers | Preserve |

### Data that must not be duplicated

Do not store independent copies of:

- Current design description.
- Current design status.
- Current quote status.
- Customer price.
- Workstream state.
- Latest communication summary.
- Owner display name.
- Overdue state.
- Blocker or warning state.
- Estimate lock state.
- Quote delivery outcome.

### Repository-specific product constraints to preserve

- Browser UI uses authenticated APIs, query helpers, or local-first handlers rather than new direct table writes.
- Access-ending responses hide protected cached data.
- Known data remains visible during recoverable refresh failure.
- Quote-backed estimate locks remain authoritative.
- Historical quote and invoice records are not repriced by the Overview.
- Overview remains a lazy workflow boundary so project opening budgets are preserved.
- Documentation changes must remain discoverable from the repository docs index and owner docs.

## 18. Controlled V1 actions

V1 may add controlled editing for:

- Project Owner.
- Selected primary next action.
- Primary-action owner.
- Due date or due time.
- Brief project note.
- Structured customer call, SMS, message, or decision record.

V1 must not allow direct editing of:

- Current design.
- Current estimate selection when a quote source controls it.
- Current quote status.
- Customer price.
- Workstream state.
- Blocker or warning state.
- Estimate lock state.
- Email delivery state.
- Approval outcome without permission.

Every controlled action must:

- Use an authenticated, owned API or local-first mutation boundary.
- Provide pending, success, failure, and retry behaviour.
- Preserve audit history where business meaning changes.
- Update relevant project and dashboard caches coherently.
- Avoid optimistic claims for server-owned side effects.

## 19. Explicit V1 exclusions

V1 does not include:

- A replacement project pipeline.
- Engineering workflow.
- Consent workflow.
- Procurement.
- Inventory.
- Material ordering.
- Installation readiness.
- Schedule Board or Gantt functionality.
- Builder view.
- Construction release.
- Installation progress.
- Completion workflow.
- Defects, repairs, or warranty cases.
- Final payment.
- Accounting reconciliation.
- Customer portal expansion.
- Full task management.
- Subtasks or task dependencies.
- Staff chat.
- Advanced notifications.
- AI project summaries.
- AI risk scoring.
- Advanced analytics.
- Full calculator inputs.
- Detailed estimate cost breakdown.
- Complete quote line items.
- Complete invoice information.
- Full email previews above the fold.
- Full Design List.
- Running Jobs spreadsheet content.
- Technical diagnostics as normal staff content.
- Manually editable workstream health.
- A general manually editable project-health status.
- Separate role-specific page layouts.

## 20. Acceptance criteria

### 20.1 The 60-second test

Using an unfamiliar representative project, an authorised office staff member can correctly identify within 60 seconds:

- Current design source.
- Exact estimate version.
- Current price source.
- Current quote and outcome.
- Primary next action.
- Action owner.
- Due or overdue state.
- Active critical exception.
- Latest meaningful customer update.

At least five pilot staff across different office roles must complete this test without verbal coaching.

### 20.2 Current design and commercial truth

1. Accepted quote source takes precedence over sent, draft, and estimate sources.
2. Sent quote source takes precedence over draft and estimate sources.
3. Draft quote source takes precedence over a standalone estimate.
4. Declined quotes never become current.
5. When no eligible quote exists, active draft estimate takes precedence over the latest eligible estimate.
6. A missing quote source estimate produces `Source design unavailable`.
7. The system never substitutes another estimate for a missing quote source design.
8. Quote price comes only from the selected quote version when an eligible quote exists.
9. Estimate price is used only when no eligible quote exists, and comes from the same saved-snapshot quote-handoff projection as quote creation rather than an estimate summary field.
10. Missing quote price does not fall back to estimate price.
11. A newer estimate does not replace a sent or accepted quote's source design.
12. Stale costing remains visible and is not recalculated by the Overview; blocked or zero-value estimate projections show price unavailable rather than a partial total.
13. Historical sent, accepted, and declined quote context remains unchanged.
14. Quote-backed estimate locks remain authoritative.
15. Multiple accepted records trigger a review state rather than silent ambiguity.

### 20.3 Ownership and primary action

16. Every project from lead through deposit displays one Project Owner or an explicit missing-owner state.
17. The only selectable Project Owners are Jordan, JP, Joe, and Bruce.
18. No project displays multiple project-owner roles.
19. No project displays more than one primary action.
20. A linked source task is not copied into a duplicate independent task.
21. Manual action selection records actor and time.
22. Every primary action has an owner or explicit unassigned state.
23. Every primary action has a due date or time.
24. Due state uses Pacific/Auckland.
25. Completing a linked action persists through its owning API.
26. The next candidate is shown only after authoritative completion succeeds.
27. Rescheduling and reassignment preserve history.
28. No-owner and no-action projects appear in an exception queue.
29. Personal dashboard reminders never become project obligations automatically.

### 20.4 Workstreams

30. All four workstream states are derived on the server.
31. Staff cannot manually set a workstream to Ready.
32. Every workstream state exposes supporting evidence.
33. Missing evidence produces Unknown.
34. A populated address alone does not prove verification.
35. Engineering, consent, and construction measurements are not universal V1 blockers.
36. Each warning or blocker links to an owning workflow.
37. Healthy workstreams remain visible but compact.
38. Workstream states do not replace or write the main pipeline stage.

### 20.5 Customer communication and timeline

39. Personal communication is distinguishable from automated communication.
40. Automated enquiry acknowledgement does not satisfy personal-contact state.
41. Latest outbound update uses actual occurrence or send time.
42. A newer customer response is shown separately.
43. Failed material communication remains visible after a later retry.
44. Important calls, SMS, messages, and decisions can be recorded with channel, direction, and occurrence time.
45. Existing historical project notes remain valid.
46. Existing note authorship and admin permissions remain intact.
47. Related technical child events are grouped into one business event.
48. Placeholder empty arrays never produce a false `No activity` result.
49. A subordinate source failure does not present partial history as fresh complete history.

### 20.6 Permissions

50. Staff cannot see internal true cost or margin.
51. Admin users can see the approved internal commercial summary.
52. Staff cannot approve commercial exceptions.
53. Staff cannot directly edit derived design, quote, price, workstream, or issue state.
54. Restricted overrides record actor and reason.
55. Access-ending responses hide protected cached data.
56. No new browser direct table writes are introduced.

### 20.7 Loading, failure, and recovery

57. Pending, summary, fresh, refresh-failed, and unavailable project states remain truthful.
58. Known permitted data remains visible during recoverable refresh failure.
59. Cached or placeholder data is labelled as updating.
60. No missing record is converted into a confident ready state.
61. Every failed controlled action has Retry or Review.
62. Failed completion does not advance the primary action.
63. Stale design or quote data retains its exact source identity.

### 20.8 Responsive and accessibility

64. Current design, price, quote state, primary action, owner, due state, and critical exception remain visible without accordions at 390 px.
65. No horizontal scrolling is required at 390 px.
66. The Overview works at 1600, 1366, 1024, 768, and 390 px.
67. All primary actions are keyboard accessible.
68. Status does not rely on colour alone.
69. Failed action focus moves to useful error or recovery content.
70. Touch targets are suitable for tablet and mobile use.
71. The page uses one primary document scrollbar.

### 20.9 Performance and repository quality

72. The Overview remains a lazy project workflow boundary where current architecture requires it.
73. Project opening remains within existing performance guards.
74. Project Detail remains within existing bundle budgets.
75. Focused project, estimate, quote, task, note, communication, and dashboard tests pass.
76. Portal typecheck, lint, repository guards, build, and relevant browser gates pass.
77. The canonical project workflow, schema map, UX roadmap, docs index, and production-readiness tracker are updated when implementation changes their owned behaviour.
78. New docs remain discoverable through repository documentation routing.

## 21. Representative scenarios

### Scenario 1: New website lead with draft estimate

#### Input records

- New project created from website enquiry.
- Address contains suburb only or is not verified.
- Draft indicative estimate exists.
- Automated acknowledgement exists.
- No personal contact.
- No Project Owner.
- No primary next action.

#### Expected current design

- Draft estimate, when it is the active eligible estimate.

#### Expected commercial state

- Estimate price.
- No quote created.

#### Expected primary action

- Contact lead, once created or selected.
- Until then: `No next action set`.

#### Expected workstreams

- Sales: Contact required.
- Site information: Address incomplete or Unknown.
- Design and estimating: In progress or Ready according to actual estimate evidence.
- Quote and commercial: Not started.

#### Expected warnings or exceptions

- Project Owner missing.
- No next action.
- No personal contact.
- Address not verified.
- Lead SLA critical exception only after the approved threshold is exceeded.

---

### Scenario 2: Standard residential project

#### Input records

- Verified full address.
- Project Owner assigned.
- Required site visit completed, or explicitly not required with reason.
- One active estimate.
- Costing current.
- No quote.
- Primary action: prepare quote.

#### Expected current design

- Active estimate.

#### Expected commercial state

- Estimate price.
- No quote created.

#### Expected primary action

- Prepare quote, owned by the relevant person.

#### Expected workstreams

- Sales: Ready.
- Site information: Ready.
- Design and estimating: Ready.
- Quote and commercial: Not started.

#### Expected warnings or exceptions

- None, unless the Project Owner is missing.

---

### Scenario 3: Multiple estimate versions

#### Input records

- Estimate v1.
- Newer estimate v2.
- Draft quote linked to v1.

#### Expected current design

- Estimate v1, because the current draft quote references v1.

#### Expected commercial state

- Draft quote and its stored price.

#### Expected primary action

- Continue quote preparation, review newer estimate, or another explicitly selected action.

#### Expected workstreams

- Design and estimating: Review required.
- Quote and commercial: Draft.

#### Expected warnings or exceptions

- Newer estimate exists but is not the current quote source.
- No use of v2 geometry or price in the current quote summary.

---

### Scenario 4: Sent revised quote

#### Input records

- Original sent quote.
- Later revised quote version sent successfully.
- Follow-up due.
- No customer response.

#### Expected current design

- Exact source estimate of the latest sent eligible quote.

#### Expected commercial state

- Waiting on customer.
- Latest sent quote price.

#### Expected primary action

- Dated quote follow-up.

#### Expected workstreams

- Sales: Waiting on customer.
- Design and estimating: Ready or locked.
- Quote and commercial: Waiting on customer.

#### Expected warnings or exceptions

- Follow-up overdue only when past due.

---

### Scenario 5: Accepted quote

#### Input records

- Accepted quote.
- Exact source estimate available.
- Newer unrelated estimate also exists.

#### Expected current design

- Exact source estimate of the accepted quote.

#### Expected commercial state

- Accepted quote and stored accepted price.

#### Expected primary action

- Existing lead-to-quote close-out or later-lifecycle action if already present. V1 does not invent installation work.

#### Expected workstreams

- Quote and commercial: Accepted.
- Design and estimating: Ready - locked.

#### Expected warnings or exceptions

- Neutral or amber notice that a newer estimate exists but is not the accepted quote source.
- No replacement of accepted source design.

---

### Scenario 6: Declined quote

#### Input records

- Declined quote.
- Latest eligible estimate remains.
- No accepted, sent, or draft quote.

#### Expected current design

- Selected estimate.

#### Expected commercial state

- Latest quote declined.

#### Expected primary action

- Follow up, revise, or archive.

#### Expected workstreams

- Sales: Waiting on customer or In progress according to action.
- Quote and commercial: Declined.

#### Expected warnings or exceptions

- Latest quote declined.
- Declined quote remains in timeline.

---

### Scenario 7: Missing quote source estimate

#### Input records

- Sent or accepted quote.
- Source estimate missing, unavailable, or inaccessible.
- Reliable stored quote price exists.

#### Expected current design

- `Source design unavailable`.

#### Expected commercial state

- Selected quote and reliable stored price remain visible.

#### Expected primary action

- Review quote source.

#### Expected workstreams

- Design and estimating: Blocked.
- Quote and commercial: Blocked.

#### Expected warnings or exceptions

- Red source-design blocker.
- No fallback to active or latest estimate.

---

### Scenario 8: No owner

#### Input records

- Active lead-to-quote project.
- Personal contact has occurred.
- No Project Owner.

#### Expected current design

- Derived normally.

#### Expected commercial state

- Derived normally.

#### Expected primary action

- Existing action may remain visible but is unassigned if no source owner exists.

#### Expected workstreams

- Sales cannot be Ready solely because contact occurred.

#### Expected warnings or exceptions

- Project Owner missing.
- Assign Owner action.
- Project appears in exception queue.

---

### Scenario 9: No primary next action

#### Input records

- Active project.
- Project Owner exists.
- No open candidate and no selected manual action.

#### Expected current design

- Derived normally.

#### Expected commercial state

- Derived normally.

#### Expected primary action

- `No next action set`.

#### Expected workstreams

- Supporting workstreams remain derived; none becomes Blocked solely because the action is missing unless an approved rule requires it.

#### Expected warnings or exceptions

- No next action.
- Set action.
- Project appears in exception queue.

---

### Scenario 10: Overdue action

#### Input records

- Primary customer follow-up action.
- Due date is past the approved escalation threshold.

#### Expected current design

- Derived normally.

#### Expected commercial state

- Derived normally.

#### Expected primary action

- Exact overdue action, owner, and overdue duration.

#### Expected workstreams

- Sales or Quote and commercial reflects overdue follow-up evidence.

#### Expected warnings or exceptions

- Amber or red according to configured criticality and threshold.
- Complete, reschedule, and reassign actions.
- Reschedule history retained.

---

### Scenario 11: Failed customer email

#### Input records

- Material quote or estimate communication attempted.
- Latest attempt failed.
- No later success.

#### Expected current design

- Derived normally.

#### Expected commercial state

- Send failed when the failed event is the current quote delivery attempt.

#### Expected primary action

- Retry through the owning workflow.

#### Expected workstreams

- Quote and commercial: Blocked - send failed, or an equivalent reliable state.

#### Expected warnings or exceptions

- Prominent failed-communication issue.
- Timeline retains failure.
- Customer is not treated as successfully updated.

## 22. Open business decisions for Jordan

These decisions require business judgement before the relevant implementation stage. Repository inspection alone cannot decide them.

### Stage 2 decisions resolved

1. Lead response is due by 5:00pm Auckland time on the next business day; weekends, national/Auckland holidays, and company closures are excluded.
2. Normal overdue remains amber. Critical is explicit only and requires a reason to set or clear.
3. The third and every later reschedule requires a reason.
4. Admins manage the single Project Owner from the Jordan/JP/Joe/Bruce roster. All staff may reassign the current action to an active staff member unless a selection conflict freezes the control.

### Before Stage 3

5. Address verification:
   - Who may mark an address verified?
   - What evidence is required?

6. Site visit not required:
   - Who may make that decision?
   - Which project types require a visit?
   - Is a reason always mandatory?

7. Stage age:
   - Which stages need ageing warnings?
   - What thresholds should apply?

### Before Stage 5

8. Internal margin:
   - Confirm that admin-only visibility is acceptable until capability-based roles exist.

9. Commercial approvals:
   - Margin threshold.
   - Discount threshold.
   - Manual price-adjustment threshold.
   - Free-work or credit threshold.
   - Which directors or admins may approve.

10. Approval expiry:
    - Which commercial changes automatically invalidate approval beyond the required quote or estimate version change?

These decisions must be added to this document before the corresponding Codex implementation goal begins.
