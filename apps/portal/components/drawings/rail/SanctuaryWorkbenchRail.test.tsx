import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import SanctuaryWorkbenchRail from './SanctuaryWorkbenchRail';

function makeGeometryState(overrides: Partial<GeometryEditState> = {}): GeometryEditState {
  const base: GeometryEditState = {
    family: 'mono',
    config: {} as GeometryEditState['config'],
    dimensions: {
      lengthM: '6',
      projectionM: '3',
    },
    roof: {
      material: 'acrylic',
      pitchDeg: '25',
      boxPerimeterEnabled: false,
    },
    connection: {
      type: 'fascia',
      attachmentSide: 'rear',
    },
    houseContext: {
      canEditFootprint: true,
      footprintPreset: 'straight',
      footprintParams: {
        bandDepthM: '1.8',
        returnRunM: '2.4',
        recessWidthM: '2.4',
        recessDepthM: '1.2',
        leftLegRunM: '2.4',
        rightLegRunM: '2.4',
        sideRunM: '2.4',
      },
      drawingRotationQuarterTurns: 1,
    },
    supports: {
      postConnectionType: 'slab_anchors',
      ground: 'easy',
      postCount: '2',
      postCutHeightM: '2.5',
    },
    overrides: {
      ledgerProfile: '',
      rafterProfile: '',
      postProfile: '',
      frontBeamProfile: '',
      ridgeBeamProfile: '',
      boxPerimeterBeamProfile: '',
      tieBeamProfile: '',
      strutProfile: '',
    },
  };

  return {
    ...base,
    ...overrides,
    dimensions: { ...base.dimensions, ...overrides.dimensions },
    roof: { ...base.roof, ...overrides.roof },
    connection: { ...base.connection, ...overrides.connection },
    houseContext: {
      ...base.houseContext,
      ...overrides.houseContext,
      footprintParams: {
        ...base.houseContext.footprintParams,
        ...(overrides.houseContext?.footprintParams ?? {}),
      },
    },
    supports: { ...base.supports, ...overrides.supports },
  };
}

describe('SanctuaryWorkbenchRail', () => {
  it('renders only the curated Sanctuary sections and hides calculator sprawl', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        geometryState={makeGeometryState()}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Geometry');
    expect(markup).toContain('Roof');
    expect(markup).toContain('House / Context');
    expect(markup).toContain('Supports');
    expect(markup).toContain('Pergola family');
    expect(markup).toContain('Box perimeter');
    expect(markup).toContain('Roof material');
    expect(markup).toContain('House connection');
    expect(markup).toContain('Post count');
    expect(markup).toContain('Overrides');
    expect(markup).toContain('Ledger override');
    expect(markup).toContain('Rafter override');
    expect(markup).toContain('Post override');
    expect(markup).not.toContain('Flashings');
    expect(markup).not.toContain('Allowances');
    expect(markup).not.toContain('Travel');
    expect(markup).not.toContain('Powdercoat');
    expect(markup).not.toContain('Open full calculator');
  });

  it('shows ground only for pile footings and disables roof pitch when box perimeter is active', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Box"
        geometryState={makeGeometryState({
          family: 'box',
          roof: {
            material: 'acrylic',
            pitchDeg: '5',
            boxPerimeterEnabled: true,
          },
          supports: {
            postConnectionType: 'pile_1m',
            ground: 'easy',
            postCount: '2',
            postCutHeightM: '2.5',
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Ground');
    expect(markup).toContain('aria-label="Roof pitch (deg)"');
    expect(markup).toContain('Box perimeter beam override');
    expect(markup).toContain('disabled=""');
  });

  it('shows gable-only overrides when the family is gable', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M2 - Gable"
        geometryState={makeGeometryState({
          family: 'gable',
          roof: {
            material: 'acrylic',
            pitchDeg: '25',
            boxPerimeterEnabled: false,
          },
        })}
        view="plan"
        onCommitGeometryEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Tie beam override');
    expect(markup).toContain('King-post strut override');
    expect(markup).not.toContain('Box perimeter beam override');
  });
});
