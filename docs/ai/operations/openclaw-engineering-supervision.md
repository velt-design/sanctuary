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
| `sanctuary_engineering_supervision_ci`        | Watch exact-head required checks, allow one classified transient rerun, or route one same-lane repair.      |
| `sanctuary_engineering_review_attach`         | Revision-fence the exact native read-only reviewer to its deterministic evidence packet.                    |
| `sanctuary_engineering_review_reconcile`      | Validate reviewer lifecycle and strict report before success or a bounded same-lane repair.                 |
| `sanctuary_engineering_review_diff_chunk`     | Let only the named reviewer read every bounded chunk of the hash-bound exact PR diff.                       |

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
   isolated context. Do not pass `label`: OpenClaw derives the durable task
   label from `taskName`, while a separate session label can collide with a
   retained recovery session. Do not override its model.
4. Attach the returned native run id using the dispatch's exact flow revision.
   A stale revision or different agent/session identity fails closed.
5. Yield for OpenClaw's native completion event. Do not poll the child. Reconcile
   the attached task when the supervisor wakes.
6. A native success waits for a strict completion report. A valid successful
   report matching the clean pushed lane and exact open draft PR enters
   `ci_pending`; it does not finish the flow.
7. The CI tool watches in two-minute windows at a thirty-second interval under
   a fixed three-minute OpenClaw per-call watchdog, with a durable ninety-minute
   deadline. It carries each new flow revision forward, so no user prompt is
   required while GitHub checks run. If a bounded manual workflow dispatch is
   needed, the controller reads its exact commit and exact required job because
   GitHub does not add `workflow_dispatch` jobs to the pull request check list.
   A gateway restart resumes from the stored checkpoint.
8. Passed exact-head CI creates one deterministic dispatch for
   `sanctuary-code-reviewer`. Spawn and attach it exactly, yield for completion,
   then reconcile one strict `sanctuary-engineering-review-v1` report. The
   controller replaces the `controller_bound` identity/time sentinels with the
   verified native child-session and task timestamps before storing the report.
9. Only passed CI plus an approved read-only review can finish the flow. A
   classified CI failure or blocking review may create a bounded same-lane
   coding repair; skipped, duplicate, stale or unclassified evidence blocks.
10. After success, safely clean the lane worktree and claim the next eligible
    task. Branches and the draft PR remain for human review.

A blocked worker report also retires its lane automatically when native
evidence proves the worktree is clean, unchanged from the exact base, unpushed
and unpublished. Any blocked lane with changes or publication evidence remains
owned for operator review rather than releasing the single-lane lease.

The `runTimeoutSeconds` in a dispatch confirms the manifest timeout matches the
globally pinned OpenClaw subagent timeout. It is evidence, not a supported
`sessions_spawn` parameter.

## Durable state and fencing

Each flow stores the canonical manifest and hash, current phase, attempt ledger,
cumulative reported cost, completion evidence, exact CI evidence/history,
independent review evidence/history, repair context and last checkpoint. Every
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
Completion validation always supplies both the canonical task manifest and the
worker report to the shared contract checker; a report is never validated as a
standalone document.

OpenClaw child runs inherit the supervisor's effective tool policy before the
worker policy is applied. The supervisor policy therefore carries the
lane-publish name through that inherited filter. The fail-closed oversight hook
rejects every supervisor invocation before execution, while the coding worker
can call the same narrow manifest-bound publisher.

## Retry and recovery policy

Only `timed_out` and `lost` native worker outcomes are automatically retryable. A
strict worker completion with outcome `failed` may retry only when it reports a
clean worktree, passed secret scan, no merge and no production effect. Native
`failed` or `cancelled`, an unsafe completion, an unknown state, identity drift,
or a failed cancellation blocks for an operator. A failed, timed-out or lost
reviewer blocks rather than silently replacing the independent review.

A blocked or failed flow also fences every manifest that was already queued when
the terminal checkpoint was written. After reviewing that evidence, an operator
acknowledges it by enqueueing a new approved manifest. The controller retains
the failed flow unchanged and may claim only flows created after that checkpoint;
it never replays older queued work as an accidental acknowledgement.

Retries reuse the same manifest lane and cannot exceed `maxAttempts`, the
globally pinned worker deadline or `maxCostCents`. Repeated recovery while a
dispatch is merely ready returns the same attempt and task name; it does not
create a second worktree or worker. If the gateway stopped after spawn but
before attachment, the controller finds the one native task from the exact
supervisor session with the target agent, canonical prompt and current attempt
time window, attaches it, ignores historical runs outside that window, and
refuses duplicates while any matching worker remains live. If every duplicate
is terminal, recovery deterministically attaches the oldest original dispatch;
this lets a corrected controller resume a prior duplicate-safety block without
starting more work.
An overdue running task must be cancelled through OpenClaw's native task
runtime before a retry becomes eligible.

The remaining reported cost budget is divided across the remaining worker and
review units and stored with each dispatch. This reserves a final independent
review even after a same-lane repair. A completion report supplies the new
cumulative task total; it cannot spend a later unit's allocation early. If a
timed-out or lost run cannot report usage, the controller conservatively
reserves that attempt's full allocation before considering a retry.

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
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-ci-review.mjs
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/supervision-ci-watch.mjs
sanctuary-openclaw plugins inspect sanctuary-engineering-lanes --runtime --json
sanctuary-openclaw tasks flow list --json
sanctuary-openclaw tasks audit --json
```

The live promotion rehearsal must prove exact enqueue/resume, dependency wait,
single-worker enforcement, native task binding, exact CI classification, one
transient rerun, bounded same-lane repair, independent reviewer identity,
gateway-restart recovery and strict reviewed completion. It must not merge,
deploy, use a production credential or expose any token.
