# Sanctuary AI Constitution

Status: Strategic target.

Accepted: 2026-08-18

Owner: Jordan / Sanctuary Pergolas

Review cadence: Monthly for the first 90 days, then quarterly.

## Purpose

Sanctuary AI is the governed intelligence, coordination, and evidence layer for Sanctuary Pergolas. It should make work faster and more consistent while preserving authoritative business systems and human control over consequential decisions.

## Constitution

1. Sanctuary AI is the platform. Models, OpenClaw, machines, connectors, and vendors are replaceable components.
2. Hosted Sanctuary systems, Supabase/Postgres, GitHub, and governed document storage retain canonical business state.
3. Agents and private nodes may derive, propose, execute bounded tasks, and return evidence. They do not own canonical memory.
4. Existing domain owners remain authoritative. AI integration extends `@sp/jobs`, Portal APIs, and package boundaries rather than creating parallel workflow truth.
5. Deterministic software is preferred where agency is unnecessary.
6. Retrieved content is untrusted data, never executable instruction by itself.
7. Authority is granted per capability and action class, not by giving a named agent broad standing permission.
8. Consequential effects initially require an exact, expiring, single-use approval bound to the frozen payload.
9. Every material output must distinguish authoritative fact, deterministic calculation, inference, and unknown.
10. Every production capability must have an owner, bounded inputs and tools, evidence, evaluation, monitoring, a kill switch, and a manual fallback.

## Initial Topology

- MacBook Pro: Jordan's portable cockpit and review device.
- Mac mini M4 Pro: private always-on execution, connector, and orchestration node.
- NVIDIA workstation: bounded GPU, media, vision, generation, and rendering worker.
- Cloud: frontier reasoning, coding, elasticity, and hosted control state.

Loss of any private node must not remove Portal access, canonical business records, or current manual workflows.

## Initial Capability Boundary

The first node deployment may perform real repository development. It may
inspect and edit Sanctuary code, run tests and builds, push feature branches,
and open draft pull requests without per-command approval. GitHub branch
protection and the absence of deployment and production credentials contain
the initial authority.

Until a later capability-specific approval, it must not have:

- customer email or messaging authority;
- production database write credentials;
- campaign or advertising account access;
- unrestricted SharePoint or document access;
- payment, price, structural, quote, invoice, or project-state authority;
- a personal everyday browser profile;
- unsandboxed general host execution;
- arbitrary third-party plugins or skills.

Those restrictions still govern the first execution node and its effect capabilities. The accepted Velt Praxis read boundary below separately governs data that Jordan deliberately connects; read access does not grant the node a browser profile, credential access, or any write/effect authority.

## Velt Praxis Operating Boundary

Anything deliberately connected to Velt grants Praxis complete read access to that connected source and processing by the relevant approved cloud models. The source system remains canonical. Credentials stay hidden from models and browser clients, narrowly scoped, audited, revocable, and covered by a connector kill switch.

Praxis may autonomously create internal tasks, plans, analyses, test work, branches, pull requests, and previews inside the permissions captured for the run. It must stop before external sending or publishing, spending, live customer or financial changes, merge or deployment, production changes, credential changes, or destructive actions. Connecting a source does not grant any of those effect permissions.

The first Sanctuary connector implements only this governed read side. It does not provision credentials, connect live data, call a model, or change production. Those remain separately reviewed activation steps.

## Promotion Rule

Promotion follows suggestion, then exact approval, then supervised autonomy only after representative evaluation. A capability is promoted independently; success in one action class does not expand another.

The separately authorised production finance capability is governed by `../xero-connection.md#next-stage-everyday-finance`. Its deterministic invoice and verified-payment automation does not promote the initial private node or grant Praxis general financial-effect authority.

## Owner outcomes and delivery order

Agreed direction: 2026-09-14, reconciled with Jordan's subsequent decisions through 2026-09-16 in the task "Assess Velt OS direction" (01a09d32-ffde-7ef0-8b1b-d13d0ae1c070). These priorities describe the intended business outcome, not deployed capabilities or blanket permission to change production. The initial node restrictions above remain in force; each business capability needs its own implementation and release evidence. Later explicit owner decisions supersede earlier choices in the same capability only.

