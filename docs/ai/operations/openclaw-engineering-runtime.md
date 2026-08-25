# OpenClaw Engineering Runtime

Status: Isolated runtime contract implemented; live role-boundary rehearsal is
required before product work is promoted through it.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Run approved Sanctuary engineering goals without routine 1Password, shell or
per-task prompts. OpenClaw supervises separate Codex-backed roles; it is not the
coding worker itself. Humans continue to approve material scope, review draft
pull requests and merge.

## Isolation boundary

The engineering runtime is a separate OpenClaw instance:

| Surface              | Engineering value                                 |
| -------------------- | ------------------------------------------------- |
| State                | `~/.openclaw-sanctuary-engineering`               |
| Config               | `~/.openclaw-sanctuary-engineering/openclaw.json` |
| Gateway              | loopback port `19011`, token-authenticated        |
| CLI                  | `~/bin/sanctuary-openclaw`                        |
| Workspaces           | `~/.openclaw-sanctuary-engineering/workspaces/**` |
| Channels and browser | disabled                                          |
| Plugins              | bundled `codex` only                              |

Activation never writes the default `~/.openclaw/openclaw.json`, approvals,
agents, sessions, gateway token or gateway process. An unrelated OpenClaw
channel or experiment therefore cannot silently change the engineering model,
tools or approval posture. Both instances may run only because they use unique
state, config, ports and workspace roots.

This is configuration and operational isolation, not an adversarial OS security
boundary. Every role runs as the dedicated non-admin `sanctuary-runner` account,
which must continue to hold no production credential.

## Named roles

| Role                               | Authority                                                                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanctuary-engineering-supervisor` | Read contracts and evidence; spawn, inspect, steer and wait for the two named child roles. No shell or file mutation.                                |
| `sanctuary-coding-worker`          | No-prompt coding inside the assigned worker root; focused checks, feature-branch push and draft PR only. One leaf worker cannot spawn another agent. |
| `sanctuary-code-reviewer`          | Read-only independent evidence review. No shell, mutation, delegation or merge authority.                                                            |

The installed OpenClaw schema requires a deterministic default route, so only
the bounded supervisor is marked default. The coding worker and reviewer remain
explicit named children and cannot become an implicit execution route. Operator
commands still name the supervisor; do not start the worker directly.

## Why routine prompts stop

The worker's two execution-policy layers both resolve to full execution with
`ask: off`, and the managed Codex app-server uses `approvalPolicy: never` with
`danger-full-access`. The supervisor and reviewer do not receive execution tools
and their host approval policy is deny.

GitHub uses the repository-scoped Sanctuary GitHub App. The helper reads its
identity with a headless, read-only 1Password service account and requests a
short-lived installation token. It does not use the desktop app, so there is no
approval pop-up for each command. The service-account token is copied once from
the protected legacy location into the isolated state without printing it.

## Activation on the Mac

From the reviewed Sanctuary checkout as `sanctuary-runner`:

```bash
npm run ai:engineering:activate-mac
```

The activation is idempotent for the claimed Sanctuary state. It fails rather
than overwrite an unclaimed or differently owned state directory. It then:

1. verifies FileVault and the non-admin runtime account;
2. writes the reviewed config, role instructions and wrappers to the dedicated
   state;
3. imports the reviewed per-agent approvals into that state's SQLite store;
4. validates the config and bundled Codex app-server binary; and
5. verifies the headless 1Password service account and exact GitHub App scope.

Complete one OpenAI login inside this isolated state:

```bash
sanctuary-openclaw models auth login --provider openai
```

Start the sleep-resistant, loopback-only instance:

```bash
npm run ai:engineering:start-mac
```

The launcher survives SSH disconnection. A FileVault restart still needs one
physical unlock; this development node does not pretend otherwise. An external
backup disk remains optional while Git, 1Password and reissuable credentials
are canonical and the Mac stores no unique business record.

## Secret-free verification

```bash
sanctuary-openclaw config validate
sanctuary-openclaw gateway health
sanctuary-openclaw agents list --json
sanctuary-openclaw approvals get
sanctuary-openclaw doctor --lint --only codex/managed-app-server --json
```

Expected evidence:

- exactly the three named agents exist and none is implicit;
- only the supervisor can target the worker and reviewer;
- the supervisor and reviewer have no shell or mutation tools;
- the worker has no-prompt coding authority and is capped at one active leaf;
- channels, browser, hooks, ACP, cron, mDNS and production credentials are
  absent; and
- the default OpenClaw gateway remains unchanged and independently healthy.

The live promotion rehearsal must separately prove the supervisor cannot edit,
the reviewer cannot execute, the worker can complete a harmless file/check in
its workspace without approval, and stopping this gateway affects no other
OpenClaw instance.

References:

- <https://docs.openclaw.ai/gateway/multiple-gateways>
- <https://docs.openclaw.ai/gateway/config-agents>
- <https://docs.openclaw.ai/tools/subagents>
- <https://docs.openclaw.ai/plugins/codex-harness-reference>
- <https://docs.openclaw.ai/tools/exec-approvals>
