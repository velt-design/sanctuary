# AI-ADR-003: Mac Mini Is The Private Always-On Execution Node

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

Persistent connectors and orchestration need a reliable, low-power host separated from a daily-use workstation.

## Decision

The Mac mini M4 Pro is the private always-on execution, connector, and orchestration node. It is not the canonical control plane.

## Consequences

The host must be encrypted, privately administered, rebuildable, monitored, and free of personal daily-use identity. Services start dark and synthetic.

## Security and data impact

No public inbound ports, broad credentials, unrestricted browser profile, or unique business records are permitted.

## Alternatives considered

Using Jordan's laptop or a public VPS for all private connectors was rejected for availability or trust-boundary reasons.

## Evidence and evaluation

Reboot, disconnect, revocation, kill-switch, and rebuild rehearsals are required.

## Revisit conditions

Revisit if hosted private workers become clearly safer and simpler or the node proves unnecessary.

## Related docs, code, tests and incidents

- `../00-vision.md`
- `../sanctuary-ai-master-plan.md`
