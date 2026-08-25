# Mac Mini Private Node Runbook

Status: Active protocol for preparation; physical execution pending.

Owner: Jordan / Sanctuary Pergolas

Review cadence: before setup, after each material platform change, and quarterly
after the node becomes operational.

## How To Use This Runbook

Complete the phases in order for the first setup. Use `Routine Operations` after
deployment and switch to `node-rebuild-and-revocation.md` or
`ai-incident-response.md` when integrity, credentials, or recovery are in doubt.

## Purpose

Build a secure, observable, rebuildable Mac mini that can later run one
staging-only synthetic Sanctuary task. This procedure does not activate
OpenClaw, the Sanctuary worker, a model/provider, or any production effect.

## Non-Negotiable Boundary

- No personal everyday Apple account or browser profile.
- No production Supabase, email, advertising, payment, customer-message, or
  broad document credential.
- No public inbound port or router port-forward.
- No canonical business record stored only on the Mac.
- No auto-login.
- No unrestricted host shell, elevated OpenClaw mode, arbitrary plugin, or
  external connector.
- No claim that reboot recovery is automatic until it has been rehearsed from a
  powered-off and FileVault-locked state.

## Before Touching The Mac

The operator must complete these private decisions outside the repository:

- [ ] Name the primary operator and a recovery custodian.
- [ ] Select the private-overlay account and owner. Tailscale is recommended for
      the first node, but account creation is an owner action.
- [ ] Select a business secret vault.
- [ ] Obtain a dedicated encrypted-backup disk of at least 2 TB for the 1 TB Mac.
- [ ] Obtain and identify the UPS, protected network equipment, and shutdown path.
- [ ] Choose a maintained Docker- or Podman-compatible macOS runtime after
      confirming licensing and operational support.
- [ ] Create a private asset-register entry. Store hardware identifiers there,
      not in Git.

## Phase 1 - Physical And Account Baseline

1. Connect the Mac mini, primary network equipment, and backup destination to
   the UPS. Use wired Ethernet where practical.
2. Install the current supported macOS release and all security updates before
   adding developer tools.
3. During Setup Assistant, create a local dedicated administrator account such
   as `sanctuary-admin`. Do not enable automatic login or a personal iCloud data
   sync profile.
4. Create a separate standard account such as `sanctuary-runner` for runtime
   services. It must not be an administrator.
5. Keep normal work in the standard account. Use the administrator only for
   updates, service installation, recovery, and audited configuration changes.
6. Set the computer name to a non-sensitive stable label. Keep the serial number,
   physical address, and exact location only in the private asset register.

Acceptance evidence, with no identifiers or secrets:

```bash
sw_vers
uname -m
fdesetup status
```

Expected: supported macOS, `arm64`, and FileVault on after Phase 2.

## Phase 2 - Disk, Recovery, Updates, And Local Security

1. Enable FileVault from System Settings -> Privacy & Security -> FileVault.
2. Use a personal recovery key rather than personal iCloud recovery. Apple no
   longer recommends an institutional recovery key for Apple silicon.
3. Store the recovery key in the business secret vault and one controlled
   offline recovery location away from the Mac. Never store it in the repo, on
   the Mac desktop, in shell history, or beside the device.
4. Test that the recorded recovery material is readable and assigned to the
   correct asset without printing it into an evidence log.
5. Enable automatic macOS updates, security responses, and application updates.
   Reboot updates during a named maintenance window and verify services after
   the console unlock.
6. Turn on the macOS application firewall and stealth mode. Do not use "Block all
   incoming" once the narrow private SSH path is deliberately enabled.
7. Disable unused sharing services: Screen Sharing, File Sharing, Media Sharing,
   Remote Management, Internet Sharing, AirPlay Receiver, and Bluetooth Sharing.
8. Leave guest access and automatic login off.

Reference: Apple documents FileVault recovery-key custody at
<https://support.apple.com/guide/mac-help/filevault-recovery-key-mh35880/mac>
and recommends a personal recovery key for Apple silicon at
<https://support.apple.com/guide/security/sec8447f5049/web>.

## Phase 3 - Private Administration

### Initial Safe Posture

1. Install the selected overlay client from its official signed distribution.
2. Enrol the Mac as a service device, not Jordan's everyday user device. For
   Tailscale, use a one-time, tagged auth key and a staging-node tag owned by a
   named admin group. Do not use a reusable key on disk.
