import { useId, type PointerEvent as ReactPointerEvent } from 'react';
import type { AttachmentSide } from '@sp/costing';
import styles from './CalculatorGrid.module.css';
import {
  attachmentSideQuarterTurns,
  buildHouseFootprintLocalLayout,
  type HouseFootprintHandleId,
  type HouseFootprintPoint,
  type ModulePlanModel,
  type ModuleSectionModel,
} from './moduleViews';
import { moduleDrawingThemeCssVariables } from '@/lib/theme/moduleDrawing';
import {
  DEFAULT_ESTIMATE_DRAWING_SCALE,
  getEstimateDrawingScaleOptions,
  type EstimateDrawingScale,
  type EstimateDrawingFixedScaleValue,
} from '@/lib/estimates/drawingSheet';
import {
  getDrawingSheetViewportMm,
  getViewBoxUnitsPerMetreAtScale,
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';

export type ModuleViewsTab = 'plan' | 'section';
export type ModuleViewsStatus = 'loading' | 'ready' | 'error' | 'empty';
type ModuleDrawingPresentation = 'card' | 'minimal' | 'sheet';
export type { HouseFootprintHandleId } from './moduleViews';

export type HouseFootprintEditorDragMeta = {
  handleId: HouseFootprintHandleId;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

type GeometryConsistency = {
  level: 'ok' | 'warn';
  summary: string;
  details: string[];
};

type ModuleFootprintEditorProps = {
  available: boolean;
  isEditing: boolean;
  hoveredAttachmentSide: AttachmentSide | null;
  hoveredHandleId: HouseFootprintHandleId | null;
  activeHandleId: HouseFootprintHandleId | null;
  onStartEditing: () => void;
  onDoneEditing: () => void;
  onAttachmentSideHover: (side: AttachmentSide | null) => void;
  onAttachmentSideSelect: (side: AttachmentSide) => void;
  onHandleHover: (handleId: HouseFootprintHandleId | null) => void;
  onHandleDragStart: (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => void;
  onPresetSelect: (preset: ModulePlanModel['houseFootprintPreset']) => void;
  onRotate: (delta: -1 | 1) => void;
  onSvgMount?: (node: SVGSVGElement | null) => void;
};

type ModuleViewsCardProps = {
  moduleLabel: string;
  view: ModuleViewsTab;
  onViewChange: (next: ModuleViewsTab) => void;
  status: ModuleViewsStatus;
  statusDetail?: string;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  presentation?: 'full' | 'minimal';
  footprintEditor?: ModuleFootprintEditorProps;
};

type ModuleDrawingRendererProps = {
  view: ModuleViewsTab;
  status: ModuleViewsStatus;
  statusDetail?: string;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  presentation?: ModuleDrawingPresentation;
  drawingScale?: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  showDebugOverlays?: boolean;
  footprintEditor?: ModuleFootprintEditorProps;
};

type ModuleDrawingInteractiveField = {
  fieldId: string;
  onActivate: (fieldId: string, target: SVGTextElement) => void;
};

export type ModuleDrawingInteractiveFieldMap = Partial<Record<string, ModuleDrawingInteractiveField>>;

export type ModuleDrawingScaleState = {
  requestedScale: EstimateDrawingScale;
  appliedScale: EstimateDrawingScale;
  fit: DrawingSheetFitResult | null;
  fits: boolean;
  suggestedScale: EstimateDrawingScale;
};

export type ModuleDrawingScaleDiagnostic = {
  scale: EstimateDrawingScale;
  fits: boolean;
  requiredWidthMm: number;
  requiredHeightMm: number;
  availableWidthMm: number;
  availableHeightMm: number;
  utilizationX: number;
  utilizationY: number;
};

const TAB_ITEMS: Array<{ id: ModuleViewsTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'section', label: 'Section' },
];

const STATUS_TEXT: Record<ModuleViewsStatus, string> = {
  loading: 'Updating module geometry...',
  ready: 'Plan schematic ready.',
  error: 'Live geometry is unavailable. Resolve calculation errors to restore derived data.',
  empty: 'Waiting for valid inputs before geometry is available.',
};

const HOUSE_FOOTPRINT_PRESET_OPTIONS: Array<{ id: ModulePlanModel['houseFootprintPreset']; label: string }> = [
  { id: 'straight', label: 'Straight' },
  { id: 'l_left', label: 'L left' },
  { id: 'l_right', label: 'L right' },
  { id: 'recess_left', label: 'Recess left' },
  { id: 'recess_right', label: 'Recess right' },
  { id: 'u_shape', label: 'U shape' },
  { id: 'wrap_left', label: 'Wrap left' },
  { id: 'wrap_right', label: 'Wrap right' },
];

export function canEditHouseFootprintPlan(model?: ModulePlanModel | null): boolean {
  return Boolean(model && model.houseConnectionType !== 'none' && model.supportsHouseFootprints && model.roofType !== 'hip_corner');
}

export default function ModuleViewsCard({
  moduleLabel,
  view,
  onViewChange,
  status,
  statusDetail,
  planModel,
  sectionModel,
  presentation = 'full',
  footprintEditor,
}: ModuleViewsCardProps) {
  const isMinimal = presentation === 'minimal';
  const drawingSurface: ModuleDrawingPresentation = isMinimal ? 'minimal' : 'card';
  const canEditFootprint = !isMinimal && view === 'plan' && Boolean(footprintEditor?.available) && canEditHouseFootprintPlan(planModel);

  return (
    <section
      className={`${styles.moduleViewsCard} ${isMinimal ? styles.moduleViewsCardMinimal : styles.previewCard}`}
      style={moduleDrawingThemeCssVariables(drawingSurface)}
      aria-label="Module views"
    >
      <div className={styles.moduleViewsHeader}>
        {isMinimal ? null : (
          <div className={styles.moduleViewsTitleWrap}>
            <h2 className={styles.previewCardTitle}>Module views</h2>
            <div className={styles.moduleViewsSubtitle}>{moduleLabel}</div>
          </div>
        )}

        <div className={styles.moduleViewsControls}>
          <div className={styles.moduleViewsTabs} role="tablist" aria-label="View type">
            {TAB_ITEMS.map((item) => {
              const active = item.id === view;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? `${styles.moduleViewsTabButton} ${styles.moduleViewsTabButtonActive}` : styles.moduleViewsTabButton}
                  onClick={() => onViewChange(item.id)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          {canEditFootprint ? (
            <button
              type="button"
              className={
                footprintEditor?.isEditing
                  ? `${styles.moduleViewsSecondaryButton} ${styles.moduleViewsSecondaryButtonActive}`
                  : styles.moduleViewsSecondaryButton
              }
              onClick={footprintEditor?.isEditing ? footprintEditor.onDoneEditing : footprintEditor?.onStartEditing}
            >
              {footprintEditor?.isEditing ? 'Done' : 'Edit footprint'}
            </button>
          ) : null}
        </div>
      </div>

      <ModuleDrawingRenderer
        view={view}
        status={status}
        statusDetail={statusDetail}
        planModel={planModel}
        sectionModel={sectionModel}
        presentation={drawingSurface}
        footprintEditor={canEditFootprint ? footprintEditor : undefined}
      />

      {isMinimal ? null : (
        <div className={styles.moduleViewsMeta}>
          <span>Not to scale</span>
          <span>{view === 'plan' ? 'Plan schematic' : 'Section schematic'}</span>
        </div>
      )}
    </section>
  );
}

export function ModuleDrawingRenderer({
  view,
  status,
  statusDetail,
  planModel,
  sectionModel,
  presentation = 'card',
  drawingScale = DEFAULT_ESTIMATE_DRAWING_SCALE,
  sheetViewportMm,
  interactiveFields,
  showDebugOverlays,
  footprintEditor,
}: ModuleDrawingRendererProps) {
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isCompact = presentation !== 'card';
  const showPlan = view === 'plan' && Boolean(planModel);
  const showSection = view === 'section' && Boolean(sectionModel);
  const planConsistency = planModel ? checkPlanConsistency(planModel) : null;
  const sectionConsistency = sectionModel ? checkSectionConsistency(sectionModel) : null;
  const sectionOverhangDisplayM = sectionModel ? sectionOverhangM(sectionModel) : 0;
  const sectionOuterDisplayM = sectionModel ? sectionOuterGutterUndersideM(sectionModel) : null;
  const sectionSupportDisplayM = sectionModel ? sectionSupportUndersideM(sectionModel) : null;
  const sectionRafterCutDisplay = sectionModel ? sectionRafterCutLengthLabel(sectionModel) : null;
  const activeConsistency = view === 'plan' ? planConsistency : sectionConsistency;
  const stateText = view === 'section' && status === 'ready' ? 'Section schematic ready.' : STATUS_TEXT[status];
  const svgId = useId().replace(/:/g, '_');
  const sheetScaleState =
    presentation === 'sheet'
      ? resolveModuleDrawingScaleState({
          view,
          requestedScale: drawingScale,
          planModel,
          sectionModel,
          viewportMm: sheetViewportMm,
        })
      : null;
  const sheetScaleDiagnostics =
    presentation === 'sheet'
      ? getModuleDrawingScaleDiagnostics({
          view,
          planModel,
          sectionModel,
          viewportMm: sheetViewportMm,
        })
      : [];
  const appliedDrawingScale = sheetScaleState?.appliedScale ?? drawingScale;

  return (
    <div
      className={`${styles.moduleViewsStage} ${isCompact ? styles.moduleViewsStageBare : ''} ${
        presentation === 'sheet' ? styles.moduleViewsStageSheet : ''
      }`}
      aria-live="polite"
    >
      {showPlan && planModel ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''}`}>
          {isCompact ? null : (
            <div className={styles.modulePlanSourceRow}>
              <div className={planModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {planModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
              </div>
              {planConsistency ? (
                <div className={planConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {planConsistency.level === 'ok' ? 'Geometry OK' : `Check ${planConsistency.details.length}`}
                </div>
              ) : null}
            </div>
          )}
          <div className={styles.modulePlanCanvas}>
            {presentation === 'card' && footprintEditor?.available && footprintEditor.isEditing ? (
              <div className={styles.moduleFootprintToolbar} aria-label="House footprint editor">
                <div className={styles.moduleFootprintToolbarGroup}>
                  <label className={styles.moduleFootprintToolbarField}>
                    <span className={styles.moduleFootprintToolbarFieldLabel}>Preset</span>
                    <select
                      aria-label="House footprint preset"
                      className={styles.moduleFootprintToolbarSelect}
                      value={planModel.houseFootprintPreset}
                      onChange={(event) => footprintEditor.onPresetSelect(event.target.value as ModulePlanModel['houseFootprintPreset'])}
                    >
                      {HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className={styles.moduleFootprintToolbarGroup}>
                  <button type="button" className={styles.moduleFootprintToolbarButton} onClick={() => footprintEditor.onRotate(-1)}>
                    Rotate -90
                  </button>
                  <button type="button" className={styles.moduleFootprintToolbarButton} onClick={() => footprintEditor.onRotate(1)}>
                    Rotate +90
                  </button>
                </div>
              </div>
            ) : null}
            <PlanSvg
              model={planModel}
              idBase={`${svgId}_plan`}
              presentation={presentation}
              drawingScale={appliedDrawingScale}
              sheetViewportMm={sheetViewportMm}
              debugScaleState={sheetScaleState}
              scaleDiagnostics={sheetScaleDiagnostics}
              interactiveFields={interactiveFields}
              showDebugOverlays={effectiveShowDebugOverlays}
              footprintEditor={presentation === 'card' ? footprintEditor : undefined}
            />
          </div>
          {isCompact ? null : (
            <>
              <LegendRow
                items={
                  planModel.houseConnectionType === 'none'
                    ? hasFullLengthPlanRidge(planModel.roofType)
                      ? ['Frame member', 'Rafters', 'Ridge beam']
                      : ['Frame member', 'Rafters']
                    : planModel.houseConnectionType === 'soffit'
                      ? hasFullLengthPlanRidge(planModel.roofType)
                        ? ['Frame member', 'Rafters', 'Ridge beam', 'Soffit brackets', 'House side']
                        : ['Frame member', 'Rafters', 'Soffit brackets', 'House side']
                      : hasFullLengthPlanRidge(planModel.roofType)
                        ? ['Frame member', 'Rafters', 'Ridge beam', 'House side']
                        : ['Frame member', 'Rafters', 'House side']
                }
              />
              <div className={styles.modulePlanStats}>
                <span className={styles.modulePlanStat}>{`A: ${formatMetres(planModel.lengthA)} x ${formatMetres(planModel.spanA)}`}</span>
                {planModel.roofType === 'hip_corner' && planModel.lengthB && planModel.spanB ? (
                  <span className={styles.modulePlanStat}>{`B: ${formatMetres(planModel.lengthB)} x ${formatMetres(planModel.spanB)}`}</span>
                ) : null}
                <span className={styles.modulePlanStat}>{`Roof: ${roofTypeLabel(planModel.roofType)}`}</span>
                <span className={styles.modulePlanStat}>{`Rafters: ${planModel.rafterCountA} @ ${formatMetres(planModel.rafterSpacingA)} c/c`}</span>
                {hasFullLengthPlanRidge(planModel.roofType) ? (
                  <span className={styles.modulePlanStat}>{`Ridge beam: ${Math.round(planModel.ridgeBeamDepthM * 1000)}x${Math.round(planModel.ridgeBeamWidthM * 1000)}mm`}</span>
                ) : null}
                {planModel.houseConnectionType === 'soffit' ? (
                  <span className={styles.modulePlanStat}>{`Soffit brackets: ${planModel.soffitBracketPositionsA.length}`}</span>
                ) : null}
                {planModel.boxPerimeterEnabled ? <span className={styles.modulePlanStat}>Box perimeter enabled</span> : null}
              </div>
            </>
          )}
        </div>
      ) : showSection && sectionModel ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''}`}>
          {isCompact ? null : (
            <div className={styles.modulePlanSourceRow}>
              <div className={sectionModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {sectionModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
              </div>
              {sectionConsistency ? (
                <div className={sectionConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {sectionConsistency.level === 'ok' ? 'Geometry OK' : `Check ${sectionConsistency.details.length}`}
                </div>
              ) : null}
            </div>
          )}
          <SectionSvg
            model={sectionModel}
            presentation={presentation}
            drawingScale={appliedDrawingScale}
            sheetViewportMm={sheetViewportMm}
            debugScaleState={sheetScaleState}
            scaleDiagnostics={sheetScaleDiagnostics}
            interactiveFields={interactiveFields}
            showDebugOverlays={effectiveShowDebugOverlays}
          />
          {isCompact ? null : (
            <>
              <LegendRow
                items={
                  sectionModel.sectionKind === 'gable'
                    ? ['Primary frame', 'Internal roof line', 'Ridge beam', 'Tie beam / king strut']
                    : sectionModel.overhangEnabled && sectionModel.overhangAmountM > 0
                      ? ['Primary frame', 'Internal roof line', 'Overhang support']
                      : ['Primary frame', 'Internal roof line']
                }
              />
              <div className={styles.modulePlanStats}>
                <span className={styles.modulePlanStat}>{`Span: ${formatMetres(sectionModel.spanA)}`}</span>
                <span className={styles.modulePlanStat}>{`Pitch: ${sectionModel.pitchDeg.toFixed(1)} deg`}</span>
                <span className={styles.modulePlanStat}>{`House: ${formatMetres(sectionModel.leftEdgeHeightM)}`}</span>
                <span className={styles.modulePlanStat}>{`Outer: ${formatMetres(sectionOuterDisplayM ?? sectionModel.rightEdgeHeightM)}`}</span>
                {sectionOverhangDisplayM > 0 ? <span className={styles.modulePlanStat}>{`Support: ${formatMetres(sectionSupportDisplayM ?? sectionModel.rightEdgeHeightM)}`}</span> : null}
                <span className={styles.modulePlanStat}>{`Post: ${Math.round(sectionModel.postDepthM * 1000)}x${Math.round(sectionModel.postWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Rafter: ${Math.round(sectionModel.rafterDepthM * 1000)}x${Math.round(sectionModel.rafterWidthM * 1000)}mm`}</span>
                {sectionRafterCutDisplay ? <span className={styles.modulePlanStat}>{sectionRafterCutDisplay}</span> : null}
                <span className={styles.modulePlanStat}>{`Ledger: ${Math.round(sectionModel.ledgerBeamDepthM * 1000)}x${Math.round(sectionModel.ledgerBeamWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Support beam: ${Math.round(sectionModel.supportBeamDepthM * 1000)}x${Math.round(sectionModel.supportBeamWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Gutter: ${Math.round(sectionModel.gutterDepthM * 1000)}x${Math.round(sectionModel.gutterWidthM * 1000)}mm`}</span>
                {typeof sectionModel.ridgeHeightM === 'number' ? (
                  <span className={styles.modulePlanStat}>{`Ridge beam: ${Math.round(sectionModel.ridgeBeamDepthM * 1000)}x${Math.round(sectionModel.ridgeBeamWidthM * 1000)}mm`}</span>
                ) : null}
                {typeof sectionModel.ridgeHeightM === 'number' ? (
                  <span className={styles.modulePlanStat}>{`Ridge: ${formatMetres(sectionModel.ridgeHeightM)}`}</span>
                ) : null}
                {sectionOverhangDisplayM > 0 ? <span className={styles.modulePlanStat}>{`Overhang: ${formatMetres(sectionOverhangDisplayM)}`}</span> : null}
                {sectionModel.boxPerimeterEnabled && sectionModel.boxRiseM ? (
                  <span className={styles.modulePlanStat}>{`Box fall: ${formatMetres(sectionModel.boxRiseM)}`}</span>
                ) : null}
                {sectionModel.roofType === 'hip_corner' ? <span className={styles.modulePlanStat}>Primary wing section (A)</span> : null}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className={`${styles.moduleViewsStateText} ${presentation === 'sheet' ? styles.moduleViewsStateTextSheet : ''}`}>{stateText}</p>
      )}
      {statusDetail ? <p className={styles.moduleViewsStateDetail}>{statusDetail}</p> : null}
      {isCompact
        ? null
        : activeConsistency ? (
            <p className={activeConsistency.level === 'ok' ? styles.moduleViewsConsistencyOk : styles.moduleViewsConsistencyWarn}>
              {activeConsistency.summary}
            </p>
          ) : null}
      {isCompact || !activeConsistency || activeConsistency.level !== 'warn' ? null : (
        <div className={styles.moduleViewsConsistencyList}>
          {activeConsistency.details.slice(0, 4).map((detail, idx) => (
            <p key={`${detail}-${idx}`} className={styles.moduleViewsConsistencyItem}>
              {detail}
            </p>
          ))}
          {activeConsistency.details.length > 4 ? (
            <p className={styles.moduleViewsConsistencyItem}>{`+${activeConsistency.details.length - 4} more`}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

type Point = { x: number; y: number };

type TickDimensionProps = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  textX?: number;
  textY?: number;
  rotateDeg?: number;
  overrun?: number;
  showTermBars?: boolean;
  presentation?: ModuleDrawingPresentation;
  interactiveField?: ModuleDrawingInteractiveField;
};

type DimensionPresentationSpec = {
  tickHalf: number;
  barHalf: number;
  barOffset: number;
  labelClearance: number;
  horizontalLabelGap: number;
  verticalLabelGap: number;
};

type TickDimensionGeometry = {
  lineStartX: number;
  lineStartY: number;
  lineEndX: number;
  lineEndY: number;
  tick1StartX: number;
  tick1StartY: number;
  tick1EndX: number;
  tick1EndY: number;
  tick2StartX: number;
  tick2StartY: number;
  tick2EndX: number;
  tick2EndY: number;
  labelX: number;
  labelY: number;
  labelRotate?: number;
  termBar1?: { x1: number; y1: number; x2: number; y2: number };
  termBar2?: { x1: number; y1: number; x2: number; y2: number };
};

type SvgDebugScaleProps = {
  scaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
};

function formatMetres(value: number): string {
  return `${value.toFixed(2)}m`;
}

function formatMetresPrecise(value: number, decimals = 3): string {
  return `${value.toFixed(decimals)}m`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDimensionPresentationSpec(presentation: ModuleDrawingPresentation): DimensionPresentationSpec {
  if (presentation === 'sheet') {
    return {
      tickHalf: 0.74,
      barHalf: 0.52,
      barOffset: 0.42,
      labelClearance: 2.05,
      horizontalLabelGap: 2.15,
      verticalLabelGap: 3.05,
    };
  }

  return {
    tickHalf: 0.96,
    barHalf: 0.68,
    barOffset: 0.52,
    labelClearance: 1.82,
    horizontalLabelGap: 2.05,
    verticalLabelGap: 2.78,
  };
}

function roofTypeLabel(roofType: ModulePlanModel['roofType']): string {
  if (roofType === 'hip_corner') return 'Hip corner';
  if (roofType === 'low_gable') return 'Low gable';
  if (roofType === 'gable') return 'Gable';
  if (roofType === 'hip') return 'Hip';
  return 'Pitched';
}

function hasFullLengthPlanRidge(roofType: ModulePlanModel['roofType']): boolean {
  return roofType === 'gable' || roofType === 'low_gable';
}

function memberSizeM(value: number | null | undefined, fallbackM: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallbackM;
}

type PlanFitBox = {
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};

type SheetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SheetDrawingField = SheetRect;
type SheetFitArea = SheetRect;
type AnnotatedBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type BoundsInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type LayoutOffset = {
  dx: number;
  dy: number;
};

type DebugOutlineProps = {
  rect: SheetRect;
  className: string;
  marker: string;
};

function getSheetDrawingField(): SheetDrawingField {
  // Keep the outer field flush to the top/left/right edges, but reserve the
  // lower title-block band so the sheet field stops at the top of the block.
  // The footer metadata has been compacted into the right rail, so the sheet
  // can reclaim a little more vertical drawing area than before.
  return {
    x: 0,
    y: 0,
    width: 120,
    height: 86.0,
  };
}

function DebugOutline({ rect, className, marker }: DebugOutlineProps) {
  const inset = 0.16;
  const rawX1 = rect.x;
  const rawY1 = rect.y;
  const rawX2 = rect.x + rect.width;
  const rawY2 = rect.y + rect.height;
  const x1 = rawX1 <= 0 ? rawX1 + inset : rawX1;
  const y1 = rawY1 <= 0 ? rawY1 + inset : rawY1;
  const x2 = rawX2 >= 120 ? rawX2 - inset : rawX2;
  const y2 = rawY2 >= 90 ? rawY2 - inset : rawY2;

  return (
    <g data-debug-crop={marker} aria-hidden="true">
      <line x1={x1} y1={y1} x2={x2} y2={y1} className={className} />
      <line x1={x1} y1={y1} x2={x1} y2={y2} className={className} />
      <line x1={x2} y1={y1} x2={x2} y2={y2} className={className} />
      <line x1={x1} y1={y2} x2={x2} y2={y2} className={className} />
    </g>
  );
}

function insetRect(rect: SheetRect, insets: BoundsInsets): SheetRect {
  return {
    x: rect.x + insets.left,
    y: rect.y + insets.top,
    width: Math.max(0.1, rect.width - insets.left - insets.right),
    height: Math.max(0.1, rect.height - insets.top - insets.bottom),
  };
}

function createBounds(minX: number, minY: number, maxX: number, maxY: number): AnnotatedBounds {
  return { minX, minY, maxX, maxY };
}

function boundsFromRect(x: number, y: number, width: number, height: number): AnnotatedBounds {
  return createBounds(
    Math.min(x, x + width),
    Math.min(y, y + height),
    Math.max(x, x + width),
    Math.max(y, y + height),
  );
}

function boundsFromLine(x1: number, y1: number, x2: number, y2: number, pad = 0): AnnotatedBounds {
  return createBounds(Math.min(x1, x2) - pad, Math.min(y1, y2) - pad, Math.max(x1, x2) + pad, Math.max(y1, y2) + pad);
}

function boundsFromPoints(points: Point[], pad = 0): AnnotatedBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return createBounds(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad);
}

function unionBounds(bounds: Array<AnnotatedBounds | null | undefined>): AnnotatedBounds {
  const valid = bounds.filter((entry): entry is AnnotatedBounds => Boolean(entry));
  if (valid.length === 0) return createBounds(0, 0, 0, 0);

  return createBounds(
    Math.min(...valid.map((entry) => entry.minX)),
    Math.min(...valid.map((entry) => entry.minY)),
    Math.max(...valid.map((entry) => entry.maxX)),
    Math.max(...valid.map((entry) => entry.maxY)),
  );
}

function translateBounds(bounds: AnnotatedBounds, dx: number, dy: number): AnnotatedBounds {
  return createBounds(bounds.minX + dx, bounds.minY + dy, bounds.maxX + dx, bounds.maxY + dy);
}

function getBoundsWidth(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxX - bounds.minX);
}

function getBoundsHeight(bounds: AnnotatedBounds): number {
  return Math.max(0, bounds.maxY - bounds.minY);
}

function resolveBoundsPlacement(bounds: AnnotatedBounds, fitArea: SheetFitArea, verticalBias: number): LayoutOffset {
  const slackX = Math.max(0, fitArea.width - getBoundsWidth(bounds));
  const slackY = Math.max(0, fitArea.height - getBoundsHeight(bounds));
  return {
    dx: fitArea.x - bounds.minX + slackX / 2,
    dy: fitArea.y - bounds.minY + slackY * verticalBias,
  };
}

function fitsWithinArea(bounds: AnnotatedBounds, fitArea: SheetFitArea): boolean {
  return getBoundsWidth(bounds) <= fitArea.width + 1e-6 && getBoundsHeight(bounds) <= fitArea.height + 1e-6;
}

function estimateTextBounds(input: {
  text: string;
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  fontHeight: number;
  charWidth: number;
  paddingX?: number;
  paddingY?: number;
  rotateDeg?: number;
}): AnnotatedBounds {
  const width = Math.max(input.fontHeight * 0.9, input.text.length * input.charWidth + (input.paddingX ?? 0) * 2);
  const height = input.fontHeight + (input.paddingY ?? 0) * 2;
  const anchor = input.anchor ?? 'middle';
  const baseX = anchor === 'middle' ? input.x - width / 2 : anchor === 'end' ? input.x - width : input.x;
  const baseY = input.y - height / 2;
  const rect = boundsFromRect(baseX, baseY, width, height);

  if ((input.rotateDeg ?? 0) % 180 === 0) return rect;

  const corners: Point[] = [
    { x: rect.minX, y: rect.minY },
    { x: rect.maxX, y: rect.minY },
    { x: rect.maxX, y: rect.maxY },
    { x: rect.minX, y: rect.maxY },
  ];
  const rad = ((input.rotateDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return boundsFromPoints(
    corners.map((corner) => ({
      x: input.x + (corner.x - input.x) * cos - (corner.y - input.y) * sin,
      y: input.y + (corner.x - input.x) * sin + (corner.y - input.y) * cos,
    })),
  );
}

function evaluateAnnotatedSheetFit(input: {
  bounds: AnnotatedBounds;
  fitArea: SheetFitArea;
  viewportMm?: { widthMm: number; heightMm: number };
}): DrawingSheetFitResult {
  return {
    fits: fitsWithinArea(input.bounds, input.fitArea),
    requiredWidthMm: viewBoxUnitsToMm(getBoundsWidth(input.bounds), input.viewportMm),
    requiredHeightMm: viewBoxUnitsToMm(getBoundsHeight(input.bounds), input.viewportMm),
    availableWidthMm: viewBoxUnitsToMm(input.fitArea.width, input.viewportMm),
    availableHeightMm: viewBoxUnitsToMm(input.fitArea.height, input.viewportMm),
  };
}

type PlanSheetFrame = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  annotationPadLeft: number;
  annotationPadRight: number;
  annotationPadTop: number;
  annotationPadBottom: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
  verticalBias: number;
};

function getPlanSheetFrame(isHipCorner: boolean): PlanSheetFrame {
  const outerField = getSheetDrawingField();
  const annotationPadLeft = 0;
  const annotationPadRight = 0;
  const annotationPadTop = 0;
  const annotationPadBottom = 0;
  return {
    outerField,
    fitArea: outerField,
    annotationPadLeft,
    annotationPadRight,
    annotationPadTop,
    annotationPadBottom,
    houseBandHeight: 5.3,
    houseBandOffset: 1.15,
    houseInset: 1.7,
    fallGap: 5.0,
    verticalBias: 0.02,
  };
}

function resolvePlanFitBox(totalW: number, totalH: number, presentation: ModuleDrawingPresentation, isHipCorner: boolean): PlanFitBox {
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  if (presentation === 'sheet') {
    const frame = getPlanSheetFrame(isHipCorner);
    const maxW = frame.fitArea.width;
    const maxH = frame.fitArea.height;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    const slackY = Math.max(0, maxH - heightPx);
    return {
      x: frame.fitArea.x + (maxW - widthPx) / 2,
      y: frame.fitArea.y + slackY * frame.verticalBias,
      scale,
      houseBandHeight: frame.houseBandHeight,
      houseBandOffset: frame.houseBandOffset,
      houseInset: frame.houseInset,
      fallGap: frame.fallGap,
    };
  }

  const maxW = 74;
  const maxH = 42;
  const scale = Math.min(maxW / safeW, maxH / safeH);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  return {
    x: 23 + (maxW - widthPx) / 2,
    y: 20 + (maxH - heightPx) / 2,
    scale,
    houseBandHeight: 8,
    houseBandOffset: 2,
    houseInset: 2,
    fallGap: 8,
  };
}

function resolvePlanFixedScaleBox(
  totalW: number,
  totalH: number,
  isHipCorner: boolean,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): PlanFitBox {
  const frame = getPlanSheetFrame(isHipCorner);
  const safeW = Math.max(totalW, 0.1);
  const safeH = Math.max(totalH, 0.1);
  const maxW = frame.fitArea.width;
  const maxH = frame.fitArea.height;
  const scale = getViewBoxUnitsPerMetreAtScale(ratio, viewportMm);
  const widthPx = safeW * scale;
  const heightPx = safeH * scale;
  const slackY = Math.max(0, maxH - heightPx);

  return {
    x: frame.fitArea.x + (maxW - widthPx) / 2,
    y: frame.fitArea.y + slackY * frame.verticalBias,
    scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
  };
}

type SectionFitFrame = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  verticalBias: number;
  annotationPadLeft: number;
  annotationPadRight: number;
  annotationPadTop: number;
  annotationPadBottom: number;
};

function getSectionSheetFrame(sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  const outerField = getSheetDrawingField();
  return {
    outerField,
    fitArea: outerField,
    verticalBias: 0.2,
    annotationPadLeft: 0,
    annotationPadRight: 0,
    annotationPadTop: 0,
    annotationPadBottom: 0,
  };
}

function resolveSectionFitFrame(presentation: ModuleDrawingPresentation, sectionKind: ModuleSectionModel['sectionKind']): SectionFitFrame {
  if (presentation === 'sheet') {
    return getSectionSheetFrame(sectionKind);
  }

  return {
    outerField: { x: 18, y: 16, width: 84, height: 56 },
    fitArea: { x: 27, y: 22, width: 66, height: 40 },
    verticalBias: 0.3,
    annotationPadLeft: 9,
    annotationPadRight: 9,
    annotationPadTop: 6,
    annotationPadBottom: 10,
  };
}

function viewBoxUnitsToMm(value: number, viewportMm?: { widthMm: number; heightMm: number }): number {
  return value / getViewBoxUnitsPerMm(viewportMm);
}

function getPlanRealExtents(model: ModulePlanModel): { widthM: number; heightM: number } {
  const widthM = model.roofType === 'hip_corner' ? Math.max(model.lengthA, model.lengthB ?? 0) : model.lengthA;
  const heightM = model.roofType === 'hip_corner' ? model.spanA + (model.spanB ?? 0) : model.spanA;
  if (model.roofType === 'hip_corner' || model.drawingRotationQuarterTurns % 2 === 0) {
    return { widthM, heightM };
  }
  return { widthM: heightM, heightM: widthM };
}

function getSectionRealExtents(model: ModuleSectionModel): { widthM: number; heightM: number } {
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionLedgerBeamDepthM(model);
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : sectionSupportBeamDepthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportUndersideM = sectionSupportUndersideM(model);
  const supportBeamTopM = supportUndersideM + sectionSupportBeamDepthM(model);
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;

  const maxHeightM = Math.max(
    0.1,
    houseLedgerUndersideM,
    model.rightEdgeHeightM,
    supportUndersideM,
    outerGutterUndersideM,
    houseRafterUndersideM,
    supportRafterUndersideM,
    supportBeamTopM,
    outerRafterUndersideM,
    houseRafterUndersideM + model.rafterDepthM,
    outerRafterUndersideM + model.rafterDepthM,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : 0,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM + ridgeBeamDepthM + model.rafterDepthM : 0,
  );

  return {
    widthM: Math.max(model.spanA, 0.001),
    heightM: maxHeightM,
  };
}

function getPlanScaleFit(
  model: ModulePlanModel,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): DrawingSheetFitResult {
  const layout = resolvePlanSheetLayout({
    model,
    drawingScale: { mode: 'fixed', ratio },
    viewportMm,
  });
  return evaluateAnnotatedSheetFit({
    bounds: layout.annotatedBounds,
    fitArea: layout.fitArea,
    viewportMm,
  });
}

function getSectionScaleFit(
  model: ModuleSectionModel,
  ratio: EstimateDrawingFixedScaleValue,
  viewportMm?: { widthMm: number; heightMm: number },
): DrawingSheetFitResult {
  const layout = resolveSectionSheetLayout({
    model,
    drawingScale: { mode: 'fixed', ratio },
    viewportMm,
  });
  return evaluateAnnotatedSheetFit({
    bounds: layout.annotatedBounds,
    fitArea: layout.fitArea,
    viewportMm,
  });
}

function toScaleDiagnostic(scale: EstimateDrawingScale, fit: DrawingSheetFitResult | null): ModuleDrawingScaleDiagnostic {
  const availableWidthMm = fit?.availableWidthMm ?? 0;
  const availableHeightMm = fit?.availableHeightMm ?? 0;
  const requiredWidthMm = fit?.requiredWidthMm ?? 0;
  const requiredHeightMm = fit?.requiredHeightMm ?? 0;
  return {
    scale,
    fits: fit?.fits ?? scale.mode === 'fit',
    requiredWidthMm,
    requiredHeightMm,
    availableWidthMm,
    availableHeightMm,
    utilizationX: availableWidthMm > 0 ? requiredWidthMm / availableWidthMm : 0,
    utilizationY: availableHeightMm > 0 ? requiredHeightMm / availableHeightMm : 0,
  };
}

export function getModuleDrawingScaleDiagnostics(input: {
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): ModuleDrawingScaleDiagnostic[] {
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();
  return getEstimateDrawingScaleOptions(input.view)
    .filter((scale): scale is Extract<EstimateDrawingScale, { mode: 'fixed' }> => scale.mode === 'fixed')
    .map((scale) => {
      const fit =
        input.view === 'plan'
          ? input.planModel
            ? getPlanScaleFit(input.planModel, scale.ratio, viewportMm)
            : null
          : input.sectionModel
            ? getSectionScaleFit(input.sectionModel, scale.ratio, viewportMm)
            : null;
      return toScaleDiagnostic(scale, fit);
    });
}

export function getSuggestedModuleDrawingScale(input: {
  view: ModuleViewsTab;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): EstimateDrawingScale {
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();

  for (const option of getEstimateDrawingScaleOptions(input.view)) {
    if (option.mode !== 'fixed') continue;
    const fit =
      input.view === 'plan'
        ? input.planModel
          ? getPlanScaleFit(input.planModel, option.ratio, viewportMm)
          : null
        : input.sectionModel
          ? getSectionScaleFit(input.sectionModel, option.ratio, viewportMm)
          : null;

    if (fit?.fits) return option;
  }

  return DEFAULT_ESTIMATE_DRAWING_SCALE;
}

export function resolveModuleDrawingScaleState(input: {
  view: ModuleViewsTab;
  requestedScale?: EstimateDrawingScale;
  planModel?: ModulePlanModel | null;
  sectionModel?: ModuleSectionModel | null;
  viewportMm?: { widthMm: number; heightMm: number };
}): ModuleDrawingScaleState {
  const requestedScale = input.requestedScale ?? DEFAULT_ESTIMATE_DRAWING_SCALE;
  const viewportMm = input.viewportMm ?? getDrawingSheetViewportMm();
  const suggestedScale = getSuggestedModuleDrawingScale({
    view: input.view,
    planModel: input.planModel,
    sectionModel: input.sectionModel,
    viewportMm,
  });

  if (requestedScale.mode !== 'fixed') {
    return {
      requestedScale,
      appliedScale: requestedScale,
      fit: null,
      fits: true,
      suggestedScale,
    };
  }

  const fit =
    input.view === 'plan'
      ? input.planModel
        ? getPlanScaleFit(input.planModel, requestedScale.ratio, viewportMm)
        : null
      : input.sectionModel
        ? getSectionScaleFit(input.sectionModel, requestedScale.ratio, viewportMm)
        : null;

  return {
    requestedScale,
    appliedScale: fit?.fits ? requestedScale : DEFAULT_ESTIMATE_DRAWING_SCALE,
    fit,
    fits: fit?.fits ?? false,
    suggestedScale,
  };
}

function summariseConsistency(issues: string[]): GeometryConsistency {
  if (issues.length === 0) {
    return {
      level: 'ok',
      summary: 'Geometry consistency checks passed.',
      details: [],
    };
  }
  return {
    level: 'warn',
    summary: `${issues.length} geometry consistency issue${issues.length === 1 ? '' : 's'} detected.`,
    details: issues,
  };
}

function checkPlanConsistency(model: ModulePlanModel): GeometryConsistency {
  const issues: string[] = [];
  const tolM = 0.02;
  const spacingTolM = 0.03;

  if (!(model.lengthA > 0)) issues.push('A length must be > 0.');
  if (!(model.spanA > 0)) issues.push('A span must be > 0.');
  if (model.overhangEnabled && model.overhangAmountM >= model.spanA - 1e-6) {
    issues.push(`Overhang ${formatMetres(model.overhangAmountM)} is not less than span ${formatMetres(model.spanA)}.`);
  }

  if (hasFullLengthPlanRidge(model.roofType)) {
    const sideFrameWidthM = memberSizeM(model.supportBeamWidthM, 0.05);
    const ridgeLengthM = model.lengthA - sideFrameWidthM * 2;
    if (ridgeLengthM <= 0) {
      issues.push('Ridge beam does not fit between end frame members.');
    }
  }

  if (model.rafterPositionsA.length !== model.rafterCountA) {
    issues.push(`Rafter count mismatch: positions=${model.rafterPositionsA.length}, count=${model.rafterCountA}.`);
  }
  if (model.rafterPositionsA.length >= 2) {
    const start = model.rafterPositionsA[0] ?? 0;
    const end = model.rafterPositionsA[model.rafterPositionsA.length - 1] ?? 0;
    if (Math.abs(start) > tolM || Math.abs(end - model.rafterEdgeLengthM) > tolM) {
      issues.push('Rafter extents do not align with A length bounds.');
    }

    const spacings = model.rafterPositionsA.slice(1).map((pos, idx) => pos - (model.rafterPositionsA[idx] ?? 0));
    const maxSpacing = Math.max(...spacings);
    if (maxSpacing > model.rafterMaxSpacingM + 1e-6) {
      issues.push(`Rafter spacing exceeds max (${formatMetres(maxSpacing)} > ${formatMetres(model.rafterMaxSpacingM)}).`);
    }
    const maxSpacingDelta = Math.max(...spacings.map((spacing) => Math.abs(spacing - model.rafterSpacingA)));
    if (maxSpacingDelta > spacingTolM) {
      issues.push(`Rafter spacing is non-uniform beyond tolerance (${formatMetres(maxSpacingDelta)}).`);
    }
  }

  if (model.houseConnectionType === 'soffit' && model.soffitBracketPositionsA.length >= 2) {
    const start = model.soffitBracketPositionsA[0] ?? 0;
    const end = model.soffitBracketPositionsA[model.soffitBracketPositionsA.length - 1] ?? 0;
    if (
      Math.abs(start - model.soffitBracketOffsetM) > tolM ||
      Math.abs(end - (model.attachmentEdgeLengthM - model.soffitBracketOffsetM)) > tolM
    ) {
      issues.push('Soffit bracket start/end offsets do not match configured offset.');
    }
    const bracketSpacings = model.soffitBracketPositionsA.slice(1).map((pos, idx) => pos - (model.soffitBracketPositionsA[idx] ?? 0));
    if (bracketSpacings.some((spacing) => spacing > model.soffitBracketMaxSpacingM + 1e-6)) {
      issues.push('Soffit bracket spacing exceeds configured maximum.');
    }
  }

  if (model.roofType === 'hip_corner' && model.lengthB && model.rafterPositionsB) {
    if (model.rafterPositionsB.length !== (model.rafterCountB ?? model.rafterPositionsB.length)) {
      issues.push('Hip corner B rafter count mismatch.');
    }
    if (model.rafterPositionsB.length >= 2) {
      const start = model.rafterPositionsB[0] ?? 0;
      const end = model.rafterPositionsB[model.rafterPositionsB.length - 1] ?? 0;
      if (Math.abs(start) > tolM || Math.abs(end - model.lengthB) > tolM) {
        issues.push('Hip corner B rafter extents do not align with B length.');
      }
    }
  }

  return summariseConsistency(issues);
}

function checkSectionConsistency(model: ModuleSectionModel): GeometryConsistency {
  const issues: string[] = [];
  const pitchTolDeg = 0.35;
  const heightTolM = 0.03;

  if (!(model.spanA > 0)) issues.push('Span must be > 0.');
  if (model.leftEdgeHeightM < 0 || model.rightEdgeHeightM < 0) issues.push('Post underside heights must be non-negative.');

  const overhangM = model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, model.overhangAmountM) : 0;
  if (overhangM > model.spanA + 1e-6) {
    issues.push(`Overhang ${formatMetres(overhangM)} exceeds span ${formatMetres(model.spanA)}.`);
  }

  const supportXFromHouseM = model.sectionKind === 'mono' ? model.spanA - overhangM : model.spanA;
  if (model.sectionKind === 'mono' && overhangM > 0 && supportXFromHouseM <= 0) {
    issues.push('Support position is non-positive after overhang.');
  }

  if (model.sectionKind === 'mono' && model.spanA > 0) {
    const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
    const fallM = outerGutterUndersideM - model.leftEdgeHeightM;
    const impliedPitchDeg = (Math.atan(Math.abs(fallM) / model.spanA) * 180) / Math.PI;
    if (Math.abs(impliedPitchDeg - model.pitchDeg) > pitchTolDeg) {
      issues.push(`Pitch mismatch: model ${model.pitchDeg.toFixed(2)} deg vs implied ${impliedPitchDeg.toFixed(2)} deg.`);
    }

    if (model.slopeDirection === 'away_from_house' && outerGutterUndersideM > model.leftEdgeHeightM + heightTolM) {
      issues.push('Slope direction says away from house, but outer underside is higher than house underside.');
    }
    if (model.slopeDirection === 'toward_house' && outerGutterUndersideM < model.leftEdgeHeightM - heightTolM) {
      issues.push('Slope direction says toward house, but outer underside is lower than house underside.');
    }
  }

  if (model.sectionKind === 'gable' && typeof model.ridgeHeightM === 'number' && Number.isFinite(model.ridgeHeightM)) {
    const eaveHeight = Math.max(model.leftEdgeHeightM, model.rightEdgeHeightM);
    const impliedRiseM = Math.tan((model.pitchDeg * Math.PI) / 180) * (model.spanA / 2);
    const expectedRidgeM = eaveHeight + impliedRiseM;
    if (Math.abs(expectedRidgeM - model.ridgeHeightM) > heightTolM) {
      issues.push(`Ridge height mismatch: model ${formatMetres(model.ridgeHeightM)} vs implied ${formatMetres(expectedRidgeM)}.`);
    }
  }

  return summariseConsistency(issues);
}

function sectionOverhangM(model: ModuleSectionModel): number {
  return model.sectionKind === 'mono' && model.overhangEnabled ? Math.max(0, Math.min(model.overhangAmountM, Math.max(0, model.spanA - 0.01))) : 0;
}

function sectionSupportXFromHouseM(model: ModuleSectionModel): number {
  const overhangM = sectionOverhangM(model);
  return model.sectionKind === 'mono' ? Math.max(0.05, model.spanA - overhangM) : model.spanA;
}

function sectionLedgerBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamDepthM, 0.1);
}

function sectionLedgerBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ledgerBeamWidthM, 0.05);
}

function sectionSupportBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamDepthM, 0.15);
}

function sectionSupportBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.supportBeamWidthM, 0.05);
}

function sectionRidgeBeamDepthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamDepthM, 0.15);
}

function sectionRidgeBeamWidthM(model: ModuleSectionModel): number {
  return memberSizeM(model.ridgeBeamWidthM, 0.05);
}

type MonoDatumResolution = {
  rightEdgeRole: 'gutter' | 'support';
  supportUndersideM: number;
  outerGutterUndersideM: number;
};

function resolveMonoDatums(model: ModuleSectionModel): MonoDatumResolution {
  const overhangM = sectionOverhangM(model);
  if (model.sectionKind !== 'mono' || overhangM <= 0) {
    return {
      rightEdgeRole: 'gutter',
      supportUndersideM: model.rightEdgeHeightM,
      outerGutterUndersideM: model.rightEdgeHeightM,
    };
  }

  const spanM = Math.max(model.spanA, 0.001);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const leftUndersideM = model.leftEdgeHeightM;
  const rightRawM = model.rightEdgeHeightM;
  const pitchRad = (model.pitchDeg * Math.PI) / 180;
  const fallPerM = Math.tan(pitchRad) * (model.slopeDirection === 'toward_house' ? 1 : -1);
  const expectedSupportUndersideM = leftUndersideM + fallPerM * supportXFromHouseM;
  const expectedOuterUndersideM = leftUndersideM + fallPerM * spanM;
  const errAsSupport = Math.abs(rightRawM - expectedSupportUndersideM);
  const errAsGutter = Math.abs(rightRawM - expectedOuterUndersideM);

  // Derived right post height is often the support-post underside when overhang is enabled.
  const treatRightAsSupport = errAsSupport + 0.03 < errAsGutter;
  if (treatRightAsSupport) {
    return {
      rightEdgeRole: 'support',
      supportUndersideM: rightRawM,
      outerGutterUndersideM: Math.max(0, expectedOuterUndersideM),
    };
  }

  const tSupport = clamp(supportXFromHouseM / spanM, 0, 1);
  return {
    rightEdgeRole: 'gutter',
    supportUndersideM: Math.max(0, leftUndersideM + (rightRawM - leftUndersideM) * tSupport),
    outerGutterUndersideM: rightRawM,
  };
}

function sectionOuterGutterUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  return resolveMonoDatums(model).outerGutterUndersideM;
}

function sectionRafterBearingStartM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return 0;
  return Math.max(0, Math.min(model.spanA, sectionLedgerBeamWidthM(model)));
}

