# House Roof Stability Plan (PR-HR sequence)

**Drafted**: 2026-06-17. **Status**: planning. Umbrella plan covering five PRs (PR-HR1 → PR-HR5) that move the design workbench's house-roof system from "works when you stay on the happy path" to "works on every realistic shape, and self-documents when it doesn't."

## 1. Goal

Make every L/T/U/cross/recess orthogonal house footprint with any combination of open-hip-as-gable settings either (a) render correctly, or (b) fail in a way that a designer can keep working around AND that automatically becomes a permanent regression fixture — with zero engineer involvement at capture time.

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

[`docs/design-workbench-architecture.md`](design-workbench-architecture.md) "Product North Star" — *"Invalid geometry renders diagnostic/reference geometry only. It must not borrow another object's committed body."* PR-HR3 makes the diagnostic render usable instead of skeletal. PR-HR1/HR2 honor the same principle from the failure-reporting side: the diagnostic info exists in the model already, but the UI isn't surfacing enough of it for a non-engineer to act on. PR-HR4/HR5 close the existing partial-open joined-topology hole that [`packages/geometry/src/house/partialOpenJoinedTopology.test.ts`](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts) already documents (16 of 18 cases pass; 2 quarantined via `it.fails`).

### What alternatives were considered, and why rejected?

1. **Just fix the 2 quarantined Y-ridge cases and ship.** Rejected. It would fix Graham–Oratia, but the next customer-shape that exercises a different numerical edge case would feel like a brand-new bug, because the designer has no way to report it actionably. The instrumentation is the lasting value — the specific fix is one-off.
2. **Increase tolerance/relax QA so more shapes "pass."** Rejected as anti-pattern — it violates the north star ("invalid geometry renders diagnostic only") by hiding bad geometry behind generous tolerances. The current strictness is correct; the UX around failures is the gap.
3. **Make the captured-repro workflow ([`docs/workbench-captured-repro-workflow.md`](workbench-captured-repro-workflow.md)) the only path.** Already exists, but requires `PORTAL_PAGE_DEBUG_EXPORTS=1` env flags, a dev server, and JSON pasting by an engineer. Designers will not (and should not) run dev servers. PR-HR1 puts a designer-usable wrapper on the same underlying capture infra.
4. **Skip property-based generation; just rely on customer reports.** Rejected — combinatorial coverage of orthogonal footprints × open-hip configs is finite and cheap to generate. Doing it as a CI job means we find the next "2 of 18" before a designer hits it.
5. **Rebuild the wavefront solver from scratch.** Rejected as scope explosion. The current solver works on 16/18 cases; the remaining 2 are numerically fragile *specific edge cases* (Y-ridge convergence near adjacent reflex corners). Targeted fix in PR-HR5 beats a rewrite.

### What does this consciously NOT try to do?

- **NOT introduce non-orthogonal house footprints.** Custom angles are out of scope for this plan; orthogonal coverage must be bulletproof first.
- **NOT change the QA failure codes or their semantics.** [`packages/geometry/src/house/roofQa.ts`](../packages/geometry/src/house/roofQa.ts) stays as-is. PR-HR2 only changes how codes are *presented*.
- **NOT introduce a "force-render" override that bypasses QA.** Violates the north star.
- **NOT alter the `RawHouseInput` / `WorkbenchSolvedGeometryArtifact` contract.** The seam between workbench and `@sp/geometry` is load-bearing — adding diagnostic fields is fine, removing or repurposing is not.
- **NOT block the 2 quarantined `it.fails` cases on PR-HR1-4 landing.** PR-HR5 is independent and can ship out of order if it converges quickly.
- **NOT add user-facing roof type-switching beyond what exists today.** The hipped/gabled/open-end controls in the current rail are the supported set.

### Net tech debt: pay down or add?

