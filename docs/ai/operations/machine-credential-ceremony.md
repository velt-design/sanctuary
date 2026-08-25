# Mac Mini Machine Credential Ceremony

Status: Prepared protocol; do not execute until the FileVault and backup gates pass.

Owner: Jordan / Sanctuary Pergolas

## Purpose

Give `sanctuary-runner` enough non-interactive authority to read its own runtime
secrets and create Sanctuary branches and pull requests. This does not grant
workflow, deployment, environment, secret-management, administration, or
production access.

## Credential-Free CLI Preparation

The signed 1Password CLI may be installed for `sanctuary-runner` before the
FileVault and backup gates pass because the binary itself contains no account or
secret. Install it from the official 1Password release channel, verify the
macOS code signature identifies Team ID `2BUA8C4S2C`, and confirm `op --version`
is 2.18.0 or later. A non-admin installation may use `~/bin/op` when that
directory is already in the runtime account's `PATH`.

Do not connect the CLI to a person's 1Password desktop session. Do not place a
service-account token, vault item, GitHub key, or other credential on the node
until the FileVault and backup/restore gates pass. The headless runtime uses only
the restricted service account described below.

## One-Time Owner Actions

1. Create a new 1Password vault named `Sanctuary - Node Runtime`. Put no owner,
   admin, FileVault, backup, production, customer, email, or payment secret in it.
2. Create the GitHub App `Sanctuary Node PR Bot`, owned by the business-controlled
   GitHub account that owns `velt-design/sanctuary` (currently `velt-design`).
   Disable webhooks. Grant repository permissions only:
   `Metadata: read`, `Contents: read and write`, and `Pull requests: read and
   write`.
3. Install that app only on `velt-design/sanctuary`. Do not grant all-repository
   access. Generate one private key and store its App ID, installation ID, and
   private key in `Sanctuary - Node Runtime`; then remove the downloaded key.
   If the repository later moves to a GitHub organisation, transfer or recreate
   the app under that organisation before the node uses it again.
4. Create the 1Password service account `sanctuary-node-runtime`. Grant only
   `read_items` on `Sanctuary - Node Runtime`, no other vault or Environment,
   and no create-vault permission. Set a named expiry/rotation date.
5. Save the one-time service-account token in `Sanctuary - Owners`. Do not paste
   it into Git, a task, chat, shell history, `.env`, or a launchd plist.
6. During the controlled Mac ceremony, place the service-account token and the
   three GitHub App values into macOS System Keychain under the exact service
   names used by `scripts/ai/mac-machine-credential-gate.mjs`. The operator must
   confirm that `sanctuary-runner` can read them without a prompt and that other
   standard accounts cannot.

Use Keychain account `sanctuary-runner` and these exact service names:

- `sanctuary.1password.service-account`;
- `sanctuary.github.app-id`;
- `sanctuary.github.installation-id`;
- `sanctuary.github.private-key`.

The Keychain insertion step is intentionally not a copy-paste command in Git:
the values must be entered through a non-logging operator session after disk and
backup recovery pass. Record only the item names, owners, and rotation dates in
the private asset register.

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
- all GitHub App identity values are retrieved from Keychain;
- the installation token contains only the exact repository and permissions
  above.

Revoke and recreate either identity if the gate reports broader access. Do not
weaken the gate to match an over-privileged credential.

References:

- <https://www.1password.dev/service-accounts/get-started>
- <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app>