function sectionRafterBearingEndM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.spanA;
  const startM = sectionRafterBearingStartM(model);
  const endM = model.spanA - Math.max(0, Math.min(model.spanA, model.gutterWidthM));
  return Math.max(startM + 0.01, endM);
}

function sectionRafterPlumbCutDropM(model: ModuleSectionModel): number {
  const pitchRad = (Math.max(0, Math.min(85, model.pitchDeg)) * Math.PI) / 180;
  const cosPitch = Math.max(0.12, Math.cos(pitchRad));
  return model.rafterDepthM / cosPitch;
}

function sectionRafterPreCutAllowanceM(model: ModuleSectionModel): number {
  const pitchRad = (Math.max(0, Math.min(85, model.pitchDeg)) * Math.PI) / 180;
  const tanPitch = Math.max(0, Math.tan(pitchRad));
  const allowancePerEnd = Math.max(0, model.rafterWidthM) * tanPitch;
  return allowancePerEnd * 2;
}

function sectionMonoRafterCutLengthM(model: ModuleSectionModel): number {
  const startM = sectionRafterBearingStartM(model);
  const endM = sectionRafterBearingEndM(model);
  const runM = Math.max(0.01, endM - startM);
  const houseTopM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model);
  const outerTopM = sectionOuterGutterUndersideM(model) + model.gutterDepthM;
  const finishedCutLengthM = Math.hypot(runM, outerTopM - houseTopM);
  return finishedCutLengthM + sectionRafterPreCutAllowanceM(model);
}

