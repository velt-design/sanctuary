import { renderToStaticMarkup } from 'react-dom/server';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import { buildPlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { dispatchPointer, renderIntoDocument } from '../../../../../test/reactHarness';
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

function makePlanModelWithHouseContext(): ModulePlanModel {
  const drawing = makeDrawingModule();
  return {
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
      ],
      lines: [
        {
          id: 'house-attachment-target',
          kind: 'attachment_target',
          line: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } },
        },
      ],
    },
  };
}

function makePlanModelWithLargeHouseContext(): ModulePlanModel {
  return {
    ...makePlanModelWithHouseContext(),
    houseContext: {
      surfaces: [
        {
          id: 'house-footprint-large',
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
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => {
    button.click();
  });
}

function installSvgPointMock(svg: SVGSVGElement): void {
  Object.defineProperty(svg, 'getScreenCTM', {
    configurable: true,
    value: () => ({
      inverse: () => ({}),
    }),
  });
  Object.defineProperty(svg, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform(this: { x: number; y: number }) {
        return { x: this.x, y: this.y };
      },
    }),
  });
}

function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function parseModelSpaceBox(value: string | undefined): { x: number; y: number; width: number; height: number } {
  const parts = value?.split(/\s+/).map((part) => Number.parseFloat(part)) ?? [];
  expect(parts).toHaveLength(4);
  const [x, y, width, height] = parts as [number, number, number, number];
  return { x, y, width, height };
}

function expectedFitForSvgFocus(input: {
  scrollerWidth: number;
  scrollerHeight: number;
  frameWidth: number;
  frameHeight: number;
  svg: SVGSVGElement;
}): { zoom: number; panX: number; panY: number } {
  const viewBox = parseModelSpaceBox(input.svg.dataset.modelSpaceViewBox);
  const focusBox = parseModelSpaceBox(input.svg.dataset.modelSpaceFocusBox);
  const svgWidth = Number.parseFloat(input.svg.getAttribute('width') ?? '0');
  const svgHeight = Number.parseFloat(input.svg.getAttribute('height') ?? '0');
  const svgLeft = Math.max(0, (input.frameWidth - svgWidth) / 2);
  const svgTop = Math.max(0, (input.frameHeight - svgHeight) / 2);
  const focusRect = {
    x: svgLeft + (focusBox.x - viewBox.x) * (svgWidth / viewBox.width),
    y: svgTop + (focusBox.y - viewBox.y) * (svgHeight / viewBox.height),
    width: focusBox.width * (svgWidth / viewBox.width),
    height: focusBox.height * (svgHeight / viewBox.height),
  };
  const zoom = Math.min(Math.max(Math.min((input.scrollerWidth - 48) / focusRect.width, (input.scrollerHeight - 48) / focusRect.height), 0.25), 4);
  return {
    zoom,
    panX: input.scrollerWidth / 2 - (focusRect.x + focusRect.width / 2) * zoom,
    panY: input.scrollerHeight / 2 - (focusRect.y + focusRect.height / 2) * zoom,
  };
}

