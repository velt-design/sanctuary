import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import ModuleViewsCard, {
  ModuleDrawingRenderer,
  type HouseFootprintHandleId,
  getModuleDrawingScaleDiagnostics,
  getSuggestedModuleDrawingScale,
  resolveModuleDrawingScaleState,
} from './ModuleViewsCard';

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

function makeFootprintEditor(overrides: Partial<{
  isEditing: boolean;
  isContextHovered: boolean;
  surface: 'card' | 'sheet';
  hoveredHandleId: HouseFootprintHandleId | null;
  activeHandleId: HouseFootprintHandleId | null;
}> = {}) {
  return {
    available: true,
    isEditing: overrides.isEditing ?? false,
    isContextHovered: overrides.isContextHovered ?? false,
    surface: overrides.surface ?? 'card',
    hoveredAttachmentSide: null,
    hoveredHandleId: overrides.hoveredHandleId ?? null,
    activeHandleId: overrides.activeHandleId ?? null,
    onStartEditing: () => undefined,
    onDoneEditing: () => undefined,
    onContextHoverChange: () => undefined,
    onContextPopoverHoverChange: () => undefined,
    onAttachmentSideHover: () => undefined,
    onAttachmentSideSelect: () => undefined,
    onHandleHover: () => undefined,
    onHandleDragStart: () => undefined,
    onPresetSelect: () => undefined,
    onRotate: () => undefined,
    onSvgMount: () => undefined,
  };
}

