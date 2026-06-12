# Design Workbench Multi-Object Goal

Status: Active goal, current-state summary.

## Goal

Make the Design Workbench a dependable multi-object editor: multiple house forms, pergolas, decks, and openings can be created, moved, selected, snapped, rendered, diagnosed, and eventually costed from one object-first project model.

This doc now tracks the product goal, not old migration PR history. Use `docs/design-workbench-architecture.md` for the runtime contract and `docs/design-workbench-legacy-cull.md` for historical Gate 0 audit rows.

## Current State

The workbench has crossed the main breakaway boundary:

- live runtime accepts object-first workbench state only;
- house forms, pergolas, decks, and openings are object-owned;
- calculator state, house-first carriers, raw module wrappers, module-index selection, legacy plan/section models, and workbench costing payloads are forbidden in live workbench roots;
- invalid geometry is withheld as normal committed geometry and surfaced through object-owned diagnostics;
- Plan is the editor and 3D is read/select only.

The largest remaining architecture gap is not another compatibility migration. The workbench now has a `WorkbenchSolvedProjectArtifact` UI boundary, but the solved model still carries temporary loose-field aliases while downstream code is cleaned up. The next milestone is to delete those aliases and move deeper non-shell consumers to artifact fields.

## North-Star Constraints

Every workbench PR under this goal must preserve these constraints:

- No primary house form. Any old `house-main` identity is just an imported id, not a privileged model concept.
- No select-host-first workflows for pergolas or decks. New objects are born freestanding; snap creates relationships.
- Snap references and solved geometry own relationship truth. Inspector labels can describe relationships, but must not replace spatial solving.
- Plan is the only direct-manipulation editor. 3D may select, but must not commit geometry edits.
- Plan, 3D, Sheet, Section, snap, dimensions, and diagnostics derive from the solved geometry spine.
- Invalid objects render diagnostic/reference geometry only.
- Workbench commercial work is downstream of solved geometry/takeoff and must not reintroduce calculator inputs into the runtime.

## Next Milestone: Artifact Alias Retirement

Recommended next implementation slice:

```text
WorkbenchProjectModel
  -> WorkbenchSolvedProjectArtifact
  -> Plan / 3D / Sheet / Section / Snap / Diagnostics consume artifact fields
```

The slice should:

- remove temporary loose-field aliases from `WorkbenchSolvedModel` once all live consumers read `projectArtifact`;
- keep one object-id-keyed project artifact boundary for houses, pergolas, decks, openings, Plan projection, 3D scene, sheet/section views, snap sources, diagnostics, and future takeoff;
- keep the workbench shell and viewport host passing that bundle instead of separate scene/projection/health/reference props;
- keep diagnostic/reference geometry explicit inside the artifact, not as separate fallback props;
- preserve Plan/3D agreement by making both surfaces read from the same object artifact records;
- update tests so multi-object success is asserted by object id and artifact contents, not by legacy shape or selection side effects.

## Done Criteria

The multi-object goal is done when:

- users can add, select, move, and save multiple house forms and pergolas without hidden primary/host assumptions;
- every valid object has committed Plan and 3D geometry keyed by object id;
- every invalid object has a clear first-failing diagnostic and no borrowed committed body;
- Plan and 3D selection identity agree for house forms, pergolas, decks, and openings;
- snap sources are object-owned and can target all valid host objects;
- saved object-first drafts reload without calculator synthesis;
- a future commercial adapter can consume solved geometry/takeoff without changing workbench runtime geometry.

## Non-Goals

Do not expand this goal to include:

- a marketing self-design shell;
- Rhino/Vray export;
- a workbench pricing rollout;
- new pergola roof families;
- UI redesign unrelated to multi-object correctness;
- manual host-picking dropdowns as a substitute for snap.

## Verification Expectations

Each PR should run focused tests for the changed path plus the runtime boundary guard:

```bash
npx vitest run apps/portal/lib/workbenchBreakawayImportGuards.test.ts
npm run test:portal:workbench
npm run test:portal:browser
```

Manual or Playwright checks should include:

- a blank object-first workbench;
- multiple house forms;
- multiple pergolas;
- an invalid object with diagnostics;
- Plan/3D mode switching for the same project state.

## Gate 0 Mapping

Expected historical rows for this goal:

- N2: primary-vs-additional house form assumptions.
- N4 and architecture audit #9: object-owned house geometry instead of wrapping houses into old raw module context.
- N7/N13: unsupported calculator snapshot/draft carriers.
- N9/N10: per-object/project scene composition instead of host-only scene branches.
- N11: snap targets for all relevant objects.

PRs under this goal should state whether they remove legacy, build on legacy, or defer a commercial/takeoff dependency.
