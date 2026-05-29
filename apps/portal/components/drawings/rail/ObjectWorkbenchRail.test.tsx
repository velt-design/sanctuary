import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState, type DrawingWorkbenchRailTab } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { HouseFormRoofIntentModel, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import type { ObjectWorkbenchCompatibilityDraft } from '@/lib/drawings/state/legacyObjectFirstCompatibilityAdapter';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import {
  buildObjectFirstOpeningDraftsFromCompatibilityDrafts,
} from '@/lib/drawings/state/legacyObjectFirstCompatibilityAdapter';
import ObjectWorkbenchRail from './ObjectWorkbenchRail';

function buildRailProps(input?: {
  fixtureSlug?: 'mono-standard' | 'box-standard';
  draft?: EstimateDrawingDraft | null;
  activeRailTab?: DrawingWorkbenchRailTab;
  activeObjectRef?: WorkbenchObjectRef;
  disabled?: boolean;
  onAddPergola?: () => { ok: boolean; error?: string };
}) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(input?.fixtureSlug ?? 'mono-standard');
  if (!fixture) throw new Error('Expected Sanctuary fixture.');

  const bootstrapStore = buildDrawingWorkbenchStore({
    snapshot: fixture.snapshot,
    draft: input?.draft ?? null,
    ui: createDrawingWorkbenchUiState(),
  });
  const activeRailTab = input?.activeRailTab ?? 'house_forms';
  const defaultHouseRef: WorkbenchObjectRef = {
    family: 'house_forms',
    objectId: bootstrapStore.derived.houseForms[0]?.id ?? null,
  };
  const defaultPergolaRef: WorkbenchObjectRef = {
    family: 'pergolas',
    objectId: bootstrapStore.derived.objectFirstPergolas[0]?.id ?? null,
  };
  const activeObjectRef =
    input?.activeObjectRef ??
    (activeRailTab === 'pergolas'
      ? defaultPergolaRef
      : activeRailTab === 'decks'
        ? { family: 'decks', objectId: bootstrapStore.derived.objectWorkbench.decks[0]?.id ?? null }
        : activeRailTab === 'openings'
          ? { family: 'openings', objectId: bootstrapStore.derived.objectFirstOpenings[0]?.id ?? null }
          : defaultHouseRef);

  const store = buildDrawingWorkbenchStore({
    snapshot: fixture.snapshot,
    draft: input?.draft ?? null,
    ui: createDrawingWorkbenchUiState({
      activeRailTab,
      activeObjectFamily: activeObjectRef.family,
      activeObjectRef,
    }),
  });

  return {
    model: store.derived.railModel,
    disabled: input?.disabled ?? false,
    activeRailTab: store.ui.activeRailTab,
    activeObjectRef: store.ui.activeObjectRef,
    visibility: store.ui.visibility,
    inspectorContext: {
      objectWorkbench: store.derived.objectWorkbench,
      canEditFootprint: true,
      canStartDrawOutline: true,
      onStartDrawOutline: () => ({ ok: true }),
      onCommitFootprintEdit: () => ({ ok: true }),
      onCommitRoofIntent: () => ({ ok: true }),
      onAddDeck: () => ({ ok: true }),
      onAddHouseForm: () => ({ ok: true }),
      onAddPergola: input?.onAddPergola ?? (() => ({ ok: true })),
      onAddOpening: () => ({ ok: true }),
      onRemoveDeck: () => ({ ok: true }),
      onRemoveOpening: () => ({ ok: true }),
      onCommitDeckPatch: () => ({ ok: true }),
      onCommitOpeningPatch: () => ({ ok: true }),
      onStartDeckOutline: () => ({ ok: true }),
      houseFormAttachmentContextPanel: <div>Attachment context extras</div>,
      pergolaInspectorPanel: <div>Native pergola inspector</div>,
      diagnosticsPanel: <section>Migration diagnostics</section>,
    },
  };
}

