import { act, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import { buildPlanViewModel, type PlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  resolveWorkbenchTrustGate,
  type WorkbenchTrustStatusKind,
} from '@/lib/drawings/state/workbenchSolvedModel';
import { renderIntoDocument } from '../../../../../test/reactHarness';
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

function makeCustomPolygonPlanModel() {
  const drawing = makeDrawingModule();
  return {
    ...drawing.planModel!,
    houseFootprintMode: 'custom_polygon' as const,
    houseFootprintPolygon: [
      { alongM: '0', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ],
  };
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
      rafters: [],
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
      attachmentSide: null,
    },
    extents: {
      minX: 0,
      minY: 0,
      maxX: 6000,
      maxY: 3000,
      lengthMm: 6000,
      projectionMm: 3000,
    },
  } as unknown as GeometryPlanViewModel;
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
        id: 'roof_plane:roof-plane-main',
        sourceObjectId: 'scene-roof-plane-main',
        sourceId: 'roof-plane-main',
        sourceType: 'roof_plane',
        family: 'pergola',
        kind: 'roof_plane',
        polygon: [
          { x: 0, y: 0 },
          { x: 6000, y: 0 },
          { x: 6000, y: 3000 },
          { x: 0, y: 3000 },
        ],
        zOrder: 60,
        zMin: 2400,
        zMax: 2600,
        metadata: { topProjectionRole: 'top_visible' },
      },
    ],
    extents: {
      minX: 0,
      minY: 0,
      maxX: 6000,
      maxY: 3000,
      widthMm: 6000,
      heightMm: 3000,
    },
  } as unknown as GeometryTopProjectionViewModel;
}

function makeReadyPlanViewModel(planModel = makeDrawingModule().planModel ?? null): PlanViewModel {
  const viewModel = buildPlanViewModel({
    moduleId: 'module-1',
    moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
    planModel,
    geometryPlan: makeGeometryPlanFixture(),
    geometryTopProjection: makeTopProjectionFixture(),
    pergolaRenderSource: 'geometry',
    pergolaRenderStatus: 'geometry_ready',
    canEditHouseFootprint: true,
  });
  if (!viewModel) throw new Error('Expected ready plan view model fixture');
  return viewModel;
}

function makeTrustGate(status: WorkbenchTrustStatusKind, issues: WorkbenchTrustStatusKind[] = []) {
  return resolveWorkbenchTrustGate({
    status,
    issues,
    renderSource: status === 'geometry_ready' || status === 'approximate' ? 'geometry' : 'legacy',
    message: null,
  });
}

