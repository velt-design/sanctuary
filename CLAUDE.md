# Claude Code: First Moves

This file is auto-loaded into Claude's context at session start. It exists to ensure Claude reads the repo's existing agent guide before making changes. The canonical guidance lives in `AGENTS.md` and `docs/`; this file deliberately does **not** duplicate it.

## Every session, before any code change

### HARD GATE for design-workbench / geometry / costing work

If your task touches **any** of these paths, you MUST read [docs/design-workbench-architecture.md § "Product North Star (READ FIRST)"](docs/design-workbench-architecture.md) **before writing any code or proposing a next task**:

- `apps/portal/lib/drawings/**`
- `apps/portal/components/drawings/**`
- `apps/portal/app/staff/projects/[projectId]/design-workbench/**`
- `packages/geometry/**`
- `packages/costing/**` (when the change affects the costing engine's input layer)

The north star section is ~60 lines, designed to be read in 90 seconds. It contains 3 load-bearing product decisions (locked 2026-05-22), 5 architectural invariants, a costing direction with a 2-phase plan, and an explicit anti-pattern list. **Every PR proposal in these paths must answer four questions, in writing, before any code:**

1. **Which legacy audit row(s) does this touch?** (cite by number from `docs/design-workbench-legacy-cull.md`, or "N/A — net new")
2. **Does this REMOVE legacy or BUILD ON legacy?** Default in Phase 1 is REMOVE. Build-on PRs require explicit user approval BEFORE coding. Documenting a workaround in `decision-log.md` is not a substitute for this approval.
3. **Does this PR have Phase 2 dependencies?** Phase 2 is the cost engine input-layer migration (cost engine reads from solved geometry instead of `inputs.modules`). A PR has Phase 2 dependencies if it would require changing how the cost engine, email-quote path, or other `inputs.modules` consumers read their data. If yes: split the PR into a Phase 1 chunk (deletion/restructuring inside the workbench) and a Phase 2 chunk (deferred). Do NOT try to land both in one PR.
4. **If this PR consolidates two or more functions/types into one**, list their parameter (or field) differences explicitly. Each difference must be either: (a) genuinely equivalent at all call sites, (b) already pluggable via an existing parameter, (c) added as a new parameter in the consolidation, or (d) explicitly acceptable to lose given Phase 1's "workbench can break temporarily" permission. Naming the legacy parameters as "Phase 2 retiring" in the consolidated function's JSDoc is fine; silently dropping them is not.

Plus a process step before answering question 1: **grep for ALL consumers** of the file/function/type you're about to change. Discovering a missed consumer mid-PR (as in PR-A's `legacyObjectFirstCompatibilityAdapter.test.ts` slip, or PR-B's `syncHouseAssemblyFromDraftInputs` entanglement) means the scope estimate was wrong. Surface the resize to the user before continuing.

**Phase 1 acceptance — what MUST work after every PR:**
- The marketing-site enquiry → automated estimate email path: `apps/marketing/app/contact/page.tsx` → `/api/enquiry` → `calculateCostV1()` from `@sp/costing` → `sendCustomerAutoresponder()`. This path **does not touch the workbench** — it goes form → API → costing package → email. As long as you don't change `@sp/costing/calculateCostV1`, `CostInputsV1`, `EnquiryPayload`, or the form contract, the email path is automatically preserved. Workbench refactors are inherently safe from breaking this.
- Quick safety check after any cull PR: `npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx`.

**What CAN break temporarily during Phase 1** (locked permission 2026-05-22):
- Workbench UI interactions (drag, snap, attachment, rail buttons).
- Project model byte-identity against test fixtures — update fixtures alongside the PR that changes behavior.
- Visual rendering of attachment zones, snap targets, etc.

The user is the only daily workbench user during Phase 1 and has authorised aggressive cull-and-rebuild. The goal is "end state quickly", not "no regressions along the way".

If you find yourself reaching for a `LEGACY_PRIMARY` check, an `attachmentSide` enum read for positioning, a `pergolaWidthMm`/`pergolaDepthMm` arg in a non-pergola context, or a "primary vs. additional form" distinction — STOP. Re-read the north star. These are the patterns that caused us to ship 7 bandaid PRs in a row.

### Standard reads

1. Read **[AGENTS.md](AGENTS.md)** and apply its First Moves checklist (git status, `docs/agent-playbook.md`, `docs/decision-log.md`, `docs/change-routing.md`). Do not start coding before working through the items relevant to the task.

2. Read **[docs/maintainability-principles.md](docs/maintainability-principles.md)** -- this is the highest non-functional priority for this codebase. Every change should be checked against it. Repeat violations cause shipped bugs; the doc captures the patterns we have already paid for in production.

3. For portal UI / component / route / domain work, read **[docs/file-decomposition-and-ownership.md](docs/file-decomposition-and-ownership.md)** before adding code to an existing file. Honour the advisory size bands:

   | Category | Warning | Critical |
   | --- | ---: | ---: |
   | Component or page | 800 lines | 1200 lines |
   | Route, domain, package, or script | 700 lines | 1200 lines |
   | Test | 1200 lines | 2500 lines |

   The doc's caveat is load-bearing: **split when the extracted piece has a name, owner, and test surface — not to satisfy a line count.** A single tightly-coupled consumer of <50 lines stays inline.

4. Before handoff on non-trivial work, run `npm run architecture:changed`. Add `npm run files:changed` when the task touched a warning/critical file (it shows current vs. HEAD line counts and prints the handoff cue). Add `npm run dead-code:changed` for cleanup or deletion work.

## Operating defaults

- Keep changes scoped to the requested surface. Don't refactor adjacent code unless the task asks for it.
- Don't revert user changes or unrelated worktree changes; assume a dirty tree may belong to in-flight work.
- Update the relevant `docs/*.md` in the same pass when behaviour, data flow, source-of-truth ownership, or known risks shift. Use `docs/change-routing.md` to identify the owner doc.
- Match the conventions already present in the file you're editing — don't introduce a new style mid-file.
- For non-trivial plans (multi-PR sequences, contract changes, refactors with >100 LOC ripple), follow **[docs/plan-template.md](docs/plan-template.md)**. Includes a required "Architectural fit" section that names which north-star invariant the work serves, alternatives considered, and conscious scope limits — designed to surface drift before code lands. Scale sections to the task; small plans don't need all 11 sections.

## Why this file exists

`AGENTS.md` and `docs/*.md` are not auto-loaded into agent context — agents must choose to read them, and frequently don't. CLAUDE.md is auto-loaded. This file is the trampoline that ensures the existing system actually gets used at the start of every session.
