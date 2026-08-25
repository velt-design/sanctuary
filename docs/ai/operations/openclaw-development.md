# OpenClaw Development Mode

Status: Owner-approved activation contract for the Mac mini.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Run real Sanctuary product-development tasks without per-command or per-task
approval prompts. The dedicated non-admin `sanctuary-runner` account may edit
the Sanctuary repository, run tests, push feature branches, and open draft pull
requests. The Mac remains rebuildable from GitHub and 1Password.

## Authority

Allowed without further approval:

- inspect the repository and current documentation;
- edit code and documentation inside the Sanctuary checkout;
- install ordinary repository dependencies;
- run tests, linters, builds, and local development servers;
- create and push non-protected feature branches; and
- open or update draft pull requests.

Not yet available to the node:

- merge pull requests or push directly to `main`;
- deploy Vercel or another production runtime;
- read or mutate production Supabase data;
- send customer, staff, email, advertising, or payment messages; or
- use owner/admin credentials from other 1Password vaults.

The no-prompt posture is deliberate. OpenClaw uses the `coding` tool profile,
Codex's native harness, `tools.exec.mode: full`, and no OpenClaw sandbox. The OS
account is non-admin, GitHub is repository-scoped, and no production credential
exists on the node.

## Activation

From the reviewed activation branch on the Mac:

```bash
node scripts/ai/mac-openclaw-development-activate.mjs
```

Then complete the one-time ChatGPT/Codex OAuth sign-in:

```bash
openclaw models auth login --provider openai
```

Verify the model and run one end-to-end coding task with `openclaw agent exec`.
The first proof is Marketing Configurator PR 1.

References:

- <https://docs.openclaw.ai/plugins/codex-harness>
- <https://docs.openclaw.ai/tools/permission-modes>
- <https://docs.openclaw.ai/cli/agent>
