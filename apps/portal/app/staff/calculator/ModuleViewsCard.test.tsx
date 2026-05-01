import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { ObjectWorkbenchPlanOverlay } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import ModuleViewsCard, {
  ModuleDrawingRenderer,
  type HouseFootprintHandleId,
  getModuleDrawingScaleDiagnostics,
  getSuggestedModuleDrawingScale,
  resolvePlanSvgPointerFootprintPoint,
  resolveModuleDrawingScaleState,
} from './ModuleViewsCard';
import type { ModulePlanModel, ModuleSectionModel } from './moduleViews';

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

function makeGeometryPlanFixture(): GeometryPlanViewModel {
  return {
    family: 'mono',
    connectionType: 'soffit',
    roofForm: {
      mono: true,
      gable: false,
      box: false,
    },
    outline: [
      { x: 0, y: 0 },
      { x: 6000, y: 0 },
      { x: 6000, y: 3000 },
      { x: 0, y: 3000 },
    ],
    attachmentEdge: {
      start: { x: 0, y: 0 },
      end: { x: 6000, y: 0 },
    },
    house: {
      footprint: null,
      fasciaLine: null,
      roofEdgeLine: null,
      wallReferenceLine: null,
      surfaces: [],
      lines: [],
    },
    members: {
      posts: [],
      beams: [],
      ledgers: [],
      rafters: [
        {
          id: 'geometry-rafter',
          role: 'rafter',
          centerline: { start: { x: 1800, y: 250 }, end: { x: 1800, y: 2750 } },
          profile: { shape: 'rectangular', widthMm: 50, depthMm: 150, profileKey: '50x150' },
          lengthMm: 2500,
        },
      ],
      gutters: [],
      ridge: [],
      joiners: [],
    },
    surfaces: {
      roofPlanes: [
        {
          id: 'roof-plane-main',
          kind: 'roof_plane',
          boundary: [
            { x: 0, y: 0 },
            { x: 6000, y: 0 },
            { x: 6000, y: 3000 },
            { x: 0, y: 3000 },
          ],
        },
      ],
      roofCladding: [],
    },
    anchors: {
      primarySize: {
        length: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
        projection: { start: { x: 0, y: 0 }, end: { x: 0, y: 3000 } },
      },
      fall: null,
      rafterSpacing: null,
      ridgeLine: null,
      attachmentSide: {
        line: { start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } },
      },
    },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 6000,
      maxY: 3000,
      lengthMm: 6000,
      projectionMm: 3000,
    },
  };
}

function makeTopProjectionFixture(): GeometryTopProjectionViewModel {
  return {
    coordinateSpace: 'world_xy_mm',
    screenAxis: {
      x: 'world_x_left',
      y: 'world_y_down',
    },
    shapes: [
      {
        id: 'top-projection-house-roof',
        sourceObjectId: 'scene-house-roof',
        sourceId: 'solved-house-roof',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'roof',
        polygon: [
          { x: -500, y: -2200 },
          { x: 6500, y: -2200 },
          { x: 6500, y: 0 },
          { x: -500, y: 0 },
        ],
        zOrder: 10,
        zMin: 2400,
        zMax: 3100,
        metadata: {
          topProjectionRole: 'top_visible',
        },
      },
      {
        id: 'top-projection-context-footprint',
        sourceObjectId: 'house-footprint',
        sourceId: 'house-footprint',
        sourceType: 'house_reference',
        family: 'house',
        kind: 'footprint',
        polygon: [
          { x: -1500, y: -2600 },
          { x: 7000, y: -2600 },
          { x: 7000, y: 400 },
          { x: -1500, y: 400 },
        ],
        zOrder: 0,
        zMin: 0,
        zMax: 0,
        metadata: {
          topProjectionRole: 'context',
        },
      },
      {
        id: 'top-projection-house-roof-material',
        sourceObjectId: 'scene-house-roof-material',
        sourceId: 'solved-house-roof-material',
        sourceType: 'house_roof_material',
        family: 'house',
        kind: 'house_roof_material',
        polygon: [
          { x: -500, y: -2200 },
          { x: 6500, y: -2200 },
          { x: 6500, y: 0 },
          { x: -500, y: 0 },
        ],
        zOrder: 12,
        zMin: 2400,
        zMax: 3100,
        metadata: {
          topProjectionRole: 'top_visible',
        },
      },
      {
        id: 'top-projection-hidden-wall',
        sourceObjectId: 'scene-house-wall',
        sourceId: 'solved-house-wall',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'wall',
        polygon: [
          { x: -4000, y: -5000 },
          { x: -3000, y: -5000 },
          { x: -3000, y: -4500 },
          { x: -4000, y: -4500 },
        ],
        zOrder: 11,
        zMin: 0,
        zMax: 2400,
        metadata: {
          topProjectionRole: 'hidden_from_top',
        },
      },
      {
        id: 'top-projection-pergola-roof',
        sourceObjectId: 'scene-pergola-roof',
        sourceId: 'roof-plane-main',
        sourceType: 'roof_plane',
        family: 'pergola',
        kind: 'roof_plane',
        polygon: [
          { x: 500, y: 250 },
          { x: 6500, y: 250 },
          { x: 6500, y: 3250 },
          { x: 500, y: 3250 },
        ],
        zOrder: 50,
        zMin: 2400,
        zMax: 2600,
        metadata: {
          topProjectionRole: 'top_visible',
        },
      },
    ],
    extents: {
      minX: -500,
      minY: -2200,
      maxX: 6500,
      maxY: 3250,
      widthMm: 7000,
      heightMm: 5450,
    },
  };
}

