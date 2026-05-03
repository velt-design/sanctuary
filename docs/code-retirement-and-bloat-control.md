# Code Retirement And Bloat Control

Status: Active guardrail.

Purpose: make stale code, unused exports, unused dependencies, and legacy compatibility debt visible without encouraging unsafe deletion.

## Operating Rule

Old code should either be useful, deleted, migrated, or registered with a retirement direction.

Do not delete code only because a static tool reports it. Prove the removal with:

- `npm run dead-code:report` or `npm run dead-code:changed`.
- targeted `rg` searches for dynamic, route, config, public API, script, and docs references.
- the owner doc from `docs/change-routing.md`.
- focused tests, typecheck, and builds that cover the owner surface.

Keep deletion PRs small. A good retirement change removes one cohesive surface, updates references and docs, and has an obvious rollback.

## What The Report Means

`npm run dead-code:report` runs Knip and prints an advisory repo-specific summary of unused files, exports, types, dependencies, unlisted dependencies, and duplicate dependency declarations.

`npm run dead-code:changed` narrows the same report to files touched in the local dirty worktree, or to PR base/head comparison when `ARCHITECTURE_CHANGED_BASE` and `ARCHITECTURE_CHANGED_HEAD` are set.

`npm run architecture:changed` includes `dead-code:changed` for routine non-trivial handoffs, after worktree ownership and before the other architecture changed-file reports. Use the focused `dead-code:changed` command directly for deletion, dependency, or cleanup work that needs the dedicated Knip summary.

Classifications:

| Classification | Meaning | Default Action |
| --- | --- | --- |
| `delete-candidate` | No registry coverage and likely removable after proof. | Prove unused, then delete or wire into the owner. |
| `legacy-retirement` | Known transitional surface with a documented retirement direction. | Migrate or delete one owner slice at a time. |
| `intentional-entrypoint` | Framework, package, script, or test entrypoint that static imports may not reveal. | Do not delete casually. |
| `needs-proof` | Dynamic, generated, public, workspace, or otherwise ambiguous use. | Search and test before deciding. |

The report is advisory and is not part of `npm run lint`.

## Registry

The machine-readable registry lives in `scripts/dead-code-registry.json`.

Use the registry when a finding is intentionally retained or deferred. Each entry must name the owner area, path patterns, reason, retirement action, and proof command. Do not add registry coverage to hide bloat; add it only when a path is a real entrypoint, dynamically referenced surface, generated artifact, or known legacy retirement lane.

Retire registry entries when the old surface is deleted or the dynamic entrypoint becomes statically obvious.

## Deletion Checklist

Before deleting code:

1. Confirm the finding appears in `npm run dead-code:report` or `npm run dead-code:changed`.
2. Search for references with `rg`, including string references, docs, scripts, workflows, route paths, and config.
3. Check the owner doc and `docs/decision-log.md` for compatibility or release constraints.
4. Remove the smallest cohesive slice.
5. Update docs, registries, package manifests, or routing references that mentioned the deleted surface.
6. Run the focused owner tests plus `npm run typecheck`.

Do not delete active guardrail docs, ordered migrations, public package exports, route entrypoints, Playwright setup files, generated assets, or compatibility fallbacks unless their owner docs and focused gates prove the retirement is safe.

## Enforcement Direction

Start advisory:

1. Run `npm run architecture:changed` for routine non-trivial handoffs so dead-code pressure appears with the other architecture guardrails.
2. Run `npm run dead-code:report` during cleanup and readiness work.
3. Run `npm run dead-code:changed` directly for deletion, dependency, or cleanup work.
4. Let Portal Quality publish PR-aware advisory output.
5. After the registry is calibrated, add strict mode only for newly added unused files or exports.
6. Use small cleanup PRs to delete proven candidates and retire registry entries.
