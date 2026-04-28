import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import HouseFirstWorkbenchRail from './HouseFirstWorkbenchRail';

function buildRailState(fixtureSlug: 'mono-standard' | 'box-standard' = 'mono-standard') {
  const fixture = getSanctuaryGeometryWorkbenchFixture(fixtureSlug);
  if (!fixture) throw new Error('Expected Sanctuary fixture.');
  const store = buildDrawingWorkbenchStore({
    snapshot: fixture.snapshot,
    draft: null,
    ui: createDrawingWorkbenchUiState({ workbenchMode: 'house' }),
  });

  return {
    house: store.derived.house,
    pergolas: store.derived.pergolas,
    warnings: store.derived.migrationWarnings,
    visibility: store.ui.visibility,
  };
}

describe('HouseFirstWorkbenchRail', () => {
  it('renders the extracted house-mode section stack', () => {
    const { house, pergolas, warnings, visibility } = buildRailState();
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="house"
        house={house}
        pergolas={pergolas}
        warnings={warnings}
        visibility={visibility}
        canEditFootprint
        canStartDrawOutline
        onStartDrawOutline={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitRoofDraft={() => ({ ok: true })}
        onSelectDeck={() => undefined}
        onSelectOpening={() => undefined}
        onAddDeck={() => ({ ok: true })}
        onAddOpening={() => ({ ok: true })}
        onRemoveDeck={() => ({ ok: true })}
        onRemoveOpening={() => ({ ok: true })}
        onCommitDeckPatch={() => ({ ok: true })}
        onCommitOpeningPatch={() => ({ ok: true })}
        onStartDeckOutline={() => ({ ok: true })}
        pergolaFallback={<div>Fallback rail</div>}
      />,
    );

    expect(markup).toContain('House Configurator');
    expect(markup).toContain('Footprint');
    expect(markup).toContain('Roof');
    expect(markup).toContain('Approximate');
    expect(markup).toContain('Review Basis');
    expect(markup).toContain('Roof geometry');
    expect(markup).toContain('Roof form basis');
    expect(markup).toContain('Appendage supported edges');
    expect(markup).toContain('Decks');
    expect(markup).toContain('Openings');
    expect(markup).toContain('Visibility');
    expect(markup).toContain('Pergolas');
    expect(markup).toContain('Shown');
    expect(markup).toContain('Add deck');
    expect(markup).toContain('Add window');
    expect(markup).toContain('Add door');
    expect(markup).toContain('Add slider');
    expect(markup).toContain('Add stacker');
  });

  it('keeps pergola fallback isolated from the house-mode sections', () => {
    const { house, pergolas, warnings, visibility } = buildRailState();
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="pergolas"
        house={house}
        pergolas={pergolas}
        warnings={warnings}
        visibility={visibility}
        pergolaFallback={<div>Fallback rail</div>}
      />,
    );

    expect(markup).toContain('Pergola Mode');
    expect(markup).toContain('Fallback rail');
    expect(markup).not.toContain('Add deck');
    expect(markup).not.toContain('Add window');
    expect(markup).not.toContain('Add door');
    expect(markup).not.toContain('Add slider');
    expect(markup).not.toContain('Add stacker');
  });

  it('keeps the opening type editable for hinged doors without deferred family copy', () => {
    const { house, pergolas, warnings, visibility } = buildRailState();
    if (!house) throw new Error('Expected shared house.');
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="house"
        house={{
          ...house,
          openings: [
            {
              id: 'opening-door-1',
              label: 'Rear door',
              kind: 'hinged_door',
              panelCount: null,
              wallId: 'rear',
              hostEdgeId: 'footprint-edge-3',
              widthM: '0.9',
              heightM: '2.1',
              sillHeightM: '0',
              offsetAlongWallM: '0.6',
              validation: {
                status: 'valid',
                codes: [],
                message: null,
              },
            },
          ],
        }}
        pergolas={pergolas}
        warnings={warnings}
        visibility={visibility}
        activeOpeningId="opening-door-1"
        onAddOpening={() => ({ ok: true })}
        onRemoveOpening={() => ({ ok: true })}
        onCommitOpeningPatch={() => ({ ok: true })}
        onSelectOpening={() => undefined}
        pergolaFallback={<div>Fallback rail</div>}
      />,
    );

    expect(markup).toContain('aria-label="Opening type"');
    expect(markup).not.toContain('Family-specific editing for this opening is deferred in this slice.');
  });

  it('shows legacy flat roofs as view-only in the house-mode roof section', () => {
    const { house, pergolas, warnings, visibility } = buildRailState('box-standard');
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="house"
        house={house}
        pergolas={pergolas}
        warnings={warnings}
        visibility={visibility}
        canEditFootprint
        canStartDrawOutline
        onStartDrawOutline={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitRoofDraft={() => ({ ok: true })}
        onSelectDeck={() => undefined}
        onSelectOpening={() => undefined}
        onAddDeck={() => ({ ok: true })}
        onAddOpening={() => ({ ok: true })}
        onRemoveDeck={() => ({ ok: true })}
        onRemoveOpening={() => ({ ok: true })}
        onCommitDeckPatch={() => ({ ok: true })}
        onCommitOpeningPatch={() => ({ ok: true })}
        onStartDeckOutline={() => ({ ok: true })}
        pergolaFallback={<div>Fallback rail</div>}
      />,
    );

    expect(markup).toContain('Current roof family');
    expect(markup).toContain('Flat');
    expect(markup).toContain('View-only for now');
    expect(markup).toContain('Only mono and gable are first-pass editable in house mode for this milestone.');
    expect(markup).not.toContain('aria-label="Roof form"');
    expect(markup).not.toContain('Roof pitch (deg)');
  });
});
