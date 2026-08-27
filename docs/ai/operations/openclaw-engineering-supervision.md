# OpenClaw Engineering Supervision

Status: Durable supervision contract implemented; live Mac restart and role
rehearsals remain before product work is promoted through it.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Let the OpenClaw Engineering Lead supervise a small ordered task queue without
becoming the coding agent or inventing a second scheduler. OpenClaw's managed
Task Flow stores each runtime checkpoint. A named Codex-backed worker performs
one bounded attempt in the manifest's existing lane. Humans still own material
scope changes, merge and every production effect.

Task Flow state is a runtime aid, not Sanctuary's business source of truth. The
strict manifest, Git branch, draft pull request, CI checks and completion report
remain the canonical engineering evidence.

## Narrow supervision tools

Only `sanctuary-engineering-supervisor` receives these optional tools:

| Tool                                          | Purpose                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `sanctuary_engineering_supervision_enqueue`   | Strictly validate and idempotently create one managed flow for one exact manifest hash.                     |
| `sanctuary_engineering_supervision_claim`     | Select the oldest dependency-ready flow, provision or resume its exact lane and create one durable attempt. |
| `sanctuary_engineering_supervision_attach`    | Revision-fence the attempt to the exact native `sanctuary-coding-worker` task returned by OpenClaw.         |
| `sanctuary_engineering_supervision_reconcile` | Reconcile native task state, deadlines, bounded retries and strict completion evidence.                     |
| `sanctuary_engineering_supervision_recover`   | Resume the existing dispatch or reconcile the single active native task after a wake or gateway restart.    |
| `sanctuary_engineering_supervision_status`    | Read one flow's revision, phase, attempt ledger, cost and last checkpoint.                                  |

The supervisor no longer receives direct lane provisioning. The supervision
controller calls that reviewed runtime internally, preventing a lead turn from
bypassing the queue or allocating its own retry. Lane status and safe cleanup
remain available to the lead; publish remains worker-only.

## Lifecycle

1. Enqueue the complete `sanctuary-engineering-task-v1` manifest. Repeating the
   exact manifest returns its existing flow; reusing a task id with changed
   content fails.
2. Claim the oldest eligible flow. Every dependency must have exactly one
   succeeded Sanctuary supervision flow. At most one flow may be ready,
   running or awaiting completion.
3. Spawn exactly one `sanctuary-coding-worker` with the returned `workerPrompt`,
   `worktreePath`, stable `taskName`, `mode: "run"`, `cleanup: "keep"` and
   isolated context. Set `label` to the returned `taskLabel`. Do not override
   its model.
4. Attach the returned native run id using the dispatch's exact flow revision.
   A stale revision or different agent/session identity fails closed.
5. Yield for OpenClaw's native completion event. Do not poll. Reconcile the
   attached task when the supervisor wakes.
6. A native success waits for a strict completion report. The flow succeeds
   only when that report also matches the live clean, pushed lane and open
   draft PR.
7. After success, safely clean the lane worktree and claim the next eligible
   task. Branches and the draft PR remain for human review.

The `runTimeoutSeconds` in a dispatch confirms the manifest timeout matches the
globally pinned OpenClaw subagent timeout. It is evidence, not a supported
`sessions_spawn` parameter.

## Durable state and fencing

Each flow stores the canonical manifest and hash, current phase, attempt ledger,
cumulative reported cost, completion evidence and last checkpoint. Every
mutation supplies the current Task Flow revision. A stale writer cannot replace
a newer checkpoint.

The attempt ledger binds:

- a sequential attempt number;
- a deterministic dispatch key and stable OpenClaw task name;
- the exact worktree and deadline;
- native task, run and child-session identities; and
- its allocated cost envelope, terminal status, reported cumulative cost and
  error evidence.

The controller revalidates the stored manifest on every read. It does not adopt
unknown flows, branches, worktrees, task runs or session identities.

## Retry and recovery policy

Only `timed_out` and `lost` native outcomes are automatically retryable. A
strict worker completion with outcome `failed` may retry only when it reports a
clean worktree, passed secret scan, no merge and no production effect. Native
`failed` or `cancelled`, an unsafe completion, an unknown state, identity drift,
or a failed cancellation blocks for an operator.

Retries reuse the same manifest lane and cannot exceed `maxAttempts`, the
globally pinned worker deadline or `maxCostCents`. Repeated recovery while a
dispatch is merely ready returns the same attempt and task name; it does not
create a second worktree or worker. If the gateway stopped after spawn but
before attachment, the controller finds the one native task with the exact
stable label and bound prompt, attaches it, and refuses duplicates. An overdue
running task must be cancelled through OpenClaw's native task runtime before a
retry becomes eligible.

The remaining reported cost budget is divided across the remaining attempts and
stored with each dispatch. A completion report supplies the new cumulative task
total; it cannot spend a later attempt's allocation early. If a timed-out or
lost run cannot report usage, the controller conservatively reserves that
attempt's full allocation before considering a retry.

On a gateway restart, the supervisor calls the recovery tool once. It either
returns the existing ready dispatch, waits on the attached native task,
reconciles its terminal state, or creates one permitted same-lane retry. Managed
Task Flow revision and native task identity provide the restart fence.

Gateway restart recovery assumes the same supervisor session is resumed. Do not
run `/new`, `/reset` or delete that session while a flow is active: OpenClaw's
native task APIs scope ownership to the requesting session. An intentional
session replacement is an operator recovery, not an automatic retry.

## Verification

```bash
npm run test:ai:ops
npm run test:ai
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-contract.mjs
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-runtime.mjs
sanctuary-openclaw plugins inspect sanctuary-engineering-lanes --runtime --json
sanctuary-openclaw tasks flow list --json
sanctuary-openclaw tasks audit --json
```

The live promotion rehearsal must prove exact enqueue/resume, dependency wait,
single-worker enforcement, native task binding, gateway-restart recovery,
bounded same-lane retry and strict completion. It must not merge, deploy, use a
production credential or expose any token.
