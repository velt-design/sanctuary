# Sanctuary AI Operations

Status: Mac baseline and the repository contracts for isolated lanes, durable
supervision, exact-head CI and independent review are implemented. The exact
isolated-gateway kill switch is implemented; the supervisor credential plus
live restart, safety and end-to-end promotion rehearsals remain.

Owner: Jordan / Sanctuary Pergolas

These documents are the operating procedures for the first Sanctuary private
node. They prepare a staging-only, synthetic, no-effect deployment. They do not
prove that the Mac mini, private network, OpenClaw, or worker has been installed.

## Read First

1. `../00-vision.md`: accepted capability and autonomy boundary.
2. `../09-decisions/AI-ADR-002-hosted-business-control-state.md`: hosted systems remain canonical.
3. `../09-decisions/AI-ADR-003-mac-mini-private-node.md`: private-node role and recovery requirement.
4. `mac-mini-runbook.md`: day-zero baseline, access, networking, secrets, backup, and routine operations.
5. `machine-credential-ceremony.md`: least-privilege 1Password and GitHub machine identities.
6. `openclaw-dark-install.md`: pinned, deny-all OpenClaw installation checkpoint.
7. `openclaw-engineering-runtime.md`: isolated no-prompt supervisor, worker and reviewer runtime.
8. `openclaw-engineering-lanes.md`: manifest-bound branch/worktree, draft-PR and safe cleanup contract.
9. `openclaw-engineering-supervision.md`: managed task queue, dependency gates, revision checkpoints, bounded retries and restart recovery.
10. `openclaw-engineering-ci-review.md`: stable CI routing, exact-head failure handling, independent review and hosted `main` protection.
11. `autonomous-engineering.md`: Engineering Lead/Codex worker roles, strict task, completion and review contracts, PR stack, and promotion rehearsals.
12. `node-rebuild-and-revocation.md`: planned rebuild, compromise rebuild, central revocation, and recovery proof.
13. `ai-incident-response.md`: triage, containment, evidence, recovery, and notification protocol.

## Current Deployment Boundary

- Target: existing staging Supabase only.
- Workload: repository development, tests, feature branches, and draft pull requests.
- OpenClaw: Codex-backed coding mode with deliberate no-prompt execution under
  the dedicated non-admin account.
- Production: no credential, migration, worker activation, customer data, communication, or business mutation.
- Canonical state: hosted Portal, Supabase/Postgres, GitHub, and governed document storage.
- Local state: replaceable configuration, disposable workspaces, bounded caches, and operational logs.

## External Decisions Still Owned By The Operator

The repository can define acceptance criteria but cannot create or choose these
accounts or physical controls without the owner:

| Decision            | Recommended starting point                                                                          | Required before                                        |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Private overlay     | Tailscale with a tagged staging-node identity and least-privilege policy                            | Remote administration                                  |
| Container backend   | Maintained Docker- or Podman-compatible macOS runtime; confirm licensing and support                | OpenClaw sandbox verification                          |
| Secret vault        | Business-owned password/secret manager plus macOS Keychain for machine-local use                    | Issuing any non-disposable service credential          |
| Recovery custody    | Jordan, with the FileVault recovery key stored away from the Mac                                    | Enabling FileVault                                     |
| UPS and backup disk | Optional resilience upgrade when the node begins keeping unique local state or production workloads | Production promotion or a restore-based recovery claim |

Record the selected products and owners in the private asset register. Do not
commit serial numbers, recovery keys, device IDs, auth keys, internal addresses,
account recovery codes, or secret-manager item links to this repository.

## Promotion Rule

Complete and evidence each checkpoint independently:

1. host baseline;
2. private administration;
3. dark OpenClaw security controls;
4. staging node registration and stale/revocation behavior;
5. one deterministic development task;
6. node-offline and rebuild-from-Git rehearsal.

The initial development node is intentionally rebuildable rather than
restore-dependent: source and configuration live in GitHub, secrets remain in
1Password or are reissued, and local workspaces are disposable. An encrypted
Time Machine backup and UPS are recommended later, but they do not block
repository work, tests, branches, or draft pull requests. They become required
before the node is allowed to own unique local business state or claim
restore-based production recovery.

Failure at any checkpoint returns the node to dark state. Success never grants a
production effect or expands another capability.