- Sanctuary marketing means managing and improving paid Facebook campaigns for cold, warm and hot prospects, with structured procedures and testing. It is broader than scheduling social posts. Jordan wants professional marketing procedures and measurable improvement beyond his previous self-managed approach, with autonomy increasing as tests establish reliability.
- Combine analytics from relevant sources into an understandable business picture. Campaign decisions should consider qualified opportunities and customers, not just platform engagement or enquiry counts. Portal outcomes should feed back to Meta where the integration, permissions and data-use requirements support it.
- The desired connected journey is ad exposure, enquiry, qualified enquiry, sales opportunity and customer, with Outlook conversations, portal stages, quotations, documents, invoices and payments supplying the evidence. A verified positive deposit is the agreed customer-win event; deposit balance and whole-invoice settlement remain separate facts.
- The portal is the staff working interface and owns structured customer/project workflow. Xero owns accounting; governed SharePoint storage is the intended home for business files. Jordan wants the existing OneDrive business data reorganised and accessible to the portal and Velt through the same governed sources. The exact migration/storage design still needs assessment; this is not a completed migration or approval to move every file immediately.
- Velt should present understandable business outcomes, evidence, exceptions and decisions across relevant business functions. Praxis should use that context to recommend and perform permitted work, including managing coding agents through the existing execution boundary. Jordan wants to work in the Praxis conversation rather than personally coordinating coding agents or interpreting logs. A graph or chat integration must not create a competing copy of business truth.
- Email handling should progress from useful context and reviewed drafts to independently evaluated action classes. The intended outcome is Praxis answering suitable Outlook emails on Jordan's behalf and surfacing those needing his approval. This is a future business capability, not standing permission to send messages. The owner reported approximately five years of historical business email downloading at `C:\SanctuaryEmailData`; this is a source-location reference, not evidence of complete download, ingestion or permission to publish its contents.
- Preserve the useful calculator, quoting/invoicing, booklet workbench and adopted schedule. At the time of this discussion Jordan identified the calculator as the portal's most important function, followed by quoting/invoicing; designers use the booklet workbench. He reported weak project management and materials ordering/job organisation happening outside the portal. Treat these as the owner's discovery baseline, not a fresh audit of current implementation. Improve the gaps using observed cases rather than replacing working surfaces speculatively.
- Observability must explain outcomes to a non-coder: what happened, supporting evidence, what needs attention, the next action and its consequence. Finance's owner-validated 8/10 clarity target is defined in `../xero-connection.md#finance-clarity-improvement-loop`; functional automation and green tests do not establish that score.

The approved business delivery order is:

1. Make everyday finance usable and automate proven routine cases. Jordan superseded draft-first and routine payment approval with approved Xero invoices and automatic imports of verified reconciled payments. Ellen handles exceptions and Jordan retains access. [The Xero owner document](../xero-connection.md#next-stage-everyday-finance) owns the current finance decisions, superseded choices, live evidence and remaining bank-reconciliation dependency.
2. Build one complete customer journey using the owner-selected project as the first case. Link the existing customer, email, quote, project, file and payment records; expose missing or uncertain links instead of inventing them. The private case handover retains the customer's lookup name; do not copy customer correspondence or financial details into this strategy document.
3. Repair the operational handover, materials-ordering and job-management gaps revealed by real work.
4. Present those reliable outcomes and required decisions through Velt/Praxis.
5. Join campaign attribution to qualified opportunities and verified deposits, then add structured campaign experiments and appropriate Meta feedback. Source terms, permissions and data use must be assessed before enabling that feedback.
6. Promote autonomy separately for proven action classes. Payment matching, campaign changes, email sending and coding/deployment authority do not inherit approval from one another.

Durable context is maintained in these owner documents and linked from project context. Saving a document does not itself connect a service, ingest an archive or prove that a live Praxis run has loaded it. Prefer recording decisions, evidence, ownership and unresolved questions over copying the chat transcript or private customer material into general model memory.

### Owner working preferences

- Use a clear goal and very small, verified improvements. Jordan explicitly requested this for finance usability and automation. Preserve the intended end outcome across iterations instead of treating each short turn as a new task.
- Give brief plain-English explanations before consequential work; ask targeted business questions when existing records cannot answer them. A large interview is not an automatic prerequisite, and previously answered questions should not be repeated.
- Jordan approved autonomous progress within the defined finance goal and the specified hosting purchase. These approvals do not create unlimited spending authority, general authority for future projects, or permission to weaken authentication. Hosting scope and budget remain in `../xero-connection.md#managed-worker-preparation-2026-09-15`.
- Keep technical connection controls with the designated developer account; ordinary admins should see business outcomes and actionable exceptions. Routine operation should use the persistent connector and worker, rather than requiring Jordan to keep clicking transfer buttons or signing into a browser.
- Pricing was being handled in another task and was explicitly excluded from the finance changes. Carry that boundary into a handover while overlapping work remains active.
- Jordan requested that these decisions be retained in the docs so subsequent tasks do not depend on this chat's memory. Keep current choices, superseded choices, verified status and unresolved questions distinguishable.

### Next-task recommendation and handover

The latest recommendation is a focused customer-journey task with one accountable lead and bounded subagents for independent investigation or review. Jordan asked about this workflow; the recommendation is not a recorded instruction to create that task, spawn agents or grant standing delegation authority. The next task must still follow its applicable repository instructions and explicit scope.

Before continuing in another task, read this section, the current finance decisions and the automatic-production walkthrough in `../xero-connection.md`. Verify current implementation and open work before changing it. Carry the outcome, constraints, owner decisions, source documents, verified release references and next unresolved step; avoid copying the entire transcript. Private operator evidence under ignored `.codex-tmp/xero-evidence/` includes the selected customer case and live invoice identifiers. That local evidence is not a cross-machine document store; use authorised source records or the original task when it is unavailable.

Current carry-forward limits: finance automation has production evidence in its owner doc, while Michelle's confirmation of native bank Auto-reconcile remains outstanding. This decision record does not establish that the email archive is fully ingested, SharePoint migration is complete, the unified customer view is built, Meta conversion feedback is active, or Velt/Praxis has loaded every source. Do not describe those strategic targets as deployed behavior.

## Success For The First Milestone

The Mac mini is rebuildable, encrypted, privately reachable, patched, monitored, and separated from personal identity. OpenClaw is sandboxed and tool-restricted. One synthetic task completes through Sanctuary-owned contracts with structured evidence, and node loss, revocation, rollback, and rebuild are demonstrated without a production effect.

## Related Material

- `sanctuary-ai-master-plan.md`
- `../target-architecture.md`
- `../security-privacy-quality.md`
- `09-decisions/README.md`