Net pay-down. Two specific debts retired: the captured-repro workflow's dev-only ergonomics (HR1), and the UI's silent code truncation (HR2). One new piece of infra added (HR4's property-based matrix) but it's pure additive coverage, not new contract surface. HR3 simplifies the rail's roof-display logic (one render path, not "skeleton-or-real"). HR5 deletes two `it.fails` quarantines.

## 3. The new model

### Designer-facing failure capture (PR-HR1)

When a house's roof fails QA, a banner in the right rail shows the **full** validation code + a "Report this shape" button. Clicking it:
1. Builds a redacted JSON payload using the existing [`apps/portal/lib/debug/portalPageDebugExport.ts`](../apps/portal/lib/debug/portalPageDebugExport.ts) infrastructure (the same payload spec the engineer workflow uses).
2. Strips customer-identifying fields (project name, contact, site address) — keeps only geometry.
3. Either (a) downloads as a `.json` file the designer can email/Slack, OR (b) POSTs to a `/api/workbench/roof-failure-report` endpoint that writes it to a Supabase table for later harvest. (Choose one at execution time; (a) is simpler, (b) is more useful long-term.)

```ts
// New: apps/portal/lib/drawings/exportRoofFailureRepro.ts
export type RoofFailureRepro = {
  capturedAt: string;
  validationCode: string;
  validationStatus: 'invalid' | 'approximate';
  approximationReasons: string[];
  footprintLocal: Polygon3;           // CCW, local frame
  roofIntent: { form: HouseRoofForm; pitchDeg: number; openTerminalEndIds: string[] };
  stageDiagnostics: HouseRoofStageDiagnostics; // already in the model
};
```

The shape file dropped into `packages/geometry/src/house/__fixtures__/captured/` (NEW dir) is the same JSON the engineer would have hand-built — but it was machine-built from a real designer session.

### Fail-soft render (PR-HR3)

Today: QA-invalid roof → 3D shows roof-rafter framing only (skeletal), Plan shows just the footprint outline. Designer can't tell what the system tried to render.

After PR-HR3: QA-invalid roof renders the *best-effort* roof solid (whatever the wavefront produced before QA rejected it) with a translucent red-orange overlay AND a "Diagnostic only — not committed" badge. The visual signal "this is wrong" is loud; the geometry signal "here's what the solver attempted" is preserved. Designer can keep iterating on adjacent objects without the broken roof blocking their view.

### Property-based fixture matrix (PR-HR4)

```ts
// New: packages/geometry/src/house/__tests__/orthogonalRoofCoverage.matrix.test.ts
const FOOTPRINTS = ['rect', 'L', 'T', 'U', 'cross', 'recess', 'staircase', 'plus'] as const;
const FORMS = ['fully_hipped', 'fully_gabled', 'every_corner_open_as_gable', 'every_pair_combo'] as const;

for (const fp of FOOTPRINTS) {
  for (const form of FORMS) {
    // Enumerate each terminal-end combination for the footprint.
    for (const terminalConfig of enumerateTerminalEndConfigs(fp, form)) {
      it(`roof QA passes for ${fp}/${form}/${terminalConfig.label}`, () => {
        const input = buildSyntheticHouseInput(fp, form, terminalConfig);
        const model = buildHouseModel3D(input);
        expect(model.roof.qaStatus).toBe('valid');
      });
    }
  }
}
```

Cases that fail are logged as `it.fails` quarantine entries — same pattern [`partialOpenJoinedTopology.test.ts`](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts) already uses. When the matrix runs in CI and a previously-failing case turns green, the test goes red ("expected to fail but passed"), forcing the dev to convert it to a plain `it()` — automatic regression coverage.

## 4. PR sequence

### PR-HR1 — Designer-facing failure capture (~250 LOC)

The bridge from "designer hits a bug" to "permanent regression fixture." Without this, every other PR in this plan is partial — failures still rely on engineer dev-server sessions to harvest.

**Touches**: `apps/portal/lib/drawings/exportRoofFailureRepro.ts` (NEW), [`apps/portal/components/drawings/rail/HouseFormInspector.tsx`](../apps/portal/components/drawings/rail/HouseFormInspector.tsx) (add button next to the "Remove this house" button), `apps/portal/app/api/workbench/roof-failure-report/route.ts` (NEW, optional — only if we go server-persisted instead of file download), `packages/geometry/src/house/__fixtures__/captured/` (NEW dir + README).

**Verification**: Vitest unit tests on `exportRoofFailureRepro.ts` (PII redaction, JSON round-trip). Manual: trigger Graham–Oratia shape on local dev, click button, verify download matches captured-repro JSON spec from [`docs/workbench-captured-repro-workflow.md`](workbench-captured-repro-workflow.md). Marketing build HARD GATE.

### PR-HR2 — Full validation code + copy-diagnostics in rail (~80 LOC)

The smallest PR; the highest immediate-relief-per-LOC. Designers currently see "eave_…" with no context.

**Touches**: [`apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts`](../apps/portal/lib/drawings/state/objectWorkbenchStatusModel.ts) (stop truncating `validationCode`), [`apps/portal/components/drawings/rail/HouseFormInspector.tsx`](../apps/portal/components/drawings/rail/HouseFormInspector.tsx) (full code + tooltip on hover; "Copy diagnostics" button → clipboard with the same payload PR-HR1 builds), small CSS adjustments.

**Verification**: snapshot test on the inspector rail with a failing house fixture. Manual workbench check on Graham–Oratia.

### PR-HR3 — Fail-soft render (~300 LOC)

Make the diagnostic render usable instead of skeletal. Independent of HR1/HR2; can ship in parallel.

**Touches**: [`packages/geometry/src/house/roofPrimary.ts`](../packages/geometry/src/house/roofPrimary.ts) (expose pre-QA solver output as `diagnosticBody` when QA fails), [`packages/geometry/src/houseRoofDiagnostics.ts`](../packages/geometry/src/houseRoofDiagnostics.ts) (carry diagnosticBody alongside stage diagnostics), [`apps/portal/components/drawings/viewports/Geometry3DViewport/`](../apps/portal/components/drawings/viewports/Geometry3DViewport/) (render diagnosticBody with red-orange translucent material), [`apps/portal/components/drawings/viewports/PlanViewport/`](../apps/portal/components/drawings/viewports/PlanViewport/) (matching plan overlay). Same fixture spec test from PR-HR1's captured/ dir as visual snapshot anchor.

**Verification**: visual snapshot via [`docs/workbench-visual-snapshot-loop.md`](workbench-visual-snapshot-loop.md). Geometry tests assert `diagnosticBody` is present iff `qaStatus === 'invalid'`. Architectural test (import guard) ensures viewports read diagnosticBody from the solved artifact, not from a separate channel.

### PR-HR4 — Property-based orthogonal matrix (~200 LOC test + small infra)

The moat. Every shape × every gable config × every terminal config gets exercised in CI, indefinitely.

**Touches**: `packages/geometry/src/house/__tests__/orthogonalRoofCoverage.matrix.test.ts` (NEW), `packages/geometry/src/house/testHelpers/` (NEW dir with `enumerateTerminalEndConfigs`, `buildSyntheticHouseInput`).

**Verification**: CI gate that the matrix runs and reports quarantine deltas. Expected initial baseline: ~16+N passing, ~2+M `it.fails` quarantined (we'll know exact numbers when generated). PR-HR5 then burns the quarantine down.

### PR-HR5 — Burn down 2 quarantined Y-ridge cases (~150 LOC geometry)

Independent; can ship before HR1-4 land if convergence is quick.

**Touches**: [`packages/geometry/src/house/roofJoinedWavefront.ts`](../packages/geometry/src/house/roofJoinedWavefront.ts) (numerical stability around adjacent reflex corners on Y-ridge), [`packages/geometry/src/house/roofJoinedFacets.ts`](../packages/geometry/src/house/roofJoinedFacets.ts) (area-mismatch tolerance for interior notch openings), [`packages/geometry/src/house/partialOpenJoinedTopology.test.ts`](../packages/geometry/src/house/partialOpenJoinedTopology.test.ts) (convert two `it.fails` → `it`).

**Verification**: `partialOpenJoinedTopology.test.ts` shows 18 of 18 cases green (or N+2 of N if HR4 has expanded the matrix). HR4's matrix re-run picks up any newly-passing cases.

## 5. Per-PR file map (summary)

| PR | Files touched | LOC est | Owner | Risk |
|---|---|---|---|---|
| PR-HR1 | 4 new + 1 modified inspector | ~250 | Portal + geometry | Low |
| PR-HR2 | 2 modified | ~80 | Portal | Very low |
| PR-HR3 | 2 geometry + 2 viewport dirs | ~300 | Geometry + Portal | Med |
| PR-HR4 | 1 new test + 1 helpers dir | ~200 | Geometry tests | Low |
| PR-HR5 | 2 geometry + 1 test | ~150 | Geometry | Med |

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| PR-HR3's diagnostic body trips the import guard (`workbenchBreakawayImportGuards.test.ts`) by leaking solver internals to viewports. | Med | Pass diagnosticBody through `WorkbenchSolvedGeometryArtifact` (the canonical seam), not a side channel. Update import-guard test to assert the new field IS allowed and other internals still aren't. |
| PR-HR4's matrix runtime is too slow for CI (~thousands of cases × geometry solve cost). | Med | Run in a dedicated CI job parallel to main vitest; per-case solve is ~ms. Worst-case: tag matrix as nightly + run a 50-case sample on every PR. |
| PR-HR1 server-persisted endpoint leaks PII because redaction misses a field. | Low | Default to file-download mode (a). Server mode (b) is a follow-up only after PII-redaction unit tests cover every field in `WorkbenchProjectModel`. |
| Designer reports a fixture that, when added, surfaces an additional QA failure not previously visible (because matrix coverage was incomplete). | Low (good outcome) | This is the workflow working. Add it to the captured/ dir, file a follow-up PR-HR5b. |
| PR-HR5's fix for one Y-ridge case regresses a previously-passing case in `partialOpenJoinedTopology.test.ts`. | Med | The full 18-case suite (and PR-HR4's matrix) gates the fix. No `it.fails` flip without matrix re-run. |
| Captured fixtures dir grows unbounded over years. | Very Low | Trivial. ~kB per fixture. If it ever becomes a problem, archive resolved ones into a separate `__fixtures__/resolved/` tree. |

## 7. Acceptance criteria

- All 5 PRs: `pnpm -w turbo run typecheck` clean, vitest green, lint clean, `apps/marketing/` build HARD GATE clean.
- PR-HR1: Graham–Oratia shape can be exported via the button on local dev. The downloaded JSON matches `RoofFailureRepro` schema. PII fields redacted.
- PR-HR2: Workbench rail shows full validation code, not truncated. Tooltip with stage + reason. "Copy diagnostics" button works.
- PR-HR3: Visual snapshot shows red-orange diagnostic body for Graham–Oratia (or fixture-equivalent), not blank/skeletal. Geometry test asserts diagnosticBody presence iff invalid.
- PR-HR4: Matrix test runs in CI. Baseline result documented. Quarantine count tracked in [`docs/decision-log.md`](decision-log.md).
- PR-HR5: 18 of 18 `partialOpenJoinedTopology.test.ts` cases green. Graham–Oratia shape passes QA (or HR3's fail-soft render kicks in cleanly).
- North-star compliance ([`apps/portal/lib/workbenchBreakawayImportGuards.test.ts`](../apps/portal/lib/workbenchBreakawayImportGuards.test.ts)) green.
- Docs-guard clean.

## 8. Estimates

| PR | LOC | Risk | Est time |
|---|---|---|---|
| PR-HR2 (start here — smallest, most relief) | ~80 | Very low | 30-60 min |
| PR-HR1 | ~250 | Low | 3-5 hours |
| PR-HR3 | ~300 | Med | 4-6 hours |
| PR-HR4 | ~200 | Low | 2-3 hours |
| PR-HR5 | ~150 | Med (geometry numerical) | 3-8 hours (depends on convergence) |

Total: **2-3 focused days of work** for the full sequence. PR-HR2 alone is 30-60 min of immediate UX win.

## 9. Sequencing

```text
PR-HR2 ──┬──→ PR-HR1 ──┬──→ PR-HR3 ──┐
         │              │             │
         └─→ PR-HR4 ────┴─→ PR-HR5 ───┴──→ designer-usable, self-healing
```

PR-HR2 first (smallest, unblocks everything via better diagnostics). PR-HR1 and PR-HR4 are independent — can run in parallel. PR-HR3 wants HR1/HR2's diagnostic plumbing in place. PR-HR5 can ship any time; benefits from HR4's matrix as a safety net.

## 10. What I'd push back on

The user's framing ("how do we make this much more stable and solid") implied a single big rewrite. The actual answer is **smaller**: the geometry pipeline is mostly solid — the gap is the loop from designer-hits-bug → engineer-gets-actionable-fixture. Five small PRs close it more thoroughly than one big rewrite would, and each one ships independent value.

I'd also push back on the temptation to prioritize PR-HR5 first ("just fix the Graham–Oratia shape"). The instrumentation (HR1+HR2) is higher-leverage long-term — without it, the *next* shape that breaks feels like a brand new bug.

## 11. CTA

Recommended start: ship PR-HR2 today (~30-60 min, immediate UX win, near-zero risk). Then PR-HR1 + PR-HR4 in parallel. Then HR3 and HR5.

Say **"go HR2"** to start with the smallest one, **"go HR sequence"** to commit to the whole plan in order, or **"flip — HR5 first"** if you want the Graham–Oratia shape itself fixed before the instrumentation lands.
