import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState, type DrawingWorkbenchRailTab } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { HouseFormRoofIntentModel, WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import ObjectWorkbenchRail from './ObjectWorkbenchRail';

function buildRailProps(input?: {
  fixtureSlug?: 'mono-standard' | 'box-standard';
  draft?: EstimateDrawingDraft | null;
  activeRailTab?: DrawingWorkbenchRailTab;
  activeObjectRef?: WorkbenchObjectRef;
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
    disabled: false,
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

function buildDraftWithRoofForm(form: HouseFormRoofIntentModel['form']): EstimateDrawingDraft {
  const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
  if (!fixture) throw new Error('Expected Sanctuary fixture.');
  const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
  if (!draft) throw new Error('Expected drawing draft.');
  draft.houseFirst = {
    roof: {
      form,
      material: 'corrugated_iron',
      primaryPitchDeg: '12',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: ['house-gable-end-x-1'],
      appendage: {
        enabled: true,
        form: 'mono',
        hostEdge: 'rear',
        pitchDeg: '5',
        dropMm: '450',
      },
    },
  };
  return draft;
}

describe('ObjectWorkbenchRail', () => {
  it('renders the canonical family navigator and selected house-form inspector by default', () => {
    const markup = renderToStaticMarkup(<ObjectWorkbenchRail {...buildRailProps()} />);

    expect(markup).toContain('Object Navigator');
    expect(markup).toContain('House Forms');
    expect(markup).toContain('Decks');
    expect(markup).toContain('Openings');
    expect(markup).toContain('Pergolas');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('House Form Inspector');
    expect(markup).toContain('Footprint');
    expect(markup).toContain('Roof');
    expect(markup).toContain('Review Basis');
    expect(markup).toContain('Attachment Context');
    expect(markup).toContain('Attachment context extras');
    expect(markup).toContain('Selected Object');
    expect(markup).toContain('Visibility');
    expect(markup).not.toContain('House Configurator');
  });

  it('renders the native pergola inspector inside the canonical Pergolas family', () => {
    const markup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ activeRailTab: 'pergolas' })} />,
    );

    expect(markup).toContain('Native pergola inspector');
    expect(markup).toContain('data-workbench-object-button="pergolas:pergola-1"');
    expect(markup).not.toContain('Add deck');
    expect(markup).not.toContain('Add window');
    expect(markup).not.toContain('Add door');
    expect(markup).not.toContain('Add slider');
    expect(markup).not.toContain('Add stacker');
  });

  it('keeps the opening type editable for hinged doors without deferred family copy', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected Sanctuary fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
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
    };

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

  it('shows derived host wall labels for openings in the canonical rail shell', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Expected Sanctuary fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.houseFirst = {
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
    };

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

  it('keeps all supported house roof forms editable in the house-form roof section', () => {
    const markup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ fixtureSlug: 'box-standard' })} />,
    );

    expect(markup).toContain('Flat');
    expect(markup).toContain('aria-label="Roof form"');
    expect(markup).toContain('value="flat"');
    expect(markup).toContain('value="mono"');
    expect(markup).toContain('value="gable"');
    expect(markup).toContain('value="hipped"');
    expect(markup).not.toContain('View-only for now');
    expect(markup).not.toContain('Roof pitch (deg)');
    expect(markup).toContain('aria-label="Roof material"');
  });

  it('renders only the controls relevant to each house roof form', () => {
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
    expect(monoMarkup).toContain('Appendage band');
    expect(monoMarkup).not.toContain('Gable ridge orientation');
    expect(monoMarkup).not.toContain('Open gable ends');

    const gableMarkup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ draft: buildDraftWithRoofForm('gable') })} />,
    );
    expect(gableMarkup).toContain('Roof pitch (deg)');
    expect(gableMarkup).toContain('Gable ridge orientation');
    expect(gableMarkup).toContain('Open gable ends');
    expect(gableMarkup).toContain('Appendage band');
    expect(gableMarkup).not.toContain('Mono fall direction');

    const hippedMarkup = renderToStaticMarkup(
      <ObjectWorkbenchRail {...buildRailProps({ draft: buildDraftWithRoofForm('hipped') })} />,
    );
    expect(hippedMarkup).toContain('Roof pitch (deg)');
    expect(hippedMarkup).toContain('Hipped ridge orientation');
    expect(hippedMarkup).not.toContain('Mono fall direction');
    expect(hippedMarkup).not.toContain('Open gable ends');
    expect(hippedMarkup).not.toContain('Appendage band');
  });
});
