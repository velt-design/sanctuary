import { renderToStaticMarkup } from 'react-dom/server';
import { act, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { EstimateDrawingField } from '@/lib/estimates/drawingEdits';
import type { ModulePlanModel } from '@/app/staff/calculator/moduleViews';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildAssemblyModel } from '@/lib/drawings/assembly/buildAssemblyModel';
import { buildPlanViewModel } from '@/lib/drawings/views/plan/buildPlanViewModel';
import { resolveDeckPresetGeometry } from '@/lib/drawings/state/houseFirstDeckPresets';
import type {
  DeckModel,
  HouseModel,
  WallOpeningModel,
  WorkbenchHouseSelection,
} from '@/lib/drawings/state/houseFirstWorkbenchModel';
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

function makeCustomPolygonPlanModel(): ModulePlanModel {
  return {
    ...makePlanModelWithHouseContext(),
    houseFootprintMode: 'custom_polygon',
    houseFootprintPolygon: [
      { alongM: '0', depthM: '2.4' },
      { alongM: '6', depthM: '2.4' },
      { alongM: '6', depthM: '0' },
      { alongM: '0', depthM: '0' },
    ],
  };
}

function makeHouseFirstDeck(overrides: Partial<DeckModel> = {}): DeckModel {
  return {
    id: 'deck-1',
    name: 'Deck 1',
    kind: 'deck',
    shape: 'preset',
    presetType: 'rect_attached',
    presetRect: {
      widthM: '4',
      depthM: '3',
      centerOffsetM: '0',
    },
    outline: [],
    elevationMode: 'aligned_to_threshold',
    levelOffsetMm: '0',
    hostEdgeId: 'rear',
    isAttached: true,
    surfaceMaterial: 'timber_decking',
    topSurfaceElevationMm: 0,
    supportContext: {
      classification: 'threshold_attached',
      nearestHouseEdgeId: 'rear',
      nearestHouseEdgeDistanceMm: 0,
      attachmentContactLengthMm: 0,
      warningCodes: [],
      warningMessages: [],
    },
    validation: {
      status: 'valid',
      codes: [],
      messages: [],
      message: null,
    },
    ...overrides,
  };
}

function makeHouseFirstHouse(overrides: Partial<HouseModel> = {}): HouseModel {
  const house: HouseModel = {
    id: 'house-main',
    label: 'House',
    confidence: 'high',
    lowConfidence: false,
    sourceModuleIndexes: [0],
    sourceModuleIds: ['module-1'],
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: {
        widthM: '6',
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
      polygon: [
        { alongM: '0', depthM: '0' },
        { alongM: '6', depthM: '0' },
        { alongM: '6', depthM: '2.4' },
        { alongM: '0', depthM: '2.4' },
      ],
      drawingRotationQuarterTurns: 0,
      attachmentSide: 'rear',
    },
    roof: {
      id: 'roof-1',
      form: 'mono',
      material: 'corrugated_iron',
      pitchDeg: '5',
      primaryPitchDeg: '5',
      primaryFallDirection: 'positive_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
      terminalEnds: [],
      appendage: {
        enabled: false,
        form: 'flat',
        hostEdge: 'rear',
        pitchDeg: '3',
        dropMm: '0',
      },
      validation: {
        status: 'valid',
        code: null,
        message: null,
      },
      capabilities: {
        roofForm: 'mono',
        controls: {
          pitch: true,
          material: true,
          primaryFallDirection: true,
          ridgeAxis: false,
          appendage: true,
        },
        footprintTopology: 'orthogonal',
        selectedFormFootprintRequirement: 'orthogonal',
        selectedFormSupported: true,
        appendageFootprintRequirement: 'rectangular',
        appendageSupported: true,
      },
      confidence: 'high',
      source: 'house_first_draft',
    },
    storeyMode: 'single_storey',
    attachmentStrategy: 'soffit_brackets',
    eaveHeightM: '2.7',
    wallHeightM: '2.4',
    soffitDepthMm: '450',
    fasciaHeightMm: '140',
    gutterWidthMm: '115',
    gutterDepthMm: '85',
    gutterProjectionMm: '90',
    eaveOverhangMm: '450',
    decks: [],
    openings: [],
    attachmentZones: [],
  };
  return {
    ...house,
    ...overrides,
    footprint: {
      ...house.footprint,
      ...overrides.footprint,
      params: {
        ...house.footprint.params,
        ...overrides.footprint?.params,
      },
    },
    roof: {
      ...house.roof,
      ...overrides.roof,
      appendage: {
        ...house.roof.appendage,
        ...overrides.roof?.appendage,
      },
      validation: {
        ...house.roof.validation,
        ...overrides.roof?.validation,
      },
      capabilities: {
        ...house.roof.capabilities,
        ...overrides.roof?.capabilities,
      },
    },
  };
}

function makeHouseFirstOpening(overrides: Partial<WallOpeningModel> = {}): WallOpeningModel {
  return {
    id: 'opening-1',
    label: 'Window 1',
    kind: 'window',
    wallId: 'rear',
    hostEdgeId: 'rear',
    widthM: '1.8',
    heightM: '1.2',
    sillHeightM: '0.9',
    offsetAlongWallM: '0.6',
    validation: {
      status: 'valid',
      codes: [],
      message: null,
    },
    ...overrides,
  };
}

function clickElement(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function fillAndCommitDimensionInput(input: HTMLInputElement, value: string, commit: 'enter' | 'blur'): void {
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) throw new Error('Missing HTMLInputElement value setter.');
  act(() => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (commit === 'enter') {
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
    });
    return;
  }
  act(() => {
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  });
}

type HouseFirstViewportHarnessProps = {
  initialHouse: HouseModel;
  initialSelection?: WorkbenchHouseSelection;
  rejectDeckCommit?: boolean;
};