describe('ModelSpaceViewport', () => {
  it('renders plan controls for the live model-space configurator', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const assembly = buildAssemblyModel({
      id: drawing.id,
      label: 'M1 - Pitched - 6m x 3m',
      moduleIndex: 0,
      moduleInput: drawing.input,
      moduleResult: drawing.result,
      planModel,
      sectionModel: drawing.sectionModel,
    });

    const markup = renderToStaticMarkup(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel(assembly)}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('aria-label="Plan model space viewport"');
    expect(markup).toContain('Reset');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:lengthA"');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:spanA"');
    expect(markup).toContain('data-editable-field-id="plan:lengthA"');
    expect(markup).toContain('data-editable-field-id="plan:spanA"');
    expect(markup).toContain('data-footprint-edge="rear"');
    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-house-plan-line="attachment_target"');
    expect(markup).not.toContain('Live plan viewport');
    expect(markup).not.toContain('House footprint mode');
    expect(markup).not.toContain('House footprint');
    expect(markup).not.toContain('House type');
    expect(markup).not.toContain('Rotate -90');
  });

  it('renders custom footprint vertices and edge insertion targets in model space', () => {
    const drawing = makeDrawingModule();
    const planModel: ModulePlanModel = {
      ...drawing.planModel!,
      houseFootprintMode: 'custom_polygon',
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
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-footprint-custom-vertex="0"');
    expect(markup).toContain('data-footprint-custom-vertex="5"');
    expect(markup).toContain('data-footprint-custom-edge-hit="0"');
    expect(markup).not.toContain('data-footprint-resize-edge-hit="bandDepth"');
  });

  it('renders section mode as a read-only model-space drawing', () => {
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

    expect(markup).toContain('aria-label="Section model space viewport"');
    expect(markup).toContain('aria-label="Module section view"');
    expect(markup).not.toContain('data-plan-resize-handle-hit=');
    expect(markup).not.toContain('Draw house outline controls');
  });

  it('allows model-space zoom below 100 percent', () => {
    const drawing = makeDrawingModule();
    const transform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={transform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    clickButtonByText(rendered.container, '-');

    expect(onViewportTransformChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 0.9 }));

    rendered.unmount();
  });

  it('fits and centers the model-space drawing on initial render and reset', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 480, 360);
      return makeRect(0, 0, 0, 0);
    });

    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithLargeHouseContext()}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();
    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    expect(svg).not.toBeNull();
    const expectedFit = expectedFitForSvgFocus({
      scrollerWidth: 600,
      scrollerHeight: 400,
      frameWidth: 480,
      frameHeight: 360,
      svg: svg!,
    });
    const initialFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(initialFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(initialFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(initialFit?.panY).toBeCloseTo(expectedFit.panY, 3);
    expect(initialFit?.zoom).toBeGreaterThan(0.25);

    onViewportTransformChange.mockClear();
    clickButtonByText(rendered.container, 'Reset');

    const resetFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(resetFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(resetFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(resetFit?.panY).toBeCloseTo(expectedFit.panY, 3);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('keeps manual zoom for the same layout and auto-fits when model-space layout metadata changes', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (planModel: ModulePlanModel | null | undefined = drawing.planModel) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    clickButtonByText(rendered.container, '-');
    expect(onViewportTransformChange).toHaveBeenCalledWith(expect.objectContaining({ zoom: 0.9 }));

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport(drawing.planModel));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 1 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('starts draw outline only in the model-space plan view and cancel restores the previous footprint', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());

    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();

    rendered.rerender(renderViewport(1));

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.textContent).toContain('Click first corner');
    expect(rendered.container.textContent).not.toContain('Angle mode');
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).toBeNull();
    expect(rendered.container.querySelector('[aria-label="Draw house outline controls"]')?.getAttribute('data-draw-popover-anchor')).toBe('default');

    clickButtonByText(rendered.container, 'Cancel');

    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();
    expect(rendered.container.textContent).not.toContain('Click first corner');

    rendered.unmount();
  });

  it('anchors the draw outline popover to the latest rendered custom vertex', async () => {
    const drawing = makeDrawingModule();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.getAttribute('aria-label') === 'Draw house outline controls') return makeRect(0, 0, 300, 90);
      if (this instanceof Element && this.getAttribute('data-footprint-custom-vertex') === '0') return makeRect(500, 180, 10, 10);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    await act(async () => {
      await Promise.resolve();
    });

    const popover = rendered.container.querySelector('[aria-label="Draw house outline controls"]') as HTMLElement | null;
    expect(popover?.getAttribute('data-draw-popover-anchor')).toBe('vertex');
    expect(Number.parseFloat(popover?.style.left ?? '')).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(popover?.style.left ?? '')).toBeLessThanOrEqual(288);
    expect(Number.parseFloat(popover?.style.top ?? '')).toBeGreaterThanOrEqual(12);
    expect(Number.parseFloat(popover?.style.top ?? '')).toBeLessThanOrEqual(298);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('renders a hover preview edge during draw outline without committing it', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 28 });

    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="hover"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    clickButtonByText(rendered.container, 'Cancel');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('prefers typed pending draw outline previews over hover previews', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 48 });

    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    clickButtonByText(rendered.container, 'Undo');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="pending"]')).toBeNull();
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 48 });
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('renders a close-ready start target after three confirmed draw outline points', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 48 });
    clickButtonByText(rendered.container, 'Confirm');

    expect(rendered.container.querySelector('[data-footprint-custom-close-target="0"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();

    dispatchPointer(svg, 'pointermove', { clientX: 45.05, clientY: 28.05 });
    expect(rendered.container.querySelector('[data-footprint-custom-close-hovered="true"]')).not.toBeNull();

    rendered.unmount();
  });

  it('clicking the close-ready start target validates and commits the draw outline polygon', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 48 });
    clickButtonByText(rendered.container, 'Confirm');

    const startHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="0"]');
    if (!startHit) throw new Error('Missing close-ready start hit target.');
    const PointerCtor = window.PointerEvent ?? MouseEvent;
    await act(async () => {
      startHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    expect(commitFootprintEdit).toHaveBeenCalledWith({
      type: 'custom_polygon',
      polygon: expect.arrayContaining([
        expect.objectContaining({ alongM: expect.any(String), depthM: expect.any(String) }),
      ]),
    });
    const firstCommit = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: unknown[] }]>)[0]?.[0];
    expect(firstCommit?.polygon).toHaveLength(3);

    rendered.unmount();
  });

  it('commits a valid draw outline polygon from model-space plan clicks', async () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());

    rendered.rerender(renderViewport(1));

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 45, clientY: 28 });
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchPointer(svg, 'pointerdown', { button: 0, clientX: 75, clientY: 48 });
    clickButtonByText(rendered.container, 'Confirm');

    await act(async () => {
      clickButtonByText(rendered.container, 'Close');
      await Promise.resolve();
    });

    expect(commitFootprintEdit).toHaveBeenCalledTimes(1);
    expect(commitFootprintEdit).toHaveBeenCalledWith({
      type: 'custom_polygon',
      polygon: expect.arrayContaining([
        expect.objectContaining({ alongM: expect.any(String), depthM: expect.any(String) }),
      ]),
    });
    const firstCommit = (commitFootprintEdit.mock.calls as unknown as Array<[{ type: 'custom_polygon'; polygon: unknown[] }]>)[0]?.[0];
    expect(firstCommit?.polygon).toHaveLength(3);

    rendered.unmount();
  });
});