function renderWorkbenchWithTrust(status: WorkbenchTrustStatusKind, issues: WorkbenchTrustStatusKind[] = []) {
  const drawing = makeDrawingModule();
  const meta = buildEstimateDrawingSheetMeta({
    moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
    view: 'plan',
  });

  return renderToStaticMarkup(
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
      trustGate={makeTrustGate(status, issues)}
      planModel={drawing.planModel}
      sectionModel={drawing.sectionModel}
      modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
      onModelViewportTransformChange={() => undefined}
      meta={meta}
    />,
  );
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
        planViewModel={makeReadyPlanViewModel(drawing.planModel)}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('aria-label="Drawing workbench"');
    expect(markup).toContain('Sheet View');
    expect(markup).toContain('Model Space');
    expect(markup).not.toContain('3D View');
    expect(markup).not.toContain('next landing zone');
    expect(markup).toContain('aria-label="Plan view A3 drawing sheet"');
    expect(markup).not.toContain('Sheet Preview');
    expect(markup).not.toContain('Pergola style');
    expect(markup).not.toContain('Drawing Workbench</');
  });

  it('renders pass, warning, and block trust badges in the workbench toolbar', () => {
    const passMarkup = renderWorkbenchWithTrust('geometry_ready');
    const warnMarkup = renderWorkbenchWithTrust('geometry_ready', ['approximate']);
    const blockMarkup = renderWorkbenchWithTrust('geometry_ready', ['unresolved_host']);

    expect(passMarkup).toContain('data-workbench-trust-status="pass"');
    expect(passMarkup).toContain('Geometry ready');
    expect(warnMarkup).toContain('data-workbench-trust-status="warn"');
    expect(warnMarkup).toContain('Warning: Approximate');
    expect(blockMarkup).toContain('data-workbench-trust-status="block"');
    expect(blockMarkup).toContain('Blocked: Unresolved host');
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
        planViewModel={makeReadyPlanViewModel(drawing.planModel)}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('aria-label="Plan model space viewport"');
    expect(markup).toContain('Fit view');
    expect(markup).not.toContain('Live configurator surface');
    expect(markup).not.toContain('A3 drawing sheet');
    expect(markup).not.toContain('Open full calculator');
    expect(markup).not.toContain('Rotate +90');
  });

  it('passes house-form display family to model space without changing sheet view, while showing pergolas by default', () => {
    const drawing = makeDrawingModule();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
      view: 'plan',
    });

    const sheetMarkup = renderToStaticMarkup(
      <DrawingWorkbench
        moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
        modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
        activeModuleIndex={0}
        onActiveModuleIndexChange={() => undefined}
        view="plan"
        onViewChange={() => undefined}
        viewportMode="sheet"
        objectWorkbenchDisplayFamily="house_forms"
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        planViewModel={makeReadyPlanViewModel(drawing.planModel)}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    const modelMarkup = renderToStaticMarkup(
      <DrawingWorkbench
        moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
        modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
        activeModuleIndex={0}
        onActiveModuleIndexChange={() => undefined}
        view="plan"
        onViewChange={() => undefined}
        viewportMode="model"
        objectWorkbenchDisplayFamily="house_forms"
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        planViewModel={makeReadyPlanViewModel(drawing.planModel)}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(sheetMarkup).toContain('aria-label="Plan view A3 drawing sheet"');
    expect(sheetMarkup).toContain('data-plan-primary-fill="true"');
    expect(modelMarkup).toContain('aria-label="Plan model space viewport"');
    expect(modelMarkup).toContain('data-plan-primary-fill="true"');
  });

  it('passes family visibility to model space so pergolas can be hidden without changing sheet output', () => {
    const drawing = makeDrawingModule();
    const meta = buildEstimateDrawingSheetMeta({
      moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
      view: 'plan',
    });

    const hiddenMarkup = renderToStaticMarkup(
      <DrawingWorkbench
        moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
        modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
        activeModuleIndex={0}
        onActiveModuleIndexChange={() => undefined}
        view="plan"
        onViewChange={() => undefined}
        viewportMode="model"
        objectWorkbenchDisplayFamily="house_forms"
        visibility={{
          house: true,
          pergolas: false,
          decks: true,
          openings: true,
        }}
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        planViewModel={makeReadyPlanViewModel(drawing.planModel)}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
      />
    );

    expect(hiddenMarkup).toContain('aria-label="Plan model space viewport"');
    expect(hiddenMarkup).not.toContain('data-plan-primary-fill="true"');
  });

  it('exposes the hidden 3D viewport mode only when explicitly enabled', () => {
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
        availableViewportModes={['sheet', 'model', 'geometry3d']}
        onViewportModeChange={() => undefined}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onModelViewportTransformChange={() => undefined}
        meta={meta}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('3D View');
  });

  it('does not restart a consumed custom-footprint outline request after switching to 3D view and back', async () => {
    function Harness() {
      const drawing = makeDrawingModule();
      const planModel = makeCustomPolygonPlanModel();
      const meta = buildEstimateDrawingSheetMeta({
        moduleLabel: 'M1 - Pitched - 6m x 3m - Acrylic',
        view: 'plan',
      });
      const [viewportMode, setViewportMode] = useState<DrawingWorkbenchViewportMode>('model');
      const [drawOutlineRequestId, setDrawOutlineRequestId] = useState(0);

      return (
        <div>
          <button type="button" onClick={() => setDrawOutlineRequestId((current) => current + 1)}>
            Start outline
          </button>
          <button type="button" onClick={() => setViewportMode('geometry3d')}>
            Show 3D
          </button>
          <button type="button" onClick={() => setViewportMode('model')}>
            Show model
          </button>
          <DrawingWorkbench
            moduleLabel="M1 - Pitched - 6m x 3m - Acrylic"
            modules={[{ id: 'module-1', label: 'M1 - Pitched - 6m x 3m - Acrylic' }]}
            activeModuleIndex={0}
            onActiveModuleIndexChange={() => undefined}
            view="plan"
            onViewChange={() => undefined}
            viewportMode={viewportMode}
            availableViewportModes={['model', 'geometry3d']}
            onViewportModeChange={setViewportMode}
            status="ready"
            planModel={planModel}
            planViewModel={makeReadyPlanViewModel(planModel)}
            sectionModel={drawing.sectionModel}
            modelViewportTransform={createDrawingWorkbenchUiState().viewportTransform}
            onModelViewportTransformChange={() => undefined}
            meta={meta}
            drawOutlineRequestId={drawOutlineRequestId}
            onDrawOutlineRequestConsumed={(requestId) =>
              setDrawOutlineRequestId((current) => (current === requestId ? 0 : current))
            }
            onCommitFootprintEdit={() => ({ ok: true })}
          />
        </div>
      );
    }

    const rendered = renderIntoDocument(<Harness />);
    const clickByText = (text: string) => {
      const button = Array.from(rendered.container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
      if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing button: ${text}`);
      act(() => {
        button.click();
      });
    };
    const getScroller = () => rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;

    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    clickByText('Start outline');
    await act(async () => {
      await Promise.resolve();
    });

    expect(getScroller()?.dataset.drawOutlineActive).toBe('true');
    expect(getScroller()?.dataset.drawOutlineRedrawActive).toBe('true');
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(getScroller()?.dataset.drawOutlineActive).toBe('false');
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Redraw outline');

    clickByText('Show 3D');
    await act(async () => {
      await Promise.resolve();
    });
    expect(rendered.container.querySelector('[data-model-space-scroller]')).toBeNull();

    clickByText('Show model');
    await act(async () => {
      await Promise.resolve();
    });
    expect(getScroller()?.dataset.drawOutlineActive).toBe('false');
    expect(getScroller()?.dataset.drawOutlineRedrawActive).toBe('false');
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Redraw outline');

    rendered.unmount();
  });
});