function sectionGableRafterCutLengthsM(model: ModuleSectionModel): { leftM: number; rightM: number } | null {
  if (model.sectionKind !== 'gable' || typeof model.ridgeHeightM !== 'number' || !Number.isFinite(model.ridgeHeightM)) return null;

  const ridgeWidthM = sectionRidgeBeamWidthM(model);
  const eaveWidthM = memberSizeM(model.gutterWidthM, 0.1);
  const leftRunM = Math.max(0.01, model.spanA / 2 - eaveWidthM - ridgeWidthM / 2);
  const rightRunM = Math.max(0.01, model.spanA / 2 - eaveWidthM - ridgeWidthM / 2);
  const plumbCutDropM = sectionRafterPlumbCutDropM(model);
  const leftRafterUnderM = model.leftEdgeHeightM + model.gutterDepthM - plumbCutDropM;
  const rightRafterUnderM = model.rightEdgeHeightM + model.gutterDepthM - plumbCutDropM;
  const preCutAllowanceM = sectionRafterPreCutAllowanceM(model);
  const leftM = Math.hypot(leftRunM, model.ridgeHeightM - leftRafterUnderM) + preCutAllowanceM;
  const rightM = Math.hypot(rightRunM, model.ridgeHeightM - rightRafterUnderM) + preCutAllowanceM;
  return { leftM, rightM };
}

function sectionRafterCutLengthLabel(model: ModuleSectionModel): string | null {
  if (model.sectionKind === 'mono') {
    return `Rafter length: ${formatMetresPrecise(sectionMonoRafterCutLengthM(model))}`;
  }

  const gableCuts = sectionGableRafterCutLengthsM(model);
  if (!gableCuts) return null;
  if (Math.abs(gableCuts.leftM - gableCuts.rightM) <= 0.01) {
    return `Rafter length: ${formatMetresPrecise((gableCuts.leftM + gableCuts.rightM) / 2)} ea`;
  }
  return `Rafter length: L ${formatMetresPrecise(gableCuts.leftM)} / R ${formatMetresPrecise(gableCuts.rightM)}`;
}

function sectionMonoRafterUndersideAtM(model: ModuleSectionModel, xFromHouseM: number): number {
  const startM = sectionRafterBearingStartM(model);
  const endM = sectionRafterBearingEndM(model);
  const runM = Math.max(0.001, endM - startM);
  const t = clamp((xFromHouseM - startM) / runM, 0, 1);
  const plumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseRafterUndersideM = model.leftEdgeHeightM + sectionLedgerBeamDepthM(model) - plumbCutDropM;
  const outerRafterUndersideM = sectionOuterGutterUndersideM(model) + model.gutterDepthM - plumbCutDropM;
  return houseRafterUndersideM + (outerRafterUndersideM - houseRafterUndersideM) * t;
}

function sectionSupportUndersideM(model: ModuleSectionModel): number {
  if (model.sectionKind !== 'mono') return model.rightEdgeHeightM;
  const resolved = resolveMonoDatums(model);
  const overhangM = sectionOverhangM(model);
  if (overhangM <= 0) return resolved.supportUndersideM;

  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const supportTopM = sectionMonoRafterUndersideAtM(model, supportXFromHouseM);
  const supportFromStackM = Math.max(0, supportTopM - sectionSupportBeamDepthM(model));
  return supportFromStackM;
}

function toPointsAttr(points: Point[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function segmentDownNormal(x1: number, y1: number, x2: number, y2: number): { nx: number; ny: number; len: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  if (ny < 0) {
    nx *= -1;
    ny *= -1;
  }
  return { nx, ny, len };
}

function sectionMemberPolygon(x1: number, y1: number, x2: number, y2: number, depthPx: number): Point[] {
  const { nx, ny } = segmentDownNormal(x1, y1, x2, y2);
  return [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x2 + nx * depthPx, y: y2 + ny * depthPx },
    { x: x1 + nx * depthPx, y: y1 + ny * depthPx },
  ];
}

function sectionMemberPolygonPlumbCuts(
  x1: number,
  yUnder1: number,
  x2: number,
  yUnder2: number,
  depthNormalPx: number,
): { points: Point[]; yTop1: number; yTop2: number } {
  const dx = x2 - x1;
  if (Math.abs(dx) < 1e-6) {
    const points = sectionMemberPolygon(x1, yUnder1, x2, yUnder2, depthNormalPx);
    const yTop1 = Math.min(...points.map((point) => point.y));
    const yTop2 = yTop1;
    return { points, yTop1, yTop2 };
  }
  const slope = (yUnder2 - yUnder1) / dx;
  const deltaY = depthNormalPx * Math.sqrt(1 + slope * slope);
  const yTop1 = yUnder1 - deltaY;
  const yTop2 = yUnder2 - deltaY;
  return {
    points: [
      { x: x1, y: yUnder1 },
      { x: x2, y: yUnder2 },
      { x: x2, y: yTop2 },
      { x: x1, y: yTop1 },
    ],
    yTop1,
    yTop2,
  };
}

function hipCornerInnerPoints(x: number, y: number, aW: number, bW: number, splitY: number, bottomY: number, inset: number): Point[] {
  const t = Math.max(0.2, inset);
  return [
    { x: x + t, y: y + t },
    { x: x + aW - t, y: y + t },
    { x: x + aW - t, y: splitY - t },
    { x: x + bW - t, y: splitY - t },
    { x: x + bW - t, y: bottomY - t },
    { x: x + t, y: bottomY - t },
  ];
}

function projectLinearPositions(positionsM: number[] | null, lengthM: number | null, startX: number, drawWidth: number): number[] {
  if (!positionsM || !positionsM.length || !lengthM || lengthM <= 0) return [];
  return positionsM.map((posM) => startX + (Math.max(0, posM) / lengthM) * drawWidth);
}

function interiorPlanRafterXs(xs: number[]): number[] {
  if (xs.length <= 2) return [];
  return xs.slice(1, -1);
}

function rotatePointQuarterTurns(point: Point, center: Point, turns: number): Point {
  const normalized = ((turns % 4) + 4) % 4;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (normalized === 1) return { x: center.x + dy, y: center.y - dx };
  if (normalized === 2) return { x: center.x - dx, y: center.y - dy };
  if (normalized === 3) return { x: center.x - dy, y: center.y + dx };
  return point;
}

function rotatePointsQuarterTurns(points: Point[], center: Point, turns: number): Point[] {
  return points.map((point) => rotatePointQuarterTurns(point, center, turns));
}

function rotateBoundsQuarterTurns(bounds: AnnotatedBounds, center: Point, turns: number): AnnotatedBounds {
  return boundsFromPoints(
    rotatePointsQuarterTurns(
      [
        { x: bounds.minX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.minY },
        { x: bounds.maxX, y: bounds.maxY },
        { x: bounds.minX, y: bounds.maxY },
      ],
      center,
      turns,
    ),
  );
}

function rectToPoints(x: number, y: number, width: number, height: number): Point[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function resolvePlanRotationFrame(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  turns: number;
}): { baseX: number; baseY: number; center: Point; turns: number } {
  const turns = ((input.turns % 4) + 4) % 4;
  if (turns % 2 === 0) {
    return {
      baseX: input.x,
      baseY: input.y,
      center: { x: input.x + input.width / 2, y: input.y + input.height / 2 },
      turns,
    };
  }

  const delta = (input.width - input.height) / 2;
  const baseX = input.x - delta;
  const baseY = input.y + delta;
  return {
    baseX,
    baseY,
    center: { x: baseX + input.width / 2, y: baseY + input.height / 2 },
    turns,
  };
}

type PlanAttachmentFrame = {
  start: Point;
  end: Point;
  tangent: Point;
  outward: Point;
  length: number;
};

function attachmentFrameForRect(side: ModulePlanModel['attachmentSide'], rect: { x: number; y: number; width: number; height: number }): PlanAttachmentFrame {
  if (side === 'front') {
    return {
      start: { x: rect.x, y: rect.y + rect.height },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 1, y: 0 },
      outward: { x: 0, y: 1 },
      length: rect.width,
    };
  }
  if (side === 'left') {
    return {
      start: { x: rect.x, y: rect.y },
      end: { x: rect.x, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: -1, y: 0 },
      length: rect.height,
    };
  }
  if (side === 'right') {
    return {
      start: { x: rect.x + rect.width, y: rect.y },
      end: { x: rect.x + rect.width, y: rect.y + rect.height },
      tangent: { x: 0, y: 1 },
      outward: { x: 1, y: 0 },
      length: rect.height,
    };
  }
  return {
    start: { x: rect.x, y: rect.y },
    end: { x: rect.x + rect.width, y: rect.y },
    tangent: { x: 1, y: 0 },
    outward: { x: 0, y: -1 },
    length: rect.width,
  };
}

function pointOnAttachmentFrame(frame: PlanAttachmentFrame, along: number, outward: number): Point {
  return {
    x: frame.start.x + frame.tangent.x * along + frame.outward.x * outward,
    y: frame.start.y + frame.tangent.y * along + frame.outward.y * outward,
  };
}

function rotateVectorQuarterTurns(vector: Point, turns: number): Point {
  return rotatePointQuarterTurns(vector, { x: 0, y: 0 }, turns);
}

