import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import DrawingWorkbench from './DrawingWorkbench';

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

function makeDrawingModule(overrides: Partial<CalculatorModuleInputs> = {}) {
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
      modules: [makeModule(overrides)],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
    },
  })[0]!;
}

describe('DrawingWorkbench', () => {
  it('renders the new workbench shell with the viewport mode switch', () => {
    const drawing = makeDrawingModule();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
      view: 'plan',
    });

    const markup = renderToStaticMarkup(
      <DrawingWorkbench
        moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
        modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
        activeModuleIndex={0}
        onActiveModuleIndexChange={() => undefined}
        view="plan"
        onViewChange={() => undefined}
        viewportMode="sheet"
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        activeModuleInput={drawing.input}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitModuleField={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Drawing workbench');
    expect(markup).toContain('Sheet Preview');
    expect(markup).toContain('Switch to model space');
    expect(markup).toContain('Pergola style');
    expect(markup).not.toContain('inputmode="decimal"');
    expect(markup).toContain('Sheet View');
    expect(markup).toContain('Model Space');
    expect(markup).not.toContain('next landing zone');
    expect(markup).toContain('aria-label="Plan view A3 drawing sheet"');
  });

  it('renders the model-space viewport without sheet furniture when model mode is active', () => {
    const drawing = makeDrawingModule();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
      view: 'plan',
    });

    const markup = renderToStaticMarkup(
      <DrawingWorkbench
        moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
        modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
        activeModuleIndex={0}
        onActiveModuleIndexChange={() => undefined}
        view="plan"
        onViewChange={() => undefined}
        viewportMode="model"
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        activeModuleInput={drawing.input}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
        onCommitModuleField={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('aria-label="Plan model space viewport"');
    expect(markup).toContain('Rotate +90');
    expect(markup).toContain('Open full calculator');
    expect(markup).toContain('Pergola style');
    expect(markup).toContain('Reset view');
    expect(markup).not.toContain('Live configurator surface');
    expect(markup).not.toContain('A3 drawing sheet');
  });
});
