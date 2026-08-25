# Private Node Rebuild And Revocation

Status: Active protocol; first rehearsal pending.

Owner: Jordan / Sanctuary Pergolas

Use this procedure for planned rebuilds, credential revocation, lost hardware,
or suspected compromise of the Mac mini. A wiped disk is not revocation: remove
authority from the hosted control planes first.

## How To Use This Runbook

Choose the path below, revoke hosted authority before local erasure, then use
the matching procedure and acceptance checklist. For suspected compromise,
start `ai-incident-response.md` before rebuilding.

## Choose The Path

| Trigger | Path | First action |
| --- | --- | --- |
| Planned OS or hardware maintenance | Planned rebuild | Drain work; use a backup if configured, otherwise rebuild from hosted sources. |
| Lost, stolen, or suspected-compromised Mac | Compromise rebuild | Isolate and revoke centrally before attempting recovery. |
| One exposed or retired credential | Credential-only revocation | Revoke that credential and inspect its access history. |
| Failed synthetic workload with no exposure | Normal repair | Keep execution dark, diagnose, then repeat the synthetic proof. |

If the scope is uncertain, use the compromise path and
`ai-incident-response.md`.

## Central Revocation Order

Perform only the controls that exist, but do not skip an applicable control.
Record UTC timestamps and non-secret evidence in the private incident record.

1. Disable task producers and the Sanctuary worker kill switch. Keep OpenClaw
   dark and stop its Gateway if it is running.
2. Revoke the node in the hosted node registry once PR-AI-008 provides that
   control. Revocation must prevent a later heartbeat from silently restoring
   authority.
3. Remove or disable the overlay device and revoke unused enrolment/auth keys.
4. Revoke any GitHub machine token or deploy key. The initial milestone should
   have none.
5. Rotate the staging Supabase node credential if it existed or could have been
   read. Never change production credentials as part of a staging rehearsal.
6. Revoke the OpenClaw gateway token and every enabled channel, connector,
   plugin, or provider credential. The initial milestone should have no such
   integrations.
7. Remove the node's SSH public key from every authorised account and host.
8. Preserve bounded audit metadata before deleting the hosted device or node
   record. Do not preserve tokens, private payloads, or recovery keys.

Removing a local file, erasing the Mac, deleting a checkout, or powering the
device off does not complete these steps.

## Planned Rebuild

1. Name the operator, maintenance window, exact staging boundary, and rollback
   point.
2. Stop producers, drain any claimed synthetic task, and verify the worker and
   OpenClaw are dark.
3. Record safe versions and configuration references: macOS, Git SHA, Node,
   container runtime, OpenClaw, overlay client, and applicable policy version.
4. If encrypted backup is configured, verify it and restore one non-secret
   sample. Otherwise confirm that the intended Git SHA is hosted and all machine
   credentials can be reissued before wiping the node.
5. Revoke the old machine identities using the central order above. Treat the
   rebuilt Mac as a new node, even when the hardware is unchanged.
6. Erase and install a current supported macOS release through Apple's supported
   recovery path.
7. Repeat `mac-mini-runbook.md` from the account baseline: separate admin and
   runner accounts, FileVault, updates, firewall, private network, SSH, runtime,
   the selected recovery mode, and OpenClaw controls.
8. Clone a clean repository copy over HTTPS and build from a reviewed Git SHA.
   Do not restore a working tree, container disk, sandbox, shell profile, or
   machine secret from the old installation.
9. Issue fresh machine credentials from each control plane. Do not reuse the old
   overlay identity, SSH key, node credential, or OpenClaw token.
10. Register a new hosted node identity once PR-AI-008 exists, then verify the
    old identity remains revoked and cannot heartbeat.
11. Run repository gates, OpenClaw deep audit, heartbeat/health checks, the fixed
    effect-free synthetic task, and the node-offline proof.
12. Return the node to dark state. Promotion requires the named owner to review
    the evidence; rebuild completion does not grant production authority.

## Compromise Rebuild

1. Follow `ai-incident-response.md`. If safe, disconnect the network or disable
   the overlay device. Do not use the suspected Mac to rotate credentials.
2. Complete central revocation from a separate trusted operator device.
3. Preserve only the evidence needed to determine affected identities, time
   range, task/job/node IDs, and possible effects. Do not browse private business
   data merely to collect more evidence.
4. Review hosted audit trails for the overlay, Supabase staging project, GitHub,
   OpenClaw, and any unexpectedly present provider. Expand revocation when those
   records show broader access.
5. Erase and reinstall the Mac. Do not restore a whole-system Time Machine image,
   old Keychain, OpenClaw state, container/VM disk, sandbox, or SSH configuration.
6. Restore source and configuration only from reviewed Git and other canonical
   hosted systems. Restore business records from their canonical service, never
   from an unverified local cache.
7. Issue all new credentials and register a new node identity. Keep the old
   device and node records revoked for audit retention.
8. Repeat every clean-build, security, synthetic, offline, and recovery check in
   the planned path. Resolve the incident root cause before promotion.

## Credential-Only Revocation

1. Identify the exact credential, owner, granted capability, storage locations,
   and last known use without displaying its value.
2. Disable or revoke it in its issuing control plane.
3. Confirm an attempted use fails safely and does not create or resume work.
4. Search canonical audit metadata for unexpected use during the exposure
   window. Escalate to the compromise path if the result is uncertain.
5. Remove the old value from approved storage, issue a narrower replacement only
   if required, and record the new rotation date.
6. Re-run the relevant health and synthetic checks, then return execution dark.

## Acceptance Evidence

- [ ] Producers, worker, and OpenClaw were dark before the rehearsal.
- [ ] Applicable hosted identities were revoked before local erasure.
- [ ] The old node cannot heartbeat, claim a task, or recover authority.
- [ ] The old overlay identity and SSH path no longer work.
- [ ] The selected recovery proof passed: either a backup sample restore or a
      clean rebuild from the hosted Git SHA with fresh machine credentials.
- [ ] The rebuild used reviewed source and fresh identities.
- [ ] FileVault, firewall, private access, the selected recovery mode, and the
      applicable OpenClaw policy passed.
- [ ] One fixed synthetic task passed with no customer, project, communication,
      payment, production, or external-network effect.
- [ ] Disconnecting the node left the hosted Portal and manual workflow usable.
- [ ] Evidence contains UTC times and safe identifiers, but no secrets or private
      task payloads.

Any failed item leaves the node revoked and dark.