type FootprintHandleSpec = {
  id: HouseFootprintHandleId;
  label: string;
  valueM: number;
  point: Point;
  pointRoot: Point;
  guideFrom: Point;
  guideTo: Point;
  axisX: number;
  axisY: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

type FootprintCanvasLayout = {
  polygon: Point[];
  handles: FootprintHandleSpec[];
  sideTurns: number;
};

function actualPergolaCenter(rect: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

function localFootprintDimensionsM(model: ModulePlanModel, attachmentSide: AttachmentSide): { widthM: number; depthM: number } {
  if (attachmentSide === 'left' || attachmentSide === 'right') {
    return {
      widthM: model.spanA,
      depthM: model.lengthA,
    };
  }

  return {
    widthM: model.lengthA,
    depthM: model.spanA,
  };
}

function mapLocalFootprintPointToPlan(input: {
  point: HouseFootprintPoint;
  rect: { x: number; y: number; width: number; height: number };
  canonicalWidthM: number;
  canonicalDepthM: number;
  scale: number;
  sideTurns: number;
}): Point {
  const center = actualPergolaCenter(input.rect);
  const canonicalWidth = input.canonicalWidthM * input.scale;
  const canonicalDepth = input.canonicalDepthM * input.scale;
  const canonicalPoint = {
    x: center.x - canonicalWidth / 2 + input.point.x * input.scale,
    y: center.y - canonicalDepth / 2 + input.point.y * input.scale,
  };
  return rotatePointQuarterTurns(canonicalPoint, center, input.sideTurns);
}

function resolveFootprintCanvasLayout(input: {
  model: ModulePlanModel;
  rect: { x: number; y: number; width: number; height: number };
  scale: number;
  rotationCenter: Point;
  rotationTurns: number;
}): FootprintCanvasLayout {
  const { model, rect, scale, rotationCenter, rotationTurns } = input;
  const sideTurns = attachmentSideQuarterTurns(model.attachmentSide);
  const dims = localFootprintDimensionsM(model, model.attachmentSide);
  const localLayout = buildHouseFootprintLocalLayout({
    pergolaWidthM: dims.widthM,
    pergolaDepthM: dims.depthM,
    preset: model.houseFootprintPreset,
    params: model.houseFootprintParams,
  });
  const totalTurns = sideTurns + rotationTurns;
  const polygon = localLayout.polygon.map((localPoint) =>
    mapLocalFootprintPointToPlan({
      point: localPoint,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    }),
  );
  const handles = localLayout.handles.map((handle): FootprintHandleSpec => {
    const point = mapLocalFootprintPointToPlan({
      point: handle.point,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    return {
      ...handle,
      point,
      pointRoot: rotatePointQuarterTurns(point, rotationCenter, rotationTurns),
      guideFrom: mapLocalFootprintPointToPlan({
        point: handle.guideFrom,
        rect,
        canonicalWidthM: dims.widthM,
        canonicalDepthM: dims.depthM,
        scale,
        sideTurns,
      }),
      guideTo: mapLocalFootprintPointToPlan({
        point: handle.guideTo,
        rect,
        canonicalWidthM: dims.widthM,
        canonicalDepthM: dims.depthM,
        scale,
        sideTurns,
      }),
      axisX: rotateVectorQuarterTurns({ x: handle.axisX, y: handle.axisY }, totalTurns).x,
      axisY: rotateVectorQuarterTurns({ x: handle.axisX, y: handle.axisY }, totalTurns).y,
    };
  });

  return {
    polygon,
    handles,
    sideTurns,
  };
}

function footprintLabelPoint(points: Point[]): Point {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function LegendRow({ items }: { items: string[] }) {
  return (
    <div className={styles.moduleViewsLegend} aria-label="Drawing legend">
      {items.map((item) => (
        <span key={item} className={styles.moduleViewsLegendChip}>
          <span className={styles.moduleViewsLegendSwatch} aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

function resolveTickDimensionGeometry({
  x1,
  y1,
  x2,
  y2,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
}: Omit<TickDimensionProps, 'label'>): TickDimensionGeometry {
  const dimSpec = getDimensionPresentationSpec(presentation);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const tickHalf = dimSpec.tickHalf;
  const tx = (ux + nx) * tickHalf;
  const ty = (uy + ny) * tickHalf;
  const lineStartX = x1 - ux * overrun;
  const lineStartY = y1 - uy * overrun;
  const lineEndX = x2 + ux * overrun;
  const lineEndY = y2 + uy * overrun;
  const barHalf = dimSpec.barHalf;
  const barOffset = dimSpec.barOffset;
  const horizontalBias = Math.abs(dx) >= Math.abs(dy) * 1.35;
  const verticalBias = Math.abs(dy) > Math.abs(dx) * 1.35;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const labelX = textX ?? (verticalBias ? cx - dimSpec.verticalLabelGap : horizontalBias ? cx : cx - nx * dimSpec.labelClearance);
  const labelY = textY ?? (verticalBias ? cy : horizontalBias ? cy - dimSpec.horizontalLabelGap : cy - ny * dimSpec.labelClearance);
  const labelRotate = rotateDeg ?? (verticalBias ? -90 : undefined);

  return {
    lineStartX,
    lineStartY,
    lineEndX,
    lineEndY,
    tick1StartX: x1 - tx,
    tick1StartY: y1 - ty,
    tick1EndX: x1 + tx,
    tick1EndY: y1 + ty,
    tick2StartX: x2 - tx,
    tick2StartY: y2 - ty,
    tick2EndX: x2 + tx,
    tick2EndY: y2 + ty,
    labelX,
    labelY,
    labelRotate,
    termBar1: showTermBars
      ? {
          x1: x1 + ux * barOffset - nx * barHalf,
          y1: y1 + uy * barOffset - ny * barHalf,
          x2: x1 + ux * barOffset + nx * barHalf,
          y2: y1 + uy * barOffset + ny * barHalf,
        }
      : undefined,
    termBar2: showTermBars
      ? {
          x1: x2 - ux * barOffset - nx * barHalf,
          y1: y2 - uy * barOffset - ny * barHalf,
          x2: x2 - ux * barOffset + nx * barHalf,
          y2: y2 - uy * barOffset + ny * barHalf,
        }
      : undefined,
  };
}

function TickDimension({
  x1,
  y1,
  x2,
  y2,
  label,
  textX,
  textY,
  rotateDeg,
  overrun = 2.7,
  showTermBars = false,
  presentation = 'card',
  interactiveField,
}: TickDimensionProps) {
  const geometry = resolveTickDimensionGeometry({
    x1,
    y1,
    x2,
    y2,
    textX,
    textY,
    rotateDeg,
    overrun,
    showTermBars,
    presentation,
  });

  return (
    <g>
      <line x1={geometry.lineStartX} y1={geometry.lineStartY} x2={geometry.lineEndX} y2={geometry.lineEndY} className={styles.moduleDimLine} />
      {geometry.termBar1 && geometry.termBar2 ? (
        <>
          <line
            x1={geometry.termBar1.x1}
            y1={geometry.termBar1.y1}
            x2={geometry.termBar1.x2}
            y2={geometry.termBar1.y2}
            className={styles.moduleDimTermBar}
          />
          <line
            x1={geometry.termBar2.x1}
            y1={geometry.termBar2.y1}
            x2={geometry.termBar2.x2}
            y2={geometry.termBar2.y2}
            className={styles.moduleDimTermBar}
          />
        </>
      ) : null}
      <line x1={geometry.tick1StartX} y1={geometry.tick1StartY} x2={geometry.tick1EndX} y2={geometry.tick1EndY} className={styles.moduleDimTick} />
      <line x1={geometry.tick2StartX} y1={geometry.tick2StartY} x2={geometry.tick2EndX} y2={geometry.tick2EndY} className={styles.moduleDimTick} />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        className={interactiveField ? `${styles.moduleDimText} ${styles.moduleDimTextEditable}` : styles.moduleDimText}
        transform={typeof geometry.labelRotate === 'number' ? `rotate(${geometry.labelRotate} ${geometry.labelX} ${geometry.labelY})` : undefined}
        data-editable-field-id={interactiveField?.fieldId}
        tabIndex={interactiveField ? 0 : undefined}
        onClick={interactiveField ? (event) => interactiveField.onActivate(interactiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          interactiveField
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                interactiveField.onActivate(interactiveField.fieldId, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {label}
      </text>
    </g>
  );
}

function estimateTickDimensionBounds(
  props: TickDimensionProps,
  options?: {
    charWidth?: number;
    fontHeight?: number;
    paddingX?: number;
    paddingY?: number;
  },
): AnnotatedBounds {
  const geometry = resolveTickDimensionGeometry(props);
  return unionBounds([
    boundsFromLine(geometry.lineStartX, geometry.lineStartY, geometry.lineEndX, geometry.lineEndY, 0.45),
    boundsFromLine(geometry.tick1StartX, geometry.tick1StartY, geometry.tick1EndX, geometry.tick1EndY, 0.35),
    boundsFromLine(geometry.tick2StartX, geometry.tick2StartY, geometry.tick2EndX, geometry.tick2EndY, 0.35),
    geometry.termBar1 ? boundsFromLine(geometry.termBar1.x1, geometry.termBar1.y1, geometry.termBar1.x2, geometry.termBar1.y2, 0.25) : null,
    geometry.termBar2 ? boundsFromLine(geometry.termBar2.x1, geometry.termBar2.y1, geometry.termBar2.x2, geometry.termBar2.y2, 0.25) : null,
    estimateTextBounds({
      text: props.label,
      x: geometry.labelX,
      y: geometry.labelY,
      anchor: 'middle',
      fontHeight: options?.fontHeight ?? (props.presentation === 'sheet' ? 1.85 : 2.3),
      charWidth: options?.charWidth ?? (props.presentation === 'sheet' ? 0.62 : 0.78),
      paddingX: options?.paddingX ?? 0.35,
      paddingY: options?.paddingY ?? 0.18,
      rotateDeg: geometry.labelRotate,
    }),
  ]);
}

function ArrowHead({
  x,
  y,
  direction,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}) {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  if (direction === 'up') {
    return (
      <g>
        <line x1={x} y1={y - reach} x2={x - span} y2={y + reach} className={styles.moduleFallHead} />
        <line x1={x} y1={y - reach} x2={x + span} y2={y + reach} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'left') {
    return (
      <g>
        <line x1={x - reach} y1={y} x2={x + reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x - reach} y1={y} x2={x + reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  if (direction === 'right') {
    return (
      <g>
        <line x1={x + reach} y1={y} x2={x - reach} y2={y - span} className={styles.moduleFallHead} />
        <line x1={x + reach} y1={y} x2={x - reach} y2={y + span} className={styles.moduleFallHead} />
      </g>
    );
  }
  return (
    <g>
      <line x1={x} y1={y + reach} x2={x - span} y2={y - reach} className={styles.moduleFallHead} />
      <line x1={x} y1={y + reach} x2={x + span} y2={y - reach} className={styles.moduleFallHead} />
    </g>
  );
}

function estimateArrowHeadBounds({
  x,
  y,
  presentation = 'card',
}: {
  x: number;
  y: number;
  direction: 'up' | 'down' | 'left' | 'right';
  presentation?: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const isSheet = presentation === 'sheet';
  const reach = isSheet ? 0.96 : 1.3;
  const span = isSheet ? 0.78 : 1.15;
  return boundsFromRect(x - span - 0.25, y - reach - 0.25, span * 2 + 0.5, reach * 2 + 0.5);
}

function formatScaleDebugLabel(scale: EstimateDrawingScale): string {
  return scale.mode === 'fit' ? 'NTS' : `1:${scale.ratio}`;
}

function buildSheetDebugMetrics(
  layout: ResolvedSheetLayout,
  scaleState?: ModuleDrawingScaleState | null,
  diagnostics: ModuleDrawingScaleDiagnostic[] = [],
): SheetDebugMetrics {
  const boundsWidth = getBoundsWidth(layout.annotatedBounds);
  const boundsHeight = getBoundsHeight(layout.annotatedBounds);
  return {
    requestedScaleLabel: formatScaleDebugLabel(scaleState?.requestedScale ?? { mode: 'fit' }),
    appliedScaleLabel: formatScaleDebugLabel(scaleState?.appliedScale ?? { mode: 'fit' }),
    boundsWidth,
    boundsHeight,
    fitWidth: layout.fitArea.width,
    fitHeight: layout.fitArea.height,
    utilizationX: boundsWidth / Math.max(layout.fitArea.width, 0.001),
    utilizationY: boundsHeight / Math.max(layout.fitArea.height, 0.001),
    candidateLines: diagnostics.map((diagnostic) => {
      const scaleLabel = formatScaleDebugLabel(diagnostic.scale);
      return `${scaleLabel} ${diagnostic.fits ? 'ok' : 'no'} ${Math.round(diagnostic.utilizationX * 100)}%/${Math.round(diagnostic.utilizationY * 100)}%`;
    }),
  };
}

function resolveMeasuredFitLayout(input: {
  initialScale: number;
  resolveForScale: (scale: number) => ResolvedSheetLayout;
}): ResolvedSheetLayout {
  let scale = Math.max(0.05, input.initialScale);
  let layout = input.resolveForScale(scale);

  for (let idx = 0; idx < 8; idx += 1) {
    const ratio = Math.min(
      layout.fitArea.width / Math.max(getBoundsWidth(layout.annotatedBounds), 0.001),
      layout.fitArea.height / Math.max(getBoundsHeight(layout.annotatedBounds), 0.001),
    );
    const nextScale = Math.max(0.05, scale * ratio);
    if (Math.abs(nextScale - scale) <= 0.0005) {
      scale = nextScale;
      layout = input.resolveForScale(scale);
      break;
    }
    scale = nextScale;
    layout = input.resolveForScale(scale);
  }

  for (let idx = 0; idx < 12 && !fitsWithinArea(layout.annotatedBounds, layout.fitArea); idx += 1) {
    scale *= 0.995;
    layout = input.resolveForScale(scale);
  }

  return layout;
}

type ResolvedSheetLayout = {
  outerField: SheetDrawingField;
  fitArea: SheetFitArea;
  annotatedBounds: AnnotatedBounds;
  x: number;
  y: number;
  scale: number;
  houseBandHeight: number;
  houseBandOffset: number;
  houseInset: number;
  fallGap: number;
};

type SheetDebugMetrics = {
  requestedScaleLabel: string;
  appliedScaleLabel: string;
  boundsWidth: number;
  boundsHeight: number;
  fitWidth: number;
  fitHeight: number;
  utilizationX: number;
  utilizationY: number;
  candidateLines: string[];
};

function measurePlanAnnotatedBounds(input: {
  model: ModulePlanModel;
  x: number;
  y: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
  frame: PlanSheetFrame;
}): AnnotatedBounds {
  const { model, x, y, scale, presentation = 'sheet', frame } = input;
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const rotationFrame = resolvePlanRotationFrame({
    x,
    y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: isHipCorner ? 0 : model.drawingRotationQuarterTurns,
  });
  const baseX = rotationFrame.baseX;
  const baseY = rotationFrame.baseY;
  const aW = model.lengthA * scale;
  const aH = model.spanA * scale;
  const bW = (model.lengthB ?? 0) * scale;
  const bH = (model.spanB ?? 0) * scale;
  const splitY = baseY + aH;
  const bottomY = splitY + bH;
  const topFrameW = memberSizeM(model.ledgerBeamWidthM, 0.05) * scale;
  const sideFrameW = memberSizeM(model.supportBeamWidthM, 0.05) * scale;
  const gutterW = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const rafterW = memberSizeM(model.rafterWidthM, 0.05) * scale;
  const ridgeBandW = memberSizeM(model.ridgeBeamWidthM, 0.05) * scale;
  const ridgeBandX = baseX + sideFrameW;
  const ridgeBandWidth = Math.max(0, aW - sideFrameW * 2);
  const primaryPoints: Point[] = isHipCorner
    ? [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: splitY },
        { x: baseX + bW, y: splitY },
        { x: baseX + bW, y: bottomY },
        { x: baseX, y: bottomY },
      ]
    : [
        { x: baseX, y: baseY },
        { x: baseX + aW, y: baseY },
        { x: baseX + aW, y: baseY + aH },
        { x: baseX, y: baseY + aH },
      ];
  const centerX = baseX + (isHipCorner ? Math.max(aW, bW) : aW) / 2;
  const centerY = baseY + (isHipCorner ? aH + bH : aH) / 2;
  const insetPoints = primaryPoints.map((point) => ({
    x: centerX + (point.x - centerX) * 0.92,
    y: centerY + (point.y - centerY) * 0.92,
  }));
  const hipInner = isHipCorner ? hipCornerInnerPoints(baseX, baseY, aW, bW, splitY, bottomY, Math.max(sideFrameW, topFrameW, gutterW)) : null;
  const gableMidY = baseY + aH / 2;
  const ridgeBandY = gableMidY - ridgeBandW / 2;
  const hipRidgeStartX = baseX + aW * 0.32;
  const hipRidgeEndX = baseX + aW * 0.68;
  const attachmentSide =
    model.houseConnectionType === 'none' || !model.supportsHouseFootprints || isHipCorner ? 'rear' : model.attachmentSide;
  const showHouseFootprint = model.houseConnectionType !== 'none';
  const footprintRect = { x: baseX, y: baseY, width: aW, height: aH };
  const footprintCanvasLayout =
    showHouseFootprint && model.supportsHouseFootprints && !isHipCorner
      ? resolveFootprintCanvasLayout({
          model,
          rect: footprintRect,
          scale,
          rotationCenter: rotationFrame.center,
          rotationTurns: 0,
        })
      : null;
  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.rafterEdgeLengthM, baseX, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, baseX, bW);
  const interiorRafterXsA = interiorPlanRafterXs(rafterXsA);
  const interiorRafterXsB = interiorPlanRafterXs(rafterXsB);
  const footprintFrame = attachmentFrameForRect(attachmentSide, {
    x: baseX,
    y: baseY,
    width: Math.max(aW, bW),
    height: isHipCorner ? aH + bH : aH,
  });
  const soffitXs = projectLinearPositions(model.soffitBracketPositionsA, model.attachmentEdgeLengthM, 0, footprintFrame.length);
  const soffitGuideStart =
    soffitXs.length > 0 ? pointOnAttachmentFrame(footprintFrame, soffitXs[0]!, -1.2) : pointOnAttachmentFrame(footprintFrame, 0, -1.2);
  const soffitGuideEnd =
    soffitXs.length > 0
      ? pointOnAttachmentFrame(footprintFrame, soffitXs[soffitXs.length - 1]!, -1.2)
      : pointOnAttachmentFrame(footprintFrame, footprintFrame.length, -1.2);
  const soffitBracketLines = soffitXs.map((sx) => ({
    start: pointOnAttachmentFrame(footprintFrame, sx, -2.3),
    end: pointOnAttachmentFrame(footprintFrame, sx, 0.1),
  }));
  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: baseX + Math.max(aW, bW) + frame.fallGap - 0.55,
          y: baseY,
          width: 0,
          height: isHipCorner ? aH + bH : aH,
        })
      : attachmentFrameForRect('front', { x: baseX, y: (isHipCorner ? bottomY : baseY + aH) + frame.fallGap - 0.55, width: aW, height: 0 });
  const fallStart = pointOnAttachmentFrame(fallAnchor, 1.5, 0);
  const fallEnd = pointOnAttachmentFrame(fallAnchor, Math.max(1.5, fallAnchor.length - 1.5), 0);
  const fallLabelPoint = pointOnAttachmentFrame(fallAnchor, fallAnchor.length / 2, fallIsHorizontal ? 2.4 : 0.62);
  const dimensionOffsets = { bottom: 7.8, secondary: 5.4, tertiary: 6.15, side: 5.6, hipSide: 5.9 };
  const dimBaseY = bottomY + dimensionOffsets.bottom;
  const secondaryDimY = dimBaseY + dimensionOffsets.secondary;
  const rafterDimY = dimBaseY + dimensionOffsets.tertiary;
  const yTopInner = baseY + topFrameW;
  const yBottomInner = baseY + aH - gutterW;
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : baseY + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = baseX + sideFrameW;
  const spacingBounds =
    rafterXsA.length >= 2
      ? (() => {
          const spacingXs = interiorRafterXsA.length >= 2 ? interiorRafterXsA : rafterXsA;
          const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
          const d1 = spacingXs[baseIdx]!;
          const d2 = spacingXs[baseIdx + 1]!;
          return unionBounds([
            boundsFromLine(d1, isHipCorner ? splitY - gutterW : yBottomInner, d1, rafterDimY, 0.2),
            boundsFromLine(d2, isHipCorner ? splitY - gutterW : yBottomInner, d2, rafterDimY, 0.2),
            estimateTickDimensionBounds({
              x1: d1,
              y1: rafterDimY,
              x2: d2,
              y2: rafterDimY,
              label: `${formatMetres(model.rafterSpacingA)} c/c`,
              textY: rafterDimY - 1.8,
              presentation,
            }),
          ]);
        })()
      : null;

  const localBounds = [
    boundsFromPoints(primaryPoints, 0.35),
    hipInner ? boundsFromPoints(hipInner, 0.35) : null,
    model.boxPerimeterEnabled ? boundsFromPoints(insetPoints, 0.35) : null,
    hasFullLengthRidge && ridgeBandWidth > 0 ? boundsFromRect(ridgeBandX, ridgeBandY, ridgeBandWidth, ridgeBandW) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY, hipRidgeEndX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX, baseY + aH, hipRidgeStartX, gableMidY, 0.3) : null,
    model.roofType === 'hip' ? boundsFromLine(baseX + aW, baseY + aH, hipRidgeEndX, gableMidY, 0.3) : null,
    isHipCorner ? boundsFromLine(baseX, splitY, baseX + bW, splitY, 0.25) : null,
    ...interiorRafterXsA.map((rx) => boundsFromRect(rx - rafterW / 2, yTopInner, rafterW, Math.max(0.2, (isHipCorner ? splitY - gutterW : yBottomInner) - yTopInner))),
    ...interiorRafterXsB.map((rx) =>
      boundsFromRect(rx - rafterW / 2, splitY + topFrameW, rafterW, Math.max(0.2, bottomY - gutterW - (splitY + topFrameW))),
    ),
    model.houseConnectionType === 'soffit' && soffitXs.length > 0
      ? boundsFromLine(soffitGuideStart.x, soffitGuideStart.y, soffitGuideEnd.x, soffitGuideEnd.y, 0.25)
      : null,
    ...soffitBracketLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    model.overhangEnabled && overhangDepth > 0 ? boundsFromRect(overhangX, overhangY, overhangWidth, overhangDepth) : null,
    boundsFromLine(fallStart.x, fallStart.y, fallEnd.x, fallEnd.y, 0.25),
    isGableLike
      ? estimateArrowHeadBounds({
          x: fallStart.x,
          y: fallStart.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
          presentation,
        })
      : null,
    isGableLike
      ? estimateArrowHeadBounds({
          x: fallEnd.x,
          y: fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
          presentation,
        })
      : null,
    !isGableLike
      ? estimateArrowHeadBounds({
          x: model.slopeDirection === 'toward_house' ? fallStart.x : fallEnd.x,
          y: model.slopeDirection === 'toward_house' ? fallStart.y : fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : model.slopeDirection === 'toward_house' ? 'up' : 'down',
          presentation,
        })
      : null,
    estimateTextBounds({
      text: isGableLike ? 'fall both sides' : 'fall',
      x: fallLabelPoint.x,
      y: fallLabelPoint.y,
      anchor: 'start',
      fontHeight: 1.8,
      charWidth: 0.58,
      paddingX: 0.2,
      paddingY: 0.18,
    }),
    boundsFromLine(baseX, isHipCorner ? bottomY : baseY + aH, baseX, dimBaseY, 0.2),
    boundsFromLine(baseX + aW, isHipCorner ? splitY : baseY + aH, baseX + aW, dimBaseY, 0.2),
    estimateTickDimensionBounds({ x1: baseX, y1: dimBaseY, x2: baseX + aW, y2: dimBaseY, label: formatMetres(model.lengthA), presentation }),
    boundsFromLine(baseX, baseY, baseX - dimensionOffsets.side, baseY, 0.2),
    boundsFromLine(baseX, baseY + aH, baseX - dimensionOffsets.side, baseY + aH, 0.2),
    estimateTickDimensionBounds({
      x1: baseX - dimensionOffsets.side,
      y1: baseY,
      x2: baseX - dimensionOffsets.side,
      y2: baseY + aH,
      label: formatMetres(model.spanA),
      presentation,
    }),
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX, bottomY, baseX, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({
          x1: baseX,
          y1: secondaryDimY,
          x2: baseX + bW,
          y2: secondaryDimY,
          label: formatMetres(model.lengthB),
          presentation,
        })
      : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, splitY, baseX + bW + dimensionOffsets.hipSide, splitY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW + dimensionOffsets.hipSide, bottomY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({
          x1: baseX + bW + dimensionOffsets.hipSide,
          y1: splitY,
          x2: baseX + bW + dimensionOffsets.hipSide,
          y2: bottomY,
          label: formatMetres(model.spanB),
          presentation,
        })
      : null,
    spacingBounds,
    model.boxPerimeterEnabled ? boundsFromLine(centerX, baseY + 2.8, centerX, (isHipCorner ? bottomY : baseY + aH) - 2.8, 0.2) : null,
    model.boxPerimeterEnabled
      ? estimateTextBounds({
          text: 'internal roof angle',
          x: centerX + 2.5,
          y: centerY + 0.5,
          anchor: 'start',
          fontHeight: 1.55,
          charWidth: 0.54,
          paddingX: 0.15,
          paddingY: 0.15,
        })
      : null,
  ];

  if (rotationFrame.turns === 0) {
    return unionBounds(localBounds);
  }

  return unionBounds(localBounds.map((bounds) => (bounds ? rotateBoundsQuarterTurns(bounds, rotationFrame.center, rotationFrame.turns) : null)));
}

function resolvePlanSheetLayoutForScale(input: {
  model: ModulePlanModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getPlanSheetFrame(input.model.roofType === 'hip_corner');
  const total = getPlanRealExtents(input.model);
  const totalW = total.widthM;
  const totalH = total.heightM;
  const initial = resolvePlanFitBox(totalW, totalH, 'sheet', input.model.roofType === 'hip_corner');
  let x = initial.x;
  let y = initial.y;
  let bounds = measurePlanAnnotatedBounds({ model: input.model, x, y, scale: input.scale, frame });
  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    x += offset.dx;
    y += offset.dy;
    bounds = measurePlanAnnotatedBounds({ model: input.model, x, y, scale: input.scale, frame });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x,
    y,
    scale: input.scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
  };
}

function resolvePlanSheetLayout(input: {
  model: ModulePlanModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolvePlanSheetLayoutForScale({
      model: input.model,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const total = getPlanRealExtents(input.model);
  return resolveMeasuredFitLayout({
    initialScale: resolvePlanFitBox(total.widthM, total.heightM, 'sheet', input.model.roofType === 'hip_corner').scale,
    resolveForScale: (scale) => resolvePlanSheetLayoutForScale({ model: input.model, scale }),
  });
}

function measureSectionAnnotatedBounds(input: {
  model: ModuleSectionModel;
  xLeft: number;
  yGround: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const { model, xLeft, yGround, scale, presentation = 'sheet' } = input;
  const isSheet = presentation === 'sheet';
  const overhangM = sectionOverhangM(model);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const ledgerBeamDepthM = sectionLedgerBeamDepthM(model);
  const ledgerBeamWidthM = sectionLedgerBeamWidthM(model);
  const supportBeamDepthM = sectionSupportBeamDepthM(model);
  const supportBeamWidthM = sectionSupportBeamWidthM(model);
  const tieBeamDepthM = sectionSupportBeamDepthM(model);
  const tieBeamWidthM = sectionSupportBeamWidthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const ridgeBeamWidthM = sectionRidgeBeamWidthM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : ledgerBeamDepthM;
  const leftEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : ledgerBeamWidthM;
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : supportBeamDepthM;
  const rightEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : supportBeamWidthM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const supportUndersideM = sectionSupportUndersideM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;
  const supportBeamTopM = supportUndersideM + supportBeamDepthM;
  const postW = memberSizeM(model.postWidthM, 0.1) * scale;
  const rafterDepth = memberSizeM(model.rafterDepthM, 0.15) * scale;
  const gutterWidth = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const leftEaveDepth = leftEaveBeamDepthM * scale;
  const leftEaveWidth = leftEaveBeamWidthM * scale;
  const supportCapDepth = supportBeamDepthM * scale;
  const supportCapWidth = supportBeamWidthM * scale;
  const tieBeamDepth = tieBeamDepthM * scale;
  const kingStrutWidth = tieBeamWidthM * scale;
  const rightEaveBeamDepth = rightEaveBeamDepthM * scale;
  const rightEaveBeamWidth = rightEaveBeamWidthM * scale;
  const ridgeBeamWidth = ridgeBeamWidthM * scale;
  const xRight = xLeft + model.spanA * scale;
  const xSupport = model.sectionKind === 'mono' ? xLeft + supportXFromHouseM * scale : xRight;
  const ridgeX = (xLeft + xRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;
  const yHouseUnder = yForHeight(houseLedgerUndersideM);
  const ySupportUnder = yForHeight(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM);
  const yOuterGutterUnder = yForHeight(outerGutterUndersideM);
  const yHouseRafterUnder = yForHeight(houseRafterUndersideM);
  const yOuterRafterUnder = yForHeight(outerRafterUndersideM);
  const yOuterGutterTop = yForHeight(outerGutterUndersideM + model.gutterDepthM);
  const yRightEaveRafterUnder = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM);
  const ySupportBeamTop = yForHeight(supportBeamTopM);
  const yRidgeUnder = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;
  const yRidgeBeamTop = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM + ridgeBeamDepthM) : null;
  const tieBeamTopY = yHouseUnder;
  const tieBeamBottomY = Math.min(yGround - 0.4, tieBeamTopY + tieBeamDepth);
  const supportPostTopY = ySupportUnder;
  const supportCapTopY = ySupportBeamTop;
  const gutterTopY = yOuterGutterTop;
  const ledgerX = xLeft;
  const ledgerY = yForHeight(houseLedgerUndersideM + leftEaveBeamDepthM);
  const rightEaveX = xRight - rightEaveBeamWidth;
  const rightEaveY = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM);
  const leftPostX = xLeft;
  const secondPostX = model.sectionKind === 'mono' ? (overhangM > 0 ? xSupport - postW / 2 : xRight - postW) : xRight - postW;
  const monoRafterStartX = ledgerX + leftEaveWidth;
  const monoRafterEndX = xRight - gutterWidth;
  const gableLeftRafterStartX = ledgerX + leftEaveWidth;
  const gableRightRafterEndX = xRight - rightEaveBeamWidth;
  const leftDimX = xLeft - 9.8;
  const rightDimX = xRight + 10.6;
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = Math.max(yGround + 10.9, spanDatumY + 9.4);
  const overhangDimY = Math.max(spanAnchorRightY + 4.9, spanDimY - 5.8);
  const pitchLabelY = spanDimY + 6.2;
  const metaLabelY = pitchLabelY - 3.2;
  const roofLengthLabelGap = 1.6;
  const mainRoofNormal = segmentDownNormal(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;
  const monoRoofGeom = model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder, rafterDepth) : null;
  const gableLeftRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(gableLeftRafterStartX, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth) : null;
  const gableRightRoofGeom = model.sectionKind === 'gable' && yRidgeUnder !== null ? sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, gableRightRafterEndX, yRightEaveRafterUnder, rafterDepth) : null;
  const monoSupportSplice =
    model.sectionKind === 'mono' && overhangM > 0 && monoRoofGeom && monoRafterEndX - monoRafterStartX > 1e-6
      ? (() => {
          const t = clamp((xSupport - monoRafterStartX) / (monoRafterEndX - monoRafterStartX), 0, 1);
          const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
          const topStart = monoRoofGeom.points[3]!;
          const topEnd = monoRoofGeom.points[2]!;
          const yTop = topStart.y + (topEnd.y - topStart.y) * t;
          return { yTop, yUnder };
        })()
      : null;
  const depthDimAlongRoof = 0.18;
  const depthDimUnderX = monoRafterStartX + (monoRafterEndX - monoRafterStartX) * depthDimAlongRoof;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * depthDimAlongRoof;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };
  const roofTopLengthDims = (() => {
    const offset = model.sectionKind === 'gable' ? 4.8 : 4.2;
    if (model.sectionKind === 'mono' && monoRoofGeom) {
      const topStart = monoRoofGeom.points[3]!;
      const topEnd = monoRoofGeom.points[2]!;
      const dimStart: Point = {
        x: topStart.x - mainRoofNormal.nx * offset,
        y: topStart.y - mainRoofNormal.ny * offset,
      };
      const dimEnd: Point = {
        x: topEnd.x - mainRoofNormal.nx * offset,
        y: topEnd.y - mainRoofNormal.ny * offset,
      };
      const lengthM = Math.hypot((topEnd.x - topStart.x) / scale, (topEnd.y - topStart.y) / scale);
      return [{ topStart, topEnd, dimStart, dimEnd, lengthM }];
    }
    if (model.sectionKind === 'gable' && gableLeftRoofGeom && gableRightRoofGeom) {
      const leftTopStart = gableLeftRoofGeom.points[3]!;
      const leftTopEnd = gableLeftRoofGeom.points[2]!;
      const rightTopStart = gableRightRoofGeom.points[3]!;
      const rightTopEnd = gableRightRoofGeom.points[2]!;
      const leftNormal = segmentDownNormal(leftTopStart.x, leftTopStart.y, leftTopEnd.x, leftTopEnd.y);
      const rightNormal = segmentDownNormal(rightTopStart.x, rightTopStart.y, rightTopEnd.x, rightTopEnd.y);
      const leftDimStart: Point = {
        x: leftTopStart.x - leftNormal.nx * offset,
        y: leftTopStart.y - leftNormal.ny * offset,
      };
      const leftDimEnd: Point = {
        x: leftTopEnd.x - leftNormal.nx * offset,
        y: leftTopEnd.y - leftNormal.ny * offset,
      };
      const rightDimStart: Point = {
        x: rightTopStart.x - rightNormal.nx * offset,
        y: rightTopStart.y - rightNormal.ny * offset,
      };
      const rightDimEnd: Point = {
        x: rightTopEnd.x - rightNormal.nx * offset,
        y: rightTopEnd.y - rightNormal.ny * offset,
      };
      const leftLengthM = Math.hypot((leftTopEnd.x - leftTopStart.x) / scale, (leftTopEnd.y - leftTopStart.y) / scale);
      const rightLengthM = Math.hypot((rightTopEnd.x - rightTopStart.x) / scale, (rightTopEnd.y - rightTopStart.y) / scale);
      return [
        { topStart: leftTopStart, topEnd: leftTopEnd, dimStart: leftDimStart, dimEnd: leftDimEnd, lengthM: leftLengthM },
        { topStart: rightTopStart, topEnd: rightTopEnd, dimStart: rightDimStart, dimEnd: rightDimEnd, lengthM: rightLengthM },
      ];
    }
    return [];
  })();

  return unionBounds([
    boundsFromRect(Math.max(8, xLeft - 8), yGround + 1.3, Math.min(104, xRight + 8) - Math.max(8, xLeft - 8), 8),
    boundsFromLine(Math.max(8, xLeft - 8), yGround, Math.min(112, xRight + 8), yGround, 0.25),
    boundsFromRect(leftPostX, yHouseUnder, postW, yGround - yHouseUnder),
    boundsFromRect(secondPostX, supportPostTopY, postW, yGround - supportPostTopY),
    boundsFromRect(ledgerX, ledgerY, leftEaveWidth, leftEaveDepth),
    model.houseConnectionType === 'facade' || model.houseConnectionType === 'fascia'
      ? boundsFromLine(ledgerX - 1.1, yHouseUnder - 2.2, ledgerX - 1.1, yGround, 0.2)
      : null,
    model.houseConnectionType === 'fascia' ? boundsFromLine(ledgerX - 1.1, ledgerY - 0.9, ledgerX + leftEaveWidth, ledgerY - 0.9, 0.2) : null,
    model.houseConnectionType === 'soffit' ? boundsFromLine(ledgerX - 0.25, ledgerY - 1.25, ledgerX + leftEaveWidth, ledgerY - 1.25, 0.2) : null,
    model.sectionKind === 'mono' && overhangM > 0 ? boundsFromRect(xSupport - supportCapWidth / 2, supportCapTopY, supportCapWidth, supportCapDepth) : null,
    model.sectionKind === 'gable' ? boundsFromRect(rightEaveX, rightEaveY, rightEaveBeamWidth, rightEaveBeamDepth) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(xLeft, tieBeamTopY, Math.max(0.4, xRight - xLeft), Math.max(0.2, tieBeamBottomY - tieBeamTopY)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromRect(ridgeX - kingStrutWidth / 2, yRidgeUnder, kingStrutWidth, Math.max(0.2, tieBeamTopY - yRidgeUnder)) : null,
    model.sectionKind === 'gable' && yRidgeUnder !== null ? boundsFromLine(ridgeX, yGround, ridgeX, yRidgeUnder, 0.2) : null,
    monoRoofGeom ? boundsFromPoints(monoRoofGeom.points, 0.35) : null,
    gableLeftRoofGeom ? boundsFromPoints(gableLeftRoofGeom.points, 0.35) : null,
    gableRightRoofGeom ? boundsFromPoints(gableRightRoofGeom.points, 0.35) : null,
    yRidgeBeamTop !== null ? boundsFromRect(ridgeX - ridgeBeamWidth / 2, yRidgeBeamTop, ridgeBeamWidth, Math.max(0.2, yRidgeUnder! - yRidgeBeamTop)) : null,
    monoSupportSplice ? boundsFromLine(xSupport, monoSupportSplice.yTop, xSupport, monoSupportSplice.yUnder, 0.2) : null,
    model.sectionKind === 'mono' ? boundsFromRect(xRight - gutterWidth, gutterTopY, gutterWidth, Math.max(0.2, yOuterGutterUnder - gutterTopY)) : null,
    ...roofTopLengthDims.flatMap((roofDim) => {
      const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
      return [
        boundsFromLine(roofDim.topStart.x, roofDim.topStart.y, roofDim.dimStart.x, roofDim.dimStart.y, 0.2),
        boundsFromLine(roofDim.topEnd.x, roofDim.topEnd.y, roofDim.dimEnd.x, roofDim.dimEnd.y, 0.2),
        estimateTickDimensionBounds({
          x1: roofDim.dimStart.x,
          y1: roofDim.dimStart.y,
          x2: roofDim.dimEnd.x,
          y2: roofDim.dimEnd.y,
          label: formatMetres(roofDim.lengthM),
          textX: (roofDim.dimStart.x + roofDim.dimEnd.x) / 2 - roofNormal.nx * (1.4 + roofLengthLabelGap),
          textY: (roofDim.dimStart.y + roofDim.dimEnd.y) / 2 - roofNormal.ny * 1.4,
          presentation,
        }),
      ];
    }),
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(gableLeftRafterStartX + 1.6, yHouseRafterUnder + 1.4, ridgeX, yRidgeUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind === 'gable' && yRidgeUnder !== null
      ? boundsFromLine(ridgeX, yRidgeUnder + 1.4, gableRightRafterEndX - 1.6, yRightEaveRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled && model.sectionKind !== 'gable'
      ? boundsFromLine(monoRafterStartX + 1.6, yHouseRafterUnder + 1.4, monoRafterEndX - 1.6, yOuterRafterUnder + 1.4, 0.2)
      : null,
    model.boxPerimeterEnabled
      ? estimateTextBounds({
          text: `Internal roof angle ${model.pitchDeg.toFixed(1)} deg`,
          x: (xLeft + xRight) / 2,
          y: Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8),
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
    model.sectionKind === 'mono'
      ? estimateTickDimensionBounds({
          x1: depthDimTop.x,
          y1: depthDimTop.y,
          x2: depthDimBottom.x,
          y2: depthDimBottom.y,
          label: `${Math.round(model.rafterDepthM * 1000)}mm`,
          textX: depthDimTop.x - 1.3,
          textY: depthDimTop.y - 2.5,
          overrun: 1.1,
          presentation,
        })
      : null,
    boundsFromLine(leftDimX - 2.4, yHouseUnder, xLeft + 2.4, yHouseUnder, 0.2),
    boundsFromLine(xRight - 2.4, yOuterGutterUnder, rightDimX + 2.4, yOuterGutterUnder, 0.2),
    overhangM > 0 ? boundsFromLine(xSupport, spanAnchorSupportY, xSupport, overhangDimY, 0.2) : null,
    overhangM > 0 ? boundsFromLine(xRight, spanAnchorRightY, xRight, overhangDimY, 0.2) : null,
    overhangM > 0
      ? estimateTickDimensionBounds({ x1: xSupport, y1: overhangDimY, x2: xRight, y2: overhangDimY, label: `OH ${formatMetres(overhangM)}`, presentation })
      : null,
    boundsFromLine(xLeft, spanAnchorLeftY, xLeft, spanDimY, 0.2),
    boundsFromLine(xRight, spanAnchorRightY, xRight, spanDimY, 0.2),
    estimateTickDimensionBounds({
      x1: xLeft,
      y1: spanDimY,
      x2: xRight,
      y2: spanDimY,
      label: formatMetres(model.spanA),
      textY: spanDimY - 1.8,
      presentation,
    }),
    boundsFromLine(xLeft, yGround, leftDimX, yGround, 0.2),
    boundsFromLine(xLeft, yHouseUnder, leftDimX, yHouseUnder, 0.2),
    estimateTickDimensionBounds({ x1: leftDimX, y1: yGround, x2: leftDimX, y2: yHouseUnder, label: formatMetres(model.leftEdgeHeightM), presentation }),
    boundsFromLine(xRight, yGround, rightDimX, yGround, 0.2),
    boundsFromLine(xRight, yOuterGutterUnder, rightDimX, yOuterGutterUnder, 0.2),
    estimateTickDimensionBounds({ x1: rightDimX, y1: yGround, x2: rightDimX, y2: yOuterGutterUnder, label: formatMetres(outerGutterUndersideM), presentation }),
    estimateTextBounds({
      text: `Pitch ${model.pitchDeg.toFixed(1)} deg`,
      x: (xLeft + xRight) / 2,
      y: pitchLabelY,
      anchor: 'middle',
      fontHeight: 1.9,
      charWidth: 0.6,
      paddingX: 0.25,
      paddingY: 0.18,
    }),
    model.roofType === 'hip_corner'
      ? estimateTextBounds({
          text: 'Primary wing section (A)',
          x: (xLeft + xRight) / 2,
          y: metaLabelY,
          anchor: 'middle',
          fontHeight: 1.75,
          charWidth: 0.58,
          paddingX: 0.25,
          paddingY: 0.18,
        })
      : null,
  ]);
}

function resolveSectionSheetLayoutForScale(input: {
  model: ModuleSectionModel;
  scale: number;
}): ResolvedSheetLayout {
  const frame = getSectionSheetFrame(input.model.sectionKind);
  const extents = getSectionRealExtents(input.model);
  let xLeft = frame.fitArea.x + (frame.fitArea.width - extents.widthM * input.scale) / 2;
  let yGround = frame.fitArea.y + extents.heightM * input.scale + Math.max(0, frame.fitArea.height - extents.heightM * input.scale) * frame.verticalBias;
  let bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  for (let idx = 0; idx < 2; idx += 1) {
    const offset = resolveBoundsPlacement(bounds, frame.fitArea, frame.verticalBias);
    xLeft += offset.dx;
    yGround += offset.dy;
    bounds = measureSectionAnnotatedBounds({ model: input.model, xLeft, yGround, scale: input.scale });
  }

  return {
    outerField: frame.outerField,
    fitArea: frame.fitArea,
    annotatedBounds: bounds,
    x: xLeft,
    y: yGround,
    scale: input.scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
  };
}

function resolveSectionSheetLayout(input: {
  model: ModuleSectionModel;
  drawingScale: EstimateDrawingScale;
  viewportMm?: { widthMm: number; heightMm: number };
}): ResolvedSheetLayout {
  if (input.drawingScale.mode === 'fixed') {
    return resolveSectionSheetLayoutForScale({
      model: input.model,
      scale: getViewBoxUnitsPerMetreAtScale(input.drawingScale.ratio, input.viewportMm),
    });
  }

  const extents = getSectionRealExtents(input.model);
  const fitFrame = getSectionSheetFrame(input.model.sectionKind);
  return resolveMeasuredFitLayout({
    initialScale: Math.min(fitFrame.fitArea.width / Math.max(extents.widthM, 0.1), fitFrame.fitArea.height / Math.max(extents.heightM, 0.1)),
    resolveForScale: (scale) => resolveSectionSheetLayoutForScale({ model: input.model, scale }),
  });
}

function PlanSvg({
  model,
  idBase,
  presentation = 'card',
  drawingScale = DEFAULT_ESTIMATE_DRAWING_SCALE,
  sheetViewportMm,
  debugScaleState,
  scaleDiagnostics,
  interactiveFields,
  showDebugOverlays,
  footprintEditor,
}: {
  model: ModulePlanModel;
  idBase: string;
  presentation?: ModuleDrawingPresentation;
  drawingScale?: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  debugScaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  showDebugOverlays?: boolean;
  footprintEditor?: ModuleFootprintEditorProps;
}) {
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isSheet = presentation === 'sheet';
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const planSheetFrame = isSheet ? getPlanSheetFrame(isHipCorner) : null;
  const total = getPlanRealExtents(model);
  const sheetLayout = isSheet ? resolvePlanSheetLayout({ model, drawingScale, viewportMm: sheetViewportMm }) : null;
  const layout = sheetLayout ?? resolvePlanFitBox(total.widthM, total.heightM, presentation, isHipCorner);
  const scale = layout.scale;
  const rotationFrame = resolvePlanRotationFrame({
    x: layout.x,
    y: layout.y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: isHipCorner ? 0 : model.drawingRotationQuarterTurns,
  });
  const x = rotationFrame.baseX;
  const y = rotationFrame.baseY;
  const planRotationTransform =
    rotationFrame.turns === 0 ? undefined : `rotate(${rotationFrame.turns * 90} ${rotationFrame.center.x} ${rotationFrame.center.y})`;

  const aW = model.lengthA * scale;
  const aH = model.spanA * scale;
  const bW = (model.lengthB ?? 0) * scale;
  const bH = (model.spanB ?? 0) * scale;
  const splitY = y + aH;
  const bottomY = splitY + bH;
  const topFrameW = memberSizeM(model.ledgerBeamWidthM, 0.05) * scale;
  const sideFrameW = memberSizeM(model.supportBeamWidthM, 0.05) * scale;
  const gutterW = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const rafterW = memberSizeM(model.rafterWidthM, 0.05) * scale;
  const ridgeBandW = memberSizeM(model.ridgeBeamWidthM, 0.05) * scale;
  const ridgeBandX = x + sideFrameW;
  const ridgeBandWidth = Math.max(0, aW - sideFrameW * 2);

  const primaryPoints: Point[] = isHipCorner
    ? [
        { x, y },
        { x: x + aW, y },
        { x: x + aW, y: splitY },
        { x: x + bW, y: splitY },
        { x: x + bW, y: bottomY },
        { x, y: bottomY },
      ]
    : [
        { x, y },
        { x: x + aW, y },
        { x: x + aW, y: y + aH },
        { x, y: y + aH },
      ];

  const centerX = x + (isHipCorner ? Math.max(aW, bW) : aW) / 2;
  const centerY = y + (isHipCorner ? aH + bH : aH) / 2;
  const insetPoints = primaryPoints.map((point) => ({
    x: centerX + (point.x - centerX) * 0.92,
    y: centerY + (point.y - centerY) * 0.92,
  }));
  const hipInner = isHipCorner ? hipCornerInnerPoints(x, y, aW, bW, splitY, bottomY, Math.max(sideFrameW, topFrameW, gutterW)) : null;

  const gableMidY = y + aH / 2;
  const ridgeBandY = gableMidY - ridgeBandW / 2;
  const hipRidgeStartX = x + aW * 0.32;
  const hipRidgeEndX = x + aW * 0.68;
  const attachmentSide = model.houseConnectionType === 'none' || !model.supportsHouseFootprints || isHipCorner ? 'rear' : model.attachmentSide;
  const showHouseFootprint = model.houseConnectionType !== 'none';
  const houseBandOffset = isSheet ? (planSheetFrame?.houseBandOffset ?? 1.15) : layout.houseBandOffset;
  const houseBandHeight = isSheet ? (planSheetFrame?.houseBandHeight ?? 5.3) : layout.houseBandHeight;
  const houseInset = isSheet ? (planSheetFrame?.houseInset ?? 1.7) : layout.houseInset;
  const fallGap = isSheet ? (planSheetFrame?.fallGap ?? 5.0) : layout.fallGap;
  const footprintRect = { x, y, width: aW, height: aH };
  const footprintCanvasLayout =
    showHouseFootprint && model.supportsHouseFootprints && !isHipCorner
      ? resolveFootprintCanvasLayout({
          model: { ...model, attachmentSide },
          rect: footprintRect,
          scale,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
        })
      : null;
  const housePolygon = (() => {
    if (footprintCanvasLayout) return footprintCanvasLayout.polygon;
    if (!showHouseFootprint) {
      return rectToPoints(x, y, 0.1, 0.1);
    }
    const houseBottomY = y - houseBandOffset;
    const houseTopY = Math.max(isSheet ? (sheetLayout?.outerField.y ?? 0) + 4.8 : 4, houseBottomY - houseBandHeight);
    const houseLeftX = Math.max(isSheet ? (sheetLayout?.fitArea.x ?? 0) + 1.8 : 6, x - houseInset);
    const houseRightX = Math.min(isSheet ? (sheetLayout?.fitArea.x ?? 0) + (sheetLayout?.fitArea.width ?? 114) - 1.8 : 114, x + Math.max(aW, bW) + houseInset);
    return rectToPoints(houseLeftX, houseTopY, houseRightX - houseLeftX, houseBottomY - houseTopY);
  })();
  const outerFieldOutline = sheetLayout?.outerField ?? null;
  const fitAreaOutline = sheetLayout?.fitArea ?? null;
  const annotatedBoundsOutline = sheetLayout?.annotatedBounds ?? null;
  const debugMetrics = sheetLayout ? buildSheetDebugMetrics(sheetLayout, debugScaleState, scaleDiagnostics) : null;
  const houseLabel = footprintLabelPoint(housePolygon);
  const hatchId = `${idBase}_house_hatch`;
  const houseClipId = `${idBase}_house_clip`;
  const canEditFootprint = presentation === 'card' && Boolean(footprintEditor?.available) && canEditHouseFootprintPlan(model);
  const isEditingFootprint = canEditFootprint && Boolean(footprintEditor?.isEditing);
  const houseClipRect = isSheet
    ? (sheetLayout?.outerField ?? getSheetDrawingField())
    : { x: 0, y: 0, width: 120, height: 90 };

  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.rafterEdgeLengthM, x, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, x, bW);
  const interiorRafterXsA = interiorPlanRafterXs(rafterXsA);
  const interiorRafterXsB = interiorPlanRafterXs(rafterXsB);
  const footprintFrame = attachmentFrameForRect(attachmentSide, { x, y, width: Math.max(aW, bW), height: isHipCorner ? aH + bH : aH });
  const edgeFrames = !isHipCorner
    ? (['rear', 'front', 'left', 'right'] as AttachmentSide[]).map((side) => ({
        side,
        frame: attachmentFrameForRect(side, { x, y, width: Math.max(aW, bW), height: aH }),
      }))
    : [];
  const handleSpecs = footprintCanvasLayout?.handles ?? [];
  const highlightedHandle = handleSpecs.find(
    (handle) => handle.id === (footprintEditor?.activeHandleId ?? footprintEditor?.hoveredHandleId),
  );
  const activeEdgeTagPoint = rotatePointQuarterTurns(
    pointOnAttachmentFrame(footprintFrame, footprintFrame.length / 2, -1.9),
    rotationFrame.center,
    rotationFrame.turns,
  );
  const activeEdgeTagLabel = isEditingFootprint ? 'Attached edge' : null;
  const activeEdgeTagStyle =
    activeEdgeTagLabel
      ? {
          left: `${(clamp(activeEdgeTagPoint.x, 5.5, 114.5) / 120) * 100}%`,
          top: `${(clamp(activeEdgeTagPoint.y, 5.5, 84) / 90) * 100}%`,
        }
      : undefined;
  const soffitXs = projectLinearPositions(model.soffitBracketPositionsA, model.attachmentEdgeLengthM, 0, footprintFrame.length);
  const soffitGuideStart =
    soffitXs.length > 0 ? pointOnAttachmentFrame(footprintFrame, soffitXs[0]!, -1.2) : pointOnAttachmentFrame(footprintFrame, 0, -1.2);
  const soffitGuideEnd =
    soffitXs.length > 0
      ? pointOnAttachmentFrame(footprintFrame, soffitXs[soffitXs.length - 1]!, -1.2)
      : pointOnAttachmentFrame(footprintFrame, footprintFrame.length, -1.2);
  const soffitBracketLines = soffitXs.map((sx) => ({
    start: pointOnAttachmentFrame(footprintFrame, sx, -2.3),
    end: pointOnAttachmentFrame(footprintFrame, sx, 0.1),
  }));

  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: x + Math.max(aW, bW) + (isSheet ? fallGap - 0.55 : layout.fallGap),
          y,
          width: 0,
          height: isHipCorner ? aH + bH : aH,
        })
      : attachmentFrameForRect('front', { x, y: (isHipCorner ? bottomY : y + aH) + (isSheet ? fallGap - 0.55 : layout.fallGap), width: aW, height: 0 });
  const fallStart = pointOnAttachmentFrame(fallAnchor, isSheet ? 1.5 : 1, 0);
  const fallEnd = pointOnAttachmentFrame(fallAnchor, Math.max(isSheet ? 1.5 : 1, fallAnchor.length - (isSheet ? 1.5 : 1)), 0);
  const fallLabelPoint = pointOnAttachmentFrame(fallAnchor, fallAnchor.length / 2, fallIsHorizontal ? (isSheet ? 0.8 : 2.2) : (isSheet ? 0.62 : 2.3));
  const dimensionOffsets = isSheet
    ? { bottom: 7.8, secondary: 5.4, tertiary: 6.15, side: 5.6, hipSide: 5.9 }
    : { bottom: 7.1, secondary: 5.1, tertiary: 5.8, side: 7.0, hipSide: 7.2 };

  const dimBaseY = Math.min(87.4, bottomY + dimensionOffsets.bottom);
  const secondaryDimY = Math.min(88.5, dimBaseY + dimensionOffsets.secondary);
  const rafterDimY = Math.min(88.9, dimBaseY + dimensionOffsets.tertiary);
  const yTopInner = y + topFrameW;
  const yBottomInner = y + aH - gutterW;
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : y + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = x + sideFrameW;
  const highlightedHandleLabel = highlightedHandle ? `${highlightedHandle.label}: ${formatMetres(highlightedHandle.valueM)}` : null;
  const highlightedHandleLabelWidth = highlightedHandleLabel ? Math.max(16, highlightedHandleLabel.length * 0.56 + 2.8) : 0;
  const highlightedHandleLabelX =
    highlightedHandle && highlightedHandleLabel
      ? clamp(highlightedHandle.pointRoot.x + 2.8, 1.4, 118 - highlightedHandleLabelWidth)
      : 0;
  const highlightedHandleLabelY = highlightedHandle ? clamp(highlightedHandle.pointRoot.y - 4.8, 4.5, 84) : 0;

  return (
    <>
      <svg
        viewBox="0 0 120 90"
        role="img"
        aria-label="Module plan view"
        ref={footprintEditor?.onSvgMount}
        className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
          presentation === 'sheet' ? styles.modulePlanSvgSheet : ''
        }`}
      >
      <defs>
        <pattern id={hatchId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" className={styles.moduleHouseHatchLine} />
        </pattern>
        <clipPath id={houseClipId}>
          <rect x={houseClipRect.x} y={houseClipRect.y} width={houseClipRect.width} height={houseClipRect.height} />
        </clipPath>
      </defs>

      {effectiveShowDebugOverlays && outerFieldOutline ? <DebugOutline rect={outerFieldOutline} className={styles.moduleDebugCropOutline} marker="outer-plan" /> : null}
      {effectiveShowDebugOverlays && fitAreaOutline ? <DebugOutline rect={fitAreaOutline} className={styles.moduleDebugFitOutline} marker="fit-plan" /> : null}
      {effectiveShowDebugOverlays && annotatedBoundsOutline ? (
        <DebugOutline
          rect={{
            x: annotatedBoundsOutline.minX,
            y: annotatedBoundsOutline.minY,
            width: annotatedBoundsOutline.maxX - annotatedBoundsOutline.minX,
            height: annotatedBoundsOutline.maxY - annotatedBoundsOutline.minY,
          }}
          className={styles.moduleDebugBoundsOutline}
          marker="bounds-plan"
        />
      ) : null}
      {effectiveShowDebugOverlays && debugMetrics && outerFieldOutline ? (
        <g className={styles.moduleDebugStats} aria-hidden="true">
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 1.6} className={styles.moduleDebugStatsText}>
            {`req ${debugMetrics.requestedScaleLabel} -> ${debugMetrics.appliedScaleLabel}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 3.1} className={styles.moduleDebugStatsText}>
            {`bounds ${debugMetrics.boundsWidth.toFixed(1)} x ${debugMetrics.boundsHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 4.6} className={styles.moduleDebugStatsText}>
            {`fit ${debugMetrics.fitWidth.toFixed(1)} x ${debugMetrics.fitHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 6.1} className={styles.moduleDebugStatsText}>
            {`util ${Math.round(debugMetrics.utilizationX * 100)}% x  ${Math.round(debugMetrics.utilizationY * 100)}% y`}
          </text>
          {debugMetrics.candidateLines.map((line, idx) => (
            <text key={`plan-debug-scale-${line}`} x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 7.6 + idx * 1.5} className={styles.moduleDebugStatsText}>
              {line}
            </text>
          ))}
        </g>
      ) : null}

      <g transform={planRotationTransform}>
        <g clipPath={`url(#${houseClipId})`}>
          {showHouseFootprint ? <polygon points={toPointsAttr(housePolygon)} fill={`url(#${hatchId})`} className={styles.moduleHouseHatch} /> : null}
          {showHouseFootprint && !isEditingFootprint ? (
            <text x={houseLabel.x} y={houseLabel.y} textAnchor="middle" dominantBaseline="middle" className={styles.moduleHouseLabel}>
              House side
            </text>
          ) : null}
        </g>
        {model.houseConnectionType === 'facade' ? (
          <line x1={footprintFrame.start.x} y1={footprintFrame.start.y} x2={footprintFrame.end.x} y2={footprintFrame.end.y} className={styles.modulePlanHouseWall} />
        ) : null}
        {model.houseConnectionType === 'fascia' ? (
          <>
            <line x1={footprintFrame.start.x} y1={footprintFrame.start.y} x2={footprintFrame.end.x} y2={footprintFrame.end.y} className={styles.modulePlanHouseWall} />
            <line
              x1={pointOnAttachmentFrame(footprintFrame, 0, -0.8).x}
              y1={pointOnAttachmentFrame(footprintFrame, 0, -0.8).y}
              x2={pointOnAttachmentFrame(footprintFrame, footprintFrame.length, -0.8).x}
              y2={pointOnAttachmentFrame(footprintFrame, footprintFrame.length, -0.8).y}
              className={styles.modulePlanFasciaBand}
            />
          </>
        ) : null}

        <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanFill} />
        {!isHipCorner ? (
          <>
            <rect x={x} y={y} width={aW} height={topFrameW} className={styles.modulePlanPrimaryZone} />
            <rect x={x} y={y + aH - gutterW} width={aW} height={gutterW} className={styles.modulePlanPrimaryZone} />
            <rect x={x} y={y + topFrameW} width={sideFrameW} height={Math.max(0.2, aH - topFrameW - gutterW)} className={styles.modulePlanPrimaryZone} />
            <rect x={x + aW - sideFrameW} y={y + topFrameW} width={sideFrameW} height={Math.max(0.2, aH - topFrameW - gutterW)} className={styles.modulePlanPrimaryZone} />
            <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanPerimeter} />
            <line x1={x + sideFrameW} y1={y + topFrameW} x2={x + aW - sideFrameW} y2={y + topFrameW} className={styles.modulePlanMemberEdge} />
            <line x1={x + sideFrameW} y1={y + aH - gutterW} x2={x + aW - sideFrameW} y2={y + aH - gutterW} className={styles.modulePlanMemberEdge} />
            <line x1={x + sideFrameW} y1={y + topFrameW} x2={x + sideFrameW} y2={y + aH - gutterW} className={styles.modulePlanMemberEdge} />
            <line x1={x + aW - sideFrameW} y1={y + topFrameW} x2={x + aW - sideFrameW} y2={y + aH - gutterW} className={styles.modulePlanMemberEdge} />
          </>
        ) : (
          <>
            <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanPerimeter} />
            {hipInner ? <polygon points={toPointsAttr(hipInner)} className={styles.modulePlanMemberEdge} /> : null}
          </>
        )}

        {model.boxPerimeterEnabled ? <polygon points={toPointsAttr(insetPoints)} className={styles.modulePlanBoxInset} /> : null}
        {hasFullLengthRidge && ridgeBandWidth > 0 ? <rect x={ridgeBandX} y={ridgeBandY} width={ridgeBandWidth} height={ridgeBandW} className={styles.modulePlanRidgeBand} /> : null}
        {model.roofType === 'hip' ? (
          <>
            <line x1={hipRidgeStartX} y1={gableMidY} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanRidge} />
            <line x1={x} y1={y} x2={hipRidgeStartX} y2={gableMidY} className={styles.modulePlanHipLine} />
            <line x1={x + aW} y1={y} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanHipLine} />
            <line x1={x} y1={y + aH} x2={hipRidgeStartX} y2={gableMidY} className={styles.modulePlanHipLine} />
            <line x1={x + aW} y1={y + aH} x2={hipRidgeEndX} y2={gableMidY} className={styles.modulePlanHipLine} />
          </>
        ) : null}
        {isHipCorner ? <line x1={x} y1={splitY} x2={x + bW} y2={splitY} className={styles.modulePlanJointLine} /> : null}

        {interiorRafterXsA.map((rx) => (
          <rect
            key={`rafter_a_${rx.toFixed(3)}`}
            x={rx - rafterW / 2}
            y={yTopInner}
            width={rafterW}
            height={Math.max(0.2, (isHipCorner ? splitY - gutterW : yBottomInner) - yTopInner)}
            className={styles.modulePlanRafter}
          />
        ))}
        {isHipCorner
          ? interiorRafterXsB.map((rx) => (
              <rect
                key={`rafter_b_${rx.toFixed(3)}`}
                x={rx - rafterW / 2}
                y={splitY + topFrameW}
                width={rafterW}
                height={Math.max(0.2, bottomY - gutterW - (splitY + topFrameW))}
                className={styles.modulePlanRafter}
              />
            ))
          : null}

        {model.houseConnectionType === 'soffit' && soffitXs.length > 0 ? (
          <>
            <line x1={soffitGuideStart.x} y1={soffitGuideStart.y} x2={soffitGuideEnd.x} y2={soffitGuideEnd.y} className={styles.modulePlanSoffitGuide} />
            {soffitBracketLines.map((line, idx) => (
              <line
                key={`bracket_${idx}`}
                x1={line.start.x}
                y1={line.start.y}
                x2={line.end.x}
                y2={line.end.y}
                className={styles.modulePlanSoffitBracket}
              />
            ))}
          </>
        ) : null}

        {model.overhangEnabled && overhangDepth > 0 ? <rect x={overhangX} y={overhangY} width={overhangWidth} height={overhangDepth} className={styles.modulePlanOverhangZone} /> : null}
        {model.boxPerimeterEnabled ? (
          <>
            <line x1={centerX} y1={y + 2.8} x2={centerX} y2={(isHipCorner ? bottomY : y + aH) - 2.8} className={styles.modulePlanInternalAngle} />
            <text x={centerX + 2.5} y={centerY + 0.5} className={styles.modulePlanAngleText}>
              internal roof angle
            </text>
          </>
        ) : null}

        <line x1={fallStart.x} y1={fallStart.y} x2={fallEnd.x} y2={fallEnd.y} className={styles.moduleFallLine} />
        {isGableLike ? (
          <>
            <ArrowHead x={fallStart.x} y={fallStart.y} direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up'} presentation={presentation} />
            <ArrowHead x={fallEnd.x} y={fallEnd.y} direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down'} presentation={presentation} />
            <text x={fallLabelPoint.x} y={fallLabelPoint.y} className={`${styles.moduleFallLabel} ${isSheet ? styles.moduleFallLabelSheet : ''}`}>
              fall both sides
            </text>
          </>
        ) : (
          <>
            <ArrowHead
              x={model.slopeDirection === 'toward_house' ? fallStart.x : fallEnd.x}
              y={model.slopeDirection === 'toward_house' ? fallStart.y : fallEnd.y}
              direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : model.slopeDirection === 'toward_house' ? 'up' : 'down'}
              presentation={presentation}
            />
            <text x={fallLabelPoint.x} y={fallLabelPoint.y} className={`${styles.moduleFallLabel} ${isSheet ? styles.moduleFallLabelSheet : ''}`}>
              fall
            </text>
          </>
        )}

        <line x1={x} y1={isHipCorner ? bottomY : y + aH} x2={x} y2={dimBaseY} className={styles.moduleDimWitness} />
        <line x1={x + aW} y1={isHipCorner ? splitY : y + aH} x2={x + aW} y2={dimBaseY} className={styles.moduleDimWitness} />
        <TickDimension
          x1={x}
          y1={dimBaseY}
          x2={x + aW}
          y2={dimBaseY}
          label={formatMetres(model.lengthA)}
          presentation={presentation}
          interactiveField={interactiveFields?.['plan:lengthA']}
        />

        <line x1={x} y1={y} x2={x - dimensionOffsets.side} y2={y} className={styles.moduleDimWitness} />
        <line x1={x} y1={y + aH} x2={x - dimensionOffsets.side} y2={y + aH} className={styles.moduleDimWitness} />
        <TickDimension
          x1={x - dimensionOffsets.side}
          y1={y}
          x2={x - dimensionOffsets.side}
          y2={y + aH}
          label={formatMetres(model.spanA)}
          presentation={presentation}
          interactiveField={interactiveFields?.['plan:spanA']}
        />

        {isHipCorner && model.lengthB && model.spanB ? (
          <>
            <line x1={x} y1={bottomY} x2={x} y2={secondaryDimY} className={styles.moduleDimWitness} />
            <line x1={x + bW} y1={bottomY} x2={x + bW} y2={secondaryDimY} className={styles.moduleDimWitness} />
            <TickDimension
              x1={x}
              y1={secondaryDimY}
              x2={x + bW}
              y2={secondaryDimY}
              label={formatMetres(model.lengthB)}
              presentation={presentation}
              interactiveField={interactiveFields?.['plan:lengthB']}
            />

            <line x1={x + bW} y1={splitY} x2={x + bW + dimensionOffsets.hipSide} y2={splitY} className={styles.moduleDimWitness} />
            <line x1={x + bW} y1={bottomY} x2={x + bW + dimensionOffsets.hipSide} y2={bottomY} className={styles.moduleDimWitness} />
            <TickDimension
              x1={x + bW + dimensionOffsets.hipSide}
              y1={splitY}
              x2={x + bW + dimensionOffsets.hipSide}
              y2={bottomY}
              label={formatMetres(model.spanB)}
              presentation={presentation}
              interactiveField={interactiveFields?.['plan:spanB']}
            />
          </>
        ) : null}

        {rafterXsA.length >= 2
          ? (() => {
              const spacingXs = interiorRafterXsA.length >= 2 ? interiorRafterXsA : rafterXsA;
              const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
              const d1 = spacingXs[baseIdx]!;
              const d2 = spacingXs[baseIdx + 1]!;
              return (
                <>
                  <line x1={d1} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d1} y2={rafterDimY} className={styles.moduleDimWitness} />
                  <line x1={d2} y1={isHipCorner ? splitY - gutterW : yBottomInner} x2={d2} y2={rafterDimY} className={styles.moduleDimWitness} />
                  <TickDimension
                    x1={d1}
                    y1={rafterDimY}
                    x2={d2}
                    y2={rafterDimY}
                    label={`${formatMetres(model.rafterSpacingA)} c/c`}
                    textY={rafterDimY - (isSheet ? 1.8 : 1.5)}
                    presentation={presentation}
                  />
                </>
              );
            })()
          : null}

        {isEditingFootprint
          ? edgeFrames.map(({ side, frame: edgeFrame }) => {
              const isActiveEdge = side === attachmentSide;
              const isHoveredEdge = side === footprintEditor?.hoveredAttachmentSide;
              return (
                <g key={`footprint-edge-${side}`}>
                  {isActiveEdge || isHoveredEdge ? (
                    <line
                      x1={edgeFrame.start.x}
                      y1={edgeFrame.start.y}
                      x2={edgeFrame.end.x}
                      y2={edgeFrame.end.y}
                      className={
                        isActiveEdge
                          ? `${styles.moduleFootprintEdge} ${styles.moduleFootprintEdgeActive}`
                          : `${styles.moduleFootprintEdge} ${styles.moduleFootprintEdgeHover}`
                      }
                    />
                  ) : null}
                  <line
                    x1={edgeFrame.start.x}
                    y1={edgeFrame.start.y}
                    x2={edgeFrame.end.x}
                    y2={edgeFrame.end.y}
                    data-footprint-edge={side}
                    className={styles.moduleFootprintEdgeHit}
                    onPointerEnter={() => footprintEditor?.onAttachmentSideHover(side)}
                    onPointerLeave={() => footprintEditor?.onAttachmentSideHover(null)}
                    onClick={() => footprintEditor?.onAttachmentSideSelect(side)}
                  />
                </g>
              );
            })
          : null}

        {isEditingFootprint
          ? handleSpecs.map((handle) => {
              const isActiveHandle = handle.id === footprintEditor?.activeHandleId;
              const isHoveredHandle = handle.id === footprintEditor?.hoveredHandleId;
              return (
                <g key={`footprint-handle-${handle.id}`}>
                  <line
                    x1={handle.guideFrom.x}
                    y1={handle.guideFrom.y}
                    x2={handle.guideTo.x}
                    y2={handle.guideTo.y}
                    className={isActiveHandle ? `${styles.moduleFootprintGuide} ${styles.moduleFootprintGuideActive}` : styles.moduleFootprintGuide}
                  />
                  <circle
                    cx={handle.point.x}
                    cy={handle.point.y}
                    r={isActiveHandle ? 1.18 : 1.02}
                    data-footprint-handle={handle.id}
                    className={
                      isActiveHandle
                        ? `${styles.moduleFootprintHandle} ${styles.moduleFootprintHandleActive}`
                        : isHoveredHandle
                          ? `${styles.moduleFootprintHandle} ${styles.moduleFootprintHandleHover}`
                          : styles.moduleFootprintHandle
                    }
                  />
                  <circle
                    cx={handle.point.x}
                    cy={handle.point.y}
                    r={2.8}
                    className={styles.moduleFootprintHandleHit}
                    onPointerEnter={() => footprintEditor?.onHandleHover(handle.id)}
                    onPointerLeave={() => footprintEditor?.onHandleHover(null)}
                    onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                      event.preventDefault();
                      event.stopPropagation();
                      footprintEditor?.onHandleDragStart(
                        {
                          handleId: handle.id,
                          axisX: handle.axisX,
                          axisY: handle.axisY,
                          scale,
                          deltaMultiplier: handle.deltaMultiplier,
                          minValueM: handle.minValueM,
                          maxValueM: handle.maxValueM,
                        },
                        {
                          pointerId: event.pointerId,
                          clientX: event.clientX,
                          clientY: event.clientY,
                        },
                      );
                    }}
                  />
                </g>
              );
            })
          : null}
      </g>

      {isEditingFootprint && highlightedHandle && highlightedHandleLabel ? (
        <g className={styles.moduleFootprintValueBadge} aria-hidden="true">
          <rect
            x={highlightedHandleLabelX}
            y={highlightedHandleLabelY - 1.65}
            width={highlightedHandleLabelWidth}
            height={3}
            rx={1.5}
            className={styles.moduleFootprintValueBadgeRect}
          />
          <text x={highlightedHandleLabelX + highlightedHandleLabelWidth / 2} y={highlightedHandleLabelY} textAnchor="middle" className={styles.moduleFootprintValueBadgeText}>
            {highlightedHandleLabel}
          </text>
        </g>
      ) : null}
      </svg>
      {activeEdgeTagLabel && activeEdgeTagStyle ? (
        <div className={styles.moduleFootprintEdgeBadgeOverlay} style={activeEdgeTagStyle} aria-hidden="true">
          <span className={styles.moduleFootprintEdgeBadgePill}>{activeEdgeTagLabel}</span>
        </div>
      ) : null}
    </>
  );
}

function SectionSvg({
  model,
  presentation = 'card',
  drawingScale = DEFAULT_ESTIMATE_DRAWING_SCALE,
  sheetViewportMm,
  debugScaleState,
  scaleDiagnostics,
  interactiveFields,
  showDebugOverlays = false,
}: {
  model: ModuleSectionModel;
  presentation?: ModuleDrawingPresentation;
  drawingScale?: EstimateDrawingScale;
  sheetViewportMm?: { widthMm: number; heightMm: number };
  debugScaleState?: ModuleDrawingScaleState | null;
  scaleDiagnostics?: ModuleDrawingScaleDiagnostic[];
  interactiveFields?: ModuleDrawingInteractiveFieldMap;
  showDebugOverlays?: boolean;
}) {
  const isSheet = presentation === 'sheet';
  const sectionSheetLayout = isSheet ? resolveSectionSheetLayout({ model, drawingScale, viewportMm: sheetViewportMm }) : null;
  const overhangM = sectionOverhangM(model);
  const totalSpanM = Math.max(model.spanA, 0.001);
  const supportXFromHouseM = sectionSupportXFromHouseM(model);
  const ledgerBeamDepthM = sectionLedgerBeamDepthM(model);
  const ledgerBeamWidthM = sectionLedgerBeamWidthM(model);
  const supportBeamDepthM = sectionSupportBeamDepthM(model);
  const supportBeamWidthM = sectionSupportBeamWidthM(model);
  const tieBeamDepthM = sectionSupportBeamDepthM(model);
  const tieBeamWidthM = sectionSupportBeamWidthM(model);
  const ridgeBeamDepthM = sectionRidgeBeamDepthM(model);
  const ridgeBeamWidthM = sectionRidgeBeamWidthM(model);
  const leftEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : ledgerBeamDepthM;
  const leftEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : ledgerBeamWidthM;
  const rightEaveBeamDepthM = model.sectionKind === 'gable' ? model.gutterDepthM : supportBeamDepthM;
  const rightEaveBeamWidthM = model.sectionKind === 'gable' ? model.gutterWidthM : supportBeamWidthM;
  const outerGutterUndersideM = sectionOuterGutterUndersideM(model);
  const supportUndersideM = sectionSupportUndersideM(model);
  const rafterPlumbCutDropM = sectionRafterPlumbCutDropM(model);
  const houseLedgerUndersideM = model.leftEdgeHeightM;
  const houseRafterUndersideM = houseLedgerUndersideM + leftEaveBeamDepthM - rafterPlumbCutDropM;
  const outerRafterUndersideM = outerGutterUndersideM + model.gutterDepthM - rafterPlumbCutDropM;
  const supportRafterUndersideM =
    model.sectionKind === 'mono'
      ? sectionMonoRafterUndersideAtM(model, supportXFromHouseM)
      : model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM;
  const supportBeamTopM = supportUndersideM + supportBeamDepthM;

  const fitFrame = resolveSectionFitFrame(presentation, model.sectionKind);
  const outerFieldOutline = sectionSheetLayout?.outerField ?? null;
  const fitAreaOutline = sectionSheetLayout?.fitArea ?? null;
  const annotatedBoundsOutline = sectionSheetLayout?.annotatedBounds ?? null;
  const debugMetrics = sectionSheetLayout ? buildSheetDebugMetrics(sectionSheetLayout, debugScaleState, scaleDiagnostics) : null;
  const chartWidth = Math.max(12, fitFrame.fitArea.width);
  const topMargin = fitFrame.fitArea.y;
  const safeSpanM = Math.max(totalSpanM, 0.1);

  const heights = [
    houseLedgerUndersideM,
    model.rightEdgeHeightM,
    supportUndersideM,
    outerGutterUndersideM,
    houseRafterUndersideM,
    supportRafterUndersideM,
    supportBeamTopM,
    outerRafterUndersideM,
    houseRafterUndersideM + model.rafterDepthM,
    outerRafterUndersideM + model.rafterDepthM,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM : null,
    typeof model.ridgeHeightM === 'number' ? model.ridgeHeightM + ridgeBeamDepthM + model.rafterDepthM : null,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const maxHeightM = Math.max(0.1, ...(heights.length ? heights : [0.1]));

  const availableHeight = Math.max(10, fitFrame.fitArea.height);
  const fixedScale = isSheet && drawingScale.mode === 'fixed' ? getViewBoxUnitsPerMetreAtScale(drawingScale.ratio, sheetViewportMm) : null;
  const scale =
    sectionSheetLayout?.scale ??
    fixedScale ??
    (() => {
      const scaleX = chartWidth / safeSpanM;
      const scaleY = availableHeight / maxHeightM;
      return Math.min(scaleX, scaleY);
    })();
  const drawHeight = maxHeightM * scale;
  const topOffset = sectionSheetLayout ? sectionSheetLayout.y - drawHeight : topMargin + Math.max(0, availableHeight - drawHeight) * fitFrame.verticalBias;
  const yGround = sectionSheetLayout?.y ?? topOffset + drawHeight;

  const postW = memberSizeM(model.postWidthM, 0.1) * scale;
  const rafterDepth = memberSizeM(model.rafterDepthM, 0.15) * scale;
  const gutterWidth = memberSizeM(model.gutterWidthM, 0.1) * scale;
  const leftEaveDepth = leftEaveBeamDepthM * scale;
  const leftEaveWidth = leftEaveBeamWidthM * scale;
  const supportCapDepth = supportBeamDepthM * scale;
  const supportCapWidth = supportBeamWidthM * scale;
  const tieBeamDepth = tieBeamDepthM * scale;
  const kingStrutWidth = tieBeamWidthM * scale;
  const rightEaveBeamDepth = rightEaveBeamDepthM * scale;
  const rightEaveBeamWidth = rightEaveBeamWidthM * scale;
  const ridgeBeamWidth = ridgeBeamWidthM * scale;

  const drawWidth = safeSpanM * scale;
  const xLeft = sectionSheetLayout?.x ?? (fitFrame.fitArea.x + (chartWidth - drawWidth) / 2);
  const xRight = xLeft + model.spanA * scale;
  const xSupport = model.sectionKind === 'mono' ? xLeft + supportXFromHouseM * scale : xRight;
  const ridgeX = (xLeft + xRight) / 2;
  const yForHeight = (heightM: number) => yGround - Math.max(0, heightM) * scale;

  const yHouseUnder = yForHeight(houseLedgerUndersideM);
  const ySupportUnder = yForHeight(model.sectionKind === 'mono' ? supportUndersideM : model.rightEdgeHeightM);
  const yOuterGutterUnder = yForHeight(outerGutterUndersideM);
  const yHouseRafterUnder = yForHeight(houseRafterUndersideM);
  const yOuterRafterUnder = yForHeight(outerRafterUndersideM);
  const yOuterGutterTop = yForHeight(outerGutterUndersideM + model.gutterDepthM);
  const yRightEaveRafterUnder = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM - rafterPlumbCutDropM);
  const ySupportBeamTop = yForHeight(supportBeamTopM);
  const yRidgeUnder = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM) : null;
  const yRidgeBeamTop = typeof model.ridgeHeightM === 'number' ? yForHeight(model.ridgeHeightM + ridgeBeamDepthM) : null;
  const tieBeamTopY = yHouseUnder;
  const tieBeamBottomY = Math.min(yGround - 0.4, tieBeamTopY + tieBeamDepth);
  const tieBeamLeftX = xLeft;
  const tieBeamRightX = xRight;
  const kingStrutBottomY = tieBeamTopY;
  const supportPostTopY = ySupportUnder;
  const supportCapTopY = ySupportBeamTop;
  const gutterTopY = yOuterGutterTop;
  const ledgerX = xLeft;
  const ledgerY = yForHeight(houseLedgerUndersideM + leftEaveBeamDepthM);
  const rightEaveX = xRight - rightEaveBeamWidth;
  const rightEaveY = yForHeight(model.rightEdgeHeightM + rightEaveBeamDepthM);
  const leftPostX = xLeft;
  const secondPostX = model.sectionKind === 'mono' ? (overhangM > 0 ? xSupport - postW / 2 : xRight - postW) : xRight - postW;
  const monoRafterStartX = ledgerX + leftEaveWidth;
  const monoRafterEndX = xRight - gutterWidth;
  const gableLeftRafterStartX = ledgerX + leftEaveWidth;
  const gableRightRafterEndX = xRight - rightEaveBeamWidth;

  const leftDimX = Math.max(6, xLeft - (isSheet ? 9.8 : 8.6));
  const rightDimX = Math.min(114, xRight + (isSheet ? 10.6 : 9.4));
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = Math.min(89.2, Math.max(yGround + (isSheet ? 10.9 : 10.2), spanDatumY + (isSheet ? 9.4 : 8.4)));
  const overhangDimY = Math.max(spanAnchorRightY + (isSheet ? 4.9 : 4.2), spanDimY - (isSheet ? 5.8 : 5.2));
  const pitchLabelY = isSheet ? spanDimY + 6.2 : 88;
  const metaLabelY = isSheet ? pitchLabelY - 3.2 : 84.8;
  const roofLengthLabelGap = isSheet ? 1.6 : 1.2;
  const pitchInteractiveField = interactiveFields?.['section:pitch'];

  const mainRoofNormal = segmentDownNormal(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder);
  const ridgeLeftX = ridgeX - ridgeBeamWidth / 2;
  const ridgeRightX = ridgeX + ridgeBeamWidth / 2;

  const monoRoofGeom = model.sectionKind === 'mono' ? sectionMemberPolygonPlumbCuts(monoRafterStartX, yHouseRafterUnder, monoRafterEndX, yOuterRafterUnder, rafterDepth) : null;

  const gableLeftRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(gableLeftRafterStartX, yHouseRafterUnder, ridgeLeftX, yRidgeUnder, rafterDepth);
  })();

  const gableRightRoofGeom = (() => {
    if (model.sectionKind !== 'gable' || yRidgeUnder === null) return null;
    return sectionMemberPolygonPlumbCuts(ridgeRightX, yRidgeUnder, gableRightRafterEndX, yRightEaveRafterUnder, rafterDepth);
  })();

  const monoSupportSplice = (() => {
    if (model.sectionKind !== 'mono' || overhangM <= 0 || !monoRoofGeom || monoRafterEndX - monoRafterStartX <= 1e-6) return null;
    const t = clamp((xSupport - monoRafterStartX) / (monoRafterEndX - monoRafterStartX), 0, 1);
    const yUnder = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * t;
    const topStart = monoRoofGeom.points[3]!;
    const topEnd = monoRoofGeom.points[2]!;
    const yTop = topStart.y + (topEnd.y - topStart.y) * t;
    return { yTop, yUnder };
  })();

  const depthDimAlongRoof = isSheet ? 0.18 : 0.24;
  const depthDimUnderX = monoRafterStartX + (monoRafterEndX - monoRafterStartX) * depthDimAlongRoof;
  const depthDimUnderY = yHouseRafterUnder + (yOuterRafterUnder - yHouseRafterUnder) * depthDimAlongRoof;
  const depthDimTop: Point = {
    x: depthDimUnderX - mainRoofNormal.nx * rafterDepth,
    y: depthDimUnderY - mainRoofNormal.ny * rafterDepth,
  };
  const depthDimBottom: Point = { x: depthDimUnderX, y: depthDimUnderY };
  const roofTopLengthDims = (() => {
    const offset = isSheet ? (model.sectionKind === 'gable' ? 4.8 : 4.2) : 2.7;
    if (model.sectionKind === 'mono' && monoRoofGeom) {
      const topStart = monoRoofGeom.points[3]!;
      const topEnd = monoRoofGeom.points[2]!;
      const dimStart: Point = {
        x: topStart.x - mainRoofNormal.nx * offset,
        y: topStart.y - mainRoofNormal.ny * offset,
      };
      const dimEnd: Point = {
        x: topEnd.x - mainRoofNormal.nx * offset,
        y: topEnd.y - mainRoofNormal.ny * offset,
      };
      const lengthM = Math.hypot((topEnd.x - topStart.x) / scale, (topEnd.y - topStart.y) / scale);
      return [{ topStart, topEnd, dimStart, dimEnd, lengthM }];
    }

    if (model.sectionKind === 'gable' && gableLeftRoofGeom && gableRightRoofGeom) {
      const leftTopStart = gableLeftRoofGeom.points[3]!;
      const leftTopEnd = gableLeftRoofGeom.points[2]!;
      const rightTopStart = gableRightRoofGeom.points[3]!;
      const rightTopEnd = gableRightRoofGeom.points[2]!;

      const leftNormal = segmentDownNormal(leftTopStart.x, leftTopStart.y, leftTopEnd.x, leftTopEnd.y);
      const rightNormal = segmentDownNormal(rightTopStart.x, rightTopStart.y, rightTopEnd.x, rightTopEnd.y);

      const leftDimStart: Point = {
        x: leftTopStart.x - leftNormal.nx * offset,
        y: leftTopStart.y - leftNormal.ny * offset,
      };
      const leftDimEnd: Point = {
        x: leftTopEnd.x - leftNormal.nx * offset,
        y: leftTopEnd.y - leftNormal.ny * offset,
      };
      const rightDimStart: Point = {
        x: rightTopStart.x - rightNormal.nx * offset,
        y: rightTopStart.y - rightNormal.ny * offset,
      };
      const rightDimEnd: Point = {
        x: rightTopEnd.x - rightNormal.nx * offset,
        y: rightTopEnd.y - rightNormal.ny * offset,
      };

      const leftLengthM = Math.hypot((leftTopEnd.x - leftTopStart.x) / scale, (leftTopEnd.y - leftTopStart.y) / scale);
      const rightLengthM = Math.hypot((rightTopEnd.x - rightTopStart.x) / scale, (rightTopEnd.y - rightTopStart.y) / scale);

      return [
        { topStart: leftTopStart, topEnd: leftTopEnd, dimStart: leftDimStart, dimEnd: leftDimEnd, lengthM: leftLengthM },
        { topStart: rightTopStart, topEnd: rightTopEnd, dimStart: rightDimStart, dimEnd: rightDimEnd, lengthM: rightLengthM },
      ];
    }

    return [];
  })();

  return (
    <svg
      viewBox="0 0 120 90"
      role="img"
      aria-label="Module section view"
      className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
        presentation === 'sheet' ? styles.modulePlanSvgSheet : ''
      }`}
    >
      {showDebugOverlays && outerFieldOutline ? <DebugOutline rect={outerFieldOutline} className={styles.moduleDebugCropOutline} marker="outer-section" /> : null}

      {showDebugOverlays && fitAreaOutline ? <DebugOutline rect={fitAreaOutline} className={styles.moduleDebugFitOutline} marker="fit-section" /> : null}

      {showDebugOverlays && annotatedBoundsOutline ? (
        <DebugOutline
          rect={{
            x: annotatedBoundsOutline.minX,
            y: annotatedBoundsOutline.minY,
            width: annotatedBoundsOutline.maxX - annotatedBoundsOutline.minX,
            height: annotatedBoundsOutline.maxY - annotatedBoundsOutline.minY,
          }}
          className={styles.moduleDebugBoundsOutline}
          marker="bounds-section"
        />
      ) : null}

      {showDebugOverlays && debugMetrics && outerFieldOutline ? (
        <g className={styles.moduleDebugStats} aria-hidden="true">
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 1.6} className={styles.moduleDebugStatsText}>
            {`req ${debugMetrics.requestedScaleLabel} -> ${debugMetrics.appliedScaleLabel}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 3.1} className={styles.moduleDebugStatsText}>
            {`bounds ${debugMetrics.boundsWidth.toFixed(1)} x ${debugMetrics.boundsHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 4.6} className={styles.moduleDebugStatsText}>
            {`fit ${debugMetrics.fitWidth.toFixed(1)} x ${debugMetrics.fitHeight.toFixed(1)}`}
          </text>
          <text x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 6.1} className={styles.moduleDebugStatsText}>
            {`util ${Math.round(debugMetrics.utilizationX * 100)}% x  ${Math.round(debugMetrics.utilizationY * 100)}% y`}
          </text>
          {debugMetrics.candidateLines.map((line, idx) => (
            <text key={`section-debug-scale-${line}`} x={outerFieldOutline.x + 1.2} y={outerFieldOutline.y + 7.6 + idx * 1.5} className={styles.moduleDebugStatsText}>
              {line}
            </text>
          ))}
        </g>
      ) : null}

      <rect x={Math.max(8, xLeft - 8)} y={yGround + 1.3} width={Math.min(104, xRight + 8) - Math.max(8, xLeft - 8)} height={8} className={styles.moduleSectionGroundFill} />
      <line x1={Math.max(8, xLeft - 8)} y1={yGround} x2={Math.min(112, xRight + 8)} y2={yGround} className={styles.moduleSectionGround} />

      <rect x={leftPostX} y={yHouseUnder} width={postW} height={yGround - yHouseUnder} className={styles.moduleSectionPostPrimary} />
      <rect x={secondPostX} y={supportPostTopY} width={postW} height={yGround - supportPostTopY} className={styles.moduleSectionPostPrimary} />
      <rect
        x={ledgerX}
        y={ledgerY}
        width={leftEaveWidth}
        height={leftEaveDepth}
        className={styles.moduleSectionPrimaryBeam}
      />
      {model.houseConnectionType === 'facade' ? (
        <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
      ) : null}
      {model.houseConnectionType === 'fascia' ? (
        <>
          <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
          <line x1={ledgerX - 1.1} y1={ledgerY - 0.9} x2={ledgerX + leftEaveWidth} y2={ledgerY - 0.9} className={styles.moduleSectionFasciaBand} />
        </>
      ) : null}
      {model.houseConnectionType === 'soffit' ? (
        <>
          <line x1={ledgerX - 0.25} y1={ledgerY - 1.25} x2={ledgerX + leftEaveWidth} y2={ledgerY - 1.25} className={styles.moduleSectionConnection} />
          <line x1={ledgerX + leftEaveWidth * 0.25} y1={ledgerY - 1.95} x2={ledgerX + leftEaveWidth * 0.25} y2={ledgerY - 0.15} className={styles.moduleSectionSoffitBracket} />
          <line x1={ledgerX + leftEaveWidth * 0.75} y1={ledgerY - 1.95} x2={ledgerX + leftEaveWidth * 0.75} y2={ledgerY - 0.15} className={styles.moduleSectionSoffitBracket} />
        </>
      ) : null}
      {model.sectionKind === 'mono' && overhangM > 0 ? (
        <rect x={xSupport - supportCapWidth / 2} y={supportCapTopY} width={supportCapWidth} height={supportCapDepth} className={styles.moduleSectionPrimaryBeam} />
      ) : model.sectionKind === 'gable' ? (
        <rect x={rightEaveX} y={rightEaveY} width={rightEaveBeamWidth} height={rightEaveBeamDepth} className={styles.moduleSectionPrimaryBeam} />
      ) : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
        <>
          <rect
            x={tieBeamLeftX}
            y={tieBeamTopY}
            width={Math.max(0.4, tieBeamRightX - tieBeamLeftX)}
            height={Math.max(0.2, tieBeamBottomY - tieBeamTopY)}
            className={styles.moduleSectionTieBeamPrimary}
          />
          <rect
            x={ridgeX - kingStrutWidth / 2}
            y={yRidgeUnder}
            width={kingStrutWidth}
            height={Math.max(0.2, kingStrutBottomY - yRidgeUnder)}
            className={styles.moduleSectionKingStrut}
          />
        </>
      ) : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? <line x1={ridgeX} y1={yGround} x2={ridgeX} y2={yRidgeUnder} className={styles.moduleSectionPostGhost} /> : null}

      {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
        <>
          {gableLeftRoofGeom ? <polygon points={toPointsAttr(gableLeftRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
          {gableRightRoofGeom ? <polygon points={toPointsAttr(gableRightRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
          {yRidgeBeamTop !== null ? (
            <rect
              x={ridgeX - ridgeBeamWidth / 2}
              y={yRidgeBeamTop ?? yRidgeUnder}
              width={ridgeBeamWidth}
              height={Math.max(0.2, yRidgeUnder - (yRidgeBeamTop ?? yRidgeUnder))}
              className={styles.moduleSectionRidgeBeam}
            />
          ) : null}
        </>
      ) : (
        <>
          {monoRoofGeom ? <polygon points={toPointsAttr(monoRoofGeom.points)} className={styles.moduleSectionRoofMember} /> : null}
        </>
      )}

      {monoSupportSplice ? (
        <line
          x1={xSupport}
          y1={monoSupportSplice.yTop}
          x2={xSupport}
          y2={monoSupportSplice.yUnder}
          className={styles.moduleSectionConnection}
        />
      ) : null}

      {model.sectionKind === 'mono' ? (
        <rect
          x={xRight - gutterWidth}
          y={gutterTopY}
          width={gutterWidth}
          height={Math.max(0.2, yOuterGutterUnder - gutterTopY)}
          className={styles.moduleSectionGutter}
        />
      ) : null}

      {roofTopLengthDims.map((roofDim, idx) => (
        <g key={`roof-top-len-${idx}`}>
          <line x1={roofDim.topStart.x} y1={roofDim.topStart.y} x2={roofDim.dimStart.x} y2={roofDim.dimStart.y} className={styles.moduleDimWitness} />
          <line x1={roofDim.topEnd.x} y1={roofDim.topEnd.y} x2={roofDim.dimEnd.x} y2={roofDim.dimEnd.y} className={styles.moduleDimWitness} />
          <TickDimension
            x1={roofDim.dimStart.x}
            y1={roofDim.dimStart.y}
            x2={roofDim.dimEnd.x}
            y2={roofDim.dimEnd.y}
            label={formatMetres(roofDim.lengthM)}
            textX={(() => {
              const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
              return (roofDim.dimStart.x + roofDim.dimEnd.x) / 2 - roofNormal.nx * (isSheet ? 1.4 : 1.1);
            })() - (segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y).nx * roofLengthLabelGap)}
            textY={(() => {
              const roofNormal = segmentDownNormal(roofDim.topStart.x, roofDim.topStart.y, roofDim.topEnd.x, roofDim.topEnd.y);
              return (roofDim.dimStart.y + roofDim.dimEnd.y) / 2 - roofNormal.ny * (isSheet ? 1.4 : 1.1);
            })()}
            presentation={presentation}
          />
        </g>
      ))}

      {model.boxPerimeterEnabled ? (
        <>
          {model.sectionKind === 'gable' && yRidgeUnder !== null ? (
            <>
              <line x1={gableLeftRafterStartX + 1.6} y1={yHouseRafterUnder + 1.4} x2={ridgeX} y2={yRidgeUnder + 1.4} className={styles.moduleSectionBoxRoof} />
              <line
                x1={ridgeX}
                y1={yRidgeUnder + 1.4}
                x2={gableRightRafterEndX - 1.6}
                y2={yRightEaveRafterUnder + 1.4}
                className={styles.moduleSectionBoxRoof}
              />
            </>
          ) : (
            <line x1={monoRafterStartX + 1.6} y1={yHouseRafterUnder + 1.4} x2={monoRafterEndX - 1.6} y2={yOuterRafterUnder + 1.4} className={styles.moduleSectionBoxRoof} />
          )}
          <text x={(xLeft + xRight) / 2} y={Math.min(yGround - 2.5, Math.max(yHouseUnder, ySupportUnder) + 8)} textAnchor="middle" className={styles.moduleSectionAngleLabel}>
            {`Internal roof angle ${model.pitchDeg.toFixed(1)} deg`}
          </text>
        </>
      ) : null}

      {model.sectionKind === 'mono' ? (
        <TickDimension
          x1={depthDimTop.x}
          y1={depthDimTop.y}
          x2={depthDimBottom.x}
          y2={depthDimBottom.y}
          label={`${Math.round(model.rafterDepthM * 1000)}mm`}
          textX={isSheet ? depthDimTop.x - 1.3 : undefined}
          textY={depthDimTop.y - (isSheet ? 2.5 : 1.6)}
          overrun={1.1}
          presentation={presentation}
        />
      ) : null}

      <line x1={leftDimX - 2.4} y1={yHouseUnder} x2={xLeft + 2.4} y2={yHouseUnder} className={styles.moduleDimGuide} />
      <line x1={xRight - 2.4} y1={yOuterGutterUnder} x2={rightDimX + 2.4} y2={yOuterGutterUnder} className={styles.moduleDimGuide} />

      {overhangM > 0 ? (
        <>
          <line x1={xSupport} y1={spanAnchorSupportY} x2={xSupport} y2={overhangDimY} className={styles.moduleDimWitness} />
          <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={overhangDimY} className={styles.moduleDimWitness} />
          <TickDimension x1={xSupport} y1={overhangDimY} x2={xRight} y2={overhangDimY} label={`OH ${formatMetres(overhangM)}`} presentation={presentation} />
        </>
      ) : null}

      <line x1={xLeft} y1={spanAnchorLeftY} x2={xLeft} y2={spanDimY} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={spanAnchorRightY} x2={xRight} y2={spanDimY} className={styles.moduleDimWitness} />
      <TickDimension
        x1={xLeft}
        y1={spanDimY}
        x2={xRight}
        y2={spanDimY}
        label={formatMetres(model.spanA)}
        textY={spanDimY - (isSheet ? 1.8 : 1.4)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:spanA']}
      />

      <line x1={xLeft} y1={yGround} x2={leftDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xLeft} y1={yHouseUnder} x2={leftDimX} y2={yHouseUnder} className={styles.moduleDimWitness} />
      <TickDimension
        x1={leftDimX}
        y1={yGround}
        x2={leftDimX}
        y2={yHouseUnder}
        label={formatMetres(model.leftEdgeHeightM)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:heightLeft']}
      />

      <line x1={xRight} y1={yGround} x2={rightDimX} y2={yGround} className={styles.moduleDimWitness} />
      <line x1={xRight} y1={yOuterGutterUnder} x2={rightDimX} y2={yOuterGutterUnder} className={styles.moduleDimWitness} />
      <TickDimension
        x1={rightDimX}
        y1={yGround}
        x2={rightDimX}
        y2={yOuterGutterUnder}
        label={formatMetres(outerGutterUndersideM)}
        presentation={presentation}
        interactiveField={interactiveFields?.['section:heightRight']}
      />

      <text
        x={(xLeft + xRight) / 2}
        y={pitchLabelY}
        textAnchor="middle"
        className={pitchInteractiveField ? `${styles.moduleSectionPitchLabel} ${styles.moduleDimTextEditable}` : styles.moduleSectionPitchLabel}
        data-editable-field-id={pitchInteractiveField?.fieldId}
        tabIndex={pitchInteractiveField ? 0 : undefined}
        onClick={pitchInteractiveField ? (event) => pitchInteractiveField.onActivate(pitchInteractiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          pitchInteractiveField
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                pitchInteractiveField.onActivate(pitchInteractiveField.fieldId, event.currentTarget as SVGTextElement);
              }
            : undefined
        }
      >
        {`Pitch ${model.pitchDeg.toFixed(1)} deg`}
      </text>

      {model.roofType === 'hip_corner' ? (
        <text x={(xLeft + xRight) / 2} y={metaLabelY} textAnchor="middle" className={styles.moduleSectionMetaLabel}>
          Primary wing section (A)
        </text>
      ) : null}
    </svg>
  );
}
