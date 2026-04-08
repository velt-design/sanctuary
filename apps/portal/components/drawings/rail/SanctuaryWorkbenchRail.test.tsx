import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import SanctuaryWorkbenchRail from './SanctuaryWorkbenchRail';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '25',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    postCount: '2',
    houseConnectionType: 'fascia',
    attachmentSide: 'rear',
    drawingRotationQuarterTurns: 1,
    houseFootprintPreset: 'straight',
    houseFootprintParams: {
      bandDepthM: '1.8',
      returnRunM: '2.4',
      recessWidthM: '2.4',
      recessDepthM: '1.2',
      leftLegRunM: '2.4',
      rightLegRunM: '2.4',
      sideRunM: '2.4',
    },
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.5',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };

  return { ...base, ...overrides } as CalculatorModuleInputs;
}

describe('SanctuaryWorkbenchRail', () => {
  it('renders only the curated Sanctuary sections and hides calculator sprawl', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Mono"
        moduleInput={makeModule()}
        view="plan"
        onCommitFamily={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitModuleField={() => ({ ok: true })}
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
    expect(markup).not.toContain('Flashings');
    expect(markup).not.toContain('Allowances');
    expect(markup).not.toContain('Override');
    expect(markup).not.toContain('Travel');
    expect(markup).not.toContain('Powdercoat');
    expect(markup).not.toContain('Open full calculator');
  });

  it('shows ground only for pile footings and disables roof pitch when box perimeter is active', () => {
    const markup = renderToStaticMarkup(
      <SanctuaryWorkbenchRail
        moduleLabel="M1 - Box"
        moduleInput={makeModule({
          boxPerimeterEnabled: true,
          postConnectionType: 'pile_1m',
        })}
        view="plan"
        onCommitFamily={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitModuleField={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Ground');
    expect(markup).toContain('aria-label="Roof pitch (deg)"');
    expect(markup).toContain('disabled=""');
  });
});
