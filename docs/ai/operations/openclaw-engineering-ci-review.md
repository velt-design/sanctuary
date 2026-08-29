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
- foundation-owned changes run strict worktree ownership plus every strict
  changed-file architecture guard, AI operations and provider-neutral contract
  tests, the AI package typecheck, and docs/package boundary guards;
- shared manifests and repository-level tooling that can affect the AI
  foundation run the same focused AI checks and every strict changed-file guard
  except worktree ownership, because their presence does not make unrelated
  product files part of an AI-owned lane; and
- checkout is read-only with persisted credentials disabled. No OpenAI or
  production secret is supplied to the workflow.

The route is derived from the event's exact base and head SHAs. Unsafe paths or
an unbounded change set fail the job. A pull request that changes any genuinely
foundation-owned path still takes the strict ownership route, even when shared
manifests or non-foundation files are present, so a mixed change cannot use a
shared-impact trigger to broaden the AI lane.

## Exact-head evidence and failure policy

The controller re-reads the open draft PR and requires its number, URL, base
ref/SHA, feature branch and head SHA to match the manifest and worker report.
Each named check must appear exactly once.

GitHub's live check rollup may represent an unfinished check with an empty
conclusion and a zero-value completion timestamp. The CI adapter normalizes the
empty conclusion to `null`, records the check as pending, and re-reads the exact
PR head on the next reconciliation. Empty pending fields are not malformed
terminal evidence and must not strand an otherwise healthy flow.

Durable checkpoints written before that normalization may contain a blank
status or conclusion. Recovery accepts that legacy value only when the same
check is classified as pending, then immediately replaces it with freshly
normalized exact-head evidence. Blank lifecycle values remain invalid for
passed, failed, actionable, transient, or blocked evidence.

| Result                                                                                                | Controller action                                                                                              |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Missing                                                                                               | Dispatch the exact AI foundation workflow once for the verified feature-branch head, then remain `ci_pending`. |
| Running                                                                                               | Remain `ci_pending`; watch in bounded windows until the durable deadline.                                      |
| Passed                                                                                                | Freeze the evidence hash and prepare the independent reviewer.                                                 |
| Recognized runner/network interruption, or differing assertions between a test and its built-in retry | Rerun only the failed jobs of the exact workflow run, once per head.                                           |
| Stable test failure                                                                                   | Record the failed-check evidence and allocate one permitted same-lane coding repair.                           |
| Duplicate, skipped, neutral, stale or unknown terminal state                                          | Block for an operator; never reinterpret it as success.                                                        |

## Bounded reviewer dispatch

The supervisor returns the trusted review packet through an OpenClaw tool
before spawning the independent reviewer. Keep that dispatch at or below
15,000 characters so OpenClaw cannot truncate the immutable prompt between the
controller and the supervisor. The current packet uses compact JSON, records
acceptance evidence by criterion index instead of repeating every criterion,
uses indexed copy instructions in the output skeleton instead of repeating the
same criteria there, and still includes the exact task, completion, CI and diff
hashes needed for a read-only review.

Recovery recognizes the prior embedded, chunked and templated-chunked prompt
hashes, upgrades a still-ready review to the bounded packet, and only then
allows a matching reviewer to be attached. A packet that cannot fit the bound
fails before dispatch; truncated or reconstructed text never qualifies as the
named reviewer.

The failed log is read only to classify the result. A rerun does not erase the
first evidence: its hash and count remain in durable state. If the rerun has not
yet appeared, identical evidence stays pending instead of being mistaken for a
second failure.

## Independent review

After CI passes, the controller creates one deterministic compact packet
containing the canonical task, worker completion, exact CI evidence and the
exact Git diff hash. The named `sanctuary-code-reviewer` reads every diff chunk
through `sanctuary_engineering_review_diff_chunk`; each call revalidates the
open draft PR's base, head and full diff hash. Diff text is explicitly marked
untrusted. The reviewer has no shell, mutation, delegation, merge or production
authority. Bounded chunks prevent transport truncation without weakening or
omitting review evidence.

The reviewer returns one strict `sanctuary-engineering-review-v1` JSON object.
It must cover every acceptance criterion once and in order. Approval requires
all criteria to pass and no blocking finding. The model returns
`controller_bound` for native identity and timestamp fields; the controller
replaces those sentinels with the child-session and task times it already
verified. A stale head, CI hash, PR, session, lane or budget fails closed.
Blocking findings may create one remaining same-lane worker attempt; reviewer
runtime failure is never replaced automatically.

A reviewer is also never silently replaced for malformed output. The only
exceptions are the finite, ordered, operator-authorized corrections for the two
recognized historical dispatch defects: the original prompt/allowlist contract,
then the missing parent registration required for child tool inheritance. For
each one, the controller verifies the exact completed native reviewer and prompt
hash, reserves its full review budget, records its run/task/session evidence in
durable history, then returns one strict replacement dispatch. Repeating,
reordering or applying either correction to any other prompt fails closed.

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