3. Policy must allow only the named admin identity/device to reach the Mac's SSH
   service. The node must not reach unrelated tailnet devices.
4. Turn on Apple Remote Login for `sanctuary-admin` only. Keep "Allow full disk
   access for remote users" off.
5. Add a newly generated, dedicated Ed25519 public key to the admin account.
   Generate and retain the private half only on the chosen operator device or
   hardware-backed vault. Do not reuse the repository incident key, a generic
   personal key, or an unverified old "Mac mini" key.
6. From the operator device, prove key-based access over the private overlay.
7. While console access is available, disable SSH password authentication only
   after key access and a second recovery route have both been tested.
8. Do not expose port 22 or any application port on the office router.

Apple's Remote Login procedure supports limiting access to selected users:
<https://support.apple.com/guide/mac-help/mchlp1066/mac>. Tailscale recommends a
tagged server identity and access policy:
<https://tailscale.com/kb/1245/set-up-servers>.

### Reboot Truth

The normal Tailscale macOS app does not currently run as an unattended system
service before user login. FileVault also requires an unlock after power loss or
restart. Therefore the first milestone requires physical/on-site unlock after a
reboot and must not use auto-login. The UPS reduces avoidable restarts; it does
not remove this recovery dependency.

Do not adopt a standalone system `tailscaled`, pre-boot SSH unlock, or a remote
management product merely to hide this limitation. Each is a later security
decision requiring a separate test and rollback path. Record the observed boot
behavior in the private asset register.

Reference: <https://tailscale.com/docs/how-to/run-unattended>.

## Phase 4 - Repository And Runtime Baseline

1. Install Xcode Command Line Tools, Node 22, Git, and the selected container
   runtime from maintained sources. Record versions, not installer secrets.
2. Clone Sanctuary over HTTPS into a dedicated runner-owned path. The initial
   node needs read access only. Do not install a GitHub write token or SSH deploy
   key for the synthetic milestone.
3. Verify a clean checkout and repository gates before building:

```bash
node --version
npm --version
git --version
npm ci --ignore-scripts
npm run typecheck
npm run audit:security
npm run test:ai
npm run test:jobs
npm run test:worker
npm run build:worker
```

4. Build the worker container but keep it dark. Do not provide production or
   staging credentials yet:

```bash
docker build -f apps/worker/Dockerfile -t sanctuary-background-worker:local .
```

5. Use an immutable `git-<sha>` build label when a staging runtime is eventually
   started. Preserve the worker timing and dark-mode rules in
   `apps/worker/README.md`.

## Phase 5 - Secret Contract

No secret is issued merely because software is installed. Use this inventory;
store values only in the selected vault or machine Keychain.

| Secret or identity | Initial state | Storage | Rotation/revocation owner |
| --- | --- | --- | --- |
| FileVault personal recovery key | Required | Business vault plus offline copy | Primary operator and recovery custodian |
| Backup encryption password | Required | Business vault, separate from backup disk | Primary operator and recovery custodian |
| Overlay enrolment key | One-time only; delete after enrolment | Never persist on node | Overlay admin |
| Overlay device identity | Staging-node tag only | Overlay control plane/device key | Overlay admin |
| SSH admin private key | Required on operator device only | Operator vault or hardware-backed store | Primary operator |
| GitHub credential | None for first milestone | Not applicable | Repository admin |
| Staging Supabase credential | None until PR-AI-008 owns the exact contract | Future machine secret store | Supabase admin |
| OpenClaw gateway token | Generate only at dark install | Machine Keychain/secret store | Node operator |
| Model/provider or connector keys | Prohibited | Not applicable | Capability owner |

Rules:

- Never use a CLI argument, committed `.env`, launchd plist, shell profile, or
  terminal transcript as secret storage.
- Never copy a production service-role key to the node.
- Prefer a narrow node credential when PR-AI-008 defines one. If a staging
  service-role key is temporarily required, treat it as high impact, stage-only,
  separately owned, and immediately revocable.
- Logs and evidence may contain secret names and last-rotation dates, never
  values, hashes that enable guessing, access tokens, or recovery codes.
- Reissue machine credentials after a rebuild; do not restore them blindly from
  backup.

## Phase 6 - Encrypted Backup And Restore Proof

1. Configure the dedicated disk as an encrypted Time Machine destination. Apple
   recommends backup capacity of at least twice the Mac's storage; use at least
   2 TB for this 1 TB node.
