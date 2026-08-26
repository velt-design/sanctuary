# OpenClaw Engineering CI And Review

Status: Repository contract and initial hosted `main` protection active; the
foundation check promotion and live Mac rehearsals remain promotion gates.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Keep a coding worker's claim separate from proof. A clean draft pull request is
only a candidate result. GitHub Actions independently tests the exact head, then
a different read-only Codex-backed agent reviews the exact evidence and diff.
OpenClaw may finish the durable task only after both gates pass. A human remains
the only merge authority.

## Stable CI check

`.github/workflows/autonomous-engineering.yml` runs on every pull request, with
the stable job name `Autonomous Engineering Foundation`. It never uses a path
filter that could make a required check disappear:

- non-foundation changes take a deterministic no-op route and pass the named
  check;
- foundation changes run strict changed-architecture reporting, AI operations
  and provider-neutral contract tests, the AI package typecheck, and docs/package
  boundary guards; and
- checkout is read-only with persisted credentials disabled. No OpenAI or
  production secret is supplied to the workflow.

The route is derived from the event's exact base and head SHAs. Unsafe paths or
an unbounded change set fail the job.

## Exact-head evidence and failure policy

The controller re-reads the open draft PR and requires its number, URL, base
ref/SHA, feature branch and head SHA to match the manifest and worker report.
Each named check must appear exactly once.

| Result                                                                                                | Controller action                                                                    |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Missing or running                                                                                    | Remain `ci_pending`; watch in bounded windows until the durable deadline.            |
| Passed                                                                                                | Freeze the evidence hash and prepare the independent reviewer.                       |
| Recognized runner/network interruption, or differing assertions between a test and its built-in retry | Rerun only the failed jobs of the exact workflow run, once per head.                 |
| Stable test failure                                                                                   | Record the failed-check evidence and allocate one permitted same-lane coding repair. |
| Duplicate, skipped, neutral, stale or unknown terminal state                                          | Block for an operator; never reinterpret it as success.                              |

The failed log is read only to classify the result. A rerun does not erase the
first evidence: its hash and count remain in durable state. If the rerun has not
yet appeared, identical evidence stays pending instead of being mistaken for a
second failure.

## Independent review

After CI passes, the controller creates one deterministic packet containing the
canonical task, worker completion, exact CI evidence and hash, and a bounded Git
diff. Diff text is explicitly marked untrusted. The named
`sanctuary-code-reviewer` has read-only tools, no shell, no delegation and no
merge or production authority.

The reviewer returns one strict `sanctuary-engineering-review-v1` JSON object.
It must cover every acceptance criterion once and in order. Approval requires
all criteria to pass and no blocking finding. The model returns
`controller_bound` for native identity and timestamp fields; the controller
replaces those sentinels with the child-session and task times it already
verified. A stale head, CI hash, PR, session, lane or budget fails closed.
Blocking findings may create one remaining same-lane worker attempt; reviewer
runtime failure is never replaced automatically.

## Hosted `main` authority

`scripts/ai/github-main-protection.mjs` defines and audits the GitHub protection
payload. The initial policy:

- requires a pull request and strict `Portal Quality` plus `Portal Performance
Report` checks;
- applies to administrators;
- requires linear history and resolved conversations;
- blocks force pushes and deletion;
- has no user, team or GitHub App review bypass.

GitHub does not support branch push restrictions on a personal-account
repository. Before every apply/check, the script therefore verifies that this
is the expected owner-admin personal repository and that `velt-design` is its
only human write collaborator. With pull requests enforced for administrators,
that owner can merge in GitHub but cannot directly push `main`; the GitHub App
is not a collaborator and has no bypass allowance.

The repository currently has one human owner, so the approval count is zero:
GitHub does not allow a PR author to approve their own PR. The human merge click
is still required. Add a required approval when a second trusted human reviewer
is available.

The initial policy was applied and re-read successfully on 2026-08-26. Do not
add the foundation check to the required set until its guarded promotion command
passes after merge.

Apply or audit the initial policy from Jordan's authenticated operator machine:

```bash
npm run ai:engineering:main-protection -- --apply
npm run ai:engineering:main-protection -- --check
```

The Mac GitHub App has no administration permission and cannot run this change.
After this workflow is merged to `main` and the current main revision has one
successful foundation check, promote it into the required set:

```bash
npm run ai:engineering:main-protection -- --apply --promote-foundation
npm run ai:engineering:main-protection -- --check --promote-foundation
```

Promotion fails if the workflow is absent, inactive, duplicated or not green on
the current main revision. This two-stage activation avoids deadlocking the
existing stacked PRs on a check that did not exist on their base commits.

## Verification

```bash
npm run test:ai:ops
npm run test:ai
node --check scripts/ai/engineering-ci-route.mjs
node --check scripts/ai/github-main-protection.mjs
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/ci-runtime.mjs
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/review-runtime.mjs
```

Live promotion additionally requires a passed exact-head task, one transient
rerun rehearsal, one repair rehearsal, a reviewer identity mismatch rehearsal,
a gateway-restart recovery, and proof that the Mac App cannot update `main`.
