import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import HouseFirstWorkbenchRail from './HouseFirstWorkbenchRail';

function buildRailState() {
  const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
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
  };
}

describe('HouseFirstWorkbenchRail', () => {
  it('renders the extracted house-mode section stack', () => {
    const { house, pergolas, warnings } = buildRailState();
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="house"
        house={house}
        pergolas={pergolas}
        warnings={warnings}
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
    expect(markup).toContain('Roof form basis');
    expect(markup).toContain('Decks');
    expect(markup).toContain('Openings');
    expect(markup).toContain('Add deck');
    expect(markup).toContain('Add window');
    expect(markup).toContain('Add slider');
  });

  it('keeps pergola fallback isolated from the house-mode sections', () => {
    const { house, pergolas, warnings } = buildRailState();
    const markup = renderToStaticMarkup(
      <HouseFirstWorkbenchRail
        workbenchMode="pergolas"
        house={house}
        pergolas={pergolas}
        warnings={warnings}
        pergolaFallback={<div>Fallback rail</div>}
      />,
    );

    expect(markup).toContain('Pergola Mode');
    expect(markup).toContain('Fallback rail');
    expect(markup).not.toContain('Add deck');
    expect(markup).not.toContain('Add window');
    expect(markup).not.toContain('Add slider');
  });
});