2. Store the backup password away from both the Mac and backup disk.
3. Exclude disposable or high-churn data: container/VM disks, `node_modules`,
   build output, OpenClaw sandboxes, temporary task payloads, downloaded customer
   artifacts, and other caches. Canonical configuration belongs in Git.
4. Keep only the minimum local logs needed for incident response. Do not turn
   Time Machine into a permanent archive of task-scoped customer data.
5. Run the first backup, then restore one non-secret configuration sample into a
   temporary directory and compare it with its source.
6. Record backup time, restore sample, and outcome in the private asset register;
   do not record the backup password or device identifier.

References:

- <https://support.apple.com/en-us/104984>
- <https://support.apple.com/guide/mac-help/mh21241/mac>

## Phase 7 - OpenClaw Dark Installation

Do not install OpenClaw until Phases 1-6 pass. At first start:

- bind the Gateway to loopback only;
- require a generated gateway token stored outside configuration files;
- enable no chat channel, public endpoint, connector, plugin, model/provider,
  browser automation, or business tool;
- set sandbox mode to all sessions, Docker or Podman backend, session scope,
  read-only workspace, read-only root, temporary writable filesystems, no
  network, and all Linux capabilities dropped;
- set host exec to deny, ask fallback to deny, auto-allow skills off, elevated
  execution off, and no allowlist entries;
- mount no external host directory;
- keep the runner repository read-only to the sandbox;
- run a deep security audit after every configuration change.

The intended sandbox shape follows the official restricted example:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "all",
        backend: "docker",
        scope: "session",
        workspaceAccess: "ro",
        docker: {
          image: "openclaw-sandbox:bookworm-slim",
          readOnlyRoot: true,
          tmpfs: ["/tmp", "/var/tmp", "/run"],
          network: "none",
          capDrop: ["ALL"]
        }
      }
    }
  },
  tools: {
    exec: {
      mode: "deny"
    }
  }
}
```

Verify without printing the gateway token:

```bash
openclaw security audit --deep
openclaw approvals get
openclaw exec-policy show
```

OpenClaw's host-exec defaults are broader than Sanctuary permits, so an install
is not acceptable until the effective policy proves deny. See:

- <https://docs.openclaw.ai/gateway/security>
- <https://docs.openclaw.ai/gateway/sandboxing>
- <https://docs.openclaw.ai/tools/exec-approvals>

## Phase 8 - Staging Node And Synthetic Proof

This phase waits for PR-AI-008 and a separate staging deployment checkpoint.

1. Identify staging by exact Supabase project ref and separately supply the exact
   production refusal ref.
2. Register one node identity with the minimum declared capabilities.
3. Prove heartbeat, safe health, maintenance/drain, stale detection, and central
   revocation before executing a task.
4. Keep the Sanctuary worker dark until the reviewed synthetic path is selected.
5. Run one fixed, zero-cost, no-network, no-effect synthetic task.
6. Confirm structured result, task/job linkage, usage/evaluation evidence, and no
   customer/project mutation.
7. Disconnect the node and prove Portal/manual workflows remain available.
8. Run `node-rebuild-and-revocation.md` before any production-ledger discussion.

## Routine Operations

Weekly while staging-only:

- check macOS, overlay, container runtime, OpenClaw, and repository update status;
- verify last encrypted backup and restore-test age;
- verify node last-seen and stale/revoked state once PR-AI-008 exists;
- review failed logins, OpenClaw audit findings, sandbox inventory, disk use, and
  secret-rotation dates;
- confirm no unexpected channel, plugin, connector, listening port, production
  credential, or broad host allowlist exists;
- keep worker and OpenClaw execution dark unless a named rehearsal is active.

After every update or restart:

- console-unlock the FileVault volume;
- prove private SSH access;
- prove firewall and sharing posture;
- verify OpenClaw effective deny/sandbox policy before starting it;
- verify health only; do not infer task authority from liveness.

## Definition Of Done

- All checklist items have dated, secret-free evidence in the private asset register.
- FileVault and encrypted backup recovery material is held away from the Mac.
- Only named private administration works; no public port exists.
- Reboot behavior is truthfully documented and physically rehearsed.
- OpenClaw is dark, loopback-only, sandboxed, networkless, and host-exec denied.
- No production or broad connector credential exists on the node.
- Backup sample restore, revocation, rebuild, and node-offline rehearsals pass.
- Hosted Portal and canonical business workflows remain usable with the node off.
