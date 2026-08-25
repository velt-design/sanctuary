# OpenClaw Dark Installation

Status: Prepared and validation-tested; machine execution blocked by recovery gates.

Owner: Jordan / Sanctuary Pergolas

## What Dark Means

The CLI and sandbox image may exist, but OpenClaw has no model, provider,
channel, hook, plugin, browser, ACP runtime, tool, host execution, production
credential, or daemon. The Gateway is not left running.

The pinned package and config follow the current official installation,
sandboxing, security, and exec-policy contracts. Version upgrades require a new
integrity pin, schema validation, security audit, and this same checkpoint again.

## Prerequisites

Do not install until all three earlier gates pass. In addition, generate a long
random Gateway token during the controlled Keychain ceremony and store it for
Keychain account `sanctuary-runner` under service name
`sanctuary.openclaw.gateway-token`. Never print it or put it in Git, `.env`,
shell history, a plist, or a task.

Keep the original non-secret backup sample and its restored copy until this
checkpoint completes. Then, as `sanctuary-runner`, run the readiness check:

```bash
node scripts/ai/mac-openclaw-dark-install.mjs \
  --backup-source /path/to/original-sample \
  --backup-restored /path/to/restored-sample \
  --attest-op-read-only
```

Only after every line reports `PASS`, repeat the same command with `--install`.
The installer verifies the npm registry integrity pin, installs the exact
package under `~/.local`, copies the reviewed config and deny-all approvals with
restricted permissions, builds the pinned rootless Podman sandbox image,
validates the effective config, and requires a clean static security audit. It
does not onboard, install a daemon, start a Gateway, or add a model.

## First Live Rehearsal

The first foreground Gateway start and `openclaw security audit --deep` happen
only in a named maintenance session with the operator watching. Stop the Gateway
after the audit and confirm there is no listener. Do not install a LaunchAgent
until a later capability PR defines startup, monitoring, shutdown, and rollback.

Promotion beyond dark mode requires a separate PR and explicit approval. That
PR must name the exact model, tool, writable workspace, network destination,
credential, task class, evaluation, cost limit, approval rule, and rollback.

References:

- <https://docs.openclaw.ai/install>
- <https://docs.openclaw.ai/gateway/security>
- <https://docs.openclaw.ai/gateway/sandboxing>
- <https://docs.openclaw.ai/tools/exec-approvals>
