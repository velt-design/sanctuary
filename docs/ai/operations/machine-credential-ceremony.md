# Mac Mini Machine Credential Ceremony

Status: Control-plane preparation completed; FileVault verified and runtime
credential issuance authorised for the rebuildable development node.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Give `sanctuary-runner` enough non-interactive authority to read its own runtime
secrets and create Sanctuary branches and pull requests. This does not grant
workflow, deployment, environment, secret-management, administration, or
production access.

## Credential-Free CLI Preparation

The signed 1Password CLI may be installed for `sanctuary-runner` before
credential issuance because the binary itself contains no account or secret.
Install it from the official 1Password release channel, verify the
macOS code signature identifies Team ID `2BUA8C4S2C`, and confirm `op --version`
is 2.18.0 or later. A non-admin installation may use `~/bin/op` when that
directory is already in the runtime account's `PATH`.

Do not connect the CLI to a person's 1Password desktop session. The headless
runtime uses only the restricted service account described below. FileVault must
pass before its token or the GitHub App key is placed on the node; a local backup
disk is not required while the node remains rebuildable and development-only.

## One-Time Owner Actions

1. Create a new 1Password vault named `Sanctuary - Node Runtime`. Put no owner,
   admin, FileVault, backup, production, customer, email, or payment secret in it.
2. Create the GitHub App `Sanctuary Node PR Bot`, owned by the business-controlled
   GitHub account that owns `velt-design/sanctuary` (currently `velt-design`).
   Disable webhooks. Grant repository permissions only:
   `Metadata: read`, `Contents: read and write`, and `Pull requests: read and
write`.
3. Install that app only on `velt-design/sanctuary`. Do not grant all-repository
   access.
4. After the FileVault gate passes, generate one private key
   and store its App ID, installation ID, and private key in
   `Sanctuary - Node Runtime`; then remove the downloaded key. If the repository
   later moves to a GitHub organisation, transfer or recreate the app under that
   organisation before the node uses it again.
5. Create the 1Password service account `sanctuary-node-runtime`. Grant only
   `read_items` on `Sanctuary - Node Runtime`, no other vault or Environment,
   and no create-vault permission. Do not set an automatic expiry: unattended
   operation must not stop on a date. Revoke and recreate it after suspected
   exposure or a material access change.
6. Save the one-time service-account token in `Sanctuary - Owners`. Do not paste
   it into Git, a task, chat, shell history, `.env`, or a launchd plist.
7. Put the App ID in the username field, the private key in the password field,
   and the installation ID in a custom `installation_id` field on one item named
   `GitHub - Sanctuary Node PR Bot` inside `Sanctuary - Node Runtime`.
8. During the controlled Mac ceremony, place only the service-account token at
   `~/.openclaw-sanctuary-engineering/credentials/onepassword/service-account-token`
   with file mode `0600` and parent directories mode `0700`. The isolated
   activation can migrate the same protected token once from the retired
   `~/.openclaw` location without printing it. This headless path does not use
   the 1Password desktop app.

The token insertion step is intentionally not a copy-paste command in Git. Enter
it through a non-logging operator session after FileVault passes. Record only
the item name and owner in the private asset register.

## Live Credential-Free Preparation Evidence

Verified on 2026-08-25:

- GitHub App: `Sanctuary Node PR Bot` (`sanctuary-node-pr-bot`), owned by
  `velt-design`;
- App ID: `4710278`;
- installation ID: `156382349`;
- repository access: only `velt-design/sanctuary`;
- permissions: metadata read-only, contents read/write, pull requests
  read/write, and Actions read/write. Actions write is used only by the reviewed
  wrapper to rerun failed jobs for one exact Sanctuary workflow run; cancel,
  dispatch, workflow editing, merge, deployment and protected-branch bypass are
  not exposed;
- webhooks, user OAuth, and Device Flow: disabled; and
- private key and client secret: not generated.

These identifiers are not credentials. The installation cannot authenticate as
the app until a private key is generated. FileVault now passes, so the key may
be created and placed on this development node without waiting for a backup
disk.

## Verification

As `sanctuary-runner`, run:

```bash
node scripts/ai/mac-machine-credential-gate.mjs --attest-op-read-only
```

The gate uses the 1Password service token only in the `op` subprocess, requests
only an ephemeral Sanctuary-scoped GitHub App installation token, and prints no
credential value. It passes only when:

- 1Password CLI 2.18.0 or later is installed;
- the service account can see exactly `Sanctuary - Node Runtime`;
- the operator attests its immutable permission is `read_items` only;
- the local service-account token file is readable only by `sanctuary-runner`;
- all GitHub App identity values are retrieved from the restricted runtime vault;
- the installation token contains only the exact repository and permissions
  above.

Revoke and recreate either identity if the gate reports broader access. Do not
weaken the gate to match an over-privileged credential.

References:

- <https://www.1password.dev/service-accounts/get-started>
- <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app>