function HouseFirstViewportHarness({
  initialHouse,
  initialSelection = { kind: 'house', targetId: null },
  rejectDeckCommit = false,
}: HouseFirstViewportHarnessProps) {
  const drawing = makeDrawingModule();
  const [house, setHouse] = useState(initialHouse);
  const [selection, setSelection] = useState<WorkbenchHouseSelection>(initialSelection);
  const [deckTelemetry, setDeckTelemetry] = useState<{
    housePolygonSource: string | null;
    selectedDeckType: string;
    dragEligible: boolean;
    hostEdgeResolvable: boolean;
    relationshipDimensionsAvailable: boolean;
    snapState: string;
    snapMessage: string | null;
  } | null>(null);

  return (
    <div>
      <div data-testid="house-width">{house.footprint.params.widthM}</div>
      <div data-testid="deck-width">{house.decks[0]?.presetRect?.widthM ?? ''}</div>
      <div data-testid="deck-center-offset">{house.decks[0]?.presetRect?.centerOffsetM ?? ''}</div>
      <div data-testid="deck-telemetry-type">{deckTelemetry?.selectedDeckType ?? 'none'}</div>
      <div data-testid="deck-telemetry-house-polygon">{deckTelemetry?.housePolygonSource ?? 'none'}</div>
      <div data-testid="deck-telemetry-drag">{deckTelemetry ? String(deckTelemetry.dragEligible) : 'false'}</div>
      <div data-testid="deck-telemetry-host">{deckTelemetry ? String(deckTelemetry.hostEdgeResolvable) : 'false'}</div>
      <div data-testid="deck-telemetry-relationship">
        {deckTelemetry ? String(deckTelemetry.relationshipDimensionsAvailable) : 'false'}
      </div>
      <div data-testid="deck-telemetry-snap">{deckTelemetry?.snapState ?? 'idle'}</div>
      <div data-testid="deck-telemetry-message">{deckTelemetry?.snapMessage ?? 'none'}</div>
      <div data-testid="opening-offset">{house.openings[0]?.offsetAlongWallM ?? ''}</div>
      <div data-testid="footprint-edge-0">
        {(() => {
          const polygon = house.footprint.polygon;
          if (polygon.length < 2) return '';
          const start = polygon[0]!;
          const end = polygon[1]!;
          return String(Math.hypot(Number(end.alongM) - Number(start.alongM), Number(end.depthM) - Number(start.depthM)));
        })()}
      </div>
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel: makePlanModelWithHouseContext(),
          canEditHouseFootprint: true,
          house,
          activeHouseSelection: selection,
          includeHouseFirstOverlay: true,
          moduleLengthM: drawing.input.lengthM,
          moduleProjectionM: drawing.input.projectionM,
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        onCommitFootprintEdit={() => ({ ok: true })}
        onSelectHouseFirstTarget={(nextSelection) => {
          setSelection(nextSelection);
        }}
        onCommitHouseFirstFootprintDimension={(edit) => {
          setHouse((current) => {
            if (edit.type === 'param') {
              return {
                ...current,
                footprint: {
                  ...current.footprint,
                  params: {
                    ...current.footprint.params,
                    [edit.key]: edit.value,
                  },
                },
              };
            }
            if (edit.type === 'polygon') {
              return {
                ...current,
                footprint: {
                  ...current.footprint,
                  mode: 'custom_polygon',
                  polygon: edit.polygon,
                },
              };
            }
            return {
              ...current,
            };
          });
          return { ok: true };
        }}
        onCommitHouseFirstDeckDimension={(deckId, patch) => {
          if (rejectDeckCommit) return { ok: false, error: 'Deck dimension rejected.' };
          setHouse((current) => ({
            ...current,
            decks: current.decks.map((deck) => {
              if (deck.id !== deckId) return deck;
              const nextDeck = {
                ...deck,
                ...patch,
                presetRect:
                  patch.presetRect === undefined
                    ? deck.presetRect
                    : {
                        ...(deck.presetRect ?? {}),
                        ...patch.presetRect,
                      },
              } as DeckModel;
              if (nextDeck.shape !== 'preset') return nextDeck;
              const resolvedDeck = resolveDeckPresetGeometry({
                deck: nextDeck as any,
                housePolygon: current.footprint.polygon,
              });
              return {
                ...nextDeck,
                hostEdgeId: resolvedDeck.hostEdgeId,
                presetRect: resolvedDeck.presetRect,
                outline: resolvedDeck.outline,
              };
            }),
          }));
          return { ok: true };
        }}
        onCommitHouseFirstOpeningDimension={(openingId, patch) => {
          setHouse((current) => ({
            ...current,
            openings: current.openings.map((opening) =>
              opening.id === openingId
                ? {
                    ...opening,
                    ...(patch.label !== undefined ? { label: patch.label ?? opening.label } : null),
                    ...(patch.kind !== undefined ? { kind: patch.kind ?? opening.kind } : null),
                    ...(patch.wallId !== undefined ? { wallId: patch.wallId ?? opening.wallId } : null),
                    ...(patch.hostEdgeId !== undefined ? { hostEdgeId: patch.hostEdgeId ?? opening.hostEdgeId } : null),
                    ...(patch.widthM !== undefined ? { widthM: patch.widthM ?? opening.widthM } : null),
                    ...(patch.heightM !== undefined ? { heightM: patch.heightM ?? opening.heightM } : null),
                    ...(patch.sillHeightM !== undefined
                      ? { sillHeightM: patch.sillHeightM ?? opening.sillHeightM }
                      : null),
                    ...(patch.offsetAlongWallM !== undefined
                      ? { offsetAlongWallM: patch.offsetAlongWallM ?? opening.offsetAlongWallM }
                      : null),
                  }
                : opening,
            ),
          }));
          return { ok: true };
        }}
        onDeckInteractionTelemetryChange={(telemetry) => {
          setDeckTelemetry({
            housePolygonSource: telemetry.housePolygonSource,
            selectedDeckType: telemetry.selectedDeckType,
            dragEligible: telemetry.dragEligible,
            hostEdgeResolvable: telemetry.hostEdgeResolvable,
            relationshipDimensionsAvailable: telemetry.relationshipDimensionsAvailable,
            snapState: telemetry.snapState,
            snapMessage: telemetry.snapMessage,
          });
        }}
      />
    </div>
  );
}

function clickButtonByText(container: HTMLElement, text: string): void {
  const button = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => {
    button.click();
  });
}

function getDrawOutlineDiagnostics(container: HTMLElement): DOMStringMap {
  const scroller = container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
  if (!scroller) throw new Error('Missing model-space scroller.');
  return scroller.dataset;
}

function getDrawOutlineStatus(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[aria-label="Draw outline status"]');
}

function getDrawOutlineLandingMarker(container: HTMLElement): SVGElement | null {
  return container.querySelector('[data-draw-outline-landing-marker="true"]') as SVGElement | null;
}

function expectFiniteDrawOutlineLanding(container: HTMLElement): { alongM: number; depthM: number } {
  const diagnostics = getDrawOutlineDiagnostics(container);
  expect(diagnostics.drawOutlineHasLandingPoint).toBe('true');
  const alongM = Number.parseFloat(diagnostics.drawOutlineLandingAlongM ?? '');
  const depthM = Number.parseFloat(diagnostics.drawOutlineLandingDepthM ?? '');
  expect(Number.isFinite(alongM)).toBe(true);
  expect(Number.isFinite(depthM)).toBe(true);
  const marker = getDrawOutlineLandingMarker(container);
  expect(marker).not.toBeNull();
  expect(marker?.getAttribute('data-draw-outline-landing-along-m')).toBe(diagnostics.drawOutlineLandingAlongM);
  expect(marker?.getAttribute('data-draw-outline-landing-depth-m')).toBe(diagnostics.drawOutlineLandingDepthM);
  return { alongM, depthM };
}

function dispatchEscape(): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
}

function dispatchDrawClick(svg: SVGSVGElement, init: MouseEventInit & { pointerId?: number }): void {
  const pointerId = init.pointerId ?? 1;
  dispatchPointer(svg, 'pointerdown', { ...init, pointerId, button: init.button ?? 0 });
  dispatchPointer(window, 'pointerup', {
    pointerId,
    button: init.button ?? 0,
    clientX: init.clientX,
    clientY: init.clientY,
  });
}

function dispatchWheel(target: EventTarget, init: WheelEventInit): void {
  act(() => {
    target.dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  });
}

