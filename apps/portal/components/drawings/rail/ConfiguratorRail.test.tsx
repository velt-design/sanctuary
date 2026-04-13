import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import ConfiguratorRail from './ConfiguratorRail';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'gable',
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
      widthM: '',
      offsetXM: '0',
      setbackM: '0',
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

function makeField(id: string, label: string, rawValue: string, displayValue = rawValue): EstimateDrawingField {
  return {
    id,
    label,
    rawValue,
    displayValue,
    editor: 'singleline',
    target: { type: 'module_input', moduleIndex: 0, field: 'lengthM' },
  };
}

describe('ConfiguratorRail', () => {
  it('renders a compact summary rail for sheet view', () => {
    const markup = renderToStaticMarkup(
      <ConfiguratorRail
        moduleLabel="M1 - Gable - 6m x 3m - Acrylic"
        moduleInput={makeModule()}
        view="plan"
        mode="compact"
        editableFields={[
          makeField('plan:lengthA', 'Plan length', '6', '6.00m'),
          makeField('plan:spanA', 'Plan span', '3', '3.00m'),
        ]}
        onSwitchToModelSpace={() => undefined}
        onOpenFullCalculator={() => undefined}
      />,
    );

    expect(markup).toContain('Sheet Preview');
    expect(markup).toContain('Switch to model space');
    expect(markup).toContain('Plan length');
    expect(markup).toContain('>6<');
    expect(markup).toContain('House footprint');
    expect(markup).not.toContain('inputmode="decimal"');
  });

  it('hides plan-only house controls when viewing section in full mode', () => {
    const markup = renderToStaticMarkup(
      <ConfiguratorRail
        moduleLabel="M1 - Gable - 6m x 3m - Acrylic"
        moduleInput={makeModule()}
        view="section"
        mode="full"
        editableFields={[
          makeField('section:spanA', 'Section span', '3', '3.00m'),
          makeField('section:pitch', 'Roof pitch', '25', '25.0 deg'),
          makeField('section:heightLeft', 'Left height', '2.5', '2.50m'),
          makeField('section:heightRight', 'Right height', '2.5', '2.50m'),
        ]}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitModuleField={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('House connection');
    expect(markup).toContain('House Footprint');
    expect(markup).not.toContain('Attachment side');
    expect(markup).not.toContain('Recess width');
  });
});
