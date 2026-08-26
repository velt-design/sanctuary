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

| Surface              | Engineering value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| State                | `~/.openclaw-sanctuary-engineering`                                                             |
| Config               | `~/.openclaw-sanctuary-engineering/openclaw.json`                                               |
| Gateway              | loopback port `19011`, token-authenticated                                                      |
| CLI                  | `~/bin/sanctuary-openclaw`                                                                      |
| Workspaces           | `~/.openclaw-sanctuary-engineering/workspaces/**`                                               |
| Channels and browser | disabled                                                                                        |
| Plugins              | pinned official `@openclaw/codex@2026.7.1-1` plus reviewed `sanctuary-engineering-lanes@1.2.14` |

Activation never writes the default `~/.openclaw/openclaw.json`, approvals,
agents, sessions, gateway token or gateway process. An unrelated OpenClaw
channel or experiment therefore cannot silently change the engineering model,
tools or approval posture. Both instances may run only because they use unique
state, config, ports and workspace roots.

This is configuration and operational isolation, not an adversarial OS security
boundary. Every role runs as the dedicated non-admin `sanctuary-runner` account,
which must continue to hold no production credential.

## Named roles

| Role                               | Authority                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanctuary-engineering-supervisor` | Read contracts/evidence; use narrow durable-supervision plus lane status/cleanup tools; spawn and wait for exact named dispatches. It can request the one recorded operator-authorized correction for the recognized invalid historical reviewer dispatch, but cannot silently replace or steer reviewers. An exact finite tool allowlist and fail-closed native-tool hook permit only those named operations, with no general shell, direct lane provisioning or product-file mutation. |
| `sanctuary-coding-worker`          | No-prompt coding inside the assigned worker root; focused checks and narrow status/publish tools. One leaf worker cannot spawn another agent.                                                                                                                                                                                                                                                                                                                                            |
| `sanctuary-code-reviewer`          | Read-only exact CI/diff evidence and narrow lane-status review. An exact finite tool allowlist and fail-closed native-tool hook permit only those named operations, with no shell, mutation, delegation, reviewer replacement or merge authority.                                                                                                                                                                                                                                        |

The installed OpenClaw schema requires a deterministic default route, so only
the bounded supervisor is marked default. The coding worker and reviewer remain
explicit named children and cannot become an implicit execution route. Operator
commands still name the supervisor; do not start the worker directly.

Session history is visible across this isolated three-agent fleet so the
supervisor can validate a worker or reviewer report after a gateway restart.
OpenClaw agent-to-agent access remains enabled only for the three exact
engineering role IDs; the separate default OpenClaw instance and its sessions
are outside this state and remain invisible.

## Why routine prompts stop

The worker's two execution-policy layers both resolve to full execution with
`ask: off`, and the managed Codex app-server uses `approvalPolicy: never` with
`danger-full-access`. The supervisor and reviewer use OpenClaw `auto` execution
mode so the managed local Codex app-server can run. Their exact finite tool
allowlists are applied as a second,
model-specific policy after the minimal profile is extended with the same named
tools. Backed by explicit denies for
`exec`, `process`, `write`, `edit` and `apply_patch`, those finite allowlists
restrict their OpenClaw dynamic surface. The installed Sanctuary lane plugin
also registers a fail-closed native `before_tool_call` hook: for either oversight
agent, every tool name outside the same exact role allowlist is blocked before
execution. This closes the Codex-native shell and patch boundary while leaving
the coding worker unchanged. They receive their named narrow dynamic tools,
loaded directly so an
unattended turn does not depend on the model discovering an already approved
tool through a searchable catalog. Any host execution miss fails closed.

GitHub uses the repository-scoped Sanctuary GitHub App. The helper reads its
identity with a headless, read-only 1Password service account and requests a
short-lived installation token. It does not use the desktop app, so there is no
approval pop-up for each command. The token is passed only to an exact Git
credential request or the restricted Sanctuary read/draft wrapper; raw token,
merge and ready-for-review modes are absent. The service-account token is copied once from
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
3. writes the reviewed approvals before OpenClaw starts so its legacy migration
   cannot move the default instance's approvals, then imports them through the
   supported CLI;
4. installs or verifies the exact official Codex plugin and reviewed lane-tool
   plugin versions, load records and compatibility probes;
5. verifies the headless 1Password service account and exact GitHub App scope;
   and
6. validates the lane tool allowlists without giving the lead or reviewer a
   general execution surface.

Every isolated OpenClaw command fingerprints the default instance's config and
approval authority before and after execution. Any cross-state mutation stops
activation instead of being silently accepted.

The gateway token remains a structured environment SecretRef in config; the
protected wrapper reads the value only at runtime. The first worker rehearsal
starts the managed Codex app-server and is the final binary/authentication proof.

The stable core currently reports its latest stable official Codex plugin as one
package patch behind (`2026.7.1-2` versus `2026.7.1-1`). Activation independently
pins and verifies that npm release, requires clean plugin compatibility probes,
and fails configured-install lint on errors rather than that version-only warning.
The full security lint must remain clean.

The lane lifecycle and hosted default-branch promotion block are defined in
`openclaw-engineering-lanes.md`. The managed Task Flow, dependency, retry and
restart contract is defined in `openclaw-engineering-supervision.md`.

Complete one device-code login on the bounded supervisor inside this isolated
state:

```bash
sanctuary-openclaw models auth --agent sanctuary-engineering-supervisor login \
  --provider openai --device-code
```

OpenClaw resolves sub-agent authentication by agent id and additively merges the
main supervisor's profile as a fallback for named children. One supervisor login
therefore authenticates delegated worker and reviewer turns while their Codex
homes, threads and workspaces remain separate. Do not log in the worker directly
or copy credential databases between agents.

Start the sleep-resistant, loopback-only instance:

```bash
npm run ai:engineering:start-mac
```

Stop only this isolated instance with the reviewed kill switch:

```bash
npm run ai:engineering:stop-mac
```

The stop command requires the protected PID to match the current runtime user,
the `openclaw-gateway` process title and loopback port `19011`. It sends one
graceful termination signal, removes only the isolated PID record after both the
process and health check are down, and refuses `pkill`, `killall`, force kill or
an unknown healthy gateway. It fingerprints the default OpenClaw authority
before and after the stop.

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
- the supervisor and reviewer have no shell, and only their named narrow lane
  tools are present;
- the worker has no-prompt coding plus status/publish authority and is capped
  at one active leaf;
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
