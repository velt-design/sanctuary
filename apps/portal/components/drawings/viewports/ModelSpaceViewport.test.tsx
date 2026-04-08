import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import { buildPlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import ModelSpaceViewport from './ModelSpaceViewport';

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

function makePlanEditableFields(): EstimateDrawingField[] {
  return [
    {
      id: 'plan:lengthA',
      label: 'Plan length',
      rawValue: '6',
      displayValue: '6.00m',
      svgFieldId: 'plan:lengthA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'lengthM' },
    },
    {
      id: 'plan:spanA',
      label: 'Plan span',
      rawValue: '3',
      displayValue: '3.00m',
      svgFieldId: 'plan:spanA',
      editor: 'singleline',
      target: { type: 'module_input', moduleIndex: 0, field: 'projectionM' },
    },
  ];
}

describe('ModelSpaceViewport', () => {
  it('renders plan controls for the live model-space configurator', () => {
    const drawing = makeDrawingModule();
    const assembly = buildAssemblyModel({
      id: drawing.id,
      label: 'M1 - Pitched - 6m x 3m',
      moduleIndex: 0,
      moduleInput: drawing.input,
      moduleResult: drawing.result,
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    const markup = renderToStaticMarkup(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel(assembly)}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('Live plan viewport');
    expect(markup).toContain('Drag the primary resize handles or use the Sanctuary rail');
    expect(markup).toContain('Zoom in');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:lengthA"');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:spanA"');
    expect(markup).toContain('data-editable-field-id="plan:lengthA"');
    expect(markup).toContain('data-editable-field-id="plan:spanA"');
    expect(markup).toContain('data-footprint-edge="rear"');
    expect(markup).not.toContain('House type');
    expect(markup).not.toContain('Rotate -90');
  });

  it('shows a placeholder for section mode until section model space is implemented', () => {
    const drawing = makeDrawingModule();

    const markup = renderToStaticMarkup(
      <ModelSpaceViewport
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
      />,
    );

    expect(markup).toContain('Section model space is staged for a later milestone.');
    expect(markup).not.toContain('data-plan-resize-handle-hit=');
  });
});
