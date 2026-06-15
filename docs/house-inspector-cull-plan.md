# House Form Inspector Cull — Plan (PR-T7)

**Drafted**: 2026-05-29. **Status**: shipped; retained as a retrospective plan.

This plan records the PR-T7 house form inspector cull. The current guardrail is captured in `docs/decision-log.md`; do not treat this file as an active request to execute the cleanup again.

## Read First

- Treat this as shipped history for PR-T7.
- Use the file map and risk notes for archaeology only.
- Current workbench rules live in `docs/design-workbench-architecture.md`, `docs/design-workbench-multi-object-goal.md`, and the PR-T7 decision-log entry.

---

## 1. Goal

Reduce the house inspector from ~40 visible items (6 sections, ~15 dead/derived fields, ~10 diagnostic rows, ~4 prose paragraphs, 1 duplicate heading) to ~15-20 items grouped PRIMARY / DIMENSIONS / ADVANCED — every remaining field provably persists and re-derives.

---

## 2. Architectural fit

### Which north-star invariant or principle does this serve?

`docs/maintainability-principles.md` § "single source of truth" + the codebase-wide "don't expose editable controls for values derived from the model" pattern. The house-connection / attachment-strategy / storey-mode / rotation dropdowns currently advertise as editable but the next solve overwrites the user's choice with the model-derived value — exactly the silent-no-op anti-pattern the principles call out. Pulling them out of the inspector closes the lie.

Also matches `docs/design-workbench-architecture.md` § "Product North Star" decision: the right inspector is the compact editing surface for the selected object; diagnostics belong elsewhere (or nowhere). PR-W12 established this for pergolas; PR-T7 brings the house inspector in line.

### What alternatives were considered, and why rejected?

1. **Keep the dead fields but mark them disabled.** Rejected: still consumes pixels and visual attention. The "looks editable but does nothing" experience is what makes the inspector untrustworthy; disabling it just makes the lie more visible.
2. **Hide diagnostics behind a `?` / `…` overlay.** Rejected: premature factoring. Nobody has asked for the Review Basis diagnostics in months — defer the "where do diagnostics go" decision until someone actually needs them. Cull first, build a home later if needed.
3. **Section-by-section incremental cull (PR-T7a, T7b, …).** Rejected: every dead field shows up in the same snapshot, so verification is one cycle either way. Splitting just adds review overhead.
4. **Fix the underlying derivation bug** (make house-connection actually persist, etc). Rejected: that's a much bigger conversation about whether house-connection SHOULD be a user-editable field (probably no — it's correctly derived from the structure). The cull removes the misleading UI; the data-model question stays open.

### What does this consciously NOT try to do?

- **NOT rebuild any commit handler or geometry-edit intent.** The intent types (`house_connection`, `house_storey_mode`, `house_attachment_strategy`, `drawing_rotation`) stay in `GeometryEditIntent` and their handlers stay in the action layer. Only the UI surfaces them stops. If another consumer ever needs to write them programmatically, the path still works.
- **NOT touch the pergola inspector** (already done in PR-W12) or any other family inspector.
- **NOT add the gumball.** Rotate buttons go away with no replacement in this PR; the user's plan is for gumball-driven rotation in a future PR.
- **NOT change the data model.** Killing the "House connection" dropdown doesn't change whether `connectionKind` is still on the pergola model.
- **NOT touch HouseFormAttachmentContextPanel's underlying call to `SanctuaryWorkbenchRail` `canonical_extras` mode.** That mode is reused elsewhere; we just stop mounting that panel in the house inspector.

### Net tech debt: pay down or add?