function makeTopProjectionFixtureWithDeck(): GeometryTopProjectionViewModel {
  const base = makeTopProjectionFixture();
  return {
    ...base,
    shapes: [
      ...base.shapes,
      {
        id: 'top-projection-house-deck',
        sourceObjectId: 'scene-house-deck',
        sourceId: 'deck-1',
        sourceType: 'house_surface_solid',
        family: 'house',
        kind: 'deck',
        polygon: [
          { x: 0, y: 0 },
          { x: 6000, y: 0 },
          { x: 6000, y: 3000 },
          { x: 0, y: 3000 },
        ],
        zOrder: 20,
        zMin: 0,
        zMax: 250,
        metadata: {
          sourceId: 'deck-1',
          topProjectionRole: 'top_visible',
        },
      },
    ],
  };
}

function makeFootprintEditor(overrides: Partial<{
  isEditing: boolean;
  isContextHovered: boolean;
  surface: 'card' | 'sheet' | 'model';
  allowAttachmentSideCanvasSelect: boolean;
  allowResizeEdgeDrag: boolean;
  hoveredHandleId: HouseFootprintHandleId | null;
  activeHandleId: HouseFootprintHandleId | null;
  customPolygonOverride: ModulePlanModel['houseFootprintPolygon'] | null;
  customPolygonOpen: boolean;
  customPolygonConfirmedPointCount: number;
  customPolygonPreviewPointKind: 'pending' | 'hover' | null;
  customPolygonCloseReady: boolean;
  customPolygonCloseHovered: boolean;
}> = {}) {
  return {
    available: true,
    isEditing: overrides.isEditing ?? false,
    isContextHovered: overrides.isContextHovered ?? false,
    surface: overrides.surface ?? 'card',
    allowAttachmentSideCanvasSelect: overrides.allowAttachmentSideCanvasSelect ?? true,
    allowResizeEdgeDrag: overrides.allowResizeEdgeDrag ?? true,
    customPolygonOverride: overrides.customPolygonOverride,
    customPolygonOpen: overrides.customPolygonOpen,
    customPolygonConfirmedPointCount: overrides.customPolygonConfirmedPointCount,
    customPolygonPreviewPointKind: overrides.customPolygonPreviewPointKind,
    customPolygonCloseReady: overrides.customPolygonCloseReady,
    customPolygonCloseHovered: overrides.customPolygonCloseHovered,
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

function extractPolygonPoints(markup: string, dataAttribute: string, value: string): Array<{ x: number; y: number }> {
  const pattern = new RegExp(`points="([^"]+)"[^>]*${dataAttribute}="${value}"`);
  const match = markup.match(pattern);
  if (!match?.[1]) return [];
  return match[1].split(' ').map((pair) => {
    const [x, y] = pair.split(',');
    return {
      x: Number(x),
      y: Number(y),
    };
  });
}

function extractAllPolygonPoints(markup: string, dataAttribute: string, value: string): Array<Array<{ x: number; y: number }>> {
  const pattern = new RegExp(`points="([^"]+)"[^>]*${dataAttribute}="${value}"`, 'g');
  return [...markup.matchAll(pattern)].map((match) =>
    (match[1] ?? '').split(' ').map((pair) => {
      const [x, y] = pair.split(',');
      return {
        x: Number(x),
        y: Number(y),
      };
    }),
  );
}

function extractAllLinePoints(markup: string, dataAttribute: string, value: string): Array<Array<{ x: number; y: number }>> {
  const pattern = new RegExp(
    `<line[^>]*x1="([^"]+)"[^>]*y1="([^"]+)"[^>]*x2="([^"]+)"[^>]*y2="([^"]+)"[^>]*${dataAttribute}="${value}"`,
    'g',
  );
  return [...markup.matchAll(pattern)].map((match) => [
    {
      x: Number(match[1]),
      y: Number(match[2]),
    },
    {
      x: Number(match[3]),
      y: Number(match[4]),
    },
  ]);
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

function extractSvgTag(markup: string, ariaLabel: string): string {
  const labelIndex = markup.indexOf(`aria-label="${ariaLabel}"`);
  expect(labelIndex).toBeGreaterThanOrEqual(0);
  const start = markup.lastIndexOf('<svg', labelIndex);
  const end = markup.indexOf('>', labelIndex);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return markup.slice(start, end + 1);
}

function extractSvgNumberAttribute(svgTag: string, attr: string): number {
  const match = svgTag.match(new RegExp(`${attr}="([^"]+)"`));
  expect(match?.[1]).toBeTruthy();
  return Number.parseFloat(match?.[1] ?? '0');
}

function extractSvgStringAttribute(svgTag: string, attr: string): string {
  const match = svgTag.match(new RegExp(`${attr}="([^"]+)"`));
  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? '';
}

function parseSvgRect(value: string): { x: number; y: number; width: number; height: number } {
  const parts = value.split(/\s+/).map((part) => Number.parseFloat(part));
  expect(parts).toHaveLength(4);
  const [x, y, width, height] = parts as [number, number, number, number];
  return { x, y, width, height };
}

function extractHouseClipRect(markup: string): { x: number; y: number; width: number; height: number } {
  const clipStart = markup.indexOf('<clipPath');
  expect(clipStart).toBeGreaterThanOrEqual(0);
  const clipEnd = markup.indexOf('</clipPath>', clipStart);
  expect(clipEnd).toBeGreaterThan(clipStart);
  const clipMarkup = markup.slice(clipStart, clipEnd);
  const rectMatch = clipMarkup.match(/<rect[^>]*>/);
  expect(rectMatch?.[0]).toBeTruthy();
  const rectTag = rectMatch?.[0] ?? '';
  return {
    x: extractSvgNumberAttribute(rectTag, 'x'),
    y: extractSvgNumberAttribute(rectTag, 'y'),
    width: extractSvgNumberAttribute(rectTag, 'width'),
    height: extractSvgNumberAttribute(rectTag, 'height'),
  };
}

function expectRectCloseTo(actual: { x: number; y: number; width: number; height: number }, expected: { x: number; y: number; width: number; height: number }) {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
  expect(actual.width).toBeCloseTo(expected.width, 3);
  expect(actual.height).toBeCloseTo(expected.height, 3);
}

function expectPointerPointCloseTo(
  actual: ReturnType<typeof resolvePlanSvgPointerFootprintPoint>,
  expected: { alongM: number; depthM: number; formattedAlongM?: string; formattedDepthM?: string },
): void {
  expect(actual).not.toBeNull();
  expect(actual?.numeric.alongM).toBeCloseTo(expected.alongM, 6);
  expect(actual?.numeric.depthM).toBeCloseTo(expected.depthM, 6);
  expect(actual?.formatted.alongM).toBe(expected.formattedAlongM ?? String(expected.alongM));
  expect(actual?.formatted.depthM).toBe(expected.formattedDepthM ?? String(expected.depthM));
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
  it('converts plan SVG root pointer points to house footprint metres for every attachment side', () => {
    const model = makeDrawingModule().planModel!;
    const baseInput = {
      rotationCenter: { x: 30, y: 15 },
      rotationTurns: 0,
      footprintRect: { x: 0, y: 0, width: 60, height: 30 },
      scale: 10,
      lengthA: 6,
      spanA: 3,
      houseFootprintPreset: model.houseFootprintPreset,
      houseFootprintParams: model.houseFootprintParams,
    };

    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({ ...baseInput, attachmentSide: 'rear', rootPoint: { x: 20, y: -10 } }),
      { alongM: 2, depthM: 1 },
    );
    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({ ...baseInput, attachmentSide: 'front', rootPoint: { x: 40, y: 40 } }),
      { alongM: 2, depthM: 1 },
    );
    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({ ...baseInput, attachmentSide: 'left', rootPoint: { x: -20, y: 20 } }),
      { alongM: 1, depthM: 2 },
    );
    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({ ...baseInput, attachmentSide: 'right', rootPoint: { x: 80, y: 10 } }),
      { alongM: 1, depthM: 2 },
    );
  });

  it('converts plan SVG pointer points through drawing rotation and footprint offsets', () => {
    const model = makeDrawingModule().planModel!;
    const commonInput = {
      rotationCenter: { x: 30, y: 15 },
      footprintRect: { x: 0, y: 0, width: 60, height: 30 },
      scale: 10,
      attachmentSide: 'rear' as const,
      lengthA: 6,
      spanA: 3,
      houseFootprintPreset: model.houseFootprintPreset,
    };

    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({
        ...commonInput,
        rotationTurns: 1,
        rootPoint: { x: 5, y: 25 },
        houseFootprintParams: model.houseFootprintParams,
      }),
      { alongM: 2, depthM: 1 },
    );
    expectPointerPointCloseTo(
      resolvePlanSvgPointerFootprintPoint({
        ...commonInput,
        rotationTurns: 0,
        rootPoint: { x: 25, y: -12.5 },
        houseFootprintParams: {
          ...model.houseFootprintParams,
          widthM: '6',
          offsetXM: '0.5',
          setbackM: '0.25',
        },
      }),
      { alongM: 2, depthM: 1 },
    );
  });

  it('does not resolve plan SVG pointer points for hip-corner plans', () => {
    const model = makeDrawingModule().planModel!;

    expect(
      resolvePlanSvgPointerFootprintPoint({
        rootPoint: { x: 20, y: -10 },
        rotationCenter: { x: 30, y: 15 },
        rotationTurns: 0,
        footprintRect: { x: 0, y: 0, width: 60, height: 30 },
        scale: 10,
        attachmentSide: 'rear',
        lengthA: 6,
        spanA: 3,
        houseFootprintPreset: model.houseFootprintPreset,
        houseFootprintParams: model.houseFootprintParams,
        isHipCorner: true,
      }),
    ).toBeNull();
  });

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

  it('renders plan model space with a content-sized SVG viewport', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module plan view');

    expect(svgTag).toContain('data-model-space-svg="plan"');
    expect(svgTag).toContain('data-model-space-view-box=');
    expect(svgTag).toContain('data-model-space-world-box=');
    expect(svgTag).toContain('data-model-space-focus-box=');
    expect(markup).toContain('data-model-space-focus-target="true"');
    expect(svgTag).toContain('overflow="visible"');
    expect(svgTag).not.toContain('viewBox="0 0 120 90"');
    expect(extractSvgNumberAttribute(svgTag, 'width')).toBeGreaterThan(120);
    expect(extractSvgNumberAttribute(svgTag, 'height')).toBeGreaterThan(90);
    expect(markup).not.toContain('data-debug-crop=');
  });

  it('sizes geometry-ready plan model space from top projection extents', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module plan view');
    const viewBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-view-box'));
    const focusBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-focus-box'));
    const worldBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-world-box'));

    expectRectCloseTo(focusBox, { x: -12, y: -32.4, width: 96, height: 77.4 });
    expectRectCloseTo(viewBox, focusBox);
    expect(extractSvgStringAttribute(svgTag, 'data-model-space-render-contract')).toBe('top_projection_only');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-parity-status')).toBe('pass');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-screen-axis')).toBe('world_x_left_world_y_down');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-top-visible-count')).toBe('3');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-context-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-hidden-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-rendered-count')).toBe('2');
    expect(extractSvgStringAttribute(svgTag, 'data-top-projection-hidden-rendered-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-committed-top-projection-body-count')).toBe('2');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-committed-top-projection-object-count')).toBe('2');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-rendered-context-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-suppressed-context-body-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-suppressed-top-visible-body-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-object-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-visual-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-semantic-owner-count')).toBe('0');
    expect(markup).not.toContain('data-plan-layer="contextLines"');
    expect(markup).not.toContain('data-plan-attachment-edge="geometry"');
    expect(markup).not.toContain('data-plan-fall-direction=');
    expect(markup).not.toContain('data-plan-primary-dim=');
    expect(worldBox.x).toBeLessThanOrEqual(focusBox.x);
    expect(worldBox.y).toBeLessThanOrEqual(focusBox.y);
    expect(worldBox.x + worldBox.width).toBeGreaterThanOrEqual(focusBox.x + focusBox.width);
    expect(worldBox.y + worldBox.height).toBeGreaterThanOrEqual(focusBox.y + focusBox.height);
  });

  it('renders model-space pergola visuals and hit targets from the top projection', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        currentPergolaId="pergola-1"
        onPergolaSelect={() => undefined}
      />,
    );

    const projectedRoofPoints = extractPolygonPoints(
      markup,
      'data-plan-top-projection-shape',
      'top-projection-pergola-roof',
    );
    const hitPoints = extractPolygonPoints(markup, 'data-pergola-shape-hit', 'pergola-1');

    expect(markup).toContain('data-top-projection-source-object-id="scene-pergola-roof"');
    expect(markup).toContain('data-top-projection-source-type="roof_plane"');
    expect(markup).toContain('data-top-projection-role="top_visible"');
    expect(markup).toContain('data-top-projection-z-min="2400"');
    expect(markup).toContain('data-top-projection-z-max="2600"');
    expect(markup).toContain('data-top-projection-screen-axis="world_x_left_world_y_down"');
    expect(markup).not.toContain('data-plan-top-projection-shape="top-projection-house-roof-material"');
    expect(markup).not.toContain('data-plan-top-projection-shape="top-projection-context-footprint"');
    expect(markup).not.toContain('data-plan-top-projection-shape="top-projection-hidden-wall"');
    expect(markup).not.toContain('data-top-projection-role="hidden_from_top"');
    expect(markup).toContain('data-pergola-shape-hit-source="top_projection"');
    expect(hitPoints).toEqual(projectedRoofPoints);
  });

  it('uses top projection bodies as the single committed visual source while keeping object hits aligned', () => {
    const drawing = makeDrawingModule();
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'geometry_projection',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'top_projection_committed',
          geometrySourceId: 'house_surface_solid:deck-1',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixtureWithDeck()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module plan view');
    const projectedDeckPoints = extractPolygonPoints(markup, 'data-plan-top-projection-shape', 'top-projection-house-deck');
    const deckHitPoints = extractPolygonPoints(markup, 'data-object-workbench-shape-hit', 'deck:deck-1');

    expect(markup).toContain('data-plan-top-projection-shape="top-projection-house-deck"');
    expect(markup).not.toContain('data-plan-top-projection-shape="top-projection-house-roof-material"');
    expect(markup).not.toContain('data-plan-top-projection-shape="top-projection-context-footprint"');
    expect(markup).toContain('data-object-workbench-shape="deck:deck-1"');
    expect(markup).toContain('data-object-workbench-shape-visual="false"');
    expect(markup).toContain('data-object-workbench-shape-hit="deck:deck-1"');
    expect(markup).toContain('data-plan-layer="committedBodies"');
    expect(markup).toContain('data-plan-layer="hitTargets"');
    expect(markup).toContain('data-plan-layer="selectionOutlines"');
    expect(deckHitPoints).toEqual(projectedDeckPoints);
    expect(extractSvgStringAttribute(svgTag, 'data-plan-rendered-context-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-suppressed-context-body-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-object-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-legacy-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-geometry-fallback-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-top-projection-context-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-top-projection-committed-overlay-body-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-visual-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-semantic-owner-count')).toBe('0');
  });

  it('drops stale geometry-derived selected deck overlays in projection-only model space', () => {
    const drawing = makeDrawingModule();
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'geometry_projection',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 12, y: 8 },
            { x: 18, y: 8 },
            { x: 18, y: 11 },
            { x: 12, y: 11 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry_derived',
          geometrySourceId: 'stale-floating-deck',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixtureWithDeck()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module plan view');
    const projectedDeckPoints = extractPolygonPoints(markup, 'data-plan-top-projection-shape', 'top-projection-house-deck');
    const staleDeckHitPoints = extractPolygonPoints(markup, 'data-object-workbench-shape-hit', 'deck:deck-1');

    expect(projectedDeckPoints.length).toBeGreaterThan(0);
    expect(staleDeckHitPoints).toEqual([]);
    expect(markup).not.toContain('stale-floating-deck');
    expect(markup).not.toContain('data-plan-render-source="geometry_derived"');
    expect(extractSvgStringAttribute(svgTag, 'data-model-space-render-contract')).toBe('top_projection_only');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-geometry-fallback-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-visual-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-semantic-owner-count')).toBe('0');
  });

  it('keeps selected house overlays on the committed top projection body instead of the reference footprint', () => {
    const drawing = makeDrawingModule();
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'geometry_projection',
      shapes: [
        {
          ownerKind: 'footprint',
          ownerId: 'house-main',
          polygon: [
            { x: -0.5, y: -2.2 },
            { x: 6.5, y: -2.2 },
            { x: 6.5, y: 0 },
            { x: -0.5, y: 0 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'top_projection_committed',
          geometrySourceId: 'top-projection-house-roof',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module plan view');
    const projectedHousePoints = extractPolygonPoints(markup, 'data-plan-top-projection-shape', 'top-projection-house-roof');
    const houseSelectionPoints = extractPolygonPoints(markup, 'data-object-workbench-selection-outline', 'footprint:house-main');
    const houseHitPoints = extractPolygonPoints(markup, 'data-object-workbench-shape-hit', 'footprint:house-main');
    const mirroredReferencePoints = extractPolygonPoints(markup, 'data-plan-top-projection-shape', 'top-projection-context-footprint');

    expect(markup).toContain('data-plan-render-source="top_projection_committed"');
    expect(markup).toContain('data-plan-visual-owner="house"');
    expect(mirroredReferencePoints).toEqual([]);
    expect(houseSelectionPoints).toEqual(projectedHousePoints);
    expect(houseHitPoints).toEqual(projectedHousePoints);
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-legacy-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-geometry-fallback-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-top-projection-context-overlay-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-visible-top-projection-committed-overlay-body-count')).toBe('1');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-visual-body-count')).toBe('0');
    expect(extractSvgStringAttribute(svgTag, 'data-plan-duplicate-semantic-owner-count')).toBe('0');
  });

  it('does not render legacy-looking model-space plan geometry when solved geometry is unsupported', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpaceTopProjection={makeTopProjectionFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="legacy_unsupported_family"
        currentPergolaId="pergola-1"
        onPergolaSelect={() => undefined}
      />,
    );

    expect(markup).not.toContain('data-plan-primary-fill="true"');
    expect(markup).not.toContain('data-plan-top-projection-shape=');
    expect(markup).not.toContain('data-pergola-shape-hit-source="legacy"');
  });

  it('renders section model space with a content-sized SVG viewport', () => {
    const drawing = makeDrawingModule();
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
      />,
    );

    const svgTag = extractSvgTag(markup, 'Module section view');

    expect(svgTag).toContain('data-model-space-svg="section"');
    expect(svgTag).toContain('data-model-space-view-box=');
    expect(svgTag).toContain('data-model-space-world-box=');
    expect(svgTag).toContain('data-model-space-focus-box=');
    expect(markup).toContain('data-model-space-focus-target="true"');
    expect(svgTag).toContain('overflow="visible"');
    expect(svgTag).not.toContain('viewBox="0 0 120 90"');
    expect(extractSvgNumberAttribute(svgTag, 'width')).toBeGreaterThan(120);
    expect(extractSvgNumberAttribute(svgTag, 'height')).toBeGreaterThan(90);
    expect(markup).not.toContain('data-debug-crop=');
  });

  it('keeps oversized context out of the rendered plan model-space viewport size', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'oversized-context',
            kind: 'footprint',
            boundary: [
              { x: -80, y: -60 },
              { x: 140, y: -60 },
              { x: 140, y: 0 },
              { x: -80, y: 0 },
            ],
          },
        ],
        lines: [],
      },
    };
    const baseMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
      />,
    );
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
      />,
    );

    const baseSvgTag = extractSvgTag(baseMarkup, 'Module plan view');
    const svgTag = extractSvgTag(markup, 'Module plan view');
    const viewBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-view-box'));
    const worldBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-world-box'));
    const focusBox = parseSvgRect(extractSvgStringAttribute(svgTag, 'data-model-space-focus-box'));

    expect(markup).toContain('data-model-space-focus-target="true"');
    expect(viewBox).toEqual(focusBox);
    expect(worldBox.width).toBeGreaterThan(viewBox.width);
    expect(worldBox.height).toBeGreaterThan(viewBox.height);
    expectRectCloseTo(extractHouseClipRect(markup), worldBox);
    expect(extractSvgNumberAttribute(svgTag, 'width')).toBe(extractSvgNumberAttribute(baseSvgTag, 'width'));
    expect(extractSvgNumberAttribute(svgTag, 'height')).toBe(extractSvgNumberAttribute(baseSvgTag, 'height'));
  });

  it('keeps card and sheet plan house clipping unchanged', () => {
    const drawing = makeDrawingModule();
    const cardMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="card"
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

    expect(extractHouseClipRect(cardMarkup)).toEqual({ x: 0, y: 0, width: 120, height: 90 });
    expect(extractHouseClipRect(sheetMarkup)).toEqual({ x: 0, y: 0, width: 120, height: 86 });
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

  it('renders semantic house context overlays in plan drawings', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -1.8 },
              { x: 6, y: -1.8 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'house-attachment-zone',
            kind: 'attachment_zone',
            boundary: [
              { x: 0, y: -0.05 },
              { x: 6, y: -0.05 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
        ],
        lines: [
          {
            id: 'house-gutter',
            kind: 'gutter',
            line: { start: { x: 0, y: -0.45 }, end: { x: 6, y: -0.45 } },
          },
          {
            id: 'house-roof-feature',
            kind: 'roof_feature',
            line: { start: { x: 0, y: -1.1 }, end: { x: 6, y: -1.1 } },
          },
          {
            id: 'house-attachment-target',
            kind: 'attachment_target',
            line: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
          },
        ],
      },
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
      />,
    );

    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-house-plan-surface="attachment_zone"');
    expect(markup).toContain('data-house-plan-line="gutter"');
    expect(markup).toContain('data-house-plan-line="roof_feature"');
    expect(markup).toContain('data-house-plan-line="attachment_target"');
  });

  it('renders semantic house context overlays in section drawings', () => {
    const drawing = makeDrawingModule();
    const sectionModel: ModuleSectionModel = {
      ...drawing.sectionModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-wall',
            kind: 'wall',
            boundary: [
              { x: 0, y: 0 },
              { x: 0.03, y: 0 },
              { x: 0.03, y: 2.4 },
              { x: 0, y: 2.4 },
            ],
          },
          {
            id: 'house-attachment-zone',
            kind: 'attachment_zone',
            boundary: [
              { x: -0.02, y: 2.22 },
              { x: 0.02, y: 2.22 },
              { x: 0.02, y: 2.4 },
              { x: -0.02, y: 2.4 },
            ],
          },
        ],
        lines: [
          {
            id: 'house-gutter',
            kind: 'gutter',
            line: { start: { x: -0.45, y: 2.4 }, end: { x: -0.45, y: 2.4 } },
          },
          {
            id: 'house-roof-feature',
            kind: 'roof_feature',
            line: { start: { x: -0.55, y: 2.9 }, end: { x: 0.15, y: 2.65 } },
          },
          {
            id: 'house-attachment-target',
            kind: 'attachment_target',
            line: { start: { x: 0, y: 2.4 }, end: { x: 0, y: 2.4 } },
          },
        ],
      },
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="section"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={sectionModel}
      />,
    );

    expect(markup).toContain('data-house-section-surface="wall"');
    expect(markup).toContain('data-house-section-surface="attachment_zone"');
    expect(markup).toContain('data-house-section-line="gutter"');
    expect(markup).toContain('data-house-section-line="roof_feature"');
    expect(markup).toContain('data-house-section-line="attachment_target"');
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

  it('keeps model-space plan orientation aligned to geometry instead of sheet rotation', () => {
    const drawing = makeDrawingModule({ drawingRotationQuarterTurns: 1 });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
      />,
    );

    expect(markup).not.toContain('rotate(90');
    expect(markup).not.toContain('rotate(180');
    expect(markup).not.toContain('rotate(270');
  });

  it('renders house-mode model space as a birdseye projection without flipping sheet or card behavior', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -2 },
              { x: 2, y: -2 },
              { x: 2, y: 0 },
              { x: 0, y: 0 },
            ],
          },
        ],
        lines: [
          {
            id: 'wall-1',
            kind: 'wall_segment',
            line: { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } },
            metadata: { sourceEdgeId: 'footprint-edge-1' },
          },
        ],
      },
    };
    const houseOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'preset_derived',
      shapes: [
        {
          ownerKind: 'opening',
          ownerId: 'opening-1',
          polygon: [
            { x: 0.4, y: 0 },
            { x: 1.4, y: 0 },
            { x: 1.4, y: -0.12 },
            { x: 0.4, y: -0.12 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: {
            kind: 'opening',
            hostEdgeId: 'footprint-edge-1',
            hostEdgeStart: { x: 0, y: 0 },
            hostEdgeEnd: { x: 2, y: 0 },
            hostSpanM: 2,
            openingWidthM: 1,
            offsetAlongWallM: 0.4,
            minOffsetAlongWallM: 0,
            maxOffsetAlongWallM: 1,
          },
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry',
          geometrySourceId: 'opening-1-marker',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };

    const modelMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        displayMode="house"
        objectWorkbenchPlanOverlay={houseOverlay}
      />,
    );
    const cardMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        objectWorkbenchPlanOverlay={houseOverlay}
      />,
    );

    const modelFootprintPoints = extractPolygonPoints(modelMarkup, 'data-house-plan-surface', 'footprint');
    const cardFootprintPoints = extractPolygonPoints(cardMarkup, 'data-house-plan-surface', 'footprint');
    const modelOpeningPoints = extractPolygonPoints(modelMarkup, 'data-object-workbench-shape', 'opening:opening-1');

    expect(modelFootprintPoints[0]?.y).toBeLessThan(modelFootprintPoints[2]?.y);
    expect(cardFootprintPoints[0]?.y).toBeLessThan(cardFootprintPoints[2]?.y);
    expect(modelOpeningPoints[0]?.y).toBeGreaterThan(modelOpeningPoints[2]?.y);
  });

  it('keeps house-mode roof and gutter geometry inside the projected model-space clip box', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -6 },
              { x: 6, y: -6 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'roof-top',
            kind: 'roof',
            boundary: [
              { x: 0, y: -6 },
              { x: 6, y: -6 },
              { x: 6, y: -4 },
              { x: 0, y: -4 },
            ],
          },
          {
            id: 'roof-spine',
            kind: 'roof',
            boundary: [
              { x: 0, y: -4 },
              { x: 3, y: -4 },
              { x: 3, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'roof-bottom',
            kind: 'roof',
            boundary: [
              { x: 3, y: -2 },
              { x: 6, y: -2 },
              { x: 6, y: 0 },
              { x: 3, y: 0 },
            ],
          },
        ],
        lines: [
          {
            id: 'gutter-bottom',
            kind: 'gutter',
            line: { start: { x: 0, y: -6 }, end: { x: 6, y: -6 } },
          },
          {
            id: 'wall-bottom',
            kind: 'wall_segment',
            line: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
          },
        ],
      },
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        displayMode="house"
      />,
    );

    const clipRect = extractHouseClipRect(markup);
    const roofPolygons = extractAllPolygonPoints(markup, 'data-house-plan-surface', 'roof');
    const gutterLines = extractAllLinePoints(markup, 'data-house-plan-line', 'gutter');
    const worldBox = parseSvgRect(extractSvgStringAttribute(extractSvgTag(markup, 'Module plan view'), 'data-model-space-world-box'));

    expectRectCloseTo(clipRect, worldBox);
    expect(roofPolygons.length).toBeGreaterThan(0);
    expect(gutterLines.length).toBeGreaterThan(0);

    for (const polygon of roofPolygons) {
      for (const point of polygon) {
        expect(point.x).toBeGreaterThanOrEqual(clipRect.x);
        expect(point.x).toBeLessThanOrEqual(clipRect.x + clipRect.width);
        expect(point.y).toBeGreaterThanOrEqual(clipRect.y);
        expect(point.y).toBeLessThanOrEqual(clipRect.y + clipRect.height);
      }
    }

    for (const line of gutterLines) {
      for (const point of line) {
        expect(point.x).toBeGreaterThanOrEqual(clipRect.x);
        expect(point.x).toBeLessThanOrEqual(clipRect.x + clipRect.width);
        expect(point.y).toBeGreaterThanOrEqual(clipRect.y);
        expect(point.y).toBeLessThanOrEqual(clipRect.y + clipRect.height);
      }
    }
  });

  it('expands the house-mode model-space focus box to the projected house geometry', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -6 },
              { x: 6, y: -6 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'roof-main',
            kind: 'roof',
            boundary: [
              { x: 0, y: -6 },
              { x: 6, y: -6 },
              { x: 6, y: -4 },
              { x: 0, y: -4 },
            ],
          },
        ],
        lines: [],
      },
    };

    const pergolaMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
      />,
    );
    const houseMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        displayMode="house"
      />,
    );

    const pergolaFocusBox = parseSvgRect(extractSvgStringAttribute(extractSvgTag(pergolaMarkup, 'Module plan view'), 'data-model-space-focus-box'));
    const houseFocusBox = parseSvgRect(extractSvgStringAttribute(extractSvgTag(houseMarkup, 'Module plan view'), 'data-model-space-focus-box'));

    expect(houseFocusBox.height).toBeGreaterThan(pergolaFocusBox.height);
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
    expect(markup).toContain('aria-label="House footprint mode"');
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

  it('renders custom outline mode without preset resize handles in the card editor', () => {
    const drawing = makeDrawingModule();
    const planModel = {
      ...drawing.planModel!,
      houseFootprintMode: 'custom_polygon' as const,
      houseFootprintPolygon: [
        { alongM: '0', depthM: '2.4' },
        { alongM: '6', depthM: '2.4' },
        { alongM: '6', depthM: '0' },
        { alongM: '3', depthM: '0' },
        { alongM: '3', depthM: '1.2' },
        { alongM: '0', depthM: '1.2' },
      ],
    };

    const markup = renderToStaticMarkup(
      <ModuleViewsCard
        moduleLabel="M1"
        view="plan"
        onViewChange={() => undefined}
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        footprintEditor={makeFootprintEditor({ isEditing: true })}
      />,
    );

    expect(markup).toContain('aria-label="House footprint mode"');
    expect(markup).toContain('aria-label="House footprint preset"');
    expect(markup).not.toContain('data-footprint-handle="bandDepth"');
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

  it('suppresses model-space footprint canvas hits when the interaction capabilities are disabled', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'recess_left' });
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        footprintEditor={makeFootprintEditor({
          surface: 'model',
          isEditing: true,
          allowAttachmentSideCanvasSelect: false,
          allowResizeEdgeDrag: false,
          activeHandleId: 'bandDepth',
        })}
      />,
    );

    expect(markup).not.toContain('data-footprint-edge=');
    expect(markup).not.toContain('data-footprint-resize-edge-hit=');
    expect(markup).not.toContain('data-footprint-resize-edge=');
    expect(markup).toContain('Band depth: 1.80m');
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
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
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

  it('renders object-workbench deck targets above the pergola plan fill in model space', () => {
    const drawing = makeDrawingModule();
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'geometry_projection',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry',
          geometrySourceId: 'deck-1',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };
    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    const pergolaFillIndex = markup.indexOf('data-plan-primary-fill="true"');
    const deckHitIndex = markup.indexOf('data-object-workbench-shape-hit="deck:deck-1"');
    expect(pergolaFillIndex).toBeGreaterThanOrEqual(0);
    expect(deckHitIndex).toBeGreaterThan(pergolaFillIndex);
  });

  it('uses the object-workbench deck overlay as the single house-mode plan deck body', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -3 },
              { x: 6, y: -3 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'deck-1',
            kind: 'deck',
            boundary: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 3 },
              { x: 0, y: 3 },
            ],
          },
        ],
        lines: [],
      },
    };
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'preset_derived',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry',
          geometrySourceId: 'deck-1',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        displayMode="house"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    expect(markup).toContain('data-object-workbench-shape="deck:deck-1"');
    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).not.toContain('data-house-plan-surface="deck"');
  });

  it('hides semantic and object-workbench deck visuals when deck visibility is off', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseContext: {
        surfaces: [
          {
            id: 'house-footprint',
            kind: 'footprint',
            boundary: [
              { x: 0, y: -3 },
              { x: 6, y: -3 },
              { x: 6, y: 0 },
              { x: 0, y: 0 },
            ],
          },
          {
            id: 'deck-1',
            kind: 'deck',
            boundary: [
              { x: 0, y: 0 },
              { x: 6, y: 0 },
              { x: 6, y: 3 },
              { x: 0, y: 3 },
            ],
          },
        ],
        lines: [],
      },
    };
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'preset_derived',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry',
          geometrySourceId: 'deck-1',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [],
      customEdgeCandidates: [],
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        displayMode="house"
        visibility={{ house: true, pergolas: true, decks: false, openings: true }}
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
      />,
    );

    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).not.toContain('data-house-plan-surface="deck"');
    expect(markup).not.toContain('data-object-workbench-shape="deck:deck-1"');
    expect(markup).not.toContain('data-object-workbench-shape-hit="deck:deck-1"');
  });

  it('suppresses the committed deck body and dimensions while a deck preview is active', () => {
    const drawing = makeDrawingModule();
    const objectWorkbenchPlanOverlay: ObjectWorkbenchPlanOverlay = {
      housePolygonSource: 'preset_derived',
      shapes: [
        {
          ownerKind: 'deck',
          ownerId: 'deck-1',
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 6, y: 3 },
            { x: 0, y: 3 },
          ],
          detailSegments: [],
          selected: true,
          custom: false,
          muted: false,
          invalid: false,
          invalidMessage: null,
          deckInteraction: null,
          openingInteraction: null,
          deckDragEligibility: null,
          openingDragEligibility: null,
          source: 'geometry',
          geometrySourceId: 'deck-1',
          renderStatus: 'geometry_ready',
        },
      ],
      presetAnnotations: [
        {
          id: 'deck-width',
          ownerKind: 'deck',
          ownerId: 'deck-1',
          fieldKey: 'widthM',
          displayValue: '6.00m',
          witnessStart: { x: 0, y: 0 },
          witnessEnd: { x: 6, y: 0 },
          lineStart: { x: 0, y: -0.6 },
          lineEnd: { x: 6, y: -0.6 },
          emphasis: 'driving',
        } as any,
      ],
      customEdgeCandidates: [],
    };

    const markup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        modelSpacePergolaGeometry={makeGeometryPlanFixture()}
        modelSpacePergolaRenderSource="geometry"
        modelSpacePergolaRenderStatus="geometry_ready"
        objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
        objectWorkbenchPreviewOverlay={
          {
            ownerKind: 'deck',
            ownerId: 'deck-1',
            polygon: [
              { x: 0.5, y: 0.5 },
              { x: 6.5, y: 0.5 },
              { x: 6.5, y: 3.5 },
              { x: 0.5, y: 3.5 },
            ],
            bodyState: 'snapped',
            anchorPoint: { x: 3.5, y: 2 },
            lockedCornerPoint: null,
            endCatchPoint: null,
            referenceGuide: null,
            targetHighlights: [],
          } as any
        }
      />,
    );

    expect(markup).toContain('data-object-workbench-shape="deck:deck-1"');
    expect(markup).toContain('data-object-workbench-shape-preview-suppressed="true"');
    expect(markup).toContain('data-object-workbench-shape-hit-preview-suppressed="true"');
    expect(markup).toContain('data-object-workbench-preview-shape="deck-1"');
    expect(markup).not.toContain('data-object-workbench-plan-dimension="deck-width"');
  });

  it('renders custom draw preview edges and vertex aid markers in model space', () => {
    const drawing = makeDrawingModule();
    const hoverMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        footprintEditor={makeFootprintEditor({
          surface: 'model',
          isEditing: true,
          customPolygonOverride: [
            { alongM: '0', depthM: '0' },
            { alongM: '2', depthM: '0' },
            { alongM: '2', depthM: '1' },
            { alongM: '0', depthM: '1' },
          ],
          customPolygonOpen: true,
          customPolygonConfirmedPointCount: 3,
          customPolygonPreviewPointKind: 'hover',
          customPolygonCloseReady: true,
          customPolygonCloseHovered: true,
        })}
      />,
    );
    const pendingMarkup = renderToStaticMarkup(
      <ModuleDrawingRenderer
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        presentation="model"
        footprintEditor={makeFootprintEditor({
          surface: 'model',
          isEditing: true,
          customPolygonOverride: [
            { alongM: '0', depthM: '0' },
            { alongM: '2', depthM: '0' },
            { alongM: '2', depthM: '1' },
          ],
          customPolygonOpen: true,
          customPolygonConfirmedPointCount: 2,
          customPolygonPreviewPointKind: 'pending',
        })}
      />,
    );

    expect(hoverMarkup).toContain('data-footprint-custom-edge-kind="confirmed"');
    expect(hoverMarkup).toContain('data-footprint-custom-preview-edge="hover"');
    expect(hoverMarkup).toContain('data-footprint-custom-preview-vertex="hover"');
    expect(hoverMarkup).toContain('data-footprint-custom-latest-vertex="true"');
    expect(hoverMarkup).toContain('data-footprint-custom-close-target="0"');
    expect(hoverMarkup).toContain('data-footprint-custom-close-hovered="true"');
    expect(pendingMarkup).toContain('data-footprint-custom-preview-edge="pending"');
    expect(pendingMarkup).toContain('data-footprint-custom-preview-vertex="pending"');
  });

  it('hides preset footprint affordances while a model-space draw outline draft is open', () => {
    const drawing = makeDrawingModule({ houseFootprintPreset: 'recess_left' });
    const renderDraft = (customPolygonOverride: ModulePlanModel['houseFootprintPolygon'], confirmedPointCount: number) =>
      renderToStaticMarkup(
        <ModuleDrawingRenderer
          view="plan"
          status="ready"
          planModel={drawing.planModel}
          sectionModel={drawing.sectionModel}
          presentation="model"
          footprintEditor={makeFootprintEditor({
            surface: 'model',
            isEditing: true,
            customPolygonOverride,
            customPolygonOpen: true,
            customPolygonConfirmedPointCount: confirmedPointCount,
          })}
        />,
      );

    const emptyDraftMarkup = renderDraft([], 0);
    expect(emptyDraftMarkup).not.toContain('data-footprint-edge=');
    expect(emptyDraftMarkup).not.toContain('data-footprint-resize-edge-hit=');
    expect(emptyDraftMarkup).not.toContain('data-footprint-custom-vertex=');

    const onePointMarkup = renderDraft([{ alongM: '0', depthM: '0' }], 1);
    expect(onePointMarkup).toContain('data-footprint-custom-vertex="0"');
    expect(onePointMarkup).toContain('data-footprint-custom-latest-vertex="true"');
    expect(onePointMarkup).not.toContain('data-footprint-edge=');
    expect(onePointMarkup).not.toContain('data-footprint-resize-edge-hit=');

    const threePointMarkup = renderDraft(
      [
        { alongM: '0', depthM: '0' },
        { alongM: '2', depthM: '0' },
        { alongM: '2', depthM: '1' },
      ],
      3,
    );
    expect(threePointMarkup).toContain('data-footprint-custom-edge-kind="confirmed"');
    expect(threePointMarkup).not.toContain('data-footprint-resize-edge-hit=');
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
