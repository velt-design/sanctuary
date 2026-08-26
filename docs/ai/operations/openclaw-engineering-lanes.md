# OpenClaw Engineering Lanes

Status: Runtime and local contract implemented; live Mac plugin and branch-rule
rehearsals remain before promotion.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Give every approved engineering task one exact Git branch and one disposable
worktree without giving the OpenClaw supervisor a general shell. The immutable
task manifest owns the base SHA, branch, path lane, limits and stop conditions.
The lane runtime binds those facts to local state before a coding worker starts.

## Narrow tool boundary

The reviewed `sanctuary-engineering-lanes` OpenClaw plugin exposes four optional
tools. Agent allowlists make their ownership explicit:

| Tool | Allowed role | Effect |
| --- | --- | --- |
| `sanctuary_engineering_lane_provision` | Engineering Lead | Strictly validate the complete manifest; create or resume its exact worktree and return the bound worker prompt. |
| `sanctuary_engineering_lane_status` | Lead, worker, reviewer | Report recorded branch, head, cleanliness, changed paths and draft PR without mutation. |
| `sanctuary_engineering_lane_publish` | Coding Worker | Verify clean committed scope, push only the exact feature ref and create or confirm one open draft PR. |
| `sanctuary_engineering_lane_cleanup` | Engineering Lead | Remove only the clean recorded worktree after its remote head and open draft PR still match. Retain local and remote branches. |

The lead and reviewer still have no shell. The worker has coding execution but
does not need to retrieve a GitHub token or assemble a raw PR command. The
restricted `gh` wrapper permits Sanctuary reads and explicit draft creation;
merge, ready-for-review, close, API mutation and other GitHub commands fail
closed.

This is a trusted development boundary, not protection from malicious code
running as `sanctuary-runner`. The separate GitHub branch rule described below
is therefore mandatory before promotion.

## Filesystem layout

```text
~/.openclaw-sanctuary-engineering/
  sanctuary-engineering-owner.json
  workspaces/worker/tasks/
    active-lane.json
    eng_YYYYMMDD_name/
      owner.json
      manifest.json
      worker-prompt.md
      repo/                 # Git worktree
```

The task id is validated before it becomes a path. Every lane path must resolve
under the dedicated worker task root. Owner, manifest, prompt and lease files
are owner-only. Unknown directories, branches or owner mismatches are never
adopted or deleted.

## Provisioning contract

Provisioning performs these checks in order:

1. The state root has the exact Sanctuary engineering owner record.
2. The controller checkout is clean, its fetch and push URLs are the expected
   Sanctuary repository, and both manifest refs pass Git ref validation.
3. `@sp/ai` strictly parses and canonicalizes the complete task. Its canonical
   SHA-256 identity is recorded with the lane.
4. No other task holds the one-worker lease.
5. The exact base branch is fetched through the repository-scoped GitHub App;
   `FETCH_HEAD` must equal the manifest's 40-character base SHA.
6. The feature branch does not already exist locally or remotely unless an
   exact local owner record proves this is a same-manifest resume.
7. Git creates the worktree at the recorded path and branch. A crash after the
   owner intent is written resumes that same branch; it does not start over.

The returned worker prompt includes the absolute assigned worktree and exact
manifest hash. A changed objective, base, branch, owned path, check, limit or
approval changes the hash and cannot resume the old lane.

## Publish and cleanup contract

Publication refuses to run unless:

- the recorded worktree is registered on the exact feature branch;
- the tree is clean and contains at least one committed change after the base;
- the base is still an ancestor of the head;
- every changed path matches `ownedPaths` and none matches `excludedPaths`;
- the push uses the exact HTTPS repository URL and explicit
  `refs/heads/feature:refs/heads/feature` refspec without force; and
- GitHub returns exactly one open draft PR with the manifest's head and base.

Cleanup rechecks the clean head, remote head and exact open draft PR. It calls
plain `git worktree remove` without force, keeps the owner evidence, and leaves
both feature branches intact. It never deletes a repository root, unknown path,
branch, commit, PR or remote ref.

## Operator CLI

The same controller can be exercised outside a model turn. Environment comes
from the isolated wrapper or gateway:

```bash
npm run ai:engineering:lane -- provision path/to/task.json
npm run ai:engineering:lane -- status TASK_ID MANIFEST_HASH
npm run ai:engineering:lane -- publish TASK_ID MANIFEST_HASH \
  --title "feat: bounded change" --body-file /path/to/pr-body.md
npm run ai:engineering:lane -- cleanup TASK_ID MANIFEST_HASH
```

Routine OpenClaw operation should use the narrow tools, not this general CLI.
The CLI exists for deterministic tests, operator diagnosis and recovery.

## GitHub promotion block

The repository-scoped GitHub App needs `contents: write` to push a feature
branch. GitHub cannot limit that permission to only non-default branches. The
local publisher rejects `main`, force pushes and merge commands, but local
model instructions are not the final hosted authority.

Before autonomous product work is promoted, the hosted `main` branch must have
an enforced rule that blocks direct pushes and deletion and requires a pull
request plus human approval. The GitHub App must have no bypass. The CI/review
foundation PR owns that hosted change and its negative proof. Until then this
runtime remains staged, even if lane tests and draft creation pass.

## Verification

```bash
npm run test:ai:ops
npm run test:ai
node --check infra/openclaw/engineering/plugins/sanctuary-engineering-lanes/index.mjs
sanctuary-openclaw plugins inspect sanctuary-engineering-lanes --runtime --json
sanctuary-openclaw plugins doctor
sanctuary-openclaw doctor --lint --only core/doctor/security --json
```

The live rehearsal must prove exact provision, same-manifest resume, dirty and
outside-lane refusal, draft publication, safe worktree cleanup, rejected main
push and rejected merge. Evidence must not contain an installation token or
1Password value.