**Net pay-down.** Deletes ~15 dead UI elements (with no behavior loss because they're dead). Adds nothing structurally new — the 3-section layout already exists from PR-W12. The `HouseFormOverviewSection.tsx` factory disappears entirely; `HouseFormRoofSections.tsx` shrinks by ~50 lines (Review Basis block); `HouseFormFootprintSections.tsx` shrinks by ~15 lines (rotate buttons + continue-outline conditional); `HouseFormInspector.tsx` restructures. ~150-200 LOC net removed.

---

## 3. The new model

### What the inspector renders after the cull

```
SELECTED OBJECT
House                                            Approximate

PRIMARY
  Roof form                                        Mono ▾
  Roof material                            Corrugated iron ▾
  Roof pitch                                        25 °
  House footprint                              Straight ▾
  Attachment side                                  Rear ▾

DIMENSIONS
  Eave height                                       2.5 m
  Wall height                                       2.5 m
  House width                                          m
  Soffit depth                                       450 mm
  Fascia height                                      180 mm
  Gutter width / depth / projection / Eave overhang  (each its own row)

▶ ADVANCED
  House footprint mode (Preset vs Draw outline)
  Continue outline    (conditional — only when mode === custom_polygon)
  House offset X / Facade setback / Footprint band depth
  Preset-conditional: Return run / Recess width+depth / Leg runs / Side run
  Mono fall direction (mono only)
  Hipped ridge orientation (hipped only)
  Open hip ends toggles (hipped only)
  Appendage band + host edge + pitch + drop (when supported)
```

### What gets removed

| Category | Items | Reason |
|---|---|---|
| **Dead-write / derived dropdowns** | House connection · Attachment strategy · Storey mode · Drawing rotation · Rotate -90 button · Rotate +90 button | Commits don't stick / values derived from model on next solve / will move to gumball |
| **Disabled-display dropdowns** | Gable house-side eave gutter · Gable outer-side eave gutter | Explicit `disabled: true`, no commit handler |
| **Duplicate header info** | "HOUSE FORM INSPECTOR" title · Selected form · Trust · Roof status | Inspector header already shows name + trust chip |
| **Duplicate tree info** | Decks count · Openings count · Pergolas count | Objects tree on the left shows the list |
| **Duplicate editable info** | Footprint (preset name read-only) · Rotation (read-only) · Attachment side (read-only) | Editable fields below show the same value |
| **Solver diagnostics** | Review Basis SummarySection (Roof geometry / Roof form basis / Mono fall basis / Ridge basis / Appendage support / Appendage supported edges) + all approximation-reason hints | Useful for solver debugging, not for editing |
| **Onboarding prose** | "House Forms is the object-workbench source…" · "Roof form inferred from legacy pergola data" · most field hint paragraphs | The user has used the tool for months |
| **Layout bug** | Duplicate "ATTACHMENT CONTEXT" heading | Outer wrapper + embedded rail both emit the title |

---

## 4. PR sequence

Single PR (PR-T7). One coherent cull, no contract changes.

---

## 5. Per-PR file map

| File | Change | LOC delta |
|---|---|---|
| [HouseFormInspector.tsx](../apps/portal/components/drawings/rail/HouseFormInspector.tsx) | Drop `HouseFormOverviewSection` import + call. Drop the outer `<section title="Attachment Context">` wrapper (the embedded rail already renders its own title — that's the duplicate heading). Restructure section composition into PRIMARY / DIMENSIONS / ADVANCED via `RailSection` + a collapsible details element (same pattern as PR-W12). | ~-30 |
| `apps/portal/components/drawings/rail/HouseFormOverviewSection.tsx` | DELETE FILE. Nothing else imports it (single consumer above). | -45 |
| [HouseFormRoofSections.tsx](../apps/portal/components/drawings/rail/HouseFormRoofSections.tsx) | Drop the final `<SummarySection title="Review Basis" …>` push (~30 lines incl. the approximation-reason hint). Drop the `approximationReasons` / `appendageSupportLabel` derivations that feed only that block. | ~-50 |
| [HouseFormFootprintSections.tsx](../apps/portal/components/drawings/rail/HouseFormFootprintSections.tsx) | Drop the Rotate -90 / Rotate +90 ActionButton block and its handler. Make the `<ActionButton label="Continue outline">` conditional on `footprintMode === 'custom_polygon'` (or drop entirely — confirm during impl). | ~-25 |
| HouseFormAttachmentContextPanel.tsx | DELETE FILE OR drop the panel mount from `HouseFormInspector`. The legacy-context fields it surfaces (Eave height / Wall height / Soffit depth / Fascia height / Gutter dims / Eave overhang / Attachment side) move INTO the new PRIMARY+DIMENSIONS+ADVANCED structure. Picking the simpler of the two during impl. | -45 (delete) or -25 (drop mount) |
| SanctuaryWorkbenchRail.tsx | In the `houseFields` useMemo, drop these field definitions: `house-connection`, `house-attachment-strategy`, `house-storey-mode`, `gable-house-eave-gutter`, `gable-outer-eave-gutter`, `drawing-rotation`. (The `commitGeometryEdit` paths for those intent types stay — only the UI field defs go.) | ~-100 |
| SanctuaryWorkbenchRail.test.tsx | Update assertions that reference the removed field labels / aria-labels. Estimated ~5-10 lines touched. | ~-15 |
| Possibly `apps/portal/components/drawings/rail/HouseFormInspector.test.tsx` (if exists) | Update for new structure. | ~-30 |

Total: ~280-340 LOC removed, ~30-50 LOC added (the new section composition). **Net ~-230-290 LOC.**

---

## 6. Risk + mitigation

| Risk | Likelihood | Mitigation |
|---|---|---|
| Deleting `HouseFormAttachmentContextPanel.tsx` breaks an import elsewhere | Low | `grep -r "HouseFormAttachmentContextPanel"` first; only `WorkbenchInspectorHost.tsx` uses it. Update that import to render the fields inline via the embedded rail's `canonical_extras` mode — or just drop the panel and rely on the new PRIMARY/DIMENSIONS/ADVANCED bins to host those fields. |
| Deleting `HouseFormOverviewSection.tsx` breaks tests | Low | Run unit tests; assertions on "House Form Inspector" / "Selected form" / "Decks count" labels will fail and need updating. Mechanical sweep, same shape as PR-W12 test updates. |
| Removing `house-connection` field breaks the `commitGeometryEdit({ type: 'house_connection' })` consumer | Very Low | The intent handler stays in place; only the UI that calls it goes away. If some other surface still calls the intent it'll still work. (We're not removing the underlying capability — only the lying UI.) |
| Removing the gable gutter fields breaks the embedded rail's `gable` section | Low | The `gableFields` useMemo only has 3 fields total: end-frames (works) + the two gutter readouts (no-ops). After removing the gutter readouts the section still renders with the end-frames field. If `gableFields.length === 0` somewhere the section is skipped — that's fine. |
| User reports a NEW dead-field after seeing the snapshot | Med | Expected. Snapshot the result; iterate. The plan structure (visible PRIMARY + collapsed ADVANCED) handles "one more thing to hide" cheaply — just move the field's def into the ADVANCED bin or delete it. |
| Removing rotation buttons breaks workflows that depended on them | Low (user-confirmed removal) | User explicitly directed this removal; gumball is the future path. The shipped PR did not retain a separate rotation-button fallback. |

---

## 7. Acceptance criteria

- `npx tsc -p apps/portal/tsconfig.json --noEmit --incremental false` — clean.
- HARD GATE: `npx vitest run apps/marketing/lib/enquiryBudgets.test.ts apps/marketing/emails/templates/customerEstimateEmail.test.tsx` — 6/6.
- `npx vitest run apps/portal/components/drawings/rail apps/portal/components/drawings/inspector` — green (with the test assertions updated for new structure).
- Snapshot: `npx playwright test playwright/portal.workbench-snapshot.spec.ts --project=portal-fixture` — all pass. **Read `tmp/workbench-mono-house-form.png` and confirm**:
  - No "HOUSE FORM INSPECTOR" title, no Selected form / Trust / Roof status / Decks / Openings / Pergolas rows
  - No House connection / Attachment strategy / Storey mode dropdowns
  - No Rotate buttons
  - No Review Basis block
  - No duplicate "ATTACHMENT CONTEXT" heading
  - Three sections visible (PRIMARY / DIMENSIONS / ADVANCED collapsed)
- Pergola snapshot (`workbench-mono-pergola.png`) — unchanged.
- Marketing email path — unchanged.

---

## 8. Estimates

| PR | LOC delta | Risk | Est time |
|---|---|---|---|
| PR-T7 (house inspector cull) | ~-230 to -290 net | low-med | 60-90 min |

---

## 9. Sequencing diagram

Skipped — single PR.

---

## 10. What I'd push back on

The plan kills the Review Basis SummarySection outright. That's the right call for the inspector — those signals are solver diagnostics, not editing context. **But the information may still have value somewhere** (e.g. a "why is this geometry approximate?" overlay attached to the Approximate chip). I'm not building that surface in PR-T7 — just flagging that if you ever wonder "where did the roof's approximation reason go," it's still derivable from `roofContext.approximationReasons` and `roofProvenance`. Worth a single-line comment in the deleted code so future-me knows the data path still exists.

Also: the plan keeps the `commitGeometryEdit({ type: 'house_connection' | 'house_storey_mode' | 'drawing_rotation' })` intent handlers alive even after the UI is gone. Pure dead code if nothing else calls them. A follow-up cull pass (PR-T7b, optional) can grep callers and delete unreferenced handlers — but it's not load-bearing for the visible cleanup.

---

## 11. Retrospective note

PR-T7 shipped. The house inspector was restructured around PRIMARY / DIMENSIONS / ADVANCED, dead-write fields were removed from the rail, and the duplicate attachment-context heading was resolved.
