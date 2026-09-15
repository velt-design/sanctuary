# AI Evaluation Harness

This directory holds repository-owned, reviewable AI evaluation cases.

The initial `synthetic` suite proves the evaluation runner, variable binding,
and deterministic assertions only. It does not claim model quality or authorize
provider, customer-data, production, or OpenClaw access.

Run it with:

```bash
npm run test:ai:evals
```

The runner uses Promptfoo 0.122.1 from an immutable official container digest,
disables networking, telemetry, sharing, update checks, and caching, and mounts
the repository read-only. New suites must remain synthetic until their owner
doc records the approved provider, data class, expected outputs, cost boundary,
and promotion evidence.