function extractDebugRect(markup: string, marker: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const markerIndex = markup.indexOf(`data-debug-crop="${marker}"`);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const slice = markup.slice(markerIndex, markup.indexOf('</g>', markerIndex));
  const lineMatches = [...slice.matchAll(/<line[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"/g)];
  expect(lineMatches.length).toBeGreaterThan(0);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const match of lineMatches) {
    xs.push(Number.parseFloat(match[1] ?? '0'));
    xs.push(Number.parseFloat(match[3] ?? '0'));
    ys.push(Number.parseFloat(match[2] ?? '0'));
    ys.push(Number.parseFloat(match[4] ?? '0'));
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function extractPlanPrimaryDimensionGroup(markup: string, side: 'bottom' | 'left'): string {
  const marker = `data-plan-primary-dim="${side}"`;
  const markerIndex = markup.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  return markup.slice(markerIndex, markup.indexOf('</g>', markerIndex));
}

function extractSheetAnnotationSegment(markup: string, marker: string, nextMarkers: string[]): string {
  const markerIndex = markup.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);
  const nextIndexes = nextMarkers
    .map((nextMarker) => markup.indexOf(nextMarker, markerIndex + marker.length))
    .filter((index) => index >= 0);
  const endIndex = nextIndexes.length > 0 ? Math.min(...nextIndexes) : markup.length;
  return markup.slice(markerIndex, endIndex);
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
    expect(markup).not.toContain('data-debug-crop=');
  });

  it('renders outer and fit overlays for plan sheets only', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    expect(markup).toContain('data-debug-crop="outer-plan"');
    expect(markup).toContain('data-debug-crop="fit-plan"');
    expect(markup).toContain('data-debug-crop="bounds-plan"');
  });

  it('renders outer and fit overlays for section sheets only', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    expect(markup).toContain('data-debug-crop="outer-section"');
    expect(markup).toContain('data-debug-crop="fit-section"');
    expect(markup).toContain('data-debug-crop="bounds-section"');
  });

  it('centers plan sheet geometry vertically within the viewport', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    const outer = extractDebugRect(markup, 'outer-plan');
    const bounds = extractDebugRect(markup, 'bounds-plan');
    const topSlack = bounds.minY - outer.minY;
    const bottomSlack = outer.maxY - bounds.maxY;

    expect(Math.abs(topSlack - bottomSlack)).toBeLessThanOrEqual(0.75);
  });

  it('centers section sheet geometry vertically within the viewport', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    const outer = extractDebugRect(markup, 'outer-section');
    const bounds = extractDebugRect(markup, 'bounds-section');
    const topSlack = bounds.minY - outer.minY;
    const bottomSlack = outer.maxY - bounds.maxY;

    expect(Math.abs(topSlack - bottomSlack)).toBeLessThanOrEqual(0.75);
  });

  it('hides the house footprint entirely for freestanding modules', () => {
    const drawing = makeDrawingModule({ houseConnectionType: 'none' });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
      />,
    );

    expect(markup).not.toContain('House side');
  });

  it('applies quarter-turn rotation as a final plan transform', () => {
    const drawing = makeDrawingModule({ drawingRotationQuarterTurns: 1 });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
      />,
    );

    expect(markup).toContain('rotate(90');
  });

  it('shows the edit-footprint trigger for eligible calculator plan views', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor()}
      />,
    );

    expect(markup).toContain('Edit footprint');
    expect(markup).not.toContain('House footprint editor');
  });

  it('renders the canvas toolbar and handle overlays while editing the footprint', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'recess_left' });
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor({ isEditing: true, activeHandleId: 'bandDepth' })}
      />,
    );

    expect(markup).toContain('House footprint editor');
    expect(markup).toContain('aria-label="House footprint preset"');
    expect(markup).toContain('Rotate -90');
    expect(markup).toContain('Attached edge');
    expect(markup).toContain('data-footprint-edge="rear"');
    expect(markup).toContain('data-footprint-handle="bandDepth"');
    expect(markup).toContain('data-footprint-handle="recessWidth"');
    expect(markup).toContain('Band depth: 1.80m');
    expect(markup).not.toContain('Attached edge</text>');
    expect(markup).not.toContain('House side</text>');
    expect(markup).toContain('clipPath');
  });

  it('renders U-shape handle affordances on both parallel legs', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'u_shape' });
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor({ isEditing: true })}
      />,
    );

    expect(markup).toContain('data-footprint-handle="leftLegRun"');
    expect(markup).toContain('data-footprint-handle="rightLegRun"');
  });

  it('renders the sheet house preset popover without point handles on fill hover', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'recess_left' });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
        footprintEditor={makeFootprintEditor({ surface: 'sheet', isEditing: true, isContextHovered: true, activeHandleId: 'bandDepth' })}
      />,
    );

    expect(markup).toContain('data-sheet-plan-popover="house"');
    expect(markup).toContain('House type');
    expect(markup).toContain('data-footprint-resize-edge-hit="bandDepth"');
    expect(markup).toContain('data-sheet-hover-target="house"');
    expect(markup).not.toContain('data-footprint-handle=');
    expect(markup).not.toContain('Edit house context');
  });

  it('shows a bold draggable resize edge on sheet edge hover without reopening the house popup', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'recess_left' });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
        footprintEditor={makeFootprintEditor({ surface: 'sheet', isEditing: true, hoveredHandleId: 'recessDepth' })}
      />,
    );

    expect(markup).toContain('data-footprint-resize-edge="recessDepth"');
    expect(markup).toContain('data-footprint-resize-edge-hit="recessDepth"');
    expect(markup).not.toContain('data-sheet-plan-popover="house"');
    expect(markup).not.toContain('data-footprint-handle=');
  });

  it('renders the sheet pergola rotate popover separately from the house popover', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
        footprintEditor={makeFootprintEditor({ surface: 'sheet' })}
        sheetPlanInteraction={{
          isPergolaPopoverOpen: true,
          onPergolaHoverChange: () => undefined,
          onPergolaPopoverHoverChange: () => undefined,
        }}
      />,
    );

    expect(markup).toContain('data-sheet-plan-popover="pergola"');
    expect(markup).toContain('Rotate -90');
    expect(markup).toContain('Rotate +90');
    expect(markup).toContain('data-sheet-hover-target="pergola"');
    expect(markup).not.toContain('data-sheet-plan-popover="house"');
  });

  it('pins and swaps primary plan dimensions on odd quarter-turn sheet rotations', () => {
    const drawing = makeDrawingModule({ drawingRotationQuarterTurns: 1, lengthM: '6', projectionM: '3' });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    const bottomGroup = extractPlanPrimaryDimensionGroup(markup, 'bottom');
    const leftGroup = extractPlanPrimaryDimensionGroup(markup, 'left');

    expect(bottomGroup).toContain('>3.00m<');
    expect(leftGroup).toContain('>6.00m<');
  });

  it('renders model-space resize handles only on the model presentation', () => {
    const drawing = makeDrawingModule({ drawingRotationQuarterTurns: 1 });
    const modelMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        interactiveFields={{
          'plan:lengthA': { fieldId: 'plan:lengthA' },
          'plan:spanA': { fieldId: 'plan:spanA' },
        }}
        planInteraction={{
          available: true,
          hoveredResizeFieldId: null,
          activeResizeFieldId: null,
          onResizeFieldHover: () => undefined,
          onResizeFieldDragStart: () => undefined,
          onSvgMount: () => undefined,
        }}
      />,
    );
    const sheetMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    expect(modelMarkup).toContain('data-plan-resize-handle-hit="plan:lengthA"');
    expect(modelMarkup).toContain('data-plan-resize-handle-hit="plan:spanA"');
    expect(modelMarkup).toContain('data-editable-field-id="plan:lengthA"');
    expect(modelMarkup).toContain('data-editable-field-id="plan:spanA"');
    expect(sheetMarkup).not.toContain('data-plan-resize-handle-hit=');
  });

  it('renders fall and spacing annotations in page space for rotated sheet plans', () => {
    const drawing = makeDrawingModule({ drawingRotationQuarterTurns: 1 });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="sheet"
      />,
    );

    const fallGroup = extractSheetAnnotationSegment(markup, 'data-plan-fall-annotation="sheet"', [
      'data-plan-rafter-spacing="sheet"',
      'data-plan-primary-dim="bottom"',
    ]);
    const spacingGroup = extractSheetAnnotationSegment(markup, 'data-plan-rafter-spacing="sheet"', ['data-plan-primary-dim="bottom"']);

    expect(markup).toContain('rotate(90');
    expect(fallGroup).toContain('>fall<');
    expect(fallGroup).not.toContain('rotate(90');
    expect(fallGroup).not.toContain('rotate(180');
    expect(fallGroup).not.toContain('rotate(270');
    expect(spacingGroup).toContain('c/c');
    expect(spacingGroup).not.toContain('rotate(90');
    expect(spacingGroup).not.toContain('rotate(180');
    expect(spacingGroup).not.toContain('rotate(270');
  });

  it('keeps the footprint editor affordance out of section views', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="section"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor()}
      />,
    );

    expect(markup).not.toContain('Edit footprint');
    expect(markup).not.toContain('House footprint editor');
  });

  it('switches the header control to Done while editing', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor({ isEditing: true })}
      />,
    );

    expect(markup).toContain('>Done<');
    expect(markup).not.toContain('Editing footprint');
  });

  it('suggests the largest architectural plan scale that fits the A3 sheet viewport', () => {
    const drawing = makeDrawingModule();

    expect(getSuggestedModuleDrawingScale({ view: 'plan', planModel: drawing.planModel, sectionModel: drawing.sectionModel })).toEqual({
      mode: 'fixed',
      ratio: 25,
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
      suggestedScale: { mode: 'fixed', ratio: 25 },
    });
  });

  it('reports fixed-scale diagnostics for the current plan and section boundaries', () => {
    const drawing = makeDrawingModule();
    const planDiagnostics = getModuleDrawingScaleDiagnostics({
      view: 'plan',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });
    const sectionDiagnostics = getModuleDrawingScaleDiagnostics({
      view: 'section',
      planModel: drawing.planModel,
      sectionModel: drawing.sectionModel,
    });

    expect(planDiagnostics.find((item) => item.scale.mode === 'fixed' && item.scale.ratio === 20)).toMatchObject({
      fits: false,
    });
    expect(planDiagnostics.find((item) => item.scale.mode === 'fixed' && item.scale.ratio === 25)).toMatchObject({
      fits: true,
    });
    expect(sectionDiagnostics.find((item) => item.scale.mode === 'fixed' && item.scale.ratio === 20)).toMatchObject({
      fits: true,
    });
    expect(sectionDiagnostics.find((item) => item.scale.mode === 'fixed' && item.scale.ratio === 25)).toMatchObject({
      fits: true,
    });
  });

  it('keeps section auto-scale on the largest fitting architectural scale after fit-frame refinements', () => {
    const drawing = makeDrawingModule();

    expect(getSuggestedModuleDrawingScale({ view: 'section', planModel: drawing.planModel, sectionModel: drawing.sectionModel })).toEqual({
      mode: 'fixed',
      ratio: 20,
    });
  });
});
