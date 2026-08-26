# Autonomous Engineering Operations

Status: Active foundation contract; runtime activation remains staged through the
ordered PR sequence below.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Take an approved engineering goal through small, bounded implementation tasks,
focused local verification, draft pull requests and CI diagnosis without asking
for routine command approval. OpenClaw supervises; separate Codex-backed workers
implement. Humans continue to own scope expansion, merge and production.

## Role boundary

```text
Jordan
  -> approves the goal and material scope
OpenClaw Engineering Lead
  -> validates manifests, provisions lanes, starts and monitors workers
Codex Coding Worker
  -> edits one isolated worktree, runs focused checks and opens a draft PR
GitHub Actions
  -> runs the broad verification matrix
OpenClaw Engineering Lead
  -> classifies failures, requests bounded repairs and returns evidence
Human reviewer
  -> reviews and merges
```

The Engineering Lead must not write product code merely because it can. The
Coding Worker must not create its own scope, merge, deploy, use production data,
contact customers or weaken a required check.

## Canonical contracts

`@sp/ai` owns two strict provider-neutral contracts:

- `sanctuary-engineering-task-v1`: immutable objective, exact base, short-form
  feature branch (never `main`, `master` or a full `refs/...` alias),
  path lane, dependencies, acceptance criteria, verification, limits, approvals,
  outputs and stop conditions.
- `sanctuary-engineering-completion-v1`: manifest hash, branch/commit/PR,
  acceptance and test evidence, CI state, worker attempts/cost, safety facts,
  limitations and the next human action.

Validate or render a task from the repository root:

```bash
npm run ai:engineering:validate-task -- path/to/task.json
npm run ai:engineering:render-worker-prompt -- path/to/task.json
npm run ai:engineering:validate-completion -- path/to/task.json path/to/completion.json
```

The validator canonicalizes the accepted task shape before producing its SHA-256
identity. A changed objective, base, lane, test, limit or approval therefore
creates a different manifest hash and requires a new worker instruction.
Completion validation requires that same task file and rejects mismatched task,
base, branch or hash identity; missing or substituted acceptance, local-check or
CI evidence; out-of-lane changed paths; and attempt or cost totals above the
manifest limits.

## Runtime rules

- Sanctuary uses its own OpenClaw state directory, config, logs, gateway token,
  task ledger and agents. Another OpenClaw channel or experiment must not be able
  to change Sanctuary's model, tools or approval posture.
- The named Engineering Lead can inspect repository/GitHub/task state and spawn,
  read, steer, interrupt and continue named workers. It does not receive product
  coding tools.
- The named Coding Worker uses the Codex harness in one declared worktree. It can
  edit, test, commit, push a feature branch and open/update a draft PR without
  prompts. It cannot merge, deploy or access production credentials because
  those tools and credentials are absent.
- One worker runs at a time until the rehearsals establish clean lane ownership
  and reliable recovery. Increasing concurrency requires an explicit contract
  and evaluation update.
- Focused tests run on the Mac. Broad suites run in GitHub Actions. The supervisor
  may send a genuine CI failure back to a worker; it must not hide, weaken or
  relabel a failure merely to finish.
- OpenClaw's durable task ledger and orphan recovery are runtime aids, not
  canonical business memory. The manifest, Git branch, draft PR, checks and
  completion report remain the durable engineering evidence.

## Completion definition

A task may be reported as `succeeded` only when:

- every acceptance criterion is evidenced as passed;
- every reported local verification has passed and no CI check has failed;
- the expected branch is pushed and the exact head SHA is recorded;
- an open draft PR exists;
- the worktree is clean;
- the secret scan passes;
- no merge or production effect occurred; and
- a strict completion report validates.

Otherwise the worker returns `blocked` or `failed` with the precise next action.
Pending CI is allowed in a draft handoff but must remain visibly pending.

## Ordered foundation PRs

1. **Contracts:** strict task/completion schemas, validation and prompt rendering.
2. **Runtime isolation:** dedicated Sanctuary state plus named supervisor, worker
   and reviewer profiles with tested tool boundaries.
3. **Lane provisioning:** deterministic branch/worktree creation, exact manifest
   binding, safe cleanup and no-prompt GitHub branch/draft-PR access.
4. **Durable supervision:** one-worker queue, dependency gates, bounded retries,
   timeout continuation and restart recovery using OpenClaw tasks.
5. **CI and review loop:** focused-local/broad-CI routing, failure classification,
   repair dispatch and independent read-only review.
6. **Operations and rehearsals:** status/audit reporting, cost and attempt limits,
   kill switch, timeout/restart/failure/unsafe-request rehearsals and a real
   low-risk end-to-end proof.

All PRs stop at draft review. Dependent PRs may be stacked, but each manifest
names its exact base and dependency so review and merge order stay explicit.

## Promotion gate

The foundation is ready for ordinary product work only after the rehearsal suite
proves:

- routine coding needs no interactive approval;
- a worker cannot write outside its lane or push `main`;
- timeout and gateway restart resume from the existing branch rather than start
  over;
- a failed test is surfaced and repaired or reported, never suppressed;
- an unsafe request stops before any effect;
- a clean draft PR and completion report are produced; and
- disabling the Sanctuary gateway stops new work without affecting GitHub,
  Portal access or manual development.

## Current known issue

The first Configurator PR 4 proof used a single Codex-backed OpenClaw agent as
both lead and implementer. It completed the implementation and focused evidence,
but a later live configuration drifted to guarded approvals and blocked the
final staging command. The isolated runtime and named-role PRs specifically
remove that shared-state and role ambiguity.
