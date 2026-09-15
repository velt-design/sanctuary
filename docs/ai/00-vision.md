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

## Owner outcomes and delivery order

Agreed direction: 2026-09-14. These priorities describe the intended business outcome, not deployed capabilities or blanket permission to change production. The initial node restrictions above remain in force; each business capability needs its own implementation and release evidence.

- Sanctuary marketing means managing and improving paid Facebook campaigns for cold, warm and hot prospects, with structured procedures and testing. It is broader than scheduling social posts.
- The desired connected journey is ad exposure, enquiry, qualified enquiry, sales opportunity and customer, with Outlook conversations, portal stages, quotations, documents, invoices and payments supplying the evidence. A verified positive deposit is the agreed customer-win event; deposit balance and whole-invoice settlement remain separate facts.
- The portal is the staff working interface and owns structured customer/project workflow. Xero owns accounting; governed SharePoint storage is the intended home for business files. Moving the existing OneDrive data and organising it remains planned work, not a completed migration.
- Velt should present understandable business outcomes, evidence, exceptions and decisions. Praxis should use that context to recommend and perform permitted work, including managing coding agents through the existing execution boundary. A graph or chat integration must not create a competing copy of business truth.
- Email handling should progress from useful context and reviewed drafts to independently evaluated action classes. The owner reported an existing historical email archive at `C:\SanctuaryEmailData`; this is a source-location reference, not evidence of completed ingestion or permission to publish its contents.
- Preserve the useful calculator, quoting/invoicing, booklet workbench and adopted schedule. Improve project handover, ordering and job management where staff still work outside the portal, using observed cases rather than replacing working surfaces speculatively.

The approved business delivery order is:

1. Make everyday finance usable: invoice transfer to Xero, a staff payment-review queue, explicit approval capability, balances, exceptions and correction. The released deposit pilot is the starting evidence; [the Xero owner document](../xero-connection.md#next-stage-everyday-finance) owns this next scope and unresolved decisions.
2. Build one complete customer journey using Peter's project as the first case. Link the existing customer, email, quote, project, file and payment records; expose missing or uncertain links instead of inventing them.
3. Repair the operational handover, materials-ordering and job-management gaps revealed by real work.
4. Present those reliable outcomes and required decisions through Velt/Praxis.
5. Join campaign attribution to qualified opportunities and verified deposits, then add structured campaign experiments and appropriate Meta feedback. Source terms, permissions and data use must be assessed before enabling that feedback.
6. Promote autonomy separately for proven action classes. Payment matching, campaign changes, email sending and coding/deployment authority do not inherit approval from one another.

Durable context is maintained in these owner documents and linked from project context. Saving a document does not itself connect a service, ingest an archive or prove that a live Praxis run has loaded it. Prefer recording decisions, evidence, ownership and unresolved questions over copying the chat transcript or private customer material into general model memory.

## Success For The First Milestone

The Mac mini is rebuildable, encrypted, privately reachable, patched, monitored, and separated from personal identity. OpenClaw is sandboxed and tool-restricted. One synthetic task completes through Sanctuary-owned contracts with structured evidence, and node loss, revocation, rollback, and rebuild are demonstrated without a production effect.

## Related Material

- `sanctuary-ai-master-plan.md`
- `../target-architecture.md`
- `../security-privacy-quality.md`
- `09-decisions/README.md`
