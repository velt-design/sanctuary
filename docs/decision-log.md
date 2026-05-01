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

Use `Status: Active` when the entry is still only a decision-log guardrail. Use `Status: Promoted` when the durable behavior is now represented in `docs/agent-playbook.md`, `AGENTS.md`, `docs/README.md`, or another canonical doc. Use `Status: Superseded` only when a newer entry or canonical doc replaces the rule.

## Index

| Date | Area | Status | Guardrail |
| --- | --- | --- | --- |
| 2026-05-01 | Projects/Estimates | Promoted | Core project/contact/estimate workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs/Testing | Promoted | Keep broad repo command guidance in `docs/testing-and-qa.md`; link to it instead of duplicating command blocks. |
| 2026-05-01 | Parallel Work | Promoted | Use universal parallel-work guardrails for concurrent lanes across apps, packages, docs, and workbench migration. |
| 2026-05-01 | Quotes/Invoices/Job Packs | Promoted | High-risk side-effect workflows need a canonical doc before future behavior changes. |
| 2026-05-01 | Docs | Promoted | Read the agent playbook for non-trivial portal work; promote durable lessons from this log into the playbook. |
| 2026-05-01 | Docs | Promoted | Do not delete active guardrail docs without confirming usage or replacing the rule. |
| 2026-05-01 | Docs | Promoted | Distinguish current-state references from active operating rules. |

## Entries

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