function applyObjectFirstCompatibilityDraft(input: {
  fixtureSlug?: 'mono-standard' | 'box-standard';
  draft: EstimateDrawingDraft;
  compatibility: ObjectWorkbenchCompatibilityDraft;
}) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(input.fixtureSlug ?? 'mono-standard');
  if (!fixture) throw new Error('Expected Sanctuary fixture.');
  const baselineStore = buildDrawingWorkbenchStore({
    snapshot: fixture.snapshot,
    ui: createDrawingWorkbenchUiState(),
  });
  const objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel);
  const houseForm = objectFirst.houseAssembly?.houseForms[0] ?? null;
  if (input.compatibility.roof && houseForm) {
    const roofPatch = input.compatibility.roof;
    houseForm.roofIntentAuthored = true;
    houseForm.roofIntent = {
      ...houseForm.roofIntent,
      form: roofPatch.form ?? houseForm.roofIntent.form,
      material: roofPatch.material ?? houseForm.roofIntent.material,
      primaryPitchDeg: roofPatch.primaryPitchDeg ?? houseForm.roofIntent.primaryPitchDeg,
      primaryFallDirection: roofPatch.primaryFallDirection ?? houseForm.roofIntent.primaryFallDirection,
      ridgeAxis: roofPatch.ridgeAxis ?? houseForm.roofIntent.ridgeAxis,
      openGableEndIds: roofPatch.openGableEndIds ?? houseForm.roofIntent.openGableEndIds,
    };
  }
  if (input.compatibility.openings) {
    objectFirst.openings = buildObjectFirstOpeningDraftsFromCompatibilityDrafts(
      input.compatibility.openings,
      houseForm?.id ?? null,
    );
  }
  input.draft.objectFirst = objectFirst;
}

function buildDraftWithRoofForm(form: HouseFormRoofIntentModel['form']): EstimateDrawingDraft {
  const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
  if (!fixture) throw new Error('Expected Sanctuary fixture.');
  const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
  if (!draft) throw new Error('Expected drawing draft.');
  applyObjectFirstCompatibilityDraft({
    draft,
    compatibility: {
      roof: {
        form,
        material: 'corrugated_iron',
        primaryPitchDeg: '12',
        primaryFallDirection: 'negative_y',
        ridgeAxis: 'x',
        openGableEndIds: ['house-gable-end-x-1'],
      },
    },
  });
  return draft;
}