function dispatchGesture(
  target: EventTarget,
  type: 'gesturestart' | 'gesturechange' | 'gestureend' | 'gesturecancel',
  init: { scale?: number; clientX?: number; clientY?: number } = {},
): void {
  act(() => {
    const event = new Event(type, {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'scale', { configurable: true, value: init.scale });
    Object.defineProperty(event, 'clientX', { configurable: true, value: init.clientX });
    Object.defineProperty(event, 'clientY', { configurable: true, value: init.clientY });
    target.dispatchEvent(event);
  });
}

function dispatchTouchPointer(
  target: EventTarget,
  type: string,
  init: MouseEventInit & { pointerId: number; pointerType?: string },
): void {
  act(() => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    Object.defineProperty(event, 'pointerId', { configurable: true, value: init.pointerId });
    Object.defineProperty(event, 'pointerType', { configurable: true, value: init.pointerType ?? 'touch' });
    target.dispatchEvent(event);
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

function expectedFitForTargetRect(input: {
  scrollerWidth: number;
  scrollerHeight: number;
  target: { x: number; y: number; width: number; height: number };
}): { zoom: number; panX: number; panY: number } {
  const zoom = Math.min(Math.max(Math.min((input.scrollerWidth - 48) / input.target.width, (input.scrollerHeight - 48) / input.target.height), 0.25), 4);
  return {
    zoom,
    panX: input.scrollerWidth / 2 - (input.target.x + input.target.width / 2) * zoom,
    panY: input.scrollerHeight / 2 - (input.target.y + input.target.height / 2) * zoom,
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
    expect(markup).toContain('data-draw-outline-active="false"');
    expect(markup).toContain('data-draw-outline-state="inactive"');
    expect(markup).toContain('data-draw-outline-point-count="0"');
    expect(markup).toContain('data-draw-outline-preview-kind="none"');
    expect(markup).toContain('data-draw-outline-angle-mode="none"');
    expect(markup).toContain('data-model-space-gesture="idle"');
    expect(markup).toContain('data-model-space-active-touch-count="0"');
    expect(markup).toContain('data-model-space-pinch-active="false"');
    expect(markup).toContain('data-model-space-pinch-source="none"');
    expect(markup).toContain('data-model-space-auto-fit-key="plan:ready"');
    expect(markup).toContain('data-model-space-auto-fit-ready="true"');
    expect(markup).toContain('data-native-selection-suppressed="true"');
    expect(markup).toContain('data-draw-outline-can-redraw="false"');
    expect(markup).toContain('data-draw-outline-redraw-active="false"');
    expect(markup).not.toContain('aria-label="Draw outline status"');
    expect(markup).toContain('Fit view');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:lengthA"');
    expect(markup).toContain('data-plan-resize-handle-hit="plan:spanA"');
    expect(markup).toContain('data-editable-field-id="plan:lengthA"');
    expect(markup).toContain('data-editable-field-id="plan:spanA"');
    expect(markup).not.toContain('data-footprint-edge=');
    expect(markup).not.toContain('data-footprint-resize-edge-hit=');
    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-house-plan-line="attachment_target"');
    expect(markup).not.toContain('Live plan viewport');
    expect(markup).not.toContain('House footprint mode');
    expect(markup).not.toContain('House footprint');
    expect(markup).not.toContain('House type');
    expect(markup).not.toContain('Rotate -90');
  });

  it('renders house-first plan overlays without pergola graphics in house display mode', () => {
    const drawing = makeDrawingModule();
    const baseHouse = makeHouseFirstHouse();
    const deck = makeHouseFirstDeck();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const house = makeHouseFirstHouse({
      decks: [
        {
          ...deck,
          hostEdgeId: resolvedDeck.hostEdgeId,
          presetRect: resolvedDeck.presetRect,
          outline: resolvedDeck.outline,
        },
      ],
    });
    const planModel = makePlanModelWithHouseContext();

    const markup = renderToStaticMarkup(
      <ModelSpaceViewport
        view="plan"
        workbenchDisplayMode="house"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={buildPlanViewModel({
          moduleId: drawing.id,
          moduleLabel: 'Module 1',
          planModel,
          canEditHouseFootprint: true,
          house,
          activeHouseSelection: { kind: 'footprint', targetId: 'house-main' },
          includeHouseFirstOverlay: true,
          moduleLengthM: drawing.input.lengthM,
          moduleProjectionM: drawing.input.projectionM,
        })}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        onSelectHouseFirstTarget={() => undefined}
        onCommitHouseFirstFootprintDimension={() => ({ ok: true })}
        onCommitHouseFirstDeckDimension={() => ({ ok: true })}
      />,
    );

    expect(markup).toContain('data-house-plan-surface="footprint"');
    expect(markup).toContain('data-house-first-shape-hit="footprint:house-main"');
    expect(markup).toContain('data-house-first-shape-hit="deck:deck-1"');
    expect(markup).toContain('data-editable-field-id="house-main:widthM"');
    expect(markup).not.toContain('data-plan-primary-fill="true"');
    expect(markup).not.toContain('data-plan-resize-handle-hit=');
    expect(markup).not.toContain('modulePlanRafter');
    expect(markup).not.toContain('data-sheet-hover-target="pergola"');
  });

  it('renders host-side pick targets in plan only while pending attached deck creation', () => {
    const drawing = makeDrawingModule();
    const planModel = makePlanModelWithHouseContext();
    const handlePickAttachedDeckHostEdge = vi.fn();

    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
        pendingAttachedDeckHostEdgePick
        onPickAttachedDeckHostEdge={handlePickAttachedDeckHostEdge}
      />,
    );

    const leftEdge = rendered.container.querySelector('[data-footprint-edge="left"]');
    const rightEdge = rendered.container.querySelector('[data-footprint-edge="right"]');
    expect(leftEdge).not.toBeNull();
    expect(rightEdge).not.toBeNull();

    clickElement(leftEdge as Element);
    expect(handlePickAttachedDeckHostEdge).toHaveBeenCalledWith('left');

    rendered.unmount();
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

  it('renders a house-mode section placeholder instead of the pergola section drawing', () => {
    const drawing = makeDrawingModule();

    const markup = renderToStaticMarkup(
      <ModelSpaceViewport
        view="section"
        workbenchDisplayMode="house"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
      />,
    );

    expect(markup).toContain('House mode section view is not available yet.');
    expect(markup).not.toContain('aria-label="Module section view"');
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

  it('zooms around the wheel pointer anchor with normalized trackpad input', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchWheel(resizeHit, { ctrlKey: true, deltaY: -120, clientX: 100, clientY: 80 });

    const next = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(next?.zoom).toBeGreaterThan(viewportTransform.zoom);
    expect(next?.panX).toBeLessThan(viewportTransform.panX);
    expect(next?.panY).toBeLessThan(viewportTransform.panY);
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('wheel-zoom');
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpacePinchSource).toBe('wheel');

    rendered.unmount();
  });

  it('pans the model-space viewport with non-modifier wheel input', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = { zoom: 1.25, panX: 20, panY: -10 };
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchWheel(resizeHit, { deltaX: 12, deltaY: 30, clientX: 100, clientY: 80 });

    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: viewportTransform.zoom,
        panX: 8,
        panY: -40,
      }),
    );
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('wheel-pan');
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpacePinchSource).toBe('none');

    rendered.unmount();
  });

  it('zooms with WebKit gesture events over drawing geometry', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchGesture(resizeHit, 'gesturestart', { clientX: 120, clientY: 80 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'trackpad-pinch',
      modelSpacePinchActive: 'true',
      modelSpacePinchSource: 'webkit-gesture',
    });

    dispatchGesture(resizeHit, 'gesturechange', { scale: 1.5, clientX: 120, clientY: 80 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.5,
        panX: -60,
        panY: -40,
      }),
    );

    dispatchGesture(resizeHit, 'gestureend', { clientX: 120, clientY: 80 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('ignores WebKit gesture events from controls and draw inputs', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );
    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const zoomOut = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === '-');
    const distanceInput = rendered.container.querySelector('[data-draw-outline-controls="true"] input') as HTMLInputElement | null;
    if (!zoomOut || !distanceInput) throw new Error('Missing viewport controls.');

    dispatchGesture(zoomOut, 'gesturestart', { clientX: 20, clientY: 20 });
    dispatchGesture(zoomOut, 'gesturechange', { scale: 1.4, clientX: 20, clientY: 20 });
    dispatchGesture(distanceInput, 'gesturestart', { clientX: 20, clientY: 20 });
    dispatchGesture(distanceInput, 'gesturechange', { scale: 1.4, clientX: 20, clientY: 20 });

    expect(onViewportTransformChange).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('ignores viewport wheel navigation from controls and draw inputs', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );
    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const zoomOut = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === '-');
    const distanceInput = rendered.container.querySelector('[data-draw-outline-controls="true"] input') as HTMLInputElement | null;
    if (!zoomOut || !distanceInput) throw new Error('Missing viewport controls.');

    dispatchWheel(zoomOut, { ctrlKey: true, deltaY: -120, clientX: 20, clientY: 20 });
    dispatchWheel(distanceInput, { deltaY: 30, clientX: 20, clientY: 20 });

    expect(onViewportTransformChange).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container).modelSpaceGesture).toBe('idle');

    rendered.unmount();
  });

  it('pinch zooms and pans with two touch pointers', () => {
    const drawing = makeDrawingModule();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const onViewportTransformChange = vi.fn();
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');
    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');
    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 21, button: 0, clientX: 100, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceActiveTouchCount: '1',
      modelSpacePinchActive: 'false',
    });
    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 22, button: 0, clientX: 200, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'pinch-zoom',
      modelSpaceActiveTouchCount: '2',
      modelSpacePinchActive: 'true',
      modelSpacePinchSource: 'touch-pointer',
    });

    dispatchTouchPointer(window, 'pointermove', { pointerId: 22, button: 0, clientX: 240, clientY: 100 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 1.4,
        panX: -40,
        panY: -40,
      }),
    );

    dispatchTouchPointer(window, 'pointermove', { pointerId: 22, button: 0, clientX: 170, clientY: 100 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 0.7,
        panX: 30,
        panY: 30,
      }),
    );

    dispatchTouchPointer(window, 'pointercancel', { pointerId: 22, button: 0, clientX: 170, clientY: 100 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceGesture: 'idle',
      modelSpaceActiveTouchCount: '0',
      modelSpacePinchActive: 'false',
      modelSpacePinchSource: 'none',
    });

    rendered.unmount();
  });

  it('keeps one-touch plan resize drag working on edit hit targets', () => {
    const drawing = makeDrawingModule();
    const onCommitField = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={onCommitField}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    const resizeHit = rendered.container.querySelector('[data-plan-resize-handle-hit="plan:lengthA"]') as SVGElement | null;
    if (!resizeHit) throw new Error('Missing plan resize hit target.');

    dispatchTouchPointer(resizeHit, 'pointerdown', { pointerId: 25, button: 0, clientX: 45, clientY: 28 });
    dispatchTouchPointer(window, 'pointermove', { pointerId: 25, button: 0, clientX: 65, clientY: 28 });
    dispatchTouchPointer(window, 'pointerup', { pointerId: 25, button: 0, clientX: 65, clientY: 28 });

    expect(onCommitField).toHaveBeenCalledWith(expect.objectContaining({ id: 'plan:lengthA' }), expect.any(String));
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceActiveTouchCount: '0',
      modelSpacePinchActive: 'false',
    });

    rendered.unmount();
  });

  it('pinch navigation leaves draw outline active without placing or committing points', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    installSvgPointMock(svg);
    dispatchTouchPointer(svg, 'pointerdown', { pointerId: 23, button: 0, clientX: 100, clientY: 100 });
    dispatchTouchPointer(svg, 'pointerdown', { pointerId: 24, button: 0, clientX: 200, clientY: 100 });
    dispatchTouchPointer(window, 'pointermove', { pointerId: 24, button: 0, clientX: 230, clientY: 110 });
    dispatchTouchPointer(window, 'pointerup', { pointerId: 24, button: 0, clientX: 230, clientY: 110 });

    expect(onViewportTransformChange).toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      modelSpacePinchActive: 'false',
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('fits and centers the model-space drawing on initial render and Fit view', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const focusTargetRect = { x: 140, y: 90, width: 260, height: 180 };
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
      if (this instanceof Element && this.getAttribute('data-model-space-focus-target') === 'true') {
        return makeRect(focusTargetRect.x, focusTargetRect.y, focusTargetRect.width, focusTargetRect.height);
      }
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
    const focusTarget = rendered.container.querySelector('[data-model-space-focus-target="true"]');
    expect(svg).not.toBeNull();
    expect(focusTarget).not.toBeNull();
    const expectedFit = expectedFitForTargetRect({
      scrollerWidth: 600,
      scrollerHeight: 400,
      target: focusTargetRect,
    });
    const initialFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(initialFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(initialFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(initialFit?.panY).toBeCloseTo(expectedFit.panY, 3);
    expect(initialFit?.zoom).toBeGreaterThan(0.25);

    onViewportTransformChange.mockClear();
    clickButtonByText(rendered.container, 'Fit view');

    const resetFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(resetFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(resetFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(resetFit?.panY).toBeCloseTo(expectedFit.panY, 3);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('falls back to model-space focus metadata when the focus target cannot be measured', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
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

    const svg = rendered.container.querySelector('svg[data-model-space-svg="plan"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing model-space SVG.');
    const target = {
      x: 0,
      y: 0,
      width: Number.parseFloat(svg.getAttribute('width') ?? '0'),
      height: Number.parseFloat(svg.getAttribute('height') ?? '0'),
    };
    const expectedFit = expectedFitForTargetRect({
      scrollerWidth: 600,
      scrollerHeight: 400,
      target,
    });
    const initialFit = onViewportTransformChange.mock.calls.at(-1)?.[0];
    expect(initialFit?.zoom).toBeCloseTo(expectedFit.zoom, 3);
    expect(initialFit?.panX).toBeCloseTo(expectedFit.panX, 3);
    expect(initialFit?.panY).toBeCloseTo(expectedFit.panY, 3);

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('keeps the current view through model edits and auto-fits only when the viewport context changes', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (
      planModel: ModulePlanModel | null | undefined = drawing.planModel,
      fitViewKey = 'module-1:plan',
    ) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey={fitViewKey}
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
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 2 }, 'module-2:plan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('auto-fits once when drawable model-space content becomes available', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (planModel: ModulePlanModel | null | undefined) => (
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

    const rendered = renderIntoDocument(renderViewport(null));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:plan:empty',
      modelSpaceAutoFitReady: 'false',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rendered.rerender(renderViewport(drawing.planModel));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:plan:ready',
      modelSpaceAutoFitReady: 'true',
    });
    expect(onViewportTransformChange).toHaveBeenCalledTimes(1);

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport({ ...drawing.planModel!, lengthA: drawing.planModel!.lengthA + 1 }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('skips first-visit auto-fit when the current surface already has a persisted transform', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });

    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey="house:0:plan"
        autoFitOnReady={false}
        viewportTransform={{ zoom: 1.35, panX: 48, panY: -26 }}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'house:0:plan:ready',
      modelSpaceAutoFitReady: 'true',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('auto-fits again when switching between model-space plan and section views', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 1200, 900);
      return makeRect(0, 0, 0, 0);
    });
    const renderViewport = (view: 'plan' | 'section') => (
      <ModelSpaceViewport
        view={view}
        status="ready"
        planModel={drawing.planModel}
        sectionModel={drawing.sectionModel}
        fitViewKey={`module-1:${view}`}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport('plan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onViewportTransformChange).toHaveBeenCalled();

    onViewportTransformChange.mockClear();
    rendered.rerender(renderViewport('section'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      modelSpaceAutoFitKey: 'module-1:section:ready',
      modelSpaceAutoFitReady: 'true',
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
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'none',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'false',
      drawOutlineGesture: 'idle',
      drawOutlinePanThresholdPx: '5',
      drawOutlineAngleMode: 'relative',
      drawOutlineHasError: 'false',
    });
    const status = getDrawOutlineStatus(rendered.container);
    expect(status?.getAttribute('data-draw-outline-status')).toBe('true');
    expect(status?.getAttribute('data-draw-outline-status-state')).toBe('first-point');
    expect(status?.textContent).toContain('Draw outline: click first corner');
    expect(status?.textContent).toContain('Esc cancels');
    expect(rendered.container.textContent).toContain('Click first corner');
    expect(rendered.container.textContent).not.toContain('Angle mode');
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-resize-edge-hit]')).toBeNull();
    const controls = rendered.container.querySelector('[aria-label="Draw house outline controls"]');
    expect(controls?.getAttribute('data-draw-outline-controls')).toBe('true');
    expect(controls?.getAttribute('data-draw-popover-anchor')).toBe('default');

    clickButtonByText(rendered.container, 'Cancel');

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
      drawOutlinePointCount: '0',
      drawOutlineHasLandingPoint: 'false',
      drawOutlineAngleMode: 'none',
    });
    expect(getDrawOutlineStatus(rendered.container)).toBeNull();
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('Click first corner');

    rendered.unmount();
  });

  it('starts redraw for an existing custom outline as a draft and cancel restores the persisted polygon', () => {
    const drawing = makeDrawingModule();
    const planModel = makeCustomPolygonPlanModel();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    expect(rendered.container.textContent).toContain('Redraw outline');
    expect(rendered.container.querySelector('[data-draw-outline-redraw-entry="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineCanRedraw: 'true',
      drawOutlineRedrawActive: 'false',
      drawOutlinePointCount: '0',
    });

    clickButtonByText(rendered.container, 'Redraw outline');

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.textContent).not.toContain('Redraw outline');
    expect(rendered.container.querySelector('[data-draw-outline-redraw-entry="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineCanRedraw: 'false',
      drawOutlineRedrawActive: 'true',
    });

    clickButtonByText(rendered.container, 'Cancel');

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(rendered.container.textContent).toContain('Redraw outline');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
      drawOutlineCanRedraw: 'true',
      drawOutlineRedrawActive: 'false',
    });

    rendered.unmount();
  });

  it('commits a replacement custom polygon only after a redraw outline closes successfully', async () => {
    const drawing = makeDrawingModule();
    const planModel = makeCustomPolygonPlanModel();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={planModel}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    clickButtonByText(rendered.container, 'Redraw outline');

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });
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
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineRedrawActive: 'false',
    });

    rendered.unmount();
  });

  it('keeps Fit view as a camera-only action for existing custom outlines', async () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const focusTargetRect = { x: 90, y: 70, width: 240, height: 170 };
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getMockRect(this: Element) {
      if (this instanceof HTMLElement && this.dataset.modelSpaceScroller !== undefined) return makeRect(0, 0, 600, 400);
      if (this instanceof HTMLElement && this.dataset.modelSpaceScaleFrame !== undefined) return makeRect(0, 0, 12000, 9000);
      if (this instanceof Element && this.getAttribute('data-model-space-focus-target') === 'true') {
        return makeRect(focusTargetRect.x, focusTargetRect.y, focusTargetRect.width, focusTargetRect.height);
      }
      return makeRect(0, 0, 0, 0);
    });
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makeCustomPolygonPlanModel()}
        sectionModel={drawing.sectionModel}
        fitViewKey="module-1:plan"
        viewportTransform={{ zoom: 1.5, panX: 30, panY: -20 }}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });
    onViewportTransformChange.mockClear();

    clickButtonByText(rendered.container, 'Fit view');

    expect(onViewportTransformChange).toHaveBeenCalled();
    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineCanRedraw: 'true',
    });

    rectSpy.mockRestore();
    rendered.unmount();
  });

  it('escape exits draw outline without committing and restores the previous footprint', () => {
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
    rendered.rerender(renderViewport(1));

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
    });
    expect(getDrawOutlineStatus(rendered.container)).not.toBeNull();
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).toBeNull();

    dispatchEscape();

    expect(commitFootprintEdit).not.toHaveBeenCalled();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineState: 'inactive',
    });
    expect(getDrawOutlineStatus(rendered.container)).toBeNull();
    expect(rendered.container.querySelector('[data-house-plan-surface="footprint"]')).not.toBeNull();

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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
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

  it('sets draw outline landing diagnostics before placing the first point', () => {
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

    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const landing = expectFiniteDrawOutlineLanding(rendered.container);
    expect(landing.alongM).toBeCloseTo(3.75, 3);
    expect(landing.depthM).toBeCloseTo(-2.333, 3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlinePreviewKind: 'none',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex]')).toBeNull();

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineHasLandingPoint: 'true',
    });
    const markerCircle = getDrawOutlineLandingMarker(rendered.container)?.querySelector('circle');
    const latestVertex = rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]') as SVGCircleElement | null;
    expect(latestVertex).not.toBeNull();
    expect(Number.parseFloat(latestVertex?.getAttribute('cx') ?? '')).toBeCloseTo(Number.parseFloat(markerCircle?.getAttribute('cx') ?? ''), 2);
    expect(Number.parseFloat(latestVertex?.getAttribute('cy') ?? '')).toBeCloseTo(Number.parseFloat(markerCircle?.getAttribute('cy') ?? ''), 2);
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    dispatchPointer(svg, 'pointerout');
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlinePointCount: '1',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();

    rendered.unmount();
  });

  it('places draw outline points from model-space scroller space outside the pergola outline', () => {
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

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!scroller || !svg) throw new Error('Missing model-space scroller or SVG.');
    installSvgPointMock(svg);

    dispatchPointer(scroller, 'pointermove', { clientX: 20, clientY: -12 });
    const landing = expectFiniteDrawOutlineLanding(rendered.container);
    expect(landing.alongM).toBeCloseTo(1.667, 3);
    expect(landing.depthM).toBeCloseTo(1, 3);
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineDraftSource: 'active-draft',
    });

    dispatchPointer(scroller, 'pointerdown', { pointerId: 31, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 31, button: 0, clientX: 20, clientY: -12 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineDraftSource: 'active-draft',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-edge]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-resize-edge-hit]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('does not place draw outline points from viewport or draw controls', () => {
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
    const fitViewButton = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Fit view');
    const confirmButton = Array.from(rendered.container.querySelectorAll('button')).find((button) => button.textContent === 'Confirm');
    if (!fitViewButton || !confirmButton) throw new Error('Missing controls.');

    dispatchPointer(fitViewButton, 'pointerdown', { pointerId: 41, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 41, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(confirmButton, 'pointerdown', { pointerId: 42, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointerup', { pointerId: 42, button: 0, clientX: 20, clientY: -12 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'idle',
    });

    rendered.unmount();
  });

  it('defers draw outline point placement until pointer up', () => {
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

    dispatchPointer(svg, 'pointerdown', { pointerId: 9, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'click-candidate',
      drawOutlineHasLandingPoint: 'true',
    });

    dispatchPointer(window, 'pointerup', { pointerId: 9, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineGesture: 'idle',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('keeps micro-movement below the draw outline pan threshold as a click', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={createDrawingWorkbenchUiState().viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointerdown', { pointerId: 10, button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(window, 'pointermove', { pointerId: 10, button: 0, clientX: 48, clientY: 31 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'click-candidate',
      drawOutlinePointCount: '0',
    });
    expect(onViewportTransformChange).not.toHaveBeenCalled();

    dispatchPointer(window, 'pointerup', { pointerId: 10, button: 0, clientX: 48, clientY: 31 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'idle',
      drawOutlinePointCount: '1',
    });

    rendered.unmount();
  });

  it('pans instead of placing a draw outline point after crossing the drag threshold outside the pergola outline', () => {
    const drawing = makeDrawingModule();
    const commitFootprintEdit = vi.fn(() => ({ ok: true }));
    const onViewportTransformChange = vi.fn();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const renderViewport = (drawOutlineRequestId = 0) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={drawOutlineRequestId}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={commitFootprintEdit}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    rendered.rerender(renderViewport(1));
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!scroller || !svg) throw new Error('Missing model-space scroller or SVG.');
    installSvgPointMock(svg);

    dispatchPointer(scroller, 'pointerdown', { pointerId: 11, button: 0, clientX: 20, clientY: -12 });
    dispatchPointer(window, 'pointermove', { pointerId: 11, button: 0, clientX: 36, clientY: -2 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'panning',
      drawOutlinePreviewKind: 'none',
    });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        panX: viewportTransform.panX + 16,
        panY: viewportTransform.panY + 10,
      }),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 11, button: 0, clientX: 36, clientY: -2 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'true',
      drawOutlineState: 'first-point',
      drawOutlinePointCount: '0',
      drawOutlineGesture: 'idle',
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    rendered.unmount();
  });

  it('cancels a pending draw outline click without placing a point', () => {
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

    dispatchPointer(svg, 'pointerdown', { pointerId: 12, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineGesture: 'click-candidate',
      drawOutlinePointCount: '0',
    });

    dispatchPointer(window, 'pointercancel', { pointerId: 12, button: 0, clientX: 45, clientY: 28 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'first-point',
      drawOutlineGesture: 'idle',
      drawOutlinePointCount: '0',
    });

    rendered.unmount();
  });

  it('keeps inactive model-space drag panning unchanged', () => {
    const drawing = makeDrawingModule();
    const onViewportTransformChange = vi.fn();
    const viewportTransform = createDrawingWorkbenchUiState().viewportTransform;
    const rendered = renderIntoDocument(
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        viewportTransform={viewportTransform}
        onViewportTransformChange={onViewportTransformChange}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />,
    );
    onViewportTransformChange.mockClear();

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!scroller) throw new Error('Missing model-space scroller.');

    dispatchPointer(scroller, 'pointerdown', { pointerId: 13, button: 0, clientX: 100, clientY: 120 });
    dispatchPointer(window, 'pointermove', { pointerId: 13, button: 0, clientX: 116, clientY: 130 });
    expect(onViewportTransformChange).toHaveBeenCalledWith(
      expect.objectContaining({
        panX: viewportTransform.panX + 16,
        panY: viewportTransform.panY + 10,
      }),
    );

    dispatchPointer(window, 'pointerup', { pointerId: 13, button: 0, clientX: 116, clientY: 130 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineActive: 'false',
      drawOutlineGesture: 'idle',
    });

    rendered.unmount();
  });

  it('keeps draw outline landing diagnostics finite with viewport transform props', () => {
    const drawing = makeDrawingModule();
    const renderViewport = (viewportTransform = createDrawingWorkbenchUiState().viewportTransform) => (
      <ModelSpaceViewport
        view="plan"
        status="ready"
        planModel={makePlanModelWithHouseContext()}
        sectionModel={drawing.sectionModel}
        planViewModel={null}
        drawOutlineRequestId={1}
        viewportTransform={viewportTransform}
        onViewportTransformChange={() => undefined}
        editableFields={makePlanEditableFields()}
        onCommitField={() => ({ ok: true })}
        onCommitFootprintEdit={() => ({ ok: true })}
      />
    );

    const rendered = renderIntoDocument(renderViewport());
    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    if (!svg) throw new Error('Missing module plan SVG.');
    installSvgPointMock(svg);

    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const initial = expectFiniteDrawOutlineLanding(rendered.container);

    rendered.rerender(renderViewport({ zoom: 2, panX: 40, panY: -30 }));
    dispatchPointer(svg, 'pointermove', { clientX: 45, clientY: 28 });
    const transformed = expectFiniteDrawOutlineLanding(rendered.container);
    expect(transformed.alongM).toBeCloseTo(initial.alongM, 3);
    expect(transformed.depthM).toBeCloseTo(initial.depthM, 3);

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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 28 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePointCount: '1',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'hover',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'true',
      drawOutlineAngleMode: 'absolute',
      drawOutlineHasError: 'false',
    });
    expectFiniteDrawOutlineLanding(rendered.container);
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('placing');
    expect(getDrawOutlineStatus(rendered.container)?.textContent).toContain('Draw outline: click next corner or enter distance and angle');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="hover"]')).not.toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    clickButtonByText(rendered.container, 'Cancel');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();
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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 48 });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'pending-segment',
      drawOutlinePointCount: '1',
      drawOutlineHasPendingPoint: 'true',
      drawOutlinePreviewKind: 'pending',
      drawOutlineCloseReady: 'false',
      drawOutlineCloseHovered: 'false',
      drawOutlineHasLandingPoint: 'true',
      drawOutlineAngleMode: 'absolute',
      drawOutlineHasError: 'false',
    });
    expectFiniteDrawOutlineLanding(rendered.container);
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('pending-segment');
    expect(getDrawOutlineStatus(rendered.container)?.textContent).toContain('Draw outline: confirm segment or undo');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-vertex="pending"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).toBeNull();
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    clickButtonByText(rendered.container, 'Undo');
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="pending"]')).toBeNull();
    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 48 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'placing',
      drawOutlinePreviewKind: 'hover',
      drawOutlineHasPendingPoint: 'false',
      drawOutlineHasLandingPoint: 'true',
    });
    expectFiniteDrawOutlineLanding(rendered.container);
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('placing');
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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    expect(rendered.container.querySelector('[data-footprint-custom-close-target]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-hit]')).toBeNull();
    clickButtonByText(rendered.container, 'Confirm');
    expect(rendered.container.querySelector('[data-footprint-custom-active-edge="true"]')?.getAttribute('data-footprint-custom-edge')).toBe('0');
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });
    clickButtonByText(rendered.container, 'Confirm');

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-ready',
      drawOutlinePointCount: '3',
      drawOutlineHasPendingPoint: 'false',
      drawOutlinePreviewKind: 'none',
      drawOutlineCloseReady: 'true',
      drawOutlineCloseHovered: 'false',
      drawOutlineAngleMode: 'relative',
      drawOutlineHasError: 'false',
    });
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('close-ready');
    expect(getDrawOutlineStatus(rendered.container)?.textContent).toContain('Draw outline: close shape or add another corner');
    expect(rendered.container.querySelector('[data-footprint-custom-close-target="0"]')).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-footprint-custom-close-target]')).toHaveLength(1);
    expect(rendered.container.querySelector('[data-footprint-custom-close-hit="0"]')).not.toBeNull();
    expect(rendered.container.querySelectorAll('[data-footprint-custom-close-hit]')).toHaveLength(1);
    expect(rendered.container.querySelector('[data-footprint-custom-latest-vertex="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-active-edge="true"]')?.getAttribute('data-footprint-custom-edge')).toBe('1');

    dispatchPointer(svg, 'pointermove', { clientX: 75, clientY: 58 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-ready',
      drawOutlinePreviewKind: 'hover',
      drawOutlineCloseHovered: 'false',
    });
    expect(rendered.container.querySelector('[data-footprint-custom-close-hovered="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-preview="true"]')).toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-preview-edge="hover"]')).not.toBeNull();

    dispatchPointer(svg, 'pointermove', { clientX: 45.05, clientY: 28.05 });
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'close-hovered',
      drawOutlinePreviewKind: 'hover',
      drawOutlineCloseHovered: 'true',
    });
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('close-hovered');
    expect(getDrawOutlineStatus(rendered.container)?.textContent).toContain('Draw outline: release on first corner to close');
    expect(rendered.container.querySelector('[data-footprint-custom-close-hovered="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-close-preview="true"]')).not.toBeNull();

    rendered.unmount();
  });

  it('exposes draw outline errors through viewport diagnostics', async () => {
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

    await act(async () => {
      clickButtonByText(rendered.container, 'Close');
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'error',
      drawOutlinePointCount: '0',
      drawOutlineHasError: 'true',
    });
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status-state')).toBe('error');
    expect(getDrawOutlineStatus(rendered.container)?.textContent).toContain('Draw outline: fix issue or undo');
    expect(rendered.container.textContent).toContain('Add at least 3 points before closing the outline.');

    rendered.unmount();
  });

  it('marks the draft outline invalid when close validation fails with existing points', async () => {
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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    await act(async () => {
      clickButtonByText(rendered.container, 'Close');
      await Promise.resolve();
    });

    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'error',
      drawOutlinePointCount: '1',
      drawOutlineHasError: 'true',
    });
    expect(getDrawOutlineStatus(rendered.container)?.getAttribute('data-draw-outline-status')).toBe('true');
    expect(rendered.container.querySelector('[data-footprint-custom-invalid="true"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')?.getAttribute('data-footprint-custom-invalid')).toBe('true');
    expect(commitFootprintEdit).not.toHaveBeenCalled();

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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });
    clickButtonByText(rendered.container, 'Confirm');

    const genericStartHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="0"]');
    if (!genericStartHit) throw new Error('Missing generic start vertex hit target.');
    const PointerCtor = window.PointerEvent ?? MouseEvent;
    await act(async () => {
      genericStartHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 21, clientX: 45, clientY: 28 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 21, clientX: 45, clientY: 28 }));
      await Promise.resolve();
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    const secondVertexHit = rendered.container.querySelector('[data-footprint-custom-vertex-hit="1"]');
    if (!secondVertexHit) throw new Error('Missing non-close vertex hit target.');
    await act(async () => {
      secondVertexHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 22, clientX: 75, clientY: 28 }));
      window.dispatchEvent(new PointerCtor('pointerup', { bubbles: true, cancelable: true, button: 0, pointerId: 22, clientX: 75, clientY: 28 }));
      await Promise.resolve();
    });
    expect(commitFootprintEdit).not.toHaveBeenCalled();

    const closeHit = rendered.container.querySelector('[data-footprint-custom-close-hit="0"]');
    if (!closeHit) throw new Error('Missing close-ready start hit target.');
    await act(async () => {
      closeHit.dispatchEvent(new PointerCtor('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 23, clientX: 45, clientY: 28 }));
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
    expect(getDrawOutlineDiagnostics(rendered.container)).toMatchObject({
      drawOutlineState: 'inactive',
      drawOutlineHasLandingPoint: 'false',
    });
    expect(getDrawOutlineLandingMarker(rendered.container)).toBeNull();

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

    dispatchDrawClick(svg, { button: 0, clientX: 45, clientY: 28 });
    expect(rendered.container.querySelector('[data-footprint-custom-vertex="0"]')).not.toBeNull();
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 28 });
    clickButtonByText(rendered.container, 'Confirm');
    dispatchDrawClick(svg, { button: 0, clientX: 75, clientY: 48 });
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

  it('shows house-first dimensions only for the selected shape in model space', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).toBeNull();

    const footprintHit = rendered.container.querySelector('[data-house-first-shape-hit="footprint:house-main"]');
    if (!footprintHit) throw new Error('Missing footprint hit target.');
    clickElement(footprintHit);
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).toBeNull();

    const deckHit = rendered.container.querySelector('[data-house-first-shape-hit="deck:deck-1"]');
    if (!deckHit) throw new Error('Missing deck hit target.');
    clickElement(deckHit);
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-editable-field-id="house-main:widthM"]')).toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostEndGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:centerOffsetM"]')).toBeNull();
    expect(rendered.container.textContent).not.toContain('0.00m');
    expect(
      rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.getAttribute(
        'data-house-first-dimension-emphasis',
      ),
    ).toBe('driving');
    expect(
      rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')?.getAttribute(
        'data-house-first-dimension-emphasis',
      ),
    ).toBe('relationship');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'Drag the selected deck body to move it along the host edge',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'attached_preset_rect',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-relationship"]')?.textContent).toBe(
      'true',
    );

    rendered.unmount();
  });

  it('drags a selected house-first window along its host wall in model space', async () => {
    const house = makeHouseFirstHouse({
      openings: [makeHouseFirstOpening()],
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness initialHouse={house} initialSelection={{ kind: 'opening', targetId: 'opening-1' }} />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const openingHit = rendered.container.querySelector('[data-house-first-shape-hit="opening:opening-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !openingHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    expect(rendered.container.querySelector('[data-editable-field-id="opening-1:offsetAlongWallM"]')).not.toBeNull();
    expect(scroller.dataset.houseFirstSelectedOpeningDragEligible).toBe('true');

    dispatchPointer(openingHit, 'pointerdown', { pointerId: 61, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 61, button: 0, buttons: 1, clientX: 250, clientY: 50 });

    expect(scroller.dataset.houseFirstOpeningDragActive).toBe('true');
    expect(rendered.container.querySelector('[data-house-first-preview-shape="opening-1"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 61, button: 0, clientX: 250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(scroller.dataset.houseFirstOpeningDragActive).toBe('false');
    expect(rendered.container.querySelector('[data-house-first-preview-shape="opening-1"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="opening-offset"]')?.textContent).toBe('4.2');

    rendered.unmount();
  });

  it('keeps attached preset deck interaction active on preset houses without a stored footprint polygon', async () => {
    const baseHouse = makeHouseFirstHouse();
    const deck = makeHouseFirstDeck();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          footprint: {
            ...baseHouse.footprint,
            polygon: [],
          },
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'attached_preset_rect',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-house-polygon"]')?.textContent).toBe(
      'preset_derived',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).not.toContain(
      'needs a resolvable host edge',
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-house-first-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 31, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 31, button: 0, buttons: 1, clientX: -250, clientY: 50 });

    expect(scroller.dataset.houseFirstDeckDragActive).toBe('true');
    expect(scroller.dataset.houseFirstDeckSnapState).toBe('snapped');

    dispatchPointer(window, 'pointerup', { pointerId: 31, button: 0, clientX: -250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    rendered.unmount();
  });

  it('opens the inline house-first editor and commits preset deck dimensions on Enter', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing deck width label.');
    clickElement(widthLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '4.2', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-width"]')?.textContent).toBe('4.2');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.textContent).toContain('4.20m');

    rendered.unmount();
  });

  it('reuses the inline editor for attached deck host-edge relationship dimensions', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const hostGapLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]');
    if (!(hostGapLabel instanceof Element)) throw new Error('Missing deck host-start gap label.');
    clickElement(hostGapLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '0', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent).toBe('-1');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')?.textContent).toContain('0.00m');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostEndGapM"]')?.textContent).toContain('2.00m');

    rendered.unmount();
  });

  it('commits custom footprint edge edits and cancels the inline editor on Escape', async () => {
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'footprint', targetId: 'house-main' }}
        initialHouse={makeHouseFirstHouse({
          footprint: {
            ...makeHouseFirstHouse().footprint,
            mode: 'custom_polygon',
            polygon: [
              { alongM: '0', depthM: '0' },
              { alongM: '6', depthM: '0' },
              { alongM: '6', depthM: '2.4' },
              { alongM: '0', depthM: '2.4' },
            ],
          },
        })}
      />,
    );

    const edgeHit = rendered.container.querySelector('[data-house-first-custom-edge-hit="house-main:edge:0"]');
    if (!edgeHit) throw new Error('Missing custom edge hit target.');
    clickElement(edgeHit);
    await act(async () => {
      await Promise.resolve();
    });

    const edgeLabel = rendered.container.querySelector('[data-editable-field-id="house-main:edge:0"]');
    if (!(edgeLabel instanceof Element)) throw new Error('Missing custom edge label.');
    expect(edgeLabel.textContent).toContain('6.00m');

    clickElement(edgeLabel);
    const cancelInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(cancelInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    act(() => {
      cancelInput.value = '8';
      cancelInput.dispatchEvent(new Event('input', { bubbles: true }));
      cancelInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[aria-label="Edit plan dimension"]')).toBeNull();
    expect(rendered.container.querySelector('[data-testid="footprint-edge-0"]')?.textContent).toBe('6');

    clickElement(edgeLabel);
    const commitInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(commitInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(commitInput, '8', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="footprint-edge-0"]')?.textContent).toBe('8');
    expect(rendered.container.querySelector('[data-editable-field-id="house-main:edge:0"]')?.textContent).toContain('8.00m');

    rendered.unmount();
  });

  it('shows commit errors and keeps the previous deck geometry when a house-first dimension edit is rejected', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        rejectDeckCommit
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const widthLabel = rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]');
    if (!(widthLabel instanceof Element)) throw new Error('Missing deck width label.');
    clickElement(widthLabel);

    const popoverInput = rendered.container.querySelector('[aria-label="Edit plan dimension"] input');
    if (!(popoverInput instanceof HTMLInputElement)) throw new Error('Missing dimension editor input.');
    fillAndCommitDimensionInput(popoverInput, '8', 'enter');
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.textContent).toContain('Deck dimension rejected.');
    expect(rendered.container.querySelector('[data-testid="deck-width"]')?.textContent).toBe('4');
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:widthM"]')?.textContent).toContain('4.00m');

    rendered.unmount();
  });

  it('shows deck snap preview and commits the snapped attached preset placement on release', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-house-first-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 11, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 11, button: 0, buttons: 1, clientX: -250, clientY: 50 });

    expect(scroller.dataset.houseFirstDeckDragActive).toBe('true');
    expect(scroller.dataset.houseFirstDeckSnapState).toBe('snapped');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-snap"]')?.textContent).toBe('snapped');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'Release to snap the deck to the host-edge limit.',
    );
    expect(rendered.container.querySelector('[data-house-first-preview-shape="deck-1"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-house-first-snap-target="snapped"]')).not.toBeNull();

    dispatchPointer(window, 'pointerup', { pointerId: 11, button: 0, clientX: -250, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent).toBe('-1');
    expect(scroller.dataset.houseFirstDeckDragActive).toBe('false');
    expect(scroller.dataset.houseFirstDeckSnapState).toBe('idle');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-snap"]')?.textContent).toBe('idle');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'The deck is now aligned to the host-edge limit.',
    );

    rendered.unmount();
  });

  it('keeps a valid unsnapped offset and surfaces free-placement feedback for attached preset decks', async () => {
    const deck = makeHouseFirstDeck();
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const svg = rendered.container.querySelector('svg[aria-label="Module plan view"]') as SVGSVGElement | null;
    const deckHit = rendered.container.querySelector('[data-house-first-shape-hit="deck:deck-1"]');
    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    if (!svg || !deckHit || !scroller) throw new Error('Missing plan viewport nodes.');
    installSvgPointMock(svg);

    dispatchPointer(deckHit, 'pointerdown', { pointerId: 21, button: 0, clientX: 50, clientY: 50 });
    dispatchPointer(window, 'pointermove', { pointerId: 21, button: 0, buttons: 1, clientX: -150, clientY: 50 });

    expect(scroller.dataset.houseFirstDeckDragActive).toBe('true');
    expect(scroller.dataset.houseFirstDeckSnapState).toBe('free');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-snap"]')?.textContent).toBe('free');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'Release to keep this offset without snapping.',
    );

    dispatchPointer(window, 'pointerup', { pointerId: 21, button: 0, clientX: -150, clientY: 50 });
    await act(async () => {
      await Promise.resolve();
    });

    const freeOffset = Number.parseFloat(
      rendered.container.querySelector('[data-testid="deck-center-offset"]')?.textContent ?? '',
    );
    expect(Number.isFinite(freeOffset)).toBe(true);
    expect(freeOffset).toBeLessThan(0);
    expect(freeOffset).toBeGreaterThan(-1);
    expect(scroller.dataset.houseFirstDeckDragActive).toBe('false');
    expect(scroller.dataset.houseFirstDeckSnapState).toBe('idle');
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'The deck kept a free offset without snapping.',
    );

    rendered.unmount();
  });

  it('marks detached preset decks as deferred and does not expose host-edge relationship dims', async () => {
    const deck = makeHouseFirstDeck({
      isAttached: false,
      presetType: 'rect_detached',
      presetRect: {
        widthM: '4',
        depthM: '3',
        centerOffsetM: '0',
        detachedGapM: '0.6',
      },
    });
    const baseHouse = makeHouseFirstHouse();
    const resolvedDeck = resolveDeckPresetGeometry({
      deck: deck as any,
      housePolygon: baseHouse.footprint.polygon,
    });
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            {
              ...deck,
              hostEdgeId: resolvedDeck.hostEdgeId,
              presetRect: resolvedDeck.presetRect,
              outline: resolvedDeck.outline,
            },
          ],
        })}
      />,
    );

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:detachedGapM"]')).not.toBeNull();
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).toBeNull();
    expect(scroller?.dataset.houseFirstSelectedDeckDragEligible).toBe('false');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'detached_preset_rect',
    );
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-relationship"]')?.textContent).toBe(
      'false',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'Drag and snap currently apply only to attached preset rectangular decks.',
    );

    rendered.unmount();
  });

  it('marks custom decks as deferred without host-edge relationship dimensions', async () => {
    const rendered = renderIntoDocument(
      <HouseFirstViewportHarness
        initialSelection={{ kind: 'deck', targetId: 'deck-1' }}
        initialHouse={makeHouseFirstHouse({
          decks: [
            makeHouseFirstDeck({
              shape: 'custom',
              outline: [
                { alongM: '1', depthM: '0' },
                { alongM: '5', depthM: '0' },
                { alongM: '5', depthM: '-3' },
                { alongM: '1', depthM: '-3' },
              ],
            }),
          ],
        })}
      />,
    );

    const scroller = rendered.container.querySelector('[data-model-space-scroller]') as HTMLElement | null;
    expect(rendered.container.querySelector('[data-editable-field-id="deck-1:hostStartGapM"]')).toBeNull();
    expect(scroller?.dataset.houseFirstSelectedDeckDragEligible).toBe('false');
    expect(rendered.container.querySelector('[data-testid="deck-telemetry-type"]')?.textContent).toBe(
      'custom_outline',
    );
    expect(rendered.container.querySelector('[aria-label="Deck interaction hint"]')?.textContent).toContain(
      'Custom deck dragging is deferred. Use dimensions or redraw the outline.',
    );

    rendered.unmount();
  });
});
