import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot, type EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState, type DrawingWorkbenchRailTab } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
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
    ui: createDrawingWorkbenchUiState({ workbenchMode: 'house' }),
  });
  const activeRailTab = input?.activeRailTab ?? 'house_forms';
  const defaultHouseRef: WorkbenchObjectRef = {
    family: 'house_forms',
    objectId: bootstrapStore.derived.house?.id ?? null,
  };
  const defaultPergolaRef: WorkbenchObjectRef = {
    family: 'pergolas',
    objectId: bootstrapStore.derived.pergolas[0]?.id ?? null,
  };
  const activeObjectRef =
    input?.activeObjectRef ??
    (activeRailTab === 'pergolas'
      ? defaultPergolaRef
      : activeRailTab === 'decks'
        ? { family: 'decks', objectId: bootstrapStore.derived.decks[0]?.id ?? null }
        : activeRailTab === 'openings'
          ? { family: 'openings', objectId: bootstrapStore.derived.openings[0]?.id ?? null }
          : defaultHouseRef);

  const store = buildDrawingWorkbenchStore({
    snapshot: fixture.snapshot,
    draft: input?.draft ?? null,
    ui: createDrawingWorkbenchUiState({
      workbenchMode: activeObjectRef.family === 'pergolas' ? 'pergolas' : 'house',
      activeRailTab,
      activeObjectFamily: activeObjectRef.family,
      activeObjectRef,
      activePergolaId: activeObjectRef.family === 'pergolas' ? activeObjectRef.objectId : null,
      activeHouseSelection:
        activeObjectRef.family === 'decks'
          ? { kind: 'deck', targetId: activeObjectRef.objectId }
          : activeObjectRef.family === 'openings'
            ? { kind: 'opening', targetId: activeObjectRef.objectId }
            : { kind: 'house', targetId: null },
    }),
  });

  return {
    model: store.derived.railModel,
    disabled: false,
    activeRailTab: store.ui.activeRailTab,
    activeObjectRef: store.ui.activeObjectRef,
    visibility: store.ui.visibility,
    inspectorContext: {
      house: store.derived.house,
      activeDeckId: store.derived.activeDeckId,
      activeOpeningId: store.derived.activeOpeningId,
      pergolas: store.derived.pergolas,
      warnings: store.derived.migrationWarnings,
      canEditFootprint: true,
      canStartDrawOutline: true,
      onStartDrawOutline: () => ({ ok: true }),
      onCommitFootprintEdit: () => ({ ok: true }),
      onCommitRoofDraft: () => ({ ok: true }),
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
});