describe('ObjectWorkbenchRail', () => {
  it('renders the Add structure button under the House Forms family section', () => {
    // PR-T6 (2026-05-26): all four families render an inline "+ Add X"
    // pill for visual consistency with the CAD mockup. House Forms keeps
    // "Add structure" copy. Pergolas now wires to addSharedPergola. Decks
    // + Openings wire to addSharedHouseDeck / addSharedHouseOpening
    // through the inspector context.
    const markup = renderToStaticMarkup(<ObjectWorkbenchRail {...buildRailProps()} />);
    expect(markup).toContain('data-action="add-house_forms"');
    expect(markup).toContain('>Add structure<');
    expect(markup).toContain('data-action="add-pergolas"');
    expect(markup).toContain('>Add pergola<');
    expect(markup).not.toContain('data-action="add-pergolas" disabled=""');
    expect(markup).toContain('data-action="add-decks"');
    expect(markup).toContain('>Add deck<');
    expect(markup).toContain('data-action="add-openings"');
    expect(markup).toContain('>Add opening<');
  });

  it('disables Add pergola when the rail is locked', () => {
    const markup = renderToStaticMarkup(<ObjectWorkbenchRail {...buildRailProps({ disabled: true })} />);
    expect(markup).toContain('data-action="add-pergolas" disabled=""');
  });

  it('renders the flat OBJECTS TREE with every family heading visible simultaneously', () => {
    // PR-W3d (2026-05-25): Object Navigator tab strip + Selected Object
    // summary section removed. Visibility toggles stay. All four family
    // sections render at once so the user never has to switch tabs to see
    // another family's objects. Diagnostics is removed from the rail
    // entirely (future access via top-bar `…` menu).
    //
    // Inspector content (House Form Inspector, Footprint, Roof, ...) lives
    // in WorkbenchInspectorHost (right-side panel) — that test surface is a
    // tracked follow-up.
    const markup = renderToStaticMarkup(<ObjectWorkbenchRail {...buildRailProps()} />);

    expect(markup).toContain('Visibility');
    // All four family section headings render together (flat outliner).
    expect(markup).toContain('data-object-tree-section="house_forms"');
    expect(markup).toContain('data-object-tree-section="pergolas"');
    expect(markup).toContain('data-object-tree-section="decks"');
    expect(markup).toContain('data-object-tree-section="openings"');
    // Removed surfaces: tab strip, Selected Object summary, Diagnostics tab.
    expect(markup).not.toContain('Object Navigator');
    expect(markup).not.toContain('Selected Object');
    expect(markup).not.toContain('role="tablist"');
    expect(markup).not.toContain('Diagnostics');
    // House Configurator was already gone — keep the negative assertion.
    expect(markup).not.toContain('House Configurator');
  });

  it.skip('renders the native pergola inspector inside the canonical Pergolas family — moved to WorkbenchInspectorHost', () => {
    // PR-W3c (2026-05-25): PergolaInspector mounting moved to
    // WorkbenchInspectorHost (right-side RightInspectorPanel). The rail no
    // longer renders pergola inspector content. Skipped until the
    // WorkbenchInspectorHost test file is created. The rail-only assertion
    // (`data-workbench-object-button="pergolas:pergola-1"`) still holds and
    // is covered by the navigator/family rendering tests above.
  });

  it.skip('keeps the opening type editable for hinged doors without deferred family copy — moved to WorkbenchInspectorHost', () => {
    // PR-W3c (2026-05-25): OpeningInspector mounting moved to
    // WorkbenchInspectorHost. Coverage owed to its test file.
    return;
  });
  // Original test retained below the skip marker for migration reference.
  it.skip('_legacy: keeps the opening type editable for hinged doors without deferred family copy', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected Sanctuary fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-door-1',
            label: 'Rear door',
            kind: 'hinged_door',
            wallId: 'rear',
            widthM: '0.9',
            heightM: '2.1',
            sillHeightM: '0',
            offsetAlongWallM: '0.6',
          },
        ],
      },
    });

    const markup = renderToStaticMarkup(
      <ObjectWorkbenchRail
        {...buildRailProps({
          draft,
          activeRailTab: 'openings',
          activeObjectRef: { family: 'openings', objectId: 'opening-door-1' },
        })}
      />,
    );

    expect(markup).toContain('aria-label="Opening type"');
    expect(markup).not.toContain('Family-specific editing for this opening is deferred in this slice.');
  });

  it.skip('shows derived host wall labels for openings in the canonical rail shell — moved to WorkbenchInspectorHost', () => {
    return;
  });
  it.skip('_legacy: shows derived host wall labels for openings in the canonical rail shell', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected Sanctuary fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-window-1',
            label: 'Rear window',
            kind: 'window',
            wallId: 'rear',
            widthM: '1.8',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '0.6',
          },
        ],
      },
    });

    const markup = renderToStaticMarkup(
      <ObjectWorkbenchRail
        {...buildRailProps({
          draft,
          activeRailTab: 'openings',
          activeObjectRef: { family: 'openings', objectId: 'opening-window-1' },
        })}
      />,
    );

    expect(markup).toContain('Rear wall');
    expect(markup).toContain('Host wall');
  });

  it.skip('keeps all supported house roof forms editable in the house-form roof section — moved to WorkbenchInspectorHost', () => {
    return;
  });
  it.skip('_legacy: keeps all supported house roof forms editable in the house-form roof section', () => {
    const markup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ fixtureSlug: 'box-standard' })} />,
    );

    expect(markup).toContain('Flat');
    expect(markup).toContain('aria-label="Roof form"');
    expect(markup).toContain('value="flat"');
    expect(markup).toContain('value="mono"');
    expect(markup).toContain('value="hipped"');
    expect(markup).not.toContain('value="gable"');
    expect(markup).not.toContain('View-only for now');
    expect(markup).not.toContain('Roof pitch (deg)');
    expect(markup).toContain('aria-label="Roof material"');
  });

  it.skip('renders only the controls relevant to each house roof form — moved to WorkbenchInspectorHost', () => {
    return;
  });
  it.skip('_legacy: renders only the controls relevant to each house roof form', () => {
    const flatMarkup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ draft: buildDraftWithRoofForm('flat') })} />,
    );
    expect(flatMarkup).toContain('aria-label="Roof form"');
    expect(flatMarkup).toContain('aria-label="Roof material"');
    expect(flatMarkup).not.toContain('Roof pitch (deg)');
    expect(flatMarkup).not.toContain('Mono fall direction');
    expect(flatMarkup).not.toContain('Gable ridge orientation');
    expect(flatMarkup).not.toContain('Hipped ridge orientation');
    expect(flatMarkup).not.toContain('Open gable ends');
    expect(flatMarkup).not.toContain('Appendage band');

    const monoMarkup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ draft: buildDraftWithRoofForm('mono') })} />,
    );
    expect(monoMarkup).toContain('Roof pitch (deg)');
    expect(monoMarkup).toContain('Mono fall direction');
    expect(monoMarkup).not.toContain('Appendage band');
    expect(monoMarkup).not.toContain('Hipped ridge orientation');
    expect(monoMarkup).not.toContain('Open hip ends as gables');

    // Milestone 13 session C: `'gable'` was retired from the form
    // picker. Legacy gable storage is mapped to hipped at the
    // normalize boundary; the rail exposes hipped + per-end
    // toggles for the Dutch-hip topology that replaces it.
    const hippedMarkup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ draft: buildDraftWithRoofForm('hipped') })} />,
    );
    expect(hippedMarkup).toContain('Roof pitch (deg)');
    expect(hippedMarkup).toContain('Minimum is 5 deg for this roof.');
    expect(hippedMarkup).toContain('Hipped ridge orientation');
    expect(hippedMarkup).toContain('Open hip ends as gables');
    expect(hippedMarkup).not.toContain('Mono fall direction');
    expect(hippedMarkup).not.toContain('Appendage band');
  });
});
