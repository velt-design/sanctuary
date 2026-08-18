# AI-ADR-004: Separate Heavy Compute From Orchestration

Status: Accepted

Date: 2026-08-18

Owners: Jordan / Sanctuary Pergolas

## Context

GPU and large-model workloads have different uptime, power, maintenance, and scheduling characteristics from connectors and coordination.

## Decision

The Mac mini owns persistent lightweight orchestration. The NVIDIA workstation owns bounded GPU and media work. Future local inference capacity must register as a separate capability.

## Consequences

Compute nodes may restart or drain without taking orchestration or canonical state down.

## Security and data impact

Artifact transfer is task-scoped, integrity-checked, and short-lived. A compute node receives no standing broad data access.

## Alternatives considered

Running every workload on every machine was rejected because it obscures ownership and expands the attack surface.

## Evidence and evaluation

Node capability matching and unavailable-node behavior must be tested before real workloads.

## Revisit conditions

Revisit if measured workloads remain too small for separation to justify its operational cost.

## Related docs, code, tests and incidents

- `../sanctuary-ai-master-plan.md`
