import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import ModuleViewsCard, { getSuggestedModuleDrawingScale, resolveModuleDrawingScaleState } from './ModuleViewsCard';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '5',
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
    overhangAmountM: '0.2',
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
    houseConnectionType: 'soffit',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeResult(): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: 'pitched',
    },
    derived: {
      length_m: 6,
      projection_m: 3,
      slope_direction: 'away_from_house',
      roof_pitch_deg_used: 5,
      height_house_side_m: 2.4,
      height_outer_side_m: 2.1,
    },
  } as unknown as CostOutputV1;
}

function makeDrawingModule() {
  return buildEstimateDrawingModules({
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Test Project',
      quoteRef: 'Q-1000',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules: [makeModule()],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
    },
  })[0]!;
}

describe('ModuleViewsCard', () => {
  it('renders the extracted plan renderer inside the calculator card chrome', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
      />,
    );

    expect(markup).toContain('Module views');
    expect(markup).toContain('Plan');
    expect(markup).not.toContain('Technical');
    expect(markup).not.toContain('Clean');
    expect(markup).not.toContain('Diag');
    expect(markup).toContain('Geometry OK');
    expect(markup).toContain('Not to scale');
    expect(markup).toContain('aria-label="Module plan view"');
  });

  it('suggests the largest architectural plan scale that fits the A3 sheet viewport', () => {
    const drawing = makeDrawingModule();

    expect(getSuggestedModuleDrawingScale({ view: 'plan', planModel: drawing.planModel, sectionModel: drawing.sectionModel })).toEqual({
      mode: 'fixed',
      ratio: 50,
    });

    expect(
      resolveModuleDrawingScaleState({
        view: 'plan',
        requestedScale: { mode: 'fixed', ratio: 20 },
        planModel: drawing.planModel,
        sectionModel: drawing.sectionModel,
      }),
    ).toMatchObject({
      fits: false,
      appliedScale: { mode: 'fit' },
      suggestedScale: { mode: 'fixed', ratio: 50 },
    });
  });
});
