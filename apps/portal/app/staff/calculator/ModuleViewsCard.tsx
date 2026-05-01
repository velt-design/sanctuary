import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AttachmentSide } from '@sp/costing';
import type {
  GeometryPlanMember2D,
  GeometryPlanSurface2D,
  GeometryTopProjectionShape,
  GeometryTopProjectionViewModel,
  GeometryPlanViewModel,
  Line2,
  Point2,
  Vector2,
} from '@sp/geometry';
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
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import {
  getDrawingSheetViewportMm,
  getViewBoxUnitsPerMetreAtScale,
  getViewBoxUnitsPerMm,
  type DrawingSheetFitResult,
} from '@/lib/estimates/drawingSheetLayout';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanOpeningInteraction,
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { ObjectInteractionPreviewOverlay } from '@/lib/drawings/interactions/objectInteractionEngine';
import type {
  ObjectWorkbenchPergolaRenderSource,
  ObjectWorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';

export type ModuleViewsTab = 'plan' | 'section';
export type ModuleViewsStatus = 'loading' | 'ready' | 'error' | 'empty';
type ModuleDrawingPresentation = 'card' | 'minimal' | 'sheet' | 'model';
export type ModuleDrawingDisplayMode = 'house' | 'pergolas';
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

export type HouseFootprintVertexDragMeta = {
  vertexIndex: number;
  alongAxisX: number;
  alongAxisY: number;
  depthAxisX: number;
  depthAxisY: number;
  scale: number;
};

export type ModuleFootprintEditorSurface = 'card' | 'sheet' | 'model';

export type ModuleFootprintCanvasPoint = {
  alongM: string;
  depthM: string;
  numericAlongM: number;
  numericDepthM: number;
};

export type ModulePlanSheetInteractionProps = {
  isPergolaPopoverOpen?: boolean;
  onPergolaHoverChange?: (hovered: boolean) => void;
  onPergolaPopoverHoverChange?: (hovered: boolean) => void;
};

export type ModulePlanResizeFieldId = 'plan:lengthA' | 'plan:spanA';

export type ModulePlanResizeDragMeta = {
  fieldId: ModulePlanResizeFieldId;
  axisX: number;
  axisY: number;
  scale: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

export type ModulePlanInteractionProps = {
  available: boolean;
  hoveredResizeFieldId: ModulePlanResizeFieldId | null;
  activeResizeFieldId: ModulePlanResizeFieldId | null;
  onResizeFieldHover: (fieldId: ModulePlanResizeFieldId | null) => void;
  onResizeFieldDragStart: (
    meta: ModulePlanResizeDragMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onPlanPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onDeckDragPointResolverChange?: ((resolver: ((clientX: number, clientY: number) => PlanPoint | null) | null) => void) | undefined;
  onSvgMount?: (node: SVGSVGElement | null) => void;
};

export type ObjectWorkbenchPlanShapeDragStartMeta =
  | {
      ownerKind: 'deck';
      ownerId: string;
      overlayShape: ObjectWorkbenchPlanOverlay['shapes'][number];
      deckInteraction: ObjectWorkbenchPlanDeckInteraction & {
        hostEdgeStart: Point;
        hostEdgeEnd: Point;
      };
    }
  | {
      ownerKind: 'opening';
      ownerId: string;
      openingInteraction: ObjectWorkbenchPlanOpeningInteraction & {
        hostEdgeStart: Point;
        hostEdgeEnd: Point;
      };
    };

export type ObjectWorkbenchPreviewOverlay = ObjectInteractionPreviewOverlay<PlanPoint>;
export type HouseFirstPlanShapeDragStartMeta = ObjectWorkbenchPlanShapeDragStartMeta;
export type HouseFirstObjectPreviewOverlay = ObjectWorkbenchPreviewOverlay;

export type ModuleFootprintCanvasPointResolver = (clientX: number, clientY: number) => ModuleFootprintCanvasPoint | null;

type GeometryConsistency = {
  level: 'ok' | 'warn';
  summary: string;
  details: string[];
};

export type ModuleFootprintEditorProps = {
  available: boolean;
  isEditing: boolean;
  surface?: ModuleFootprintEditorSurface;
  allowAttachmentSideCanvasSelect?: boolean;
  attachmentSideCanvasActiveSide?: AttachmentSide | null;
  allowResizeEdgeDrag?: boolean;
  customPolygonOverride?: ModulePlanModel['houseFootprintPolygon'] | null;
  customPolygonOpen?: boolean;
  customPolygonConfirmedPointCount?: number;
  customPolygonPreviewPointKind?: 'pending' | 'hover' | 'locked-distance' | null;
  customPolygonCloseReady?: boolean;
  customPolygonCloseHovered?: boolean;
  customPolygonLandingPoint?: ModuleFootprintCanvasPoint | null;
  customPolygonLockedDistanceM?: number | null;
  customPolygonHasError?: boolean;
  hideHouseFootprint?: boolean;
  isContextHovered?: boolean;
  onContextPopoverHoverChange?: (hovered: boolean) => void;
  hoveredAttachmentSide: AttachmentSide | null;
  hoveredHandleId: HouseFootprintHandleId | null;
  activeHandleId: HouseFootprintHandleId | null;
  onStartEditing: () => void;
  onDoneEditing: () => void;
  onContextHoverChange?: (hovered: boolean) => void;
  onAttachmentSideHover: (side: AttachmentSide | null) => void;
  onAttachmentSideSelect: (side: AttachmentSide) => void;
  onHandleHover: (handleId: HouseFootprintHandleId | null) => void;
  onHandleDragStart: (meta: HouseFootprintEditorDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => void;
  onVertexDragStart?: (meta: HouseFootprintVertexDragMeta, event: { pointerId: number; clientX: number; clientY: number }) => void;
  onVertexDelete?: (vertexIndex: number) => void;
  onEdgeAdd?: (edgeIndex: number) => void;
  onPresetSelect: (preset: ModulePlanModel['houseFootprintPreset']) => void;
  onModeSelect?: (mode: NonNullable<Required<ModulePlanModel>['houseFootprintMode']>) => void;
  onRotate: (delta: -1 | 1) => void;
  onCanvasPointSelect?: (point: ModuleFootprintCanvasPoint) => void;
  onCanvasPointPointerDown?: (
    point: ModuleFootprintCanvasPoint,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onCanvasPointHover?: (point: ModuleFootprintCanvasPoint | null) => void;
  onCanvasPointResolverChange?: (resolver: ModuleFootprintCanvasPointResolver | null) => void;
  onCloseStartSelect?: () => void;
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
  displayMode?: ModuleDrawingDisplayMode;
  visibility?: DrawingWorkbenchVisibilityState;
  footprintEditor?: ModuleFootprintEditorProps;
  planInteraction?: ModulePlanInteractionProps;
  sheetPlanInteraction?: ModulePlanSheetInteractionProps;
  objectWorkbenchPlanOverlay?: ObjectWorkbenchPlanOverlay | null;
  activeObjectWorkbenchCustomEdgeId?: string | null;
  onObjectWorkbenchShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  hoveredObjectWorkbenchDeckId?: string | null;
  onObjectWorkbenchDeckHoverChange?: (deckId: string | null) => void;
  currentPergolaId?: string | null;
  onPergolaSelect?: (pergolaId: string) => void;
  onCanvasSelect?: () => void;
  onObjectWorkbenchShapeDragStart?: (
    meta: ObjectWorkbenchPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onObjectWorkbenchCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onObjectWorkbenchDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
  objectWorkbenchPreviewOverlay?: ObjectWorkbenchPreviewOverlay | null;
  modelSpacePergolaGeometry?: GeometryPlanViewModel | null;
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  modelSpacePergolaRenderSource?: ObjectWorkbenchPergolaRenderSource;
  modelSpacePergolaRenderStatus?: ObjectWorkbenchPergolaRenderStatus;
};

type ModuleDrawingInteractiveField = {
  fieldId: string;
  onActivate?: (fieldId: string, target: SVGTextElement) => void;
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

export const HOUSE_FOOTPRINT_PRESET_OPTIONS: Array<{ id: ModulePlanModel['houseFootprintPreset']; label: string }> = [
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
  displayMode = 'pergolas',
  visibility,
  footprintEditor,
  planInteraction,
  sheetPlanInteraction,
  objectWorkbenchPlanOverlay,
  hoveredObjectWorkbenchDeckId,
  onObjectWorkbenchDeckHoverChange,
  activeObjectWorkbenchCustomEdgeId,
  onObjectWorkbenchShapeSelect,
  currentPergolaId,
  onPergolaSelect,
  onCanvasSelect,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  objectWorkbenchPreviewOverlay,
  modelSpacePergolaGeometry,
  modelSpaceTopProjection,
  modelSpacePergolaRenderSource,
  modelSpacePergolaRenderStatus,
}: ModuleDrawingRendererProps) {
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isCompact = presentation !== 'card';
  const isModel = presentation === 'model';
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
  const footprintEditorSurface = footprintEditor?.surface ?? 'card';
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
      } ${isModel ? styles.moduleViewsStageModel : ''}`}
      aria-live="polite"
    >
      {showPlan && planModel ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''} ${isModel ? styles.modulePlanFrameModel : ''}`}>
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
          <div className={`${styles.modulePlanCanvas} ${isModel ? styles.modulePlanCanvasModel : ''}`}>
            {presentation === 'card' && footprintEditorSurface === 'card' && footprintEditor?.available && footprintEditor.isEditing ? (
              <div className={styles.moduleFootprintToolbar} aria-label="House footprint editor">
                <div className={styles.moduleFootprintToolbarGroup}>
                  <label className={styles.moduleFootprintToolbarField}>
                    <span className={styles.moduleFootprintToolbarFieldLabel}>Mode</span>
                    <select
                      aria-label="House footprint mode"
                      className={styles.moduleFootprintToolbarSelect}
                      value={planModel.houseFootprintMode ?? 'preset'}
                      onChange={(event) => footprintEditor.onModeSelect?.(event.target.value as NonNullable<Required<ModulePlanModel>['houseFootprintMode']>)}
                    >
                      <option value="preset">Preset</option>
                      <option value="custom_polygon">Draw outline</option>
                    </select>
                  </label>
                  <label className={styles.moduleFootprintToolbarField}>
                    <span className={styles.moduleFootprintToolbarFieldLabel}>Preset</span>
                    <select
                      aria-label="House footprint preset"
                      className={styles.moduleFootprintToolbarSelect}
                      value={planModel.houseFootprintPreset}
                      disabled={(planModel.houseFootprintMode ?? 'preset') === 'custom_polygon'}
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
              displayMode={displayMode}
              visibility={visibility}
              footprintEditor={footprintEditor}
              planInteraction={planInteraction}
              sheetPlanInteraction={sheetPlanInteraction}
              objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
              hoveredObjectWorkbenchDeckId={hoveredObjectWorkbenchDeckId}
              onObjectWorkbenchDeckHoverChange={onObjectWorkbenchDeckHoverChange}
              activeObjectWorkbenchCustomEdgeId={activeObjectWorkbenchCustomEdgeId}
              onObjectWorkbenchShapeSelect={onObjectWorkbenchShapeSelect}
              currentPergolaId={currentPergolaId}
              onPergolaSelect={onPergolaSelect}
              onCanvasSelect={onCanvasSelect}
              onObjectWorkbenchShapeDragStart={onObjectWorkbenchShapeDragStart}
              onObjectWorkbenchCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
              onObjectWorkbenchDimensionActivate={onObjectWorkbenchDimensionActivate}
              objectWorkbenchPreviewOverlay={objectWorkbenchPreviewOverlay}
              modelSpacePergolaGeometry={modelSpacePergolaGeometry}
              modelSpaceTopProjection={modelSpaceTopProjection}
              modelSpacePergolaRenderSource={modelSpacePergolaRenderSource}
              modelSpacePergolaRenderStatus={modelSpacePergolaRenderStatus}
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
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''} ${isModel ? styles.modulePlanFrameModel : ''}`}>
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
  lineClassName?: string;
  tickClassName?: string;
  textClassName?: string;
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

const MODEL_SPACE_UNITS_PER_METRE = 12;
const MODEL_SPACE_CSS_PX_PER_UNIT = 8;
const MODEL_SPACE_VIEWBOX_PADDING = 6;

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

type ResolvedModelSpaceLayout = ResolvedSheetLayout & {
  viewBox: SheetRect;
  viewBoxValue: string;
  worldBounds: AnnotatedBounds;
  worldBox: SheetRect;
  worldBoxValue: string;
  focusBounds: AnnotatedBounds;
  focusBox: SheetRect;
  focusBoxValue: string;
  svgWidthPx: number;
  svgHeightPx: number;
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

function polygonAreaAbs(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
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

function boundsToPaddedRect(bounds: AnnotatedBounds, padding: number): SheetRect {
  const width = Math.max(1, getBoundsWidth(bounds) + padding * 2);
  const height = Math.max(1, getBoundsHeight(bounds) + padding * 2);
  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width,
    height,
  };
}

function formatViewBoxNumber(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(3).replace(/\.?0+$/, '');
}

function rectToViewBox(rect: SheetRect): string {
  return [rect.x, rect.y, rect.width, rect.height].map(formatViewBoxNumber).join(' ');
}

function resolveModelSpaceSvgMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'viewBox' | 'viewBoxValue' | 'svgWidthPx' | 'svgHeightPx'> {
  const viewBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    viewBox,
    viewBoxValue: rectToViewBox(viewBox),
    svgWidthPx: Math.round(viewBox.width * MODEL_SPACE_CSS_PX_PER_UNIT),
    svgHeightPx: Math.round(viewBox.height * MODEL_SPACE_CSS_PX_PER_UNIT),
  };
}

function resolveModelSpaceFocusMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'focusBounds' | 'focusBox' | 'focusBoxValue'> {
  const focusBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    focusBounds: bounds,
    focusBox,
    focusBoxValue: rectToViewBox(focusBox),
  };
}

function resolveModelSpaceWorldMetrics(bounds: AnnotatedBounds): Pick<ResolvedModelSpaceLayout, 'worldBounds' | 'worldBox' | 'worldBoxValue'> {
  const worldBox = boundsToPaddedRect(bounds, MODEL_SPACE_VIEWBOX_PADDING);
  return {
    worldBounds: bounds,
    worldBox,
    worldBoxValue: rectToViewBox(worldBox),
  };
}

function FocusTarget({ rect }: { rect: SheetRect }) {
  return (
    <rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill="transparent"
      opacity={0}
      pointerEvents="none"
      aria-hidden="true"
      data-model-space-focus-target="true"
    />
  );
}

function topProjectionExtentsToModelSpaceBounds(
  topProjection: GeometryTopProjectionViewModel | null | undefined,
  scale: number,
): AnnotatedBounds | null {
  const extents = topProjection?.extents;
  if (!extents || extents.widthMm <= 0 || extents.heightMm <= 0) return null;
  return createBounds(
    (extents.minX / 1000) * scale,
    (extents.minY / 1000) * scale,
    (extents.maxX / 1000) * scale,
    (extents.maxY / 1000) * scale,
  );
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
    verticalBias: 0.5,
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

  if (presentation === 'model') {
    const maxW = 92;
    const maxH = 64;
    const scale = Math.min(maxW / safeW, maxH / safeH);
    const widthPx = safeW * scale;
    const heightPx = safeH * scale;
    return {
      x: 14 + (maxW - widthPx) / 2,
      y: 11 + (maxH - heightPx) / 2,
      scale,
      houseBandHeight: 10,
      houseBandOffset: 2.1,
      houseInset: 2.4,
      fallGap: 7,
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
    verticalBias: 0.5,
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

  if (presentation === 'model') {
    return {
      outerField: { x: 8, y: 8, width: 104, height: 74 },
      fitArea: { x: 12, y: 10, width: 96, height: 68 },
      verticalBias: 0.5,
      annotationPadLeft: 0,
      annotationPadRight: 0,
      annotationPadTop: 0,
      annotationPadBottom: 0,
    };
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
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const xValues = [0, model.roofType === 'hip_corner' ? Math.max(model.lengthA, model.lengthB ?? 0) : model.lengthA, ...housePoints.map((point) => point.x)];
  const yValues = [0, model.roofType === 'hip_corner' ? model.spanA + (model.spanB ?? 0) : model.spanA, ...housePoints.map((point) => point.y)];
  const widthM = Math.max(...xValues) - Math.min(...xValues);
  const heightM = Math.max(...yValues) - Math.min(...yValues);
  if (model.roofType === 'hip_corner' || model.drawingRotationQuarterTurns % 2 === 0) {
    return { widthM, heightM };
  }
  return { widthM: heightM, heightM: widthM };
}

function getSectionRealExtents(model: ModuleSectionModel): { widthM: number; heightM: number } {
  const housePoints = [
    ...(model.houseContext?.surfaces ?? []).flatMap((surface) => surface.boundary),
    ...(model.houseContext?.lines ?? []).flatMap((line) => [line.line.start, line.line.end]),
  ];
  const houseProjectionValues = housePoints.map((point) => point.x);
  const houseHeightValues = housePoints.map((point) => point.y);
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
    ...houseHeightValues,
  );

  return {
    widthM: Math.max(model.spanA, 0.001, Math.max(model.spanA, ...houseProjectionValues) - Math.min(0, ...houseProjectionValues)),
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

function mmPointToPlanSvg(point: Point2, baseX: number, baseY: number, scale: number): Point {
  return {
    x: baseX + (point.x / 1000) * scale,
    y: baseY + (point.y / 1000) * scale,
  };
}

function mmPolygonToPlanSvg(points: Point2[], baseX: number, baseY: number, scale: number): Point[] {
  return points.map((point) => mmPointToPlanSvg(point, baseX, baseY, scale));
}

function topProjectionPointToPlanSvg(
  point: Point2,
  projection: GeometryTopProjectionViewModel,
  baseX: number,
  baseY: number,
  scale: number,
): Point {
  const xMm =
    projection.screenAxis.x === 'world_x_left' && projection.extents
      ? projection.extents.minX + projection.extents.maxX - point.x
      : point.x;
  return mmPointToPlanSvg({ x: xMm, y: point.y }, baseX, baseY, scale);
}

function topProjectionPolygonToPlanSvg(
  points: Point2[],
  projection: GeometryTopProjectionViewModel,
  baseX: number,
  baseY: number,
  scale: number,
): Point[] {
  return points.map((point) => topProjectionPointToPlanSvg(point, projection, baseX, baseY, scale));
}

function topProjectionDirectionToPlanSvg(
  direction: Point2,
  projection: GeometryTopProjectionViewModel | null | undefined,
): Point2 {
  return projection?.screenAxis.x === 'world_x_left'
    ? { x: -direction.x, y: direction.y }
    : direction;
}

function buildPlanMemberFootprint(input: {
  member: GeometryPlanMember2D;
  baseX: number;
  baseY: number;
  scale: number;
}): Point[] {
  const start = mmPointToPlanSvg(input.member.centerline.start, input.baseX, input.baseY, input.scale);
  const end = mmPointToPlanSvg(input.member.centerline.end, input.baseX, input.baseY, input.scale);
  const halfWidth = Math.max(0.15, (input.member.profile.widthMm / 1000) * input.scale / 2);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length <= 0.001) {
    const center = start;
    return [
      { x: center.x - halfWidth, y: center.y - halfWidth },
      { x: center.x + halfWidth, y: center.y - halfWidth },
      { x: center.x + halfWidth, y: center.y + halfWidth },
      { x: center.x - halfWidth, y: center.y + halfWidth },
    ];
  }

  const nx = -dy / length;
  const ny = dx / length;
  return [
    { x: start.x + nx * halfWidth, y: start.y + ny * halfWidth },
    { x: end.x + nx * halfWidth, y: end.y + ny * halfWidth },
    { x: end.x - nx * halfWidth, y: end.y - ny * halfWidth },
    { x: start.x - nx * halfWidth, y: start.y - ny * halfWidth },
  ];
}

function geometryFallDirectionToCardinal(direction: Vector2): CardinalDirection {
  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return direction.x >= 0 ? 'right' : 'left';
  }
  return direction.y >= 0 ? 'down' : 'up';
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

function planHousePointToSvg(
  point: Point,
  baseX: number,
  baseY: number,
  scale: number,
): Point {
  return {
    x: baseX + point.x * scale,
    y: baseY + point.y * scale,
  };
}

function planRotationTurnsForPresentation(input: {
  roofType: ModulePlanModel['roofType'];
  drawingRotationQuarterTurns: ModulePlanModel['drawingRotationQuarterTurns'];
  presentation: ModuleDrawingPresentation;
}): number {
  if (input.roofType === 'hip_corner') return 0;
  if (input.presentation === 'model') return 0;
  return input.drawingRotationQuarterTurns;
}

function sectionHousePointToSvg(point: Point, xLeft: number, yGround: number, scale: number): Point {
  return {
    x: xLeft + point.x * scale,
    y: yGround - point.y * scale,
  };
}

function planHouseSurfaceClass(kind: NonNullable<ModulePlanModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
}

function planHouseLineClass(kind: NonNullable<ModulePlanModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseAttachmentTarget}`;
  return `${styles.modulePlanHouseLine} ${styles.modulePlanHouseWallSemantic}`;
}

function topProjectionShapeVisible(
  shape: GeometryTopProjectionShape,
  visibility: DrawingWorkbenchVisibilityState,
): boolean {
  const role = topProjectionRole(shape);
  if (role === 'hidden_from_top') return false;
  if (shape.family === 'pergola') return visibility.pergolas;
  if (shape.family !== 'house') return true;
  if (shape.kind === 'deck') return visibility.decks;
  if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') return visibility.openings;
  return visibility.house;
}

function topProjectionRole(shape: GeometryTopProjectionShape): 'top_visible' | 'context' | 'hidden_from_top' {
  const role = shape.metadata?.topProjectionRole;
  return role === 'context' || role === 'hidden_from_top' || role === 'top_visible'
    ? role
    : 'top_visible';
}

function topProjectionShapeClass(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house') {
    if (shape.kind === 'deck') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseDeck}`;
    if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseOpening}`;
    }
    if (shape.kind === 'roof' || shape.kind === 'house_roof_material') return planHouseSurfaceClass('roof');
    if (shape.kind === 'soffit') return planHouseSurfaceClass('soffit');
    if (shape.kind === 'fascia') return planHouseSurfaceClass('fascia');
    if (shape.kind === 'attachment_zone') return planHouseSurfaceClass('attachment_zone');
    if (shape.kind === 'gutter' || shape.kind === 'roof_feature') {
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanTopProjectionLine}`;
    }
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint} ${styles.modulePlanTopProjectionReference}`;
  }
  if (shape.family === 'reference') return styles.modulePlanTopProjectionReference;
  if (shape.kind === 'roof_cladding') return styles.modulePlanBoxInset;
  if (shape.kind === 'rafter') return styles.modulePlanRafter;
  if (shape.kind === 'ridge') return styles.modulePlanRidgeBand;
  if (shape.kind === 'post' || shape.kind === 'beam' || shape.kind === 'ledger' || shape.kind === 'gutter' || shape.kind === 'joiner') {
    return styles.modulePlanPrimaryZone;
  }
  return styles.modulePlanPrimaryZone;
}

function sectionHouseSurfaceClass(kind: NonNullable<ModuleSectionModel['houseContext']>['surfaces'][number]['kind']): string {
  if (kind === 'roof') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseRoof}`;
  if (kind === 'soffit') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseSoffit}`;
  if (kind === 'fascia') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseAttachmentZone}`;
  return `${styles.moduleSectionHouseSurface} ${styles.moduleSectionHouseWallSemantic}`;
}

function sectionHouseLineClass(kind: NonNullable<ModuleSectionModel['houseContext']>['lines'][number]['kind']): string {
  if (kind === 'gutter') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseGutter}`;
  if (kind === 'roof_feature') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseRoofFeature}`;
  if (kind === 'attachment_target') return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseAttachmentTarget}`;
  return `${styles.moduleSectionHouseLine} ${styles.moduleSectionHouseReference}`;
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

type CardinalDirection = 'up' | 'down' | 'left' | 'right';

type PlanFallAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  label: string;
  labelPoint: Point;
  arrowHeads: Array<{ point: Point; direction: CardinalDirection }>;
};

type PlanSpacingAnnotationSpec = {
  witness1Start: Point;
  witness1End: Point;
  witness2Start: Point;
  witness2End: Point;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};

type PlanLineTextAnnotationSpec = {
  lineStart: Point;
  lineEnd: Point;
  text: string;
  textPoint: Point;
  anchor?: 'start' | 'middle' | 'end';
};

function cardinalDirectionToVector(direction: CardinalDirection): Point {
  switch (direction) {
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
    default:
      return { x: 1, y: 0 };
  }
}

function vectorToCardinalDirection(vector: Point): CardinalDirection {
  if (Math.abs(vector.x) >= Math.abs(vector.y)) {
    return vector.x >= 0 ? 'right' : 'left';
  }
  return vector.y >= 0 ? 'down' : 'up';
}

function rotateCardinalDirectionQuarterTurns(direction: CardinalDirection, turns: number): CardinalDirection {
  return vectorToCardinalDirection(rotateVectorQuarterTurns(cardinalDirectionToVector(direction), turns));
}

function buildPlanFallAnnotationSpec(input: {
  model: ModulePlanModel;
  attachmentSide: AttachmentSide;
  isHipCorner: boolean;
  isGableLike: boolean;
  baseX: number;
  baseY: number;
  aW: number;
  aH: number;
  bW: number;
  bH: number;
  bottomY: number;
  fallGap: number;
  rotationCenter: Point;
  rotationTurns: number;
  isSheet: boolean;
}): PlanFallAnnotationSpec {
  const { attachmentSide } = input;
  const fallIsHorizontal = attachmentSide === 'left' || attachmentSide === 'right';
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: input.baseX + Math.max(input.aW, input.bW) + input.fallGap - 0.55,
          y: input.baseY,
          width: 0,
          height: input.isHipCorner ? input.aH + input.bH : input.aH,
        })
      : attachmentFrameForRect('front', {
          x: input.baseX,
          y: input.bottomY + input.fallGap - 0.55,
          width: input.aW,
          height: 0,
        });
  const fallStart = pointOnAttachmentFrame(fallAnchor, input.isSheet ? 1.5 : 1, 0);
  const fallEnd = pointOnAttachmentFrame(
    fallAnchor,
    Math.max(input.isSheet ? 1.5 : 1, fallAnchor.length - (input.isSheet ? 1.5 : 1)),
    0,
  );
  const fallLabelPoint = pointOnAttachmentFrame(
    fallAnchor,
    fallAnchor.length / 2,
    fallIsHorizontal ? (input.isSheet ? 0.8 : 2.2) : input.isSheet ? 0.62 : 2.3,
  );
  const localArrowHeads: Array<{ point: Point; direction: CardinalDirection }> = input.isGableLike
    ? [
        {
          point: fallStart,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
        },
        {
          point: fallEnd,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
        },
      ]
    : [
        {
          point: input.model.slopeDirection === 'toward_house' ? fallStart : fallEnd,
          direction: fallIsHorizontal
            ? attachmentSide === 'left'
              ? 'left'
              : 'right'
            : input.model.slopeDirection === 'toward_house'
              ? 'up'
              : 'down',
        },
      ];

  return {
    lineStart: rotatePointQuarterTurns(fallStart, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(fallEnd, input.rotationCenter, input.rotationTurns),
    label: input.isGableLike ? 'fall both sides' : 'fall',
    labelPoint: rotatePointQuarterTurns(fallLabelPoint, input.rotationCenter, input.rotationTurns),
    arrowHeads: localArrowHeads.map((arrowHead) => ({
      point: rotatePointQuarterTurns(arrowHead.point, input.rotationCenter, input.rotationTurns),
      direction: rotateCardinalDirectionQuarterTurns(arrowHead.direction, input.rotationTurns),
    })),
  };
}

function estimatePlanFallAnnotationBounds(spec: PlanFallAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.25),
    ...spec.arrowHeads.map((arrowHead) =>
      estimateArrowHeadBounds({
        x: arrowHead.point.x,
        y: arrowHead.point.y,
        direction: arrowHead.direction,
        presentation,
      }),
    ),
    estimateTextBounds({
      text: spec.label,
      x: spec.labelPoint.x,
      y: spec.labelPoint.y,
      anchor: 'middle',
      fontHeight: presentation === 'sheet' ? 1.8 : 2.1,
      charWidth: presentation === 'sheet' ? 0.58 : 0.64,
      paddingX: 0.2,
      paddingY: 0.18,
    }),
  ]);
}

function buildPlanRafterSpacingAnnotationSpec(input: {
  rafterXsA: number[];
  interiorRafterXsA: number[];
  splitY: number;
  gutterW: number;
  yBottomInner: number;
  rafterDimY: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
  label: string;
}): PlanSpacingAnnotationSpec | null {
  if (input.rafterXsA.length < 2) return null;

  const spacingXs = input.interiorRafterXsA.length >= 2 ? input.interiorRafterXsA : input.rafterXsA;
  const baseIdx = Math.max(0, Math.floor((spacingXs.length - 2) / 2));
  const d1 = spacingXs[baseIdx]!;
  const d2 = spacingXs[baseIdx + 1]!;
  const witnessStartY = input.isHipCorner ? input.splitY - input.gutterW : input.yBottomInner;
  const witness1Start = rotatePointQuarterTurns({ x: d1, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness1End = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const witness2Start = rotatePointQuarterTurns({ x: d2, y: witnessStartY }, input.rotationCenter, input.rotationTurns);
  const witness2End = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionStart = rotatePointQuarterTurns({ x: d1, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);
  const dimensionEnd = rotatePointQuarterTurns({ x: d2, y: input.rafterDimY }, input.rotationCenter, input.rotationTurns);

  return {
    witness1Start,
    witness1End,
    witness2Start,
    witness2End,
    x1: dimensionStart.x,
    y1: dimensionStart.y,
    x2: dimensionEnd.x,
    y2: dimensionEnd.y,
    label: input.label,
  };
}

function estimatePlanSpacingAnnotationBounds(spec: PlanSpacingAnnotationSpec, presentation: ModuleDrawingPresentation): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.witness1Start.x, spec.witness1Start.y, spec.witness1End.x, spec.witness1End.y, 0.2),
    boundsFromLine(spec.witness2Start.x, spec.witness2Start.y, spec.witness2End.x, spec.witness2End.y, 0.2),
    estimateTickDimensionBounds({
      x1: spec.x1,
      y1: spec.y1,
      x2: spec.x2,
      y2: spec.y2,
      label: spec.label,
      presentation,
    }),
  ]);
}

function buildPlanInternalAngleAnnotationSpec(input: {
  centerX: number;
  centerY: number;
  baseY: number;
  bottomY: number;
  aH: number;
  isHipCorner: boolean;
  rotationCenter: Point;
  rotationTurns: number;
}): PlanLineTextAnnotationSpec {
  return {
    lineStart: rotatePointQuarterTurns({ x: input.centerX, y: input.baseY + 2.8 }, input.rotationCenter, input.rotationTurns),
    lineEnd: rotatePointQuarterTurns(
      { x: input.centerX, y: (input.isHipCorner ? input.bottomY : input.baseY + input.aH) - 2.8 },
      input.rotationCenter,
      input.rotationTurns,
    ),
    text: 'internal roof angle',
    textPoint: rotatePointQuarterTurns({ x: input.centerX + 2.5, y: input.centerY + 0.5 }, input.rotationCenter, input.rotationTurns),
    anchor: 'start',
  };
}

function estimatePlanLineTextAnnotationBounds(spec: PlanLineTextAnnotationSpec): AnnotatedBounds {
  return unionBounds([
    boundsFromLine(spec.lineStart.x, spec.lineStart.y, spec.lineEnd.x, spec.lineEnd.y, 0.2),
    estimateTextBounds({
      text: spec.text,
      x: spec.textPoint.x,
      y: spec.textPoint.y,
      anchor: spec.anchor ?? 'middle',
      fontHeight: 1.55,
      charWidth: 0.54,
      paddingX: 0.15,
      paddingY: 0.15,
    }),
  ]);
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

type FootprintResizeEdgeSpec = {
  id: HouseFootprintHandleId;
  label: string;
  valueM: number;
  start: Point;
  end: Point;
  pointRoot: Point;
  axisX: number;
  axisY: number;
  deltaMultiplier: number;
  minValueM: number;
  maxValueM: number;
};

type FootprintCustomVertexSpec = {
  index: number;
  kind: 'confirmed' | 'pending' | 'hover' | 'locked-distance';
  isLatestConfirmed: boolean;
  isCloseReady: boolean;
  isCloseHovered: boolean;
  point: Point;
  pointRoot: Point;
  alongAxisX: number;
  alongAxisY: number;
  depthAxisX: number;
  depthAxisY: number;
};

type FootprintCustomEdgeSpec = {
  index: number;
  kind: 'confirmed' | 'preview';
  previewPointKind: 'pending' | 'hover' | 'locked-distance' | null;
  isClosePreview: boolean;
  isActive: boolean;
  start: Point;
  end: Point;
};

type FootprintCanvasLayout = {
  polygon: Point[];
  handles: FootprintHandleSpec[];
  resizeEdges: FootprintResizeEdgeSpec[];
  customVertices: FootprintCustomVertexSpec[];
  customEdges: FootprintCustomEdgeSpec[];
  landingPoint: Point | null;
  lockedDistanceCenter: Point | null;
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

export type PlanSvgPointerFootprintPointInput = {
  rootPoint: { x: number; y: number };
  rotationCenter: { x: number; y: number };
  rotationTurns: number;
  footprintRect: { x: number; y: number; width: number; height: number };
  scale: number;
  attachmentSide: AttachmentSide;
  lengthA: number;
  spanA: number;
  houseFootprintPreset: ModulePlanModel['houseFootprintPreset'];
  houseFootprintParams: ModulePlanModel['houseFootprintParams'];
  isHipCorner?: boolean;
};

export type PlanSvgPointerFootprintPoint = {
  formatted: {
    alongM: string;
    depthM: string;
  };
  numeric: {
    alongM: number;
    depthM: number;
  };
};

function formatPlanPointerMetres(value: number): string {
  return (Math.round(value * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '') || '0';
}

export function resolvePlanSvgPointerFootprintPoint(input: PlanSvgPointerFootprintPointInput): PlanSvgPointerFootprintPoint | null {
  if (
    input.isHipCorner ||
    !Number.isFinite(input.rootPoint.x) ||
    !Number.isFinite(input.rootPoint.y) ||
    !Number.isFinite(input.rotationCenter.x) ||
    !Number.isFinite(input.rotationCenter.y) ||
    !Number.isFinite(input.footprintRect.x) ||
    !Number.isFinite(input.footprintRect.y) ||
    !Number.isFinite(input.footprintRect.width) ||
    !Number.isFinite(input.footprintRect.height) ||
    !Number.isFinite(input.scale) ||
    input.scale <= 0 ||
    !Number.isFinite(input.lengthA) ||
    !Number.isFinite(input.spanA)
  ) {
    return null;
  }

  const unrotatedPlanPoint = rotatePointQuarterTurns(input.rootPoint, input.rotationCenter, -input.rotationTurns);
  const footprintCenter = actualPergolaCenter(input.footprintRect);
  const localDims =
    input.attachmentSide === 'left' || input.attachmentSide === 'right'
      ? { widthM: input.spanA, depthM: input.lengthA }
      : { widthM: input.lengthA, depthM: input.spanA };
  const sideLocalPoint = rotatePointQuarterTurns(unrotatedPlanPoint, footprintCenter, -attachmentSideQuarterTurns(input.attachmentSide));
  const localX = (sideLocalPoint.x - (footprintCenter.x - (localDims.widthM * input.scale) / 2)) / input.scale;
  const localY = (sideLocalPoint.y - (footprintCenter.y - (localDims.depthM * input.scale) / 2)) / input.scale;
  const localLayout = buildHouseFootprintLocalLayout({
    pergolaWidthM: localDims.widthM,
    pergolaDepthM: localDims.depthM,
    preset: input.houseFootprintPreset,
    params: input.houseFootprintParams,
  });
  const alongM = localX - localLayout.resolved.offsetXM;
  const depthM = -localY - localLayout.resolved.setbackM;
  if (!Number.isFinite(alongM) || !Number.isFinite(depthM)) return null;

  return {
    formatted: {
      alongM: formatPlanPointerMetres(alongM),
      depthM: formatPlanPointerMetres(depthM),
    },
    numeric: {
      alongM,
      depthM,
    },
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
  customPolygonOverride?: ModulePlanModel['houseFootprintPolygon'] | null;
  customPolygonOpen?: boolean;
  customPolygonConfirmedPointCount?: number;
  customPolygonPreviewPointKind?: 'pending' | 'hover' | 'locked-distance' | null;
  customPolygonCloseReady?: boolean;
  customPolygonCloseHovered?: boolean;
  customPolygonLandingPoint?: ModuleFootprintCanvasPoint | null;
  customPolygonLockedDistanceM?: number | null;
  hideHouseFootprint?: boolean;
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
  const customPolygonOpen = Boolean(input.customPolygonOpen);
  const customPolygonSource = input.customPolygonOverride === undefined ? model.houseFootprintPolygon : input.customPolygonOverride;
  const hasCustomPolygonSource = customPolygonOpen || input.customPolygonOverride !== undefined || model.houseFootprintMode === 'custom_polygon';
  const customPolygonConfirmedPointCount =
    input.customPolygonConfirmedPointCount === undefined ? Number.POSITIVE_INFINITY : Math.max(0, input.customPolygonConfirmedPointCount);
  const customPolygonPreviewPointKind = input.customPolygonPreviewPointKind ?? null;
  const customPolygonCloseReady = Boolean(input.customPolygonCloseReady);
  const customPolygonCloseHovered = Boolean(input.customPolygonCloseHovered);
  const landingPoint =
    input.customPolygonLandingPoint &&
    Number.isFinite(input.customPolygonLandingPoint.numericAlongM) &&
    Number.isFinite(input.customPolygonLandingPoint.numericDepthM)
      ? mapLocalFootprintPointToPlan({
          point: {
            x: input.customPolygonLandingPoint.numericAlongM + localLayout.resolved.offsetXM,
            y: -localLayout.resolved.setbackM - input.customPolygonLandingPoint.numericDepthM,
          },
          rect,
          canonicalWidthM: dims.widthM,
          canonicalDepthM: dims.depthM,
          scale,
          sideTurns,
        })
      : null;
  const customPoints =
    hasCustomPolygonSource
      ? (customPolygonSource ?? [])
          .map((raw) => {
            const alongM = Number.parseFloat(raw.alongM);
            const depthM = Number.parseFloat(raw.depthM);
            if (!Number.isFinite(alongM) || !Number.isFinite(depthM)) return null;
            return {
              x: alongM + localLayout.resolved.offsetXM,
              y: -localLayout.resolved.setbackM - depthM,
            };
          })
          .filter((point): point is HouseFootprintPoint => Boolean(point))
      : [];
  const effectiveLocalPolygon = customPoints.length >= 3 ? customPoints : customPolygonOpen || input.hideHouseFootprint ? [] : localLayout.polygon;
  const polygon = effectiveLocalPolygon.map((localPoint) =>
    mapLocalFootprintPointToPlan({
      point: localPoint,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    }),
  );
  const customVertices =
    customPoints.length > 0
      ? customPoints.map((localPoint, index): FootprintCustomVertexSpec => {
          const point = mapLocalFootprintPointToPlan({
            point: localPoint,
            rect,
            canonicalWidthM: dims.widthM,
            canonicalDepthM: dims.depthM,
            scale,
            sideTurns,
          });
          const alongAxis = rotateVectorQuarterTurns({ x: 1, y: 0 }, totalTurns);
          const depthAxis = rotateVectorQuarterTurns({ x: 0, y: -1 }, totalTurns);
          const isConfirmed = index < customPolygonConfirmedPointCount;
          const isPreviewPoint = !isConfirmed && index === customPolygonConfirmedPointCount;
          return {
            index,
            kind: isPreviewPoint ? customPolygonPreviewPointKind ?? 'hover' : 'confirmed',
            isLatestConfirmed: isConfirmed && index === customPolygonConfirmedPointCount - 1,
            isCloseReady: customPolygonCloseReady && index === 0,
            isCloseHovered: customPolygonCloseHovered && index === 0,
            point,
            pointRoot: rotatePointQuarterTurns(point, rotationCenter, rotationTurns),
            alongAxisX: alongAxis.x,
            alongAxisY: alongAxis.y,
            depthAxisX: depthAxis.x,
            depthAxisY: depthAxis.y,
          };
        })
      : [];
  const customEdges =
    customVertices.length >= 2
      ? customVertices.flatMap((vertex, index): FootprintCustomEdgeSpec[] => {
          if (input.customPolygonOpen && index === customVertices.length - 1) return [];
          const next = customVertices[(index + 1) % customVertices.length]!;
          const isPreviewEdge =
            Boolean(customPolygonPreviewPointKind) &&
            index === customPolygonConfirmedPointCount - 1 &&
            next.index === customPolygonConfirmedPointCount;
          return [{
            index,
            kind: isPreviewEdge ? 'preview' : 'confirmed',
            previewPointKind: isPreviewEdge ? customPolygonPreviewPointKind : null,
            isClosePreview: Boolean(isPreviewEdge && customPolygonCloseHovered),
            isActive: !isPreviewEdge && next.isLatestConfirmed,
            start: vertex.point,
            end: next.point,
          }];
        })
      : [];
  const latestConfirmedVertex =
    customPolygonConfirmedPointCount > 0 ? customVertices[customPolygonConfirmedPointCount - 1] ?? null : null;
  const lockedDistanceCenter = latestConfirmedVertex?.point ?? null;
  const handles = customPolygonOpen ? [] : localLayout.handles.map((handle): FootprintHandleSpec => {
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
  const resizeEdges = customPolygonOpen ? [] : localLayout.edges.map((edge): FootprintResizeEdgeSpec => {
    const start = mapLocalFootprintPointToPlan({
      point: edge.start,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    const end = mapLocalFootprintPointToPlan({
      point: edge.end,
      rect,
      canonicalWidthM: dims.widthM,
      canonicalDepthM: dims.depthM,
      scale,
      sideTurns,
    });
    const midPoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    return {
      ...edge,
      start,
      end,
      pointRoot: rotatePointQuarterTurns(midPoint, rotationCenter, rotationTurns),
      axisX: rotateVectorQuarterTurns({ x: edge.axisX, y: edge.axisY }, totalTurns).x,
      axisY: rotateVectorQuarterTurns({ x: edge.axisX, y: edge.axisY }, totalTurns).y,
    };
  });

  return {
    polygon,
    handles: hasCustomPolygonSource ? [] : handles,
    resizeEdges: hasCustomPolygonSource ? [] : resizeEdges,
    customVertices,
    customEdges,
    landingPoint,
    lockedDistanceCenter,
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
  lineClassName,
  tickClassName,
  textClassName,
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
      <line
        x1={geometry.lineStartX}
        y1={geometry.lineStartY}
        x2={geometry.lineEndX}
        y2={geometry.lineEndY}
        className={[styles.moduleDimLine, lineClassName].filter(Boolean).join(' ')}
      />
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
      <line
        x1={geometry.tick1StartX}
        y1={geometry.tick1StartY}
        x2={geometry.tick1EndX}
        y2={geometry.tick1EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <line
        x1={geometry.tick2StartX}
        y1={geometry.tick2StartY}
        x2={geometry.tick2EndX}
        y2={geometry.tick2EndY}
        className={[styles.moduleDimTick, tickClassName].filter(Boolean).join(' ')}
      />
      <text
        x={geometry.labelX}
        y={geometry.labelY}
        textAnchor="middle"
        className={[
          styles.moduleDimText,
          interactiveField ? styles.moduleDimTextEditable : '',
          textClassName,
        ]
          .filter(Boolean)
          .join(' ')}
        transform={typeof geometry.labelRotate === 'number' ? `rotate(${geometry.labelRotate} ${geometry.labelX} ${geometry.labelY})` : undefined}
        data-editable-field-id={interactiveField?.fieldId}
        tabIndex={interactiveField?.onActivate ? 0 : undefined}
        onClick={interactiveField?.onActivate ? (event) => interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          interactiveField?.onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                interactiveField.onActivate?.(interactiveField.fieldId, event.currentTarget as SVGTextElement);
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

function renderObjectWorkbenchDimension(
  annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
  onActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void,
) {
  const emphasis =
    'emphasis' in annotation ? annotation.emphasis : annotation.targetKind === 'deck_custom_edge' ? 'relationship' : 'driving';
  const lineClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionLine
      : styles.moduleHouseFirstDrivingDimensionLine;
  const tickClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionTick
      : styles.moduleHouseFirstDrivingDimensionTick;
  const textClassName =
    emphasis === 'relationship'
      ? styles.moduleHouseFirstRelationshipDimensionText
      : styles.moduleHouseFirstDrivingDimensionText;
  return (
    <g
      key={annotation.id}
      data-object-workbench-plan-dimension={annotation.id}
      data-object-workbench-dimension-emphasis={emphasis}
      data-house-first-plan-dimension={annotation.id}
      data-house-first-dimension-emphasis={emphasis}
    >
      <line
        x1={annotation.witnessStart.x}
        y1={annotation.witnessStart.y}
        x2={annotation.lineStart.x}
        y2={annotation.lineStart.y}
        className={
          emphasis === 'relationship'
            ? `${styles.moduleDimWitness} ${styles.moduleHouseFirstRelationshipWitness}`
            : `${styles.moduleDimWitness} ${styles.moduleHouseFirstDrivingWitness}`
        }
      />
      <line
        x1={annotation.witnessEnd.x}
        y1={annotation.witnessEnd.y}
        x2={annotation.lineEnd.x}
        y2={annotation.lineEnd.y}
        className={
          emphasis === 'relationship'
            ? `${styles.moduleDimWitness} ${styles.moduleHouseFirstRelationshipWitness}`
            : `${styles.moduleDimWitness} ${styles.moduleHouseFirstDrivingWitness}`
        }
      />
      <TickDimension
        x1={annotation.lineStart.x}
        y1={annotation.lineStart.y}
        x2={annotation.lineEnd.x}
        y2={annotation.lineEnd.y}
        label={annotation.displayValue}
        presentation="model"
        lineClassName={lineClassName}
        tickClassName={tickClassName}
        textClassName={textClassName}
        interactiveField={
          onActivate
            ? {
                fieldId: annotation.id,
                onActivate: (_fieldId, target) => onActivate(annotation, target),
              }
            : undefined
        }
      />
    </g>
  );
}

function renderObjectWorkbenchPlanOverlay(input: {
  shapes: Array<ObjectWorkbenchPlanOverlay['shapes'][number] & { points: Point[] }>;
  renderCommittedBodies?: boolean;
  previewShape: {
    ownerKind: 'deck' | 'opening';
    ownerId: string;
    points: Point[];
    bodyState: ObjectWorkbenchPreviewOverlay['bodyState'];
    anchorPoint: Point | null;
    referenceGuide: {
      start: Point;
      end: Point;
      state: NonNullable<ObjectWorkbenchPreviewOverlay['referenceGuide']>['state'];
    } | null;
    targetHighlights: Array<{ start: Point; end: Point; state: 'preview' | 'snap-available' | 'snapped' }>;
    lockedCornerPoint: Point | null;
    endCatchPoint: Point | null;
  } | null;
  customEdgeCandidates: Array<ObjectWorkbenchPlanCustomEdgeCandidate & {
    witnessStart: Point;
    witnessEnd: Point;
    lineStart: Point;
    lineEnd: Point;
  }>;
  presetAnnotations: Array<ObjectWorkbenchPlanPresetDimensionAnnotation & {
    witnessStart: Point;
    witnessEnd: Point;
    lineStart: Point;
    lineEnd: Point;
  }>;
  activeCustomEdgeId: string | null;
  onShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  hoveredDeckId?: string | null;
  onDeckHoverChange?: (deckId: string | null) => void;
  onShapeDragStart?: (
    meta: ObjectWorkbenchPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
}) {
  const {
    shapes,
    renderCommittedBodies = true,
    previewShape,
    customEdgeCandidates,
    presetAnnotations,
    activeCustomEdgeId,
    hoveredDeckId,
    onDeckHoverChange,
    onShapeSelect,
    onShapeDragStart,
    onCustomEdgeSelect,
    onDimensionActivate,
  } = input;
  const previewSuppressedOwner =
    previewShape?.ownerKind === 'deck' && previewShape.bodyState !== 'grabbed'
      ? { ownerKind: previewShape.ownerKind, ownerId: previewShape.ownerId }
      : null;
  const isPreviewSuppressedOwner = (ownerKind: 'footprint' | 'deck' | 'opening', ownerId: string) =>
    previewSuppressedOwner?.ownerKind === ownerKind && previewSuppressedOwner.ownerId === ownerId;
  const visibleCustomEdgeCandidates = previewSuppressedOwner
    ? customEdgeCandidates.filter((annotation) => !isPreviewSuppressedOwner(annotation.ownerKind, annotation.ownerId))
    : customEdgeCandidates;
  const visiblePresetAnnotations = previewSuppressedOwner
    ? presetAnnotations.filter((annotation) => !isPreviewSuppressedOwner(annotation.ownerKind, annotation.ownerId))
    : presetAnnotations;

  return (
    <>
      {shapes.length
        ? shapes.map((shape) => {
            const previewSuppressed = isPreviewSuppressedOwner(shape.ownerKind, shape.ownerId);
            const detailSegments = shape.detailSegments ?? [];
            return (
            <g key={`house-first-shape-${shape.ownerKind}-${shape.ownerId}`}>
              {renderCommittedBodies ? (
                <polygon
                  points={toPointsAttr(shape.points)}
                  data-object-workbench-shape={`${shape.ownerKind}:${shape.ownerId}`}
                  data-house-first-shape={`${shape.ownerKind}:${shape.ownerId}`}
                  data-object-workbench-shape-visual="true"
                  data-object-workbench-shape-muted={shape.muted ? 'true' : 'false'}
                  data-house-first-shape-muted={shape.muted ? 'true' : 'false'}
                  data-object-workbench-shape-invalid={shape.invalid ? 'true' : 'false'}
                  data-house-first-shape-invalid={shape.invalid ? 'true' : 'false'}
                  data-object-workbench-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                  data-house-first-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                  data-object-workbench-shape-hovered={
                    shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : 'false'
                  }
                  data-house-first-shape-hovered={
                    shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : 'false'
                  }
                  className={[
                    shape.ownerKind === 'deck' || shape.ownerKind === 'opening'
                      ? styles.moduleHouseFirstDeckShape
                      : styles.moduleHouseFirstFootprintShape,
                    shape.muted ? styles.moduleHouseFirstShapeMuted : '',
                    shape.invalid ? styles.moduleHouseFirstShapeInvalid : '',
                    shape.selected ? styles.moduleHouseFirstShapeSelected : '',
                    shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? styles.moduleHouseFirstShapeHovered : '',
                    previewSuppressed ? styles.moduleHouseFirstShapePreviewSuppressed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ) : null}
              {!renderCommittedBodies || previewSuppressed ? null : detailSegments.map((segment, index) => (
                <line
                  key={`house-first-shape-detail-${shape.ownerKind}-${shape.ownerId}-${index + 1}`}
                  x1={segment.start.x}
                  y1={segment.start.y}
                  x2={segment.end.x}
                  y2={segment.end.y}
                  className={styles.moduleHouseFirstOpeningDetail}
                />
              ))}
              <polygon
                points={toPointsAttr(shape.points)}
                data-object-workbench-shape={!renderCommittedBodies ? `${shape.ownerKind}:${shape.ownerId}` : undefined}
                data-house-first-shape={!renderCommittedBodies ? `${shape.ownerKind}:${shape.ownerId}` : undefined}
                data-object-workbench-shape-visual={!renderCommittedBodies ? 'false' : undefined}
                data-object-workbench-shape-muted={!renderCommittedBodies ? (shape.muted ? 'true' : 'false') : undefined}
                data-house-first-shape-muted={!renderCommittedBodies ? (shape.muted ? 'true' : 'false') : undefined}
                data-object-workbench-shape-invalid={!renderCommittedBodies ? (shape.invalid ? 'true' : 'false') : undefined}
                data-house-first-shape-invalid={!renderCommittedBodies ? (shape.invalid ? 'true' : 'false') : undefined}
                data-object-workbench-shape-preview-suppressed={!renderCommittedBodies ? (previewSuppressed ? 'true' : 'false') : undefined}
                data-house-first-shape-preview-suppressed={!renderCommittedBodies ? (previewSuppressed ? 'true' : 'false') : undefined}
                data-object-workbench-shape-hovered={
                  !renderCommittedBodies && shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined
                }
                data-house-first-shape-hovered={
                  !renderCommittedBodies && shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined
                }
                data-object-workbench-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
                data-house-first-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
                data-object-workbench-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                data-house-first-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
                data-object-workbench-shape-draggable={
                  shape.ownerKind === 'deck'
                    ? shape.deckDragEligibility?.eligible
                      ? 'true'
                      : 'false'
                    : shape.ownerKind === 'opening'
                      ? shape.openingDragEligibility?.eligible
                        ? 'true'
                        : 'false'
                      : 'false'
                }
                data-house-first-shape-draggable={
                  shape.ownerKind === 'deck'
                    ? shape.deckDragEligibility?.eligible
                      ? 'true'
                      : 'false'
                    : shape.ownerKind === 'opening'
                      ? shape.openingDragEligibility?.eligible
                        ? 'true'
                        : 'false'
                      : 'false'
                }
                data-object-workbench-shape-drag-reason={
                  shape.ownerKind === 'deck'
                    ? (shape.deckDragEligibility?.reason ?? '')
                    : shape.ownerKind === 'opening'
                      ? (shape.openingDragEligibility?.reason ?? '')
                      : ''
                }
                data-house-first-shape-drag-reason={
                  shape.ownerKind === 'deck'
                    ? (shape.deckDragEligibility?.reason ?? '')
                    : shape.ownerKind === 'opening'
                      ? (shape.openingDragEligibility?.reason ?? '')
                      : ''
                }
                className={styles.moduleHouseFirstShapeHit}
                onClick={() => onShapeSelect?.({ ownerKind: shape.ownerKind, ownerId: shape.ownerId })}
                onPointerEnter={() => {
                  if (shape.ownerKind !== 'deck') return;
                  onDeckHoverChange?.(shape.ownerId);
                }}
                onPointerMove={() => {
                  if (shape.ownerKind !== 'deck') return;
                  onDeckHoverChange?.(shape.ownerId);
                }}
                onPointerLeave={() => {
                  if (shape.ownerKind !== 'deck') return;
                  onDeckHoverChange?.(null);
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  if (shape.ownerKind === 'deck' && shape.deckInteraction) {
                    event.preventDefault();
                    event.stopPropagation();
                    onDeckHoverChange?.(shape.ownerId);
                    if (!shape.selected) {
                      onShapeSelect?.({ ownerKind: shape.ownerKind, ownerId: shape.ownerId });
                    }
                    onShapeDragStart?.(
                      {
                        ownerKind: 'deck',
                        ownerId: shape.ownerId,
                        overlayShape: shape,
                        deckInteraction: {
                          ...shape.deckInteraction,
                          hostEdgeStart: shape.deckInteraction.hostEdgeStart,
                          hostEdgeEnd: shape.deckInteraction.hostEdgeEnd,
                        },
                      },
                      {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      },
                    );
                    return;
                  }
                  if (!shape.selected) return;
                  if (shape.ownerKind === 'opening' && shape.openingInteraction) {
                    onShapeDragStart?.(
                      {
                        ownerKind: 'opening',
                        ownerId: shape.ownerId,
                        openingInteraction: {
                          ...shape.openingInteraction,
                          hostEdgeStart: shape.openingInteraction.hostEdgeStart,
                          hostEdgeEnd: shape.openingInteraction.hostEdgeEnd,
                        },
                      },
                      {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      },
                    );
                  }
                }}
              />
              {!previewSuppressed && (shape.ownerKind === 'deck' || shape.ownerKind === 'opening') && shape.selected && shape.invalid ? (
                <text
                  x={shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(shape.points.length, 1)}
                  y={shape.points.reduce((sum, point) => sum + point.y, 0) / Math.max(shape.points.length, 1)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={styles.moduleHouseFirstInvalidBadge}
                >
                  {shape.invalidMessage?.includes('house interior')
                    ? 'Inside house'
                    : shape.invalidMessage?.includes('overlap each other')
                      ? 'Overlaps deck'
                      : shape.invalidMessage?.includes('host edge')
                        ? 'Missing host edge'
                        : shape.ownerKind === 'opening'
                          ? 'Invalid opening'
                          : 'Invalid deck'}
                </text>
              ) : null}
              {!previewSuppressed &&
              (shape.ownerKind === 'deck' || shape.ownerKind === 'opening') &&
              shape.selected &&
              (shape.ownerKind === 'deck' ? shape.deckDragEligibility : shape.openingDragEligibility) ? (
                <text
                  x={shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(shape.points.length, 1)}
                  y={Math.min(...shape.points.map((point) => point.y)) - 1.8}
                  textAnchor="middle"
                  className={
                    (shape.ownerKind === 'deck' ? shape.deckDragEligibility?.eligible : shape.openingDragEligibility?.eligible)
                      ? styles.moduleHouseFirstDraggableBadge
                      : styles.moduleHouseFirstDeferredBadge
                  }
                >
                  {(shape.ownerKind === 'deck' ? shape.deckDragEligibility?.eligible : shape.openingDragEligibility?.eligible)
                    ? shape.ownerKind === 'deck'
                      ? 'Drag deck'
                      : 'Drag opening'
                    : 'Blocked'}
                </text>
              ) : null}
            </g>
            );
          })
        : null}
      {previewShape ? (
        <g
          data-object-workbench-preview-owner={previewShape.ownerId}
          data-object-workbench-preview-owner-kind={previewShape.ownerKind}
          data-house-first-preview-owner={previewShape.ownerId}
          data-house-first-preview-owner-kind={previewShape.ownerKind}
        >
          {previewShape.referenceGuide ? (
            <line
              x1={previewShape.referenceGuide.start.x}
              y1={previewShape.referenceGuide.start.y}
              x2={previewShape.referenceGuide.end.x}
              y2={previewShape.referenceGuide.end.y}
              data-object-workbench-reference-guide={previewShape.referenceGuide.state}
              data-house-first-reference-guide={previewShape.referenceGuide.state}
              className={
                previewShape.referenceGuide.state === 'snap-lane'
                  ? `${styles.moduleHouseFirstPreviewGuide} ${styles.moduleHouseFirstPreviewGuideSnapLane}`
                  : styles.moduleHouseFirstPreviewGuide
              }
            />
          ) : null}
          {previewShape.targetHighlights.map((targetHighlight, index) => (
            <line
              key={`house-first-preview-target-${previewShape.ownerId}-${index + 1}`}
              x1={targetHighlight.start.x}
              y1={targetHighlight.start.y}
              x2={targetHighlight.end.x}
              y2={targetHighlight.end.y}
              data-object-workbench-snap-target={targetHighlight.state}
              data-house-first-snap-target={targetHighlight.state}
              className={
                targetHighlight.state === 'snapped'
                  ? `${styles.moduleHouseFirstSnapTarget} ${styles.moduleHouseFirstSnapTargetSnapped}`
                  : targetHighlight.state === 'snap-available'
                    ? `${styles.moduleHouseFirstSnapTarget} ${styles.moduleHouseFirstSnapTargetAvailable}`
                    : styles.moduleHouseFirstSnapTarget
              }
            />
          ))}
          {previewShape.lockedCornerPoint ? (
            <circle
              cx={previewShape.lockedCornerPoint.x}
              cy={previewShape.lockedCornerPoint.y}
              r={0.92}
              data-object-workbench-preview-corner-lock={previewShape.bodyState}
              data-house-first-preview-corner-lock={previewShape.bodyState}
              className={styles.moduleHouseFirstPreviewCornerLock}
            />
          ) : null}
          {previewShape.endCatchPoint ? (
            <circle
              cx={previewShape.endCatchPoint.x}
              cy={previewShape.endCatchPoint.y}
              r={0.82}
              data-object-workbench-preview-end-catch={previewShape.bodyState}
              data-house-first-preview-end-catch={previewShape.bodyState}
              className={styles.moduleHouseFirstPreviewEndCatch}
            />
          ) : null}
          {previewShape.bodyState === 'grabbed' ? null : (
            <polygon
              points={toPointsAttr(previewShape.points)}
              data-object-workbench-preview-shape={previewShape.ownerId}
              data-house-first-preview-shape={previewShape.ownerId}
              data-object-workbench-preview-body-state={previewShape.bodyState}
              data-house-first-preview-body-state={previewShape.bodyState}
              className={[
                styles.moduleHouseFirstPreviewShape,
                previewShape.bodyState === 'snap-available'
                  ? styles.moduleHouseFirstPreviewShapeAvailable
                  : previewShape.bodyState === 'snapped'
                    ? styles.moduleHouseFirstPreviewShapeSnapped
                    : previewShape.bodyState === 'blocked'
                      ? styles.moduleHouseFirstPreviewShapeBlocked
                      : previewShape.bodyState === 'settling'
                        ? styles.moduleHouseFirstPreviewShapeSettling
                        : styles.moduleHouseFirstPreviewShapeFloating,
              ].join(' ')}
            />
          )}
          {previewShape.anchorPoint ? (
            <circle
              cx={previewShape.anchorPoint.x}
              cy={previewShape.anchorPoint.y}
              r={1.05}
              data-object-workbench-preview-anchor={previewShape.bodyState}
              data-house-first-preview-anchor={previewShape.bodyState}
              className={
                previewShape.bodyState === 'blocked'
                  ? `${styles.moduleHouseFirstPreviewAnchor} ${styles.moduleHouseFirstPreviewAnchorBlocked}`
                  : previewShape.bodyState === 'grabbed'
                    ? `${styles.moduleHouseFirstPreviewAnchor} ${styles.moduleHouseFirstPreviewAnchorGrabbed}`
                    : styles.moduleHouseFirstPreviewAnchor
              }
            />
          ) : null}
        </g>
      ) : null}
      {visibleCustomEdgeCandidates.length
        ? visibleCustomEdgeCandidates.map((annotation) => (
            <g key={`house-first-edge-${annotation.id}`}>
              <line
                x1={annotation.witnessStart.x}
                y1={annotation.witnessStart.y}
                x2={annotation.witnessEnd.x}
                y2={annotation.witnessEnd.y}
                data-object-workbench-custom-edge={annotation.id}
                data-house-first-custom-edge={annotation.id}
                className={
                  annotation.id === activeCustomEdgeId
                    ? `${styles.moduleHouseFirstCustomEdge} ${styles.moduleHouseFirstCustomEdgeActive}`
                    : styles.moduleHouseFirstCustomEdge
                }
              />
              <line
                x1={annotation.witnessStart.x}
                y1={annotation.witnessStart.y}
                x2={annotation.witnessEnd.x}
                y2={annotation.witnessEnd.y}
                data-object-workbench-custom-edge-hit={annotation.id}
                data-house-first-custom-edge-hit={annotation.id}
                className={styles.moduleHouseFirstCustomEdgeHit}
                onClick={() =>
                  onCustomEdgeSelect?.({
                    ownerKind: annotation.ownerKind,
                    ownerId: annotation.ownerId,
                    edgeIndex: annotation.edgeIndex,
                  })
                }
              />
            </g>
          ))
        : null}
      {visiblePresetAnnotations.length
        ? visiblePresetAnnotations.map((annotation) => renderObjectWorkbenchDimension(annotation, onDimensionActivate))
        : null}
      {visibleCustomEdgeCandidates.length
        ? visibleCustomEdgeCandidates
            .filter((annotation) => annotation.id === activeCustomEdgeId)
            .map((annotation) => renderObjectWorkbenchDimension(annotation, onDimensionActivate))
        : null}
    </>
  );
}

function estimatePinnedSheetPlanPrimaryDimensionBounds(input: {
  rotatedPrimaryBounds: AnnotatedBounds;
  dimensionOffsets: { bottom: number; side: number };
  bottomLabel: string;
  leftLabel: string;
  presentation: ModuleDrawingPresentation;
}): AnnotatedBounds {
  const pinnedBottomDimensionY = Math.min(87.4, input.rotatedPrimaryBounds.maxY + input.dimensionOffsets.bottom);
  const pinnedLeftDimensionX = input.rotatedPrimaryBounds.minX - input.dimensionOffsets.side;

  return unionBounds([
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.minX, pinnedBottomDimensionY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.maxX, input.rotatedPrimaryBounds.maxY, input.rotatedPrimaryBounds.maxX, pinnedBottomDimensionY, 0.2),
    estimateTickDimensionBounds({
      x1: input.rotatedPrimaryBounds.minX,
      y1: pinnedBottomDimensionY,
      x2: input.rotatedPrimaryBounds.maxX,
      y2: pinnedBottomDimensionY,
      label: input.bottomLabel,
      presentation: input.presentation,
    }),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.minY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.minY, 0.2),
    boundsFromLine(input.rotatedPrimaryBounds.minX, input.rotatedPrimaryBounds.maxY, pinnedLeftDimensionX, input.rotatedPrimaryBounds.maxY, 0.2),
    estimateTickDimensionBounds({
      x1: pinnedLeftDimensionX,
      y1: input.rotatedPrimaryBounds.minY,
      x2: pinnedLeftDimensionX,
      y2: input.rotatedPrimaryBounds.maxY,
      label: input.leftLabel,
      presentation: input.presentation,
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
  displayMode?: ModuleDrawingDisplayMode;
  frame: PlanSheetFrame;
  includeHouseContext?: boolean;
  footprintEditor?: Pick<
    ModuleFootprintEditorProps,
    | 'customPolygonOverride'
    | 'customPolygonOpen'
    | 'customPolygonConfirmedPointCount'
    | 'customPolygonPreviewPointKind'
    | 'customPolygonCloseReady'
    | 'customPolygonCloseHovered'
    | 'customPolygonLandingPoint'
    | 'customPolygonLockedDistanceM'
    | 'hideHouseFootprint'
  >;
}): AnnotatedBounds {
  const { model, x, y, scale, presentation = 'sheet', frame } = input;
  const includeHouseContext = input.includeHouseContext ?? true;
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const rotationTurns = planRotationTurnsForPresentation({
    roofType: model.roofType,
    drawingRotationQuarterTurns: model.drawingRotationQuarterTurns,
    presentation,
  });
  const rotationFrame = resolvePlanRotationFrame({
    x,
    y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: rotationTurns,
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
  const customPolygonOverrideActive = input.footprintEditor?.customPolygonOverride !== undefined;
  const hideHouseFootprint = Boolean(input.footprintEditor?.hideHouseFootprint);
  const showHouseFootprint = model.houseConnectionType !== 'none' && !hideHouseFootprint;
  const footprintRect = { x: baseX, y: baseY, width: aW, height: aH };
  const footprintCanvasLayout =
    (showHouseFootprint || customPolygonOverrideActive) && model.supportsHouseFootprints && !isHipCorner
      ? resolveFootprintCanvasLayout({
          model: { ...model, attachmentSide },
          rect: footprintRect,
          scale,
          rotationCenter: rotationFrame.center,
          rotationTurns: 0,
          customPolygonOverride: input.footprintEditor?.customPolygonOverride,
          customPolygonOpen: input.footprintEditor?.customPolygonOpen,
          customPolygonConfirmedPointCount: input.footprintEditor?.customPolygonConfirmedPointCount,
          customPolygonPreviewPointKind: input.footprintEditor?.customPolygonPreviewPointKind,
          customPolygonCloseReady: input.footprintEditor?.customPolygonCloseReady,
          customPolygonCloseHovered: input.footprintEditor?.customPolygonCloseHovered,
          customPolygonLandingPoint: input.footprintEditor?.customPolygonLandingPoint,
          customPolygonLockedDistanceM: input.footprintEditor?.customPolygonLockedDistanceM,
          hideHouseFootprint,
        })
      : null;
  const footprintBoundsPoints = includeHouseContext && footprintCanvasLayout
    ? [
        ...footprintCanvasLayout.polygon,
        ...footprintCanvasLayout.customVertices.map((vertex) => vertex.point),
        ...(footprintCanvasLayout.landingPoint ? [footprintCanvasLayout.landingPoint] : []),
      ]
    : [];
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
  const semanticHouseSurfacePoints = includeHouseContext
    ? (model.houseContext?.surfaces ?? []).map((surface) =>
        surface.boundary.map((point) => planHousePointToSvg(point, baseX, baseY, scale)),
      )
    : [];
  const semanticHouseLines = includeHouseContext
    ? (model.houseContext?.lines ?? []).map((line) => ({
        start: planHousePointToSvg(line.line.start, baseX, baseY, scale),
        end: planHousePointToSvg(line.line.end, baseX, baseY, scale),
      }))
    : [];
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
  const showPinnedSheetPrimaryDimensions = presentation === 'sheet' && !isHipCorner;
  const primaryDimensionSwap = showPinnedSheetPrimaryDimensions && rotationFrame.turns % 2 !== 0;
  const sheetFallAnnotationSpec =
    presentation === 'sheet'
      ? buildPlanFallAnnotationSpec({
          model,
          attachmentSide,
          isHipCorner,
          isGableLike,
          baseX,
          baseY,
          aW,
          aH,
          bW,
          bH,
          bottomY: isHipCorner ? bottomY : baseY + aH,
          fallGap: frame.fallGap,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
          isSheet: true,
        })
      : null;
  const yTopInner = baseY + topFrameW;
  const yBottomInner = baseY + aH - gutterW;
  const sheetSpacingAnnotationSpec =
    presentation === 'sheet'
      ? buildPlanRafterSpacingAnnotationSpec({
          rafterXsA,
          interiorRafterXsA,
          splitY,
          gutterW,
          yBottomInner,
          rafterDimY,
          isHipCorner,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
          label: `${formatMetres(model.rafterSpacingA)} c/c`,
        })
      : null;
  const sheetInternalAngleAnnotationSpec =
    presentation === 'sheet' && model.boxPerimeterEnabled
      ? buildPlanInternalAngleAnnotationSpec({
          centerX,
          centerY,
          baseY,
          bottomY,
          aH,
          isHipCorner,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
        })
      : null;
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
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    presentation === 'model' && footprintBoundsPoints.length > 0 ? boundsFromPoints(footprintBoundsPoints, 0.35) : null,
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
    presentation === 'sheet' ? null : boundsFromLine(fallStart.x, fallStart.y, fallEnd.x, fallEnd.y, 0.25),
    presentation !== 'sheet' && isGableLike
      ? estimateArrowHeadBounds({
          x: fallStart.x,
          y: fallStart.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up',
          presentation,
        })
      : null,
    presentation !== 'sheet' && isGableLike
      ? estimateArrowHeadBounds({
          x: fallEnd.x,
          y: fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down',
          presentation,
        })
      : null,
    presentation !== 'sheet' && !isGableLike
      ? estimateArrowHeadBounds({
          x: model.slopeDirection === 'toward_house' ? fallStart.x : fallEnd.x,
          y: model.slopeDirection === 'toward_house' ? fallStart.y : fallEnd.y,
          direction: fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : model.slopeDirection === 'toward_house' ? 'up' : 'down',
          presentation,
        })
      : null,
    presentation === 'sheet'
      ? null
      : estimateTextBounds({
          text: isGableLike ? 'fall both sides' : 'fall',
          x: fallLabelPoint.x,
          y: fallLabelPoint.y,
          anchor: 'start',
          fontHeight: 1.8,
          charWidth: 0.58,
          paddingX: 0.2,
          paddingY: 0.18,
        }),
    ...(showPinnedSheetPrimaryDimensions
      ? []
      : [
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
        ]),
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
    presentation === 'sheet' ? null : spacingBounds,
    presentation === 'sheet' || !model.boxPerimeterEnabled ? null : boundsFromLine(centerX, baseY + 2.8, centerX, (isHipCorner ? bottomY : baseY + aH) - 2.8, 0.2),
    presentation === 'sheet' || !model.boxPerimeterEnabled
      ? null
      : estimateTextBounds({
          text: 'internal roof angle',
          x: centerX + 2.5,
          y: centerY + 0.5,
          anchor: 'start',
          fontHeight: 1.55,
          charWidth: 0.54,
          paddingX: 0.15,
          paddingY: 0.15,
        }),
  ];

  const rotatedLocalBounds =
    rotationFrame.turns === 0
      ? unionBounds(localBounds)
      : unionBounds(localBounds.map((bounds) => (bounds ? rotateBoundsQuarterTurns(bounds, rotationFrame.center, rotationFrame.turns) : null)));
  const sheetAnnotationBounds = unionBounds([
    sheetFallAnnotationSpec ? estimatePlanFallAnnotationBounds(sheetFallAnnotationSpec, presentation) : null,
    sheetSpacingAnnotationSpec ? estimatePlanSpacingAnnotationBounds(sheetSpacingAnnotationSpec, presentation) : null,
    sheetInternalAngleAnnotationSpec ? estimatePlanLineTextAnnotationBounds(sheetInternalAngleAnnotationSpec) : null,
  ]);

  if (!showPinnedSheetPrimaryDimensions) {
    return unionBounds([rotatedLocalBounds, sheetAnnotationBounds]);
  }

  const rotatedPrimaryPoints =
    rotationFrame.turns === 0 ? primaryPoints : rotatePointsQuarterTurns(primaryPoints, rotationFrame.center, rotationFrame.turns);
  const rotatedPrimaryBounds = boundsFromPoints(rotatedPrimaryPoints);

  return unionBounds([
    rotatedLocalBounds,
    sheetAnnotationBounds,
    estimatePinnedSheetPlanPrimaryDimensionBounds({
      rotatedPrimaryBounds,
      dimensionOffsets,
      bottomLabel: formatMetres(primaryDimensionSwap ? model.spanA : model.lengthA),
      leftLabel: formatMetres(primaryDimensionSwap ? model.lengthA : model.spanA),
      presentation,
    }),
  ]);
}

function measurePlanModelSpaceFocusBounds(input: {
  model: ModulePlanModel;
  x: number;
  y: number;
  scale: number;
  displayMode?: ModuleDrawingDisplayMode;
}): AnnotatedBounds {
  const { model, x, y, scale, displayMode = 'pergolas' } = input;
  const isHipCorner = model.roofType === 'hip_corner';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const rotationFrame = resolvePlanRotationFrame({
    x,
    y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: 0,
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
  const ridgeBandX = baseX + sideFrameW;
  const ridgeBandWidth = Math.max(0, aW - sideFrameW * 2);
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : baseY + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = baseX + sideFrameW;
  const rafterXsA = projectLinearPositions(model.rafterPositionsA, model.rafterEdgeLengthM, baseX, aW);
  const rafterXsB = projectLinearPositions(model.rafterPositionsB ?? null, model.lengthB, baseX, bW);
  const interiorRafterXsA = interiorPlanRafterXs(rafterXsA);
  const interiorRafterXsB = interiorPlanRafterXs(rafterXsB);
  const semanticHouseSurfacePoints =
    displayMode === 'house'
      ? (model.houseContext?.surfaces ?? []).map((surface) =>
          surface.boundary.map((point) => planHousePointToSvg(point, baseX, baseY, scale)),
        )
      : [];
  const semanticHouseLines =
    displayMode === 'house'
      ? (model.houseContext?.lines ?? []).map((line) => ({
          start: planHousePointToSvg(line.line.start, baseX, baseY, scale),
          end: planHousePointToSvg(line.line.end, baseX, baseY, scale),
        }))
      : [];
  const yTopInner = baseY + topFrameW;
  const yBottomInner = baseY + aH - gutterW;
  const dimensionOffsets = { bottom: 7.8, secondary: 5.4, side: 5.6, hipSide: 5.9 };
  const dimBaseY = bottomY + dimensionOffsets.bottom;
  const secondaryDimY = dimBaseY + dimensionOffsets.secondary;

  const localBounds = unionBounds([
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
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
    model.overhangEnabled && overhangDepth > 0 ? boundsFromRect(overhangX, overhangY, overhangWidth, overhangDepth) : null,
    boundsFromLine(baseX, isHipCorner ? bottomY : baseY + aH, baseX, dimBaseY, 0.2),
    boundsFromLine(baseX + aW, isHipCorner ? splitY : baseY + aH, baseX + aW, dimBaseY, 0.2),
    estimateTickDimensionBounds({ x1: baseX, y1: dimBaseY, x2: baseX + aW, y2: dimBaseY, label: formatMetres(model.lengthA), presentation: 'model' }),
    boundsFromLine(baseX, baseY, baseX - dimensionOffsets.side, baseY, 0.2),
    boundsFromLine(baseX, baseY + aH, baseX - dimensionOffsets.side, baseY + aH, 0.2),
    estimateTickDimensionBounds({
      x1: baseX - dimensionOffsets.side,
      y1: baseY,
      x2: baseX - dimensionOffsets.side,
      y2: baseY + aH,
      label: formatMetres(model.spanA),
      presentation: 'model',
    }),
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX, bottomY, baseX, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB ? boundsFromLine(baseX + bW, bottomY, baseX + bW, secondaryDimY, 0.2) : null,
    isHipCorner && model.lengthB && model.spanB
      ? estimateTickDimensionBounds({ x1: baseX, y1: secondaryDimY, x2: baseX + bW, y2: secondaryDimY, label: formatMetres(model.lengthB), presentation: 'model' })
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
          presentation: 'model',
        })
      : null,
  ]);

  if (rotationFrame.turns === 0) {
    return localBounds;
  }
  return rotateBoundsQuarterTurns(localBounds, rotationFrame.center, rotationFrame.turns);
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

function getPlanModelSpaceFrame(isHipCorner: boolean): PlanSheetFrame {
  return {
    ...getPlanSheetFrame(isHipCorner),
    outerField: { x: 0, y: 0, width: 0, height: 0 },
    fitArea: { x: 0, y: 0, width: 0, height: 0 },
    houseBandHeight: 10,
    houseBandOffset: 2.1,
    houseInset: 2.4,
    fallGap: 7,
  };
}

function resolvePlanModelSpaceLayout(
  model: ModulePlanModel,
  footprintEditor?: Pick<
    ModuleFootprintEditorProps,
    | 'customPolygonOverride'
    | 'customPolygonOpen'
    | 'customPolygonConfirmedPointCount'
    | 'customPolygonPreviewPointKind'
    | 'customPolygonCloseReady'
    | 'customPolygonCloseHovered'
    | 'customPolygonLandingPoint'
    | 'customPolygonLockedDistanceM'
    | 'hideHouseFootprint'
  >,
  options?: {
    displayMode?: ModuleDrawingDisplayMode;
    topProjection?: GeometryTopProjectionViewModel | null;
  },
): ResolvedModelSpaceLayout {
  const frame = getPlanModelSpaceFrame(model.roofType === 'hip_corner');
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const x = 0;
  const y = 0;
  const legacyAnnotatedBounds = measurePlanAnnotatedBounds({
    model,
    x,
    y,
    scale,
    presentation: 'model',
    displayMode: options?.displayMode,
    frame,
    footprintEditor,
  });
  const legacyFocusBounds = measurePlanModelSpaceFocusBounds({
    model,
    x,
    y,
    scale,
    displayMode: options?.displayMode,
  });
  const topProjectionFocusBounds = topProjectionExtentsToModelSpaceBounds(options?.topProjection, scale);
  const focusBounds = topProjectionFocusBounds ?? legacyFocusBounds;
  const annotatedBounds = topProjectionFocusBounds
    ? unionBounds([legacyAnnotatedBounds, topProjectionFocusBounds])
    : legacyAnnotatedBounds;
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x,
    y,
    scale,
    houseBandHeight: frame.houseBandHeight,
    houseBandOffset: frame.houseBandOffset,
    houseInset: frame.houseInset,
    fallGap: frame.fallGap,
    ...svgMetrics,
    ...focusMetrics,
    ...worldMetrics,
  };
}

function measureSectionAnnotatedBounds(input: {
  model: ModuleSectionModel;
  xLeft: number;
  yGround: number;
  scale: number;
  presentation?: ModuleDrawingPresentation;
  includeHouseContext?: boolean;
}): AnnotatedBounds {
  const { model, xLeft, yGround, scale, presentation = 'sheet' } = input;
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const includeHouseContext = input.includeHouseContext ?? true;
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
  const semanticHouseSurfacePoints = includeHouseContext
    ? (model.houseContext?.surfaces ?? []).map((surface) => surface.boundary.map((point) => sectionHousePointToSvg(point, xLeft, yGround, scale)))
    : [];
  const semanticHouseLines = includeHouseContext
    ? (model.houseContext?.lines ?? []).map((line) => ({
        start: sectionHousePointToSvg(line.line.start, xLeft, yGround, scale),
        end: sectionHousePointToSvg(line.line.end, xLeft, yGround, scale),
      }))
    : [];
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
  const groundLeftX = isModel ? xLeft - 8 : Math.max(8, xLeft - 8);
  const groundRightX = isModel ? xRight + 8 : Math.min(104, xRight + 8);
  const groundLineRightX = isModel ? xRight + 8 : Math.min(112, xRight + 8);

  return unionBounds([
    ...semanticHouseSurfacePoints.map((points) => boundsFromPoints(points, 0.25)),
    ...semanticHouseLines.map((line) => boundsFromLine(line.start.x, line.start.y, line.end.x, line.end.y, 0.25)),
    boundsFromRect(groundLeftX, yGround + 1.3, groundRightX - groundLeftX, 8),
    boundsFromLine(groundLeftX, yGround, groundLineRightX, yGround, 0.25),
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

function resolveSectionModelSpaceLayout(model: ModuleSectionModel): ResolvedModelSpaceLayout {
  const scale = MODEL_SPACE_UNITS_PER_METRE;
  const extents = getSectionRealExtents(model);
  const x = 0;
  const y = extents.heightM * scale;
  const annotatedBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model' });
  const focusBounds = measureSectionAnnotatedBounds({ model, xLeft: x, yGround: y, scale, presentation: 'model', includeHouseContext: false });
  const svgMetrics = resolveModelSpaceSvgMetrics(focusBounds);
  const focusMetrics = resolveModelSpaceFocusMetrics(focusBounds);
  const worldMetrics = resolveModelSpaceWorldMetrics(annotatedBounds);

  return {
    outerField: svgMetrics.viewBox,
    fitArea: svgMetrics.viewBox,
    annotatedBounds,
    x,
    y,
    scale,
    houseBandHeight: 0,
    houseBandOffset: 0,
    houseInset: 0,
    fallGap: 0,
    ...svgMetrics,
    ...focusMetrics,
    ...worldMetrics,
  };
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
  displayMode = 'pergolas',
  visibility,
  footprintEditor,
  planInteraction,
  sheetPlanInteraction,
  objectWorkbenchPlanOverlay,
  hoveredObjectWorkbenchDeckId,
  onObjectWorkbenchDeckHoverChange,
  activeObjectWorkbenchCustomEdgeId,
  onObjectWorkbenchShapeSelect,
  currentPergolaId,
  onPergolaSelect,
  onCanvasSelect,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  objectWorkbenchPreviewOverlay,
  modelSpacePergolaGeometry,
  modelSpaceTopProjection,
  modelSpacePergolaRenderSource = 'legacy',
  modelSpacePergolaRenderStatus = 'invalid_geometry',
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
  displayMode?: ModuleDrawingDisplayMode;
  visibility?: DrawingWorkbenchVisibilityState;
  footprintEditor?: ModuleFootprintEditorProps;
  planInteraction?: ModulePlanInteractionProps;
  sheetPlanInteraction?: ModulePlanSheetInteractionProps;
  objectWorkbenchPlanOverlay?: ObjectWorkbenchPlanOverlay | null;
  hoveredObjectWorkbenchDeckId?: string | null;
  onObjectWorkbenchDeckHoverChange?: (deckId: string | null) => void;
  activeObjectWorkbenchCustomEdgeId?: string | null;
  onObjectWorkbenchShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  currentPergolaId?: string | null;
  onPergolaSelect?: (pergolaId: string) => void;
  onCanvasSelect?: () => void;
  onObjectWorkbenchShapeDragStart?: (
    meta: ObjectWorkbenchPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
  onObjectWorkbenchCustomEdgeSelect?: (target: { ownerKind: 'footprint' | 'deck'; ownerId: string; edgeIndex: number }) => void;
  onObjectWorkbenchDimensionActivate?: (
    annotation: ObjectWorkbenchPlanPresetDimensionAnnotation | ObjectWorkbenchPlanCustomEdgeCandidate,
    target: SVGTextElement,
  ) => void;
  objectWorkbenchPreviewOverlay?: ObjectWorkbenchPreviewOverlay | null;
  modelSpacePergolaGeometry?: GeometryPlanViewModel | null;
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  modelSpacePergolaRenderSource?: ObjectWorkbenchPergolaRenderSource;
  modelSpacePergolaRenderStatus?: ObjectWorkbenchPergolaRenderStatus;
}) {
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isSheet = presentation === 'sheet';
  const isModel = presentation === 'model';
  const exposesPlanProjectionDiagnostics = isModel || isSheet;
  const familyVisibility = visibility ?? {
    house: true,
    pergolas: true,
    decks: true,
    openings: true,
  };
  const showPergolaGeometry = familyVisibility.pergolas;
  const isModelHouseDisplay = presentation === 'model' && displayMode === 'house';
  const useTopProjectionBackedPlan =
    (presentation === 'model' || presentation === 'sheet') &&
    modelSpacePergolaRenderSource === 'geometry' &&
    modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(modelSpaceTopProjection);
  const rawSemanticPlanHouseSurfaces = useTopProjectionBackedPlan ? [] : model.houseContext?.surfaces ?? [];
  const rawSemanticPlanHouseLines = useTopProjectionBackedPlan ? [] : model.houseContext?.lines ?? [];
  const rawObjectWorkbenchOverlayShapes = presentation === 'model' ? objectWorkbenchPlanOverlay?.shapes ?? [] : [];
  const rawObjectWorkbenchPresetAnnotations = presentation === 'model' ? objectWorkbenchPlanOverlay?.presetAnnotations ?? [] : [];
  const rawObjectWorkbenchCustomEdgeCandidates = presentation === 'model' ? objectWorkbenchPlanOverlay?.customEdgeCandidates ?? [] : [];
  const rawObjectWorkbenchPreviewShape =
    presentation === 'model' && objectWorkbenchPreviewOverlay
      ? objectWorkbenchPreviewOverlay.ownerKind === 'deck'
        ? familyVisibility.decks
          ? objectWorkbenchPreviewOverlay
          : null
        : objectWorkbenchPreviewOverlay.ownerKind === 'opening'
          ? familyVisibility.openings
            ? objectWorkbenchPreviewOverlay
            : null
          : objectWorkbenchPreviewOverlay
      : null;
  const isHipCorner = model.roofType === 'hip_corner';
  const isGableLike = model.roofType === 'gable' || model.roofType === 'low_gable' || model.roofType === 'hip';
  const hasFullLengthRidge = hasFullLengthPlanRidge(model.roofType);
  const planSheetFrame = isSheet ? getPlanSheetFrame(isHipCorner) : null;
  const total = getPlanRealExtents(model);
  const sheetLayout = isSheet ? resolvePlanSheetLayout({ model, drawingScale, viewportMm: sheetViewportMm }) : null;
  const modelSpaceLayout = isModel
    ? resolvePlanModelSpaceLayout(model, footprintEditor, {
        displayMode,
        topProjection: useTopProjectionBackedPlan ? modelSpaceTopProjection : null,
      })
    : null;
  const layout = sheetLayout ?? modelSpaceLayout ?? resolvePlanFitBox(total.widthM, total.heightM, presentation, isHipCorner);
  const modelSvgStyle = modelSpaceLayout
    ? {
        width: `${modelSpaceLayout.svgWidthPx}px`,
        height: `${modelSpaceLayout.svgHeightPx}px`,
      }
    : undefined;
  const scale = layout.scale;
  const rotationTurns = planRotationTurnsForPresentation({
    roofType: model.roofType,
    drawingRotationQuarterTurns: model.drawingRotationQuarterTurns,
    presentation,
  });
  const rotationFrame = resolvePlanRotationFrame({
    x: layout.x,
    y: layout.y,
    width: model.lengthA * scale,
    height: model.spanA * scale,
    turns: rotationTurns,
  });
  const x = rotationFrame.baseX;
  const y = rotationFrame.baseY;
  const planRotationTransform =
    rotationFrame.turns === 0 ? undefined : `rotate(${rotationFrame.turns * 90} ${rotationFrame.center.x} ${rotationFrame.center.y})`;
  const useGeometryBackedPergola =
    presentation === 'model' &&
    modelSpacePergolaRenderSource === 'geometry' &&
    modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(modelSpacePergolaGeometry);
  const hasGeometryBackedPergolaPlan =
    (presentation === 'model' || presentation === 'sheet') &&
    modelSpacePergolaRenderSource === 'geometry' &&
    modelSpacePergolaRenderStatus === 'geometry_ready' &&
    Boolean(modelSpacePergolaGeometry);
  const geometryPointProjector =
    useTopProjectionBackedPlan && modelSpaceTopProjection
      ? (point: Point2) => topProjectionPointToPlanSvg(point, modelSpaceTopProjection, x, y, scale)
      : (point: Point2) => mmPointToPlanSvg(point, x, y, scale);
  const geometryLineProjector = (line: Line2) => ({
    start: geometryPointProjector(line.start),
    end: geometryPointProjector(line.end),
  });
  const geometryOutlinePoints =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? mmPolygonToPlanSvg(modelSpacePergolaGeometry.outline, x, y, scale)
      : [];
  const geometryRoofPlaneSurfaces =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? modelSpacePergolaGeometry.surfaces.roofPlanes.map((surface) => ({
          ...surface,
          points: mmPolygonToPlanSvg(surface.boundary, x, y, scale),
        }))
      : [];
  const geometryRoofCladdingSurfaces =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? modelSpacePergolaGeometry.surfaces.roofCladding.map((surface) => ({
          ...surface,
          points: mmPolygonToPlanSvg(surface.boundary, x, y, scale),
        }))
      : [];
  const geometryPergolaStripMembers =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? [
          ...modelSpacePergolaGeometry.members.posts.map((member) => ({
            member,
            footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
            className: styles.modulePlanPrimaryZone,
            outlineClassName: styles.modulePlanMemberEdge,
          })),
          ...modelSpacePergolaGeometry.members.beams.map((member) => ({
            member,
            footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
            className: styles.modulePlanPrimaryZone,
            outlineClassName: styles.modulePlanMemberEdge,
          })),
          ...modelSpacePergolaGeometry.members.ledgers.map((member) => ({
            member,
            footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
            className: styles.modulePlanPrimaryZone,
            outlineClassName: styles.modulePlanMemberEdge,
          })),
          ...modelSpacePergolaGeometry.members.gutters.map((member) => ({
            member,
            footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
            className: styles.modulePlanPrimaryZone,
            outlineClassName: styles.modulePlanMemberEdge,
          })),
          ...modelSpacePergolaGeometry.members.joiners.map((member) => ({
            member,
            footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
            className: styles.modulePlanPrimaryZone,
            outlineClassName: styles.modulePlanMemberEdge,
          })),
        ]
      : [];
  const geometryRafterMembers =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? modelSpacePergolaGeometry.members.rafters.map((member) => ({
          member,
          footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
        }))
      : [];
  const geometryRidgeMembers =
    useGeometryBackedPergola && modelSpacePergolaGeometry
      ? modelSpacePergolaGeometry.members.ridge.map((member) => ({
          member,
          footprint: buildPlanMemberFootprint({ member, baseX: x, baseY: y, scale }),
        }))
      : [];
  const geometryAttachmentEdge =
    hasGeometryBackedPergolaPlan && modelSpacePergolaGeometry?.attachmentEdge
      ? geometryLineProjector(modelSpacePergolaGeometry.attachmentEdge)
      : null;
  const geometryFallAnchor =
    hasGeometryBackedPergolaPlan && modelSpacePergolaGeometry?.anchors.fall
      ? {
          point: geometryPointProjector(modelSpacePergolaGeometry.anchors.fall.point),
          direction: topProjectionDirectionToPlanSvg(modelSpacePergolaGeometry.anchors.fall.direction, useTopProjectionBackedPlan ? modelSpaceTopProjection : null),
          dual: modelSpacePergolaGeometry.anchors.fall.dual,
        }
      : null;
  const topProjectionShapes =
    useTopProjectionBackedPlan && modelSpaceTopProjection
      ? modelSpaceTopProjection.shapes
          .filter((shape) => topProjectionShapeVisible(shape, familyVisibility))
          .map((shape) => ({
            shape,
            points: topProjectionPolygonToPlanSvg(shape.polygon, modelSpaceTopProjection, x, y, scale),
          }))
      : [];
  const topProjectionAllShapes = useTopProjectionBackedPlan && modelSpaceTopProjection ? modelSpaceTopProjection.shapes : [];
  const topProjectionTopVisibleCount = topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'top_visible').length;
  const topProjectionContextCount = topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'context').length;
  const topProjectionHiddenCount = topProjectionAllShapes.filter((shape) => topProjectionRole(shape) === 'hidden_from_top').length;
  const topProjectionHiddenRenderedCount = topProjectionShapes.filter(({ shape }) => topProjectionRole(shape) === 'hidden_from_top').length;
  const topProjectionScreenAxis = modelSpaceTopProjection
    ? `${modelSpaceTopProjection.screenAxis.x}_${modelSpaceTopProjection.screenAxis.y}`
    : null;
  const topProjectionParityStatus =
    useTopProjectionBackedPlan && modelSpaceTopProjection
      ? topProjectionScreenAxis === 'world_x_left_world_y_down' && topProjectionHiddenRenderedCount === 0
        ? 'pass'
        : 'fail'
      : null;
  const topProjectionPergolaHitPoints =
    useTopProjectionBackedPlan
      ? topProjectionShapes
          .filter(({ shape }) => shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding'))
          .sort((left, right) => polygonAreaAbs(right.points) - polygonAreaAbs(left.points))[0]?.points ?? []
      : [];
  const canRenderPergolaPlanGeometry = showPergolaGeometry && (!isModel || useGeometryBackedPergola || useTopProjectionBackedPlan);

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
  const customPolygonOverride = footprintEditor?.customPolygonOverride;
  const customPolygonOverrideActive = customPolygonOverride !== undefined;
  const isDrawOutlineDraftOpen = Boolean(footprintEditor?.customPolygonOpen);
  const customPolygonHasError = Boolean(footprintEditor?.customPolygonHasError);
  const hideHouseFootprint = Boolean(footprintEditor?.hideHouseFootprint);
  const showHouseFootprint = familyVisibility.house && model.houseConnectionType !== 'none' && !hideHouseFootprint;
  const houseBandOffset = isSheet ? (planSheetFrame?.houseBandOffset ?? 1.15) : layout.houseBandOffset;
  const houseBandHeight = isSheet ? (planSheetFrame?.houseBandHeight ?? 5.3) : layout.houseBandHeight;
  const houseInset = isSheet ? (planSheetFrame?.houseInset ?? 1.7) : layout.houseInset;
  const fallGap = isSheet ? (planSheetFrame?.fallGap ?? 5.0) : layout.fallGap;
  const footprintRect = { x, y, width: aW, height: aH };
  const footprintCanvasLayout =
    (showHouseFootprint || customPolygonOverrideActive) && model.supportsHouseFootprints && !isHipCorner
      ? resolveFootprintCanvasLayout({
          model: { ...model, attachmentSide },
          rect: footprintRect,
          scale,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
          customPolygonOverride,
          customPolygonOpen: footprintEditor?.customPolygonOpen,
          customPolygonConfirmedPointCount: footprintEditor?.customPolygonConfirmedPointCount,
          customPolygonPreviewPointKind: footprintEditor?.customPolygonPreviewPointKind,
          customPolygonCloseReady: footprintEditor?.customPolygonCloseReady,
          customPolygonCloseHovered: footprintEditor?.customPolygonCloseHovered,
          customPolygonLandingPoint: footprintEditor?.customPolygonLandingPoint,
          customPolygonLockedDistanceM: footprintEditor?.customPolygonLockedDistanceM,
          hideHouseFootprint,
        })
      : null;
  const housePolygon = (() => {
    if (footprintCanvasLayout) return footprintCanvasLayout.polygon;
    if (!showHouseFootprint) {
      return rectToPoints(x, y, 0.1, 0.1);
    }
    const houseBottomY = y - houseBandOffset;
    const houseTopY = isModel ? houseBottomY - houseBandHeight : Math.max(isSheet ? (sheetLayout?.outerField.y ?? 0) + 4.8 : 4, houseBottomY - houseBandHeight);
    const houseLeftX = isModel ? x - houseInset : Math.max(isSheet ? (sheetLayout?.fitArea.x ?? 0) + 1.8 : 6, x - houseInset);
    const houseRightX = isModel
      ? x + Math.max(aW, bW) + houseInset
      : Math.min(isSheet ? (sheetLayout?.fitArea.x ?? 0) + (sheetLayout?.fitArea.width ?? 114) - 1.8 : 114, x + Math.max(aW, bW) + houseInset);
    return rectToPoints(houseLeftX, houseTopY, houseRightX - houseLeftX, houseBottomY - houseTopY);
  })();
  const effectiveHousePolygon = housePolygon.length ? housePolygon : rectToPoints(x, y, 0.1, 0.1);
  const outerFieldOutline = sheetLayout?.outerField ?? null;
  const fitAreaOutline = sheetLayout?.fitArea ?? null;
  const annotatedBoundsOutline = sheetLayout?.annotatedBounds ?? null;
  const debugMetrics = sheetLayout ? buildSheetDebugMetrics(sheetLayout, debugScaleState, scaleDiagnostics) : null;
  const houseLabel = footprintLabelPoint(effectiveHousePolygon);
  const hatchId = `${idBase}_house_hatch`;
  const houseClipId = `${idBase}_house_clip`;
  const editorSurface = footprintEditor?.surface ?? 'card';
  const allowAttachmentSideCanvasSelect = footprintEditor?.allowAttachmentSideCanvasSelect ?? true;
  const attachmentSideCanvasActiveSide = footprintEditor?.attachmentSideCanvasActiveSide ?? attachmentSide;
  const allowResizeEdgeDrag = footprintEditor?.allowResizeEdgeDrag ?? true;
  const canEditFootprint =
    Boolean(footprintEditor?.available) &&
    canEditHouseFootprintPlan(model) &&
    ((presentation === 'card' && editorSurface === 'card') ||
      (presentation === 'sheet' && editorSurface === 'sheet') ||
      (presentation === 'model' && editorSurface === 'model'));
  const isSheetFootprintEditor = presentation === 'sheet' && editorSurface === 'sheet' && Boolean(footprintEditor?.available);
  const isModelFootprintEditor = presentation === 'model' && editorSurface === 'model' && Boolean(footprintEditor?.available);
  const isEditingFootprint = canEditFootprint && Boolean(footprintEditor?.isEditing);
  const houseClipRect = isSheet
    ? (sheetLayout?.outerField ?? getSheetDrawingField())
    : isModel && modelSpaceLayout
      ? modelSpaceLayout.worldBox
      : { x: 0, y: 0, width: 120, height: 90 };
  const planHousePointProjector = (point: Point) =>
    planHousePointToSvg(point, x, y, scale);
  const objectWorkbenchPointProjector =
    useTopProjectionBackedPlan && modelSpaceTopProjection
      ? (point: Point) =>
          topProjectionPointToPlanSvg(
            { x: point.x * 1000, y: point.y * 1000 },
            modelSpaceTopProjection,
            x,
            y,
            scale,
          )
      : planHousePointProjector;
  const visibleRawObjectWorkbenchOverlayShapes = rawObjectWorkbenchOverlayShapes.filter((shape) => {
    switch (shape.ownerKind) {
      case 'footprint':
        return familyVisibility.house;
      case 'deck':
        return familyVisibility.decks;
      case 'opening':
        return familyVisibility.openings;
      default:
        return true;
    }
  });
  const visibleObjectWorkbenchDeckIds = new Set(
    visibleRawObjectWorkbenchOverlayShapes
      .filter((shape) => shape.ownerKind === 'deck')
      .map((shape) => shape.ownerId),
  );
  const selectedOpeningHostEdgeId =
    visibleRawObjectWorkbenchOverlayShapes.find((shape) => shape.ownerKind === 'opening' && shape.selected)?.openingInteraction?.hostEdgeId ?? null;
  const toneHouseRoofContext = Boolean(selectedOpeningHostEdgeId);
  const semanticPlanHouseSurfaces = rawSemanticPlanHouseSurfaces
    .filter((surface) => {
      if (surface.kind !== 'deck') return true;
      if (!familyVisibility.decks) return false;
      return !visibleObjectWorkbenchDeckIds.has(surface.id);
    })
    .map((surface) => ({
      ...surface,
      points: surface.boundary.map((point) => planHousePointProjector(point)),
      toned:
        toneHouseRoofContext &&
        (surface.kind === 'roof' || surface.kind === 'soffit' || surface.kind === 'fascia' || surface.kind === 'attachment_zone'),
    }));
  const semanticPlanHouseLines = rawSemanticPlanHouseLines.map((line) => ({
    ...line,
    start: planHousePointProjector(line.line.start),
    end: planHousePointProjector(line.line.end),
    emphasized: selectedOpeningHostEdgeId !== null && line.metadata?.sourceEdgeId === selectedOpeningHostEdgeId,
  }));
  const objectWorkbenchOverlayShapes =
    presentation === 'model'
      ? visibleRawObjectWorkbenchOverlayShapes.map((shape) => ({
          ...shape,
          points: shape.polygon.map((point) => objectWorkbenchPointProjector(point)),
          detailSegments: (shape.detailSegments ?? []).map((segment) => ({
            start: objectWorkbenchPointProjector(segment.start),
            end: objectWorkbenchPointProjector(segment.end),
          })),
          deckInteraction: shape.deckInteraction
            ? {
                ...shape.deckInteraction,
                hostEdgeStart: objectWorkbenchPointProjector(shape.deckInteraction.hostEdgeStart),
                hostEdgeEnd: objectWorkbenchPointProjector(shape.deckInteraction.hostEdgeEnd),
              }
            : null,
          openingInteraction: shape.openingInteraction
            ? {
                ...shape.openingInteraction,
                hostEdgeStart: objectWorkbenchPointProjector(shape.openingInteraction.hostEdgeStart),
                hostEdgeEnd: objectWorkbenchPointProjector(shape.openingInteraction.hostEdgeEnd),
              }
            : null,
        }))
      : [];
  const renderObjectWorkbenchCommittedBodies = !useTopProjectionBackedPlan;
  const objectWorkbenchRenderedBodyCount = renderObjectWorkbenchCommittedBodies ? objectWorkbenchOverlayShapes.length : 0;
  const duplicateCommittedBodyCount = useTopProjectionBackedPlan ? objectWorkbenchRenderedBodyCount : 0;
  const objectWorkbenchPresetAnnotations =
    presentation === 'model'
      ? rawObjectWorkbenchPresetAnnotations
          .filter((annotation) => {
            switch (annotation.ownerKind) {
              case 'footprint':
                return familyVisibility.house;
              case 'deck':
                return familyVisibility.decks;
              case 'opening':
                return familyVisibility.openings;
              default:
                return true;
            }
          })
          .map((annotation) => ({
          ...annotation,
          witnessStart: objectWorkbenchPointProjector(annotation.witnessStart),
          witnessEnd: objectWorkbenchPointProjector(annotation.witnessEnd),
          lineStart: objectWorkbenchPointProjector(annotation.lineStart),
          lineEnd: objectWorkbenchPointProjector(annotation.lineEnd),
        }))
      : [];
  const objectWorkbenchCustomEdgeCandidates =
    presentation === 'model'
      ? rawObjectWorkbenchCustomEdgeCandidates
          .filter((annotation) => annotation.ownerKind === 'footprint' ? familyVisibility.house : familyVisibility.decks)
          .map((annotation) => ({
          ...annotation,
          witnessStart: objectWorkbenchPointProjector(annotation.witnessStart),
          witnessEnd: objectWorkbenchPointProjector(annotation.witnessEnd),
          lineStart: objectWorkbenchPointProjector(annotation.lineStart),
          lineEnd: objectWorkbenchPointProjector(annotation.lineEnd),
        }))
      : [];
  const objectWorkbenchPreviewShape =
    presentation === 'model' && rawObjectWorkbenchPreviewShape
      ? {
          ownerKind: rawObjectWorkbenchPreviewShape.ownerKind,
          ownerId: rawObjectWorkbenchPreviewShape.ownerId,
          points: rawObjectWorkbenchPreviewShape.polygon.map((point) => objectWorkbenchPointProjector(point)),
          bodyState: rawObjectWorkbenchPreviewShape.bodyState,
          anchorPoint: rawObjectWorkbenchPreviewShape.anchorPoint
            ? objectWorkbenchPointProjector(rawObjectWorkbenchPreviewShape.anchorPoint)
            : null,
          lockedCornerPoint: rawObjectWorkbenchPreviewShape.lockedCornerPoint
            ? objectWorkbenchPointProjector(rawObjectWorkbenchPreviewShape.lockedCornerPoint)
            : null,
          endCatchPoint: rawObjectWorkbenchPreviewShape.endCatchPoint
            ? objectWorkbenchPointProjector(rawObjectWorkbenchPreviewShape.endCatchPoint)
            : null,
          referenceGuide: rawObjectWorkbenchPreviewShape.referenceGuide
            ? {
                start: objectWorkbenchPointProjector(rawObjectWorkbenchPreviewShape.referenceGuide.start),
                end: objectWorkbenchPointProjector(rawObjectWorkbenchPreviewShape.referenceGuide.end),
                state: rawObjectWorkbenchPreviewShape.referenceGuide.state,
              }
            : null,
          targetHighlights: rawObjectWorkbenchPreviewShape.targetHighlights.map((targetHighlight) => ({
            start: objectWorkbenchPointProjector(targetHighlight.start),
            end: objectWorkbenchPointProjector(targetHighlight.end),
            state: targetHighlight.state,
          })),
        }
      : null;
  const hasSemanticPlanHouseContext =
    familyVisibility.house &&
    !customPolygonOverrideActive &&
    !hideHouseFootprint &&
    (semanticPlanHouseSurfaces.length > 0 || semanticPlanHouseLines.length > 0);

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
  const resizeEdgeSpecs = footprintCanvasLayout?.resizeEdges ?? [];
  const highlightedValueSpec =
    editorSurface !== 'card'
      ? resizeEdgeSpecs.find((edge) => edge.id === (footprintEditor?.activeHandleId ?? footprintEditor?.hoveredHandleId))
      : handleSpecs.find((handle) => handle.id === (footprintEditor?.activeHandleId ?? footprintEditor?.hoveredHandleId));
  const activeEdgeTagPoint = rotatePointQuarterTurns(
    pointOnAttachmentFrame(footprintFrame, footprintFrame.length / 2, -1.9),
    rotationFrame.center,
    rotationFrame.turns,
  );
  const activeEdgeTagLabel = editorSurface === 'card' && isEditingFootprint ? 'Attached edge' : null;
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
  const planFallGap = isSheet ? fallGap - 0.55 : layout.fallGap;
  const fallAnchor =
    attachmentSide === 'rear' || attachmentSide === 'front'
      ? attachmentFrameForRect('right', {
          x: x + Math.max(aW, bW) + planFallGap,
          y,
          width: 0,
          height: isHipCorner ? aH + bH : aH,
        })
      : attachmentFrameForRect('front', { x, y: (isHipCorner ? bottomY : y + aH) + planFallGap, width: aW, height: 0 });
  const fallStart = pointOnAttachmentFrame(fallAnchor, isSheet ? 1.5 : 1, 0);
  const fallEnd = pointOnAttachmentFrame(fallAnchor, Math.max(isSheet ? 1.5 : 1, fallAnchor.length - (isSheet ? 1.5 : 1)), 0);
  const fallLabelPoint = pointOnAttachmentFrame(fallAnchor, fallAnchor.length / 2, fallIsHorizontal ? (isSheet ? 0.8 : 2.2) : (isSheet ? 0.62 : 2.3));
  const dimensionOffsets = isSheet
    ? { bottom: 7.8, secondary: 5.4, tertiary: 6.15, side: 5.6, hipSide: 5.9 }
    : { bottom: 7.1, secondary: 5.1, tertiary: 5.8, side: 7.0, hipSide: 7.2 };

  const dimBaseY = isModel ? bottomY + dimensionOffsets.bottom : Math.min(87.4, bottomY + dimensionOffsets.bottom);
  const secondaryDimY = isModel ? dimBaseY + dimensionOffsets.secondary : Math.min(88.5, dimBaseY + dimensionOffsets.secondary);
  const rafterDimY = isModel ? dimBaseY + dimensionOffsets.tertiary : Math.min(88.9, dimBaseY + dimensionOffsets.tertiary);
  const yTopInner = y + topFrameW;
  const yBottomInner = y + aH - gutterW;
  const sheetFallAnnotationSpec = isSheet
    ? buildPlanFallAnnotationSpec({
        model,
        attachmentSide,
        isHipCorner,
        isGableLike,
        baseX: x,
        baseY: y,
        aW,
        aH,
        bW,
        bH,
        bottomY: isHipCorner ? bottomY : y + aH,
        fallGap,
        rotationCenter: rotationFrame.center,
        rotationTurns: rotationFrame.turns,
        isSheet,
      })
    : null;
  const sheetSpacingAnnotationSpec = isSheet
    ? buildPlanRafterSpacingAnnotationSpec({
        rafterXsA,
        interiorRafterXsA,
        splitY,
        gutterW,
        yBottomInner,
        rafterDimY,
        isHipCorner,
        rotationCenter: rotationFrame.center,
        rotationTurns: rotationFrame.turns,
        label: `${formatMetres(model.rafterSpacingA)} c/c`,
      })
    : null;
  const sheetInternalAngleAnnotationSpec =
    isSheet && model.boxPerimeterEnabled
      ? buildPlanInternalAngleAnnotationSpec({
          centerX,
          centerY,
          baseY: y,
          bottomY,
          aH,
          isHipCorner,
          rotationCenter: rotationFrame.center,
          rotationTurns: rotationFrame.turns,
        })
      : null;
  const overhangFrameDepth = isHipCorner ? bH : aH;
  const overhangDepth = model.overhangEnabled
    ? Math.min(Math.max(0, model.overhangAmountM * scale), Math.max(0, overhangFrameDepth - topFrameW - gutterW))
    : 0;
  const overhangY = isHipCorner ? bottomY - overhangDepth : y + aH - overhangDepth;
  const overhangWidth = Math.max(0, (isHipCorner ? bW : aW) - sideFrameW * 2);
  const overhangX = x + sideFrameW;
  const highlightedHandleLabel = highlightedValueSpec ? `${highlightedValueSpec.label}: ${formatMetres(highlightedValueSpec.valueM)}` : null;
  const highlightedHandleLabelWidth = highlightedHandleLabel ? Math.max(16, highlightedHandleLabel.length * 0.56 + 2.8) : 0;
  const highlightedHandleLabelX =
    highlightedValueSpec && highlightedHandleLabel
      ? clamp(highlightedValueSpec.pointRoot.x + 2.8, 1.4, 118 - highlightedHandleLabelWidth)
      : 0;
  const highlightedHandleLabelY = highlightedValueSpec ? clamp(highlightedValueSpec.pointRoot.y - 4.8, 4.5, 84) : 0;
  const rotatedPrimaryPoints =
    rotationFrame.turns === 0 ? primaryPoints : rotatePointsQuarterTurns(primaryPoints, rotationFrame.center, rotationFrame.turns);
  const rotatedPrimaryBounds = boundsFromPoints(rotatedPrimaryPoints);
  const rotatedHousePoints =
    rotationFrame.turns === 0 ? effectiveHousePolygon : rotatePointsQuarterTurns(effectiveHousePolygon, rotationFrame.center, rotationFrame.turns);
  const rotatedHouseBounds = showHouseFootprint ? boundsFromPoints(rotatedHousePoints) : null;
  const showHousePopover = isSheetFootprintEditor && Boolean(footprintEditor?.isContextHovered);
  const showFootprintControls =
    canEditFootprint &&
    !isDrawOutlineDraftOpen &&
    (editorSurface === 'sheet' ? Boolean(footprintEditor?.isEditing) : editorSurface === 'model' ? true : isEditingFootprint);
  const showPergolaPopover = isSheet && Boolean(sheetPlanInteraction?.isPergolaPopoverOpen) && !showHousePopover;
  const showHouseHoverTarget = (isSheetFootprintEditor || isModelFootprintEditor) && showHouseFootprint && !isDrawOutlineDraftOpen;
  const showPergolaHoverTarget = isSheet && Boolean(sheetPlanInteraction?.onPergolaHoverChange) && !isHipCorner;
  const showPergolaSelectionHitTarget =
    !isSheet && canRenderPergolaPlanGeometry && Boolean(onPergolaSelect) && Boolean(currentPergolaId);
  const showHouseHoverState =
    (isSheetFootprintEditor && (Boolean(footprintEditor?.isEditing) || showHousePopover)) ||
    (isModelFootprintEditor &&
      (Boolean(footprintEditor?.isContextHovered) || Boolean(footprintEditor?.hoveredHandleId) || Boolean(footprintEditor?.activeHandleId)));
  const showHouseLabel = showHouseFootprint && !showFootprintControls && !isSheetFootprintEditor && !isModelFootprintEditor;
  const renderLegacyHouseContext =
    showHouseFootprint &&
    (!useTopProjectionBackedPlan || Boolean(footprintEditor?.isEditing) || customPolygonOverrideActive || isDrawOutlineDraftOpen);
  const isMergedHouseModelDisplay = isModel && displayMode === 'house';
  const allowPergolaModelEditing = !isSheet && canRenderPergolaPlanGeometry && !isMergedHouseModelDisplay;
  const showPinnedSheetPrimaryDimensions = isSheet && !isHipCorner;
  const showModelPrimaryDimensions = !isSheet && canRenderPergolaPlanGeometry;
  const showModelSecondaryAnnotations = !isSheet && !isModel;
  const showPlanResizeHandles = isModel && allowPergolaModelEditing && Boolean(planInteraction?.available) && !isHipCorner;
  const primaryDimensionSwap = showPinnedSheetPrimaryDimensions && rotationFrame.turns % 2 !== 0;
  const bottomDimensionLabel = formatMetres(primaryDimensionSwap ? model.spanA : model.lengthA);
  const leftDimensionLabel = formatMetres(primaryDimensionSwap ? model.lengthA : model.spanA);
  const bottomDimensionField = interactiveFields?.[primaryDimensionSwap ? 'plan:spanA' : 'plan:lengthA'];
  const leftDimensionField = interactiveFields?.[primaryDimensionSwap ? 'plan:lengthA' : 'plan:spanA'];
  const pinnedBottomDimensionY = isModel ? rotatedPrimaryBounds.maxY + dimensionOffsets.bottom : Math.min(87.4, rotatedPrimaryBounds.maxY + dimensionOffsets.bottom);
  const pinnedLeftDimensionX = rotatedPrimaryBounds.minX - dimensionOffsets.side;
  const housePopoverStyle =
    rotatedHouseBounds
      ? {
          left: `${(clamp((rotatedHouseBounds.minX + rotatedHouseBounds.maxX) / 2, 8, 112) / 120) * 100}%`,
          top: `${(clamp(rotatedHouseBounds.minY + 1.1, 8, 80) / 90) * 100}%`,
        }
      : undefined;
  const pergolaPopoverStyle = {
    left: `${(clamp((rotatedPrimaryBounds.minX + rotatedPrimaryBounds.maxX) / 2, 8, 112) / 120) * 100}%`,
    top: `${(clamp(rotatedPrimaryBounds.minY + 1.1, 8, 80) / 90) * 100}%`,
  };
  const rawPlanResizeHandles = showPlanResizeHandles
    ? [
        {
          fieldId: 'plan:lengthA' as const,
          start: { x: x + aW * 0.28, y: y + aH + 2.2 },
          end: { x: x + aW * 0.72, y: y + aH + 2.2 },
          guideFrom: { x: centerX, y: y + aH },
          guideTo: { x: centerX, y: y + aH + 2.2 },
          minValueM: 0.001,
          maxValueM: Number.POSITIVE_INFINITY,
        },
        {
          fieldId: 'plan:spanA' as const,
          start: { x: x - 2.2, y: y + aH * 0.28 },
          end: { x: x - 2.2, y: y + aH * 0.72 },
          guideFrom: { x, y: centerY },
          guideTo: { x: x - 2.2, y: centerY },
          minValueM: 0.001,
          maxValueM: Number.POSITIVE_INFINITY,
        },
      ]
    : [];
  const planResizeHandles = rawPlanResizeHandles.map((handle) => {
    const rootStart = rotatePointQuarterTurns(handle.start, rotationFrame.center, rotationFrame.turns);
    const rootEnd = rotatePointQuarterTurns(handle.end, rotationFrame.center, rotationFrame.turns);
    const axisDx = rootEnd.x - rootStart.x;
    const axisDy = rootEnd.y - rootStart.y;
    const axisLength = Math.max(0.001, Math.hypot(axisDx, axisDy));
    return {
      ...handle,
      rootStart,
      rootEnd,
      axisX: axisDx / axisLength,
      axisY: axisDy / axisLength,
    };
  });
  const resolvePlanClientPoint = (svg: SVGSVGElement, clientX: number, clientY: number): ModuleFootprintCanvasPoint | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = clientX;
    svgPoint.y = clientY;
    const rootPoint = svgPoint.matrixTransform(ctm.inverse());
    const resolved = resolvePlanSvgPointerFootprintPoint({
      rootPoint,
      rotationCenter: rotationFrame.center,
      rotationTurns: rotationFrame.turns,
      footprintRect,
      scale,
      attachmentSide,
      lengthA: model.lengthA,
      spanA: model.spanA,
      houseFootprintPreset: model.houseFootprintPreset,
      houseFootprintParams: model.houseFootprintParams,
      isHipCorner,
    });
    return resolved
      ? {
          alongM: resolved.formatted.alongM,
          depthM: resolved.formatted.depthM,
          numericAlongM: resolved.numeric.alongM,
          numericDepthM: resolved.numeric.depthM,
      }
      : null;
  };
  const resolveRawPlanClientPoint = (svg: SVGSVGElement, clientX: number, clientY: number): PlanPoint | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm || !Number.isFinite(scale) || scale <= 0) return null;
    const svgPoint = svg.createSVGPoint();
    svgPoint.x = clientX;
    svgPoint.y = clientY;
    const rootPoint = svgPoint.matrixTransform(ctm.inverse());
    const unrotatedPoint = rotatePointQuarterTurns(rootPoint, rotationFrame.center, -rotationFrame.turns);
    const projectedX = (unrotatedPoint.x - x) / scale;
    const projectedY = (unrotatedPoint.y - y) / scale;
    if (!Number.isFinite(projectedX) || !Number.isFinite(projectedY)) return null;
    return {
      x: projectedX,
      y: projectedY,
    };
  };
  const planSvgRef = useRef<SVGSVGElement | null>(null);
  const footprintEditorRef = useRef(footprintEditor);
  const planInteractionRef = useRef(planInteraction);
  const resolvePlanClientPointRef = useRef(resolvePlanClientPoint);
  const resolveRawPlanClientPointRef = useRef(resolveRawPlanClientPoint);

  useEffect(() => {
    footprintEditorRef.current = footprintEditor;
    planInteractionRef.current = planInteraction;
    resolvePlanClientPointRef.current = resolvePlanClientPoint;
    resolveRawPlanClientPointRef.current = resolveRawPlanClientPoint;
  }, [
    footprintEditor,
    planInteraction,
    resolvePlanClientPoint,
    resolveRawPlanClientPoint,
  ]);

  const syncPlanSvgBridge = useCallback((node: SVGSVGElement | null) => {
    const currentFootprintEditor = footprintEditorRef.current;
    const currentPlanInteraction = planInteractionRef.current;
    currentFootprintEditor?.onSvgMount?.(node);
    currentPlanInteraction?.onSvgMount?.(node);
    currentFootprintEditor?.onCanvasPointResolverChange?.(
      node ? (clientX, clientY) => resolvePlanClientPointRef.current(node, clientX, clientY) : null,
    );
    currentPlanInteraction?.onPlanPointResolverChange?.(
      node ? (clientX, clientY) => resolveRawPlanClientPointRef.current(node, clientX, clientY) : null,
    );
    currentPlanInteraction?.onDeckDragPointResolverChange?.(
      node ? (clientX, clientY) => resolveRawPlanClientPointRef.current(node, clientX, clientY) : null,
    );
  }, []);

  const handlePlanSvgRef = useCallback((node: SVGSVGElement | null) => {
    planSvgRef.current = node;
    syncPlanSvgBridge(node);
  }, [syncPlanSvgBridge]);

  const handlePlanCanvasClick = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (event.target !== event.currentTarget) return;
      onCanvasSelect?.();
    },
    [onCanvasSelect],
  );

  useEffect(() => {
    syncPlanSvgBridge(planSvgRef.current);
  }, [syncPlanSvgBridge, footprintEditor, planInteraction, resolvePlanClientPoint, resolveRawPlanClientPoint]);

  const resolvePlanSvgPointerPoint = (event: ReactPointerEvent<SVGSVGElement>): ModuleFootprintCanvasPoint | null =>
    resolvePlanClientPoint(event.currentTarget, event.clientX, event.clientY);
  const handlePlanSvgPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if ((!footprintEditor?.onCanvasPointSelect && !footprintEditor?.onCanvasPointPointerDown) || event.button !== 0) return;
    const point = resolvePlanSvgPointerPoint(event);
    if (!point) return;
    event.preventDefault();
    if (footprintEditor.onCanvasPointPointerDown) {
      footprintEditor.onCanvasPointPointerDown(point, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }
    footprintEditor.onCanvasPointSelect?.(point);
  };
  const handlePlanSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!footprintEditor?.onCanvasPointHover) return;
    footprintEditor.onCanvasPointHover(resolvePlanSvgPointerPoint(event));
  };

  return (
    <>
      <svg
        viewBox={modelSpaceLayout?.viewBoxValue ?? '0 0 120 90'}
        width={modelSpaceLayout?.svgWidthPx}
        height={modelSpaceLayout?.svgHeightPx}
        overflow={isModel ? 'visible' : undefined}
        style={modelSvgStyle}
        data-model-space-svg={isModel ? 'plan' : undefined}
        data-model-space-view-box={modelSpaceLayout?.viewBoxValue}
        data-model-space-world-box={modelSpaceLayout?.worldBoxValue}
        data-model-space-focus-box={modelSpaceLayout?.focusBoxValue}
        data-plan-render-source={exposesPlanProjectionDiagnostics ? modelSpacePergolaRenderSource : 'legacy'}
        data-plan-render-status={exposesPlanProjectionDiagnostics ? modelSpacePergolaRenderStatus : 'legacy_unsupported_family'}
        data-top-projection-parity-status={exposesPlanProjectionDiagnostics && topProjectionParityStatus ? topProjectionParityStatus : undefined}
        data-top-projection-screen-axis={exposesPlanProjectionDiagnostics ? topProjectionScreenAxis ?? undefined : undefined}
        data-top-projection-top-visible-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionTopVisibleCount : undefined}
        data-top-projection-context-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionContextCount : undefined}
        data-top-projection-hidden-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionHiddenCount : undefined}
        data-top-projection-rendered-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionShapes.length : undefined}
        data-top-projection-hidden-rendered-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionHiddenRenderedCount : undefined}
        data-plan-committed-top-projection-body-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? topProjectionShapes.length : undefined}
        data-plan-object-overlay-body-count={exposesPlanProjectionDiagnostics ? objectWorkbenchRenderedBodyCount : undefined}
        data-plan-duplicate-visual-body-count={exposesPlanProjectionDiagnostics ? duplicateCommittedBodyCount : undefined}
        role="img"
        aria-label="Module plan view"
        ref={handlePlanSvgRef}
        onClick={handlePlanCanvasClick}
        onPointerDown={handlePlanSvgPointerDown}
        onPointerMove={handlePlanSvgPointerMove}
        onPointerLeave={() => footprintEditor?.onCanvasPointHover?.(null)}
        className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
          presentation === 'sheet' ? styles.modulePlanSvgSheet : ''
        } ${isModel ? styles.modulePlanSvgModel : ''} ${isSheetFootprintEditor ? styles.modulePlanSvgSheetFootprint : ''} ${
          showHousePopover ? styles.modulePlanSvgSheetFootprintHover : ''
        } ${showFootprintControls && isSheetFootprintEditor ? styles.modulePlanSvgSheetFootprintEditing : ''} ${
          showPergolaPopover ? styles.modulePlanSvgSheetPergolaHover : ''
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
      {modelSpaceLayout ? <FocusTarget rect={modelSpaceLayout.focusBox} /> : null}

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
          {hasSemanticPlanHouseContext
            ? semanticPlanHouseSurfaces.map((surface) => (
                <polygon
                  key={surface.id}
                  points={toPointsAttr(surface.points)}
                  className={
                    surface.toned
                      ? `${planHouseSurfaceClass(surface.kind)} ${styles.modulePlanHouseSurfaceToned}`
                      : planHouseSurfaceClass(surface.kind)
                  }
                  data-house-plan-surface={surface.kind}
                  data-house-plan-surface-id={surface.id}
                />
              ))
            : null}
          {hasSemanticPlanHouseContext
            ? semanticPlanHouseLines.map((line) => (
                <line
                  key={line.id}
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  className={
                    line.emphasized
                      ? `${planHouseLineClass(line.kind)} ${styles.modulePlanHouseLineEmphasized}`
                      : planHouseLineClass(line.kind)
                  }
                  data-house-plan-line={line.kind}
                />
              ))
            : null}
          {renderLegacyHouseContext && !hasSemanticPlanHouseContext ? (
            <polygon
              points={toPointsAttr(effectiveHousePolygon)}
              fill={`url(#${hatchId})`}
              className={`${styles.moduleHouseHatch} ${isSheetFootprintEditor ? styles.moduleHouseHatchSheetContext : ''} ${
                showHouseHoverState ? styles.moduleHouseHatchSheetHover : ''
              } ${showFootprintControls && isSheetFootprintEditor ? styles.moduleHouseHatchSheetEditing : ''}`}
            />
          ) : null}
          {showHouseHoverTarget ? (
            <polygon
              points={toPointsAttr(effectiveHousePolygon)}
              className={styles.moduleHouseContextHit}
              data-sheet-hover-target="house"
              onPointerEnter={() => footprintEditor?.onContextHoverChange?.(true)}
              onPointerLeave={() => footprintEditor?.onContextHoverChange?.(false)}
            />
          ) : null}
          {showHouseLabel ? (
            <text x={houseLabel.x} y={houseLabel.y} textAnchor="middle" dominantBaseline="middle" className={styles.moduleHouseLabel}>
              House side
            </text>
          ) : null}
        </g>
        {model.houseConnectionType === 'facade' && !hasSemanticPlanHouseContext && !useTopProjectionBackedPlan ? (
          <line x1={footprintFrame.start.x} y1={footprintFrame.start.y} x2={footprintFrame.end.x} y2={footprintFrame.end.y} className={styles.modulePlanHouseWall} />
        ) : null}
        {model.houseConnectionType === 'fascia' && !hasSemanticPlanHouseContext && !useTopProjectionBackedPlan ? (
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

        {useTopProjectionBackedPlan
          ? topProjectionShapes
              .filter(({ shape }) => !(shape.family === 'house' && shape.kind === 'footprint' && (hideHouseFootprint || customPolygonOverrideActive)))
              .map(({ shape, points }) => (
              <polygon
                key={shape.id}
                points={toPointsAttr(points)}
                className={topProjectionShapeClass(shape)}
                data-plan-top-projection-shape={shape.id}
                data-top-projection-source-object-id={shape.sourceObjectId}
                data-top-projection-source-id={shape.sourceId ?? ''}
                data-top-projection-source-type={shape.sourceType}
                data-top-projection-family={shape.family}
                data-top-projection-kind={shape.kind}
                data-top-projection-role={topProjectionRole(shape)}
                data-top-projection-z-min={shape.zMin ?? ''}
                data-top-projection-z-max={shape.zMax ?? ''}
                data-top-projection-screen-axis={
                  modelSpaceTopProjection
                    ? `${modelSpaceTopProjection.screenAxis.x}_${modelSpaceTopProjection.screenAxis.y}`
                    : undefined
                }
                data-house-plan-surface={shape.family === 'house' && shape.kind !== 'gutter' && shape.kind !== 'roof_feature' ? shape.kind : undefined}
                data-house-plan-line={shape.family === 'house' && (shape.kind === 'gutter' || shape.kind === 'roof_feature' || shape.kind === 'attachment_target') ? shape.kind : undefined}
                data-plan-primary-fill={shape.family === 'pergola' && shape.kind === 'roof_plane' ? 'true' : undefined}
                data-plan-geometry-surface={shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding') ? shape.kind : undefined}
                data-plan-surface-id={shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding') ? shape.sourceId ?? shape.sourceObjectId : undefined}
                data-plan-member-id={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.sourceId ?? shape.sourceObjectId : undefined}
                data-plan-member-role={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.kind : undefined}
                data-plan-member-centerline-mm={typeof shape.metadata?.centerlineMm === 'string' ? shape.metadata.centerlineMm : undefined}
              />
            ))
          : null}

        {useTopProjectionBackedPlan && showPergolaGeometry && geometryAttachmentEdge ? (
          <line
            x1={geometryAttachmentEdge.start.x}
            y1={geometryAttachmentEdge.start.y}
            x2={geometryAttachmentEdge.end.x}
            y2={geometryAttachmentEdge.end.y}
            className={styles.modulePlanHouseWall}
            data-plan-attachment-edge="geometry"
            data-house-plan-line="attachment_target"
          />
        ) : null}
        {useTopProjectionBackedPlan && showPergolaGeometry && geometryFallAnchor ? (
          (() => {
            const fallLineLength = Math.max(4.8, scale * 0.72);
            const halfLength = geometryFallAnchor.dual ? fallLineLength / 2 : fallLineLength * 0.35;
            const start = {
              x: geometryFallAnchor.point.x - geometryFallAnchor.direction.x * halfLength,
              y: geometryFallAnchor.point.y - geometryFallAnchor.direction.y * halfLength,
            };
            const end = {
              x: geometryFallAnchor.point.x + geometryFallAnchor.direction.x * halfLength,
              y: geometryFallAnchor.point.y + geometryFallAnchor.direction.y * halfLength,
            };
            const labelPoint = {
              x: geometryFallAnchor.point.x + (Math.abs(geometryFallAnchor.direction.x) >= Math.abs(geometryFallAnchor.direction.y) ? 0 : 2.2),
              y: geometryFallAnchor.point.y + (Math.abs(geometryFallAnchor.direction.x) >= Math.abs(geometryFallAnchor.direction.y) ? -2.2 : 0),
            };
            const arrowDirection = geometryFallDirectionToCardinal(geometryFallAnchor.direction);
            const reverseArrowDirection =
              arrowDirection === 'up'
                ? 'down'
                : arrowDirection === 'down'
                  ? 'up'
                  : arrowDirection === 'left'
                    ? 'right'
                    : 'left';

            return (
              <>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  className={styles.moduleFallLine}
                  data-plan-fall-direction={`${geometryFallAnchor.direction.x},${geometryFallAnchor.direction.y}`}
                />
                {geometryFallAnchor.dual ? (
                  <>
                    <ArrowHead x={start.x} y={start.y} direction={reverseArrowDirection} presentation={presentation} />
                    <ArrowHead x={end.x} y={end.y} direction={arrowDirection} presentation={presentation} />
                    <text x={labelPoint.x} y={labelPoint.y} className={styles.moduleFallLabel}>
                      fall both sides
                    </text>
                  </>
                ) : (
                  <>
                    <ArrowHead x={end.x} y={end.y} direction={arrowDirection} presentation={presentation} />
                    <text x={labelPoint.x} y={labelPoint.y} className={styles.moduleFallLabel}>
                      fall
                    </text>
                  </>
                )}
              </>
            );
          })()
        ) : null}

        {canRenderPergolaPlanGeometry && !useTopProjectionBackedPlan ? (
          useGeometryBackedPergola ? (
            <>
              <polygon
                points={toPointsAttr(geometryOutlinePoints)}
                className={styles.modulePlanFill}
                data-plan-primary-fill="true"
                data-plan-geometry-outline="true"
              />
              {geometryRoofPlaneSurfaces.map((surface) => (
                <polygon
                  key={surface.id}
                  points={toPointsAttr(surface.points)}
                  className={styles.modulePlanPrimaryZone}
                  data-plan-geometry-surface={surface.kind}
                  data-plan-surface-id={surface.id}
                />
              ))}
              {geometryRoofCladdingSurfaces.map((surface) => (
                <polygon
                  key={surface.id}
                  points={toPointsAttr(surface.points)}
                  className={styles.modulePlanBoxInset}
                  data-plan-geometry-surface={surface.kind}
                  data-plan-surface-id={surface.id}
                />
              ))}
              {geometryPergolaStripMembers.map(({ member, footprint, className, outlineClassName }) => (
                <g
                  key={member.id}
                  data-plan-member-id={member.id}
                  data-plan-member-role={member.role}
                  data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`}
                >
                  <polygon points={toPointsAttr(footprint)} className={className} />
                  <polygon points={toPointsAttr(footprint)} className={outlineClassName} />
                </g>
              ))}
              {geometryRafterMembers.map(({ member, footprint }) => (
                <polygon
                  key={member.id}
                  points={toPointsAttr(footprint)}
                  className={styles.modulePlanRafter}
                  data-plan-member-id={member.id}
                  data-plan-member-role={member.role}
                  data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`}
                />
              ))}
              {geometryRidgeMembers.map(({ member, footprint }) => (
                <polygon
                  key={member.id}
                  points={toPointsAttr(footprint)}
                  className={styles.modulePlanRidgeBand}
                  data-plan-member-id={member.id}
                  data-plan-member-role={member.role}
                  data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`}
                />
              ))}
              <polygon points={toPointsAttr(geometryOutlinePoints)} className={styles.modulePlanPerimeter} />
              {geometryAttachmentEdge ? (
                <line
                  x1={geometryAttachmentEdge.start.x}
                  y1={geometryAttachmentEdge.start.y}
                  x2={geometryAttachmentEdge.end.x}
                  y2={geometryAttachmentEdge.end.y}
                  className={styles.modulePlanHouseWall}
                  data-plan-attachment-edge="geometry"
                  data-house-plan-line="attachment_target"
                />
              ) : null}
              {geometryFallAnchor ? (
                (() => {
                  const fallLineLength = Math.max(4.8, scale * 0.72);
                  const halfLength = geometryFallAnchor.dual ? fallLineLength / 2 : fallLineLength * 0.35;
                  const start = {
                    x: geometryFallAnchor.point.x - geometryFallAnchor.direction.x * halfLength,
                    y: geometryFallAnchor.point.y - geometryFallAnchor.direction.y * halfLength,
                  };
                  const end = {
                    x: geometryFallAnchor.point.x + geometryFallAnchor.direction.x * halfLength,
                    y: geometryFallAnchor.point.y + geometryFallAnchor.direction.y * halfLength,
                  };
                  const labelPoint = {
                    x: geometryFallAnchor.point.x + (Math.abs(geometryFallAnchor.direction.x) >= Math.abs(geometryFallAnchor.direction.y) ? 0 : 2.2),
                    y: geometryFallAnchor.point.y + (Math.abs(geometryFallAnchor.direction.x) >= Math.abs(geometryFallAnchor.direction.y) ? -2.2 : 0),
                  };
                  const arrowDirection = geometryFallDirectionToCardinal(geometryFallAnchor.direction);
                  const reverseArrowDirection =
                    arrowDirection === 'up'
                      ? 'down'
                      : arrowDirection === 'down'
                        ? 'up'
                        : arrowDirection === 'left'
                          ? 'right'
                          : 'left';

                  return (
                    <>
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        className={styles.moduleFallLine}
                        data-plan-fall-direction={`${geometryFallAnchor.direction.x},${geometryFallAnchor.direction.y}`}
                      />
                      {geometryFallAnchor.dual ? (
                        <>
                          <ArrowHead x={start.x} y={start.y} direction={reverseArrowDirection} presentation={presentation} />
                          <ArrowHead x={end.x} y={end.y} direction={arrowDirection} presentation={presentation} />
                          <text x={labelPoint.x} y={labelPoint.y} className={styles.moduleFallLabel}>
                            fall both sides
                          </text>
                        </>
                      ) : (
                        <>
                          <ArrowHead x={end.x} y={end.y} direction={arrowDirection} presentation={presentation} />
                          <text x={labelPoint.x} y={labelPoint.y} className={styles.moduleFallLabel}>
                            fall
                          </text>
                        </>
                      )}
                    </>
                  );
                })()
              ) : null}
            </>
          ) : !isModel ? (
            <>
              <polygon points={toPointsAttr(primaryPoints)} className={styles.modulePlanFill} data-plan-primary-fill="true" />
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

              {model.houseConnectionType === 'soffit' && soffitXs.length > 0 && !hasSemanticPlanHouseContext ? (
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
              {model.boxPerimeterEnabled && showModelSecondaryAnnotations ? (
                <>
                  <line x1={centerX} y1={y + 2.8} x2={centerX} y2={(isHipCorner ? bottomY : y + aH) - 2.8} className={styles.modulePlanInternalAngle} />
                  <text x={centerX + 2.5} y={centerY + 0.5} className={styles.modulePlanAngleText}>
                    internal roof angle
                  </text>
                </>
              ) : null}

              {showModelSecondaryAnnotations ? <line x1={fallStart.x} y1={fallStart.y} x2={fallEnd.x} y2={fallEnd.y} className={styles.moduleFallLine} /> : null}
              {showModelSecondaryAnnotations && isGableLike ? (
                <>
                  <ArrowHead x={fallStart.x} y={fallStart.y} direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : 'up'} presentation={presentation} />
                  <ArrowHead x={fallEnd.x} y={fallEnd.y} direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'right' : 'left') : 'down'} presentation={presentation} />
                  <text x={fallLabelPoint.x} y={fallLabelPoint.y} className={`${styles.moduleFallLabel} ${isSheet ? styles.moduleFallLabelSheet : ''}`}>
                    fall both sides
                  </text>
                </>
              ) : showModelSecondaryAnnotations ? (
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
              ) : null}
            </>
          ) : null
        ) : null}

        {renderObjectWorkbenchPlanOverlay({
          shapes: objectWorkbenchOverlayShapes,
          renderCommittedBodies: renderObjectWorkbenchCommittedBodies,
          previewShape: objectWorkbenchPreviewShape,
          customEdgeCandidates: objectWorkbenchCustomEdgeCandidates,
          presetAnnotations: objectWorkbenchPresetAnnotations,
          activeCustomEdgeId: activeObjectWorkbenchCustomEdgeId ?? null,
          hoveredDeckId: hoveredObjectWorkbenchDeckId ?? null,
          onDeckHoverChange: onObjectWorkbenchDeckHoverChange,
          onShapeSelect: onObjectWorkbenchShapeSelect,
          onShapeDragStart: onObjectWorkbenchShapeDragStart,
          onCustomEdgeSelect: onObjectWorkbenchCustomEdgeSelect,
          onDimensionActivate: onObjectWorkbenchDimensionActivate,
        })}

        {showPergolaSelectionHitTarget && currentPergolaId ? (
          <polygon
            points={toPointsAttr(
              useTopProjectionBackedPlan && topProjectionPergolaHitPoints.length > 0
                ? topProjectionPergolaHitPoints
                : useGeometryBackedPergola && geometryOutlinePoints.length > 0
                  ? geometryOutlinePoints
                  : primaryPoints,
            )}
            className={styles.modulePergolaContextHit}
            data-pergola-shape-hit={currentPergolaId}
            data-pergola-shape-hit-source={useTopProjectionBackedPlan ? 'top_projection' : useGeometryBackedPergola ? 'geometry' : 'legacy'}
            onClick={() => onPergolaSelect?.(currentPergolaId)}
          />
        ) : null}

        {showPergolaHoverTarget ? (
          <polygon
            points={toPointsAttr(useTopProjectionBackedPlan && topProjectionPergolaHitPoints.length > 0 ? topProjectionPergolaHitPoints : primaryPoints)}
            className={styles.modulePergolaContextHit}
            data-sheet-hover-target="pergola"
            onPointerEnter={() => sheetPlanInteraction?.onPergolaHoverChange?.(true)}
            onPointerLeave={() => sheetPlanInteraction?.onPergolaHoverChange?.(false)}
          />
        ) : null}

        {planResizeHandles.map((handle) => {
          const isActiveHandle = handle.fieldId === planInteraction?.activeResizeFieldId;
          const isHoveredHandle = handle.fieldId === planInteraction?.hoveredResizeFieldId;
          return (
            <g key={`plan-resize-${handle.fieldId}`}>
              <line
                x1={handle.guideFrom.x}
                y1={handle.guideFrom.y}
                x2={handle.guideTo.x}
                y2={handle.guideTo.y}
                className={isActiveHandle ? `${styles.moduleFootprintGuide} ${styles.moduleFootprintGuideActive}` : styles.moduleFootprintGuide}
              />
              <line
                x1={handle.start.x}
                y1={handle.start.y}
                x2={handle.end.x}
                y2={handle.end.y}
                data-plan-resize-handle={handle.fieldId}
                className={
                  isActiveHandle
                    ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeActive}`
                    : isHoveredHandle
                      ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeHover}`
                      : styles.moduleFootprintResizeEdge
                }
              />
              <line
                x1={handle.start.x}
                y1={handle.start.y}
                x2={handle.end.x}
                y2={handle.end.y}
                data-plan-resize-handle-hit={handle.fieldId}
                className={styles.moduleFootprintResizeEdgeHit}
                onPointerEnter={() => planInteraction?.onResizeFieldHover(handle.fieldId)}
                onPointerLeave={() => planInteraction?.onResizeFieldHover(null)}
                onPointerDown={(event: ReactPointerEvent<SVGLineElement>) => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  event.stopPropagation();
                  planInteraction?.onResizeFieldDragStart(
                    {
                      fieldId: handle.fieldId,
                      axisX: handle.axisX,
                      axisY: handle.axisY,
                      scale,
                      deltaMultiplier: 1,
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
        })}

        {showPinnedSheetPrimaryDimensions || !showModelPrimaryDimensions ? null : (
          <g data-plan-primary-dim="bottom">
            <line x1={x} y1={isHipCorner ? bottomY : y + aH} x2={x} y2={dimBaseY} className={styles.moduleDimWitness} />
            <line x1={x + aW} y1={isHipCorner ? splitY : y + aH} x2={x + aW} y2={dimBaseY} className={styles.moduleDimWitness} />
            <TickDimension
              x1={x}
              y1={dimBaseY}
              x2={x + aW}
              y2={dimBaseY}
              label={formatMetres(model.lengthA)}
              presentation={presentation}
              interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:lengthA'] : undefined}
            />
          </g>
        )}

        {showPinnedSheetPrimaryDimensions || !showModelPrimaryDimensions ? null : (
          <g data-plan-primary-dim="left">
            <line x1={x} y1={y} x2={x - dimensionOffsets.side} y2={y} className={styles.moduleDimWitness} />
            <line x1={x} y1={y + aH} x2={x - dimensionOffsets.side} y2={y + aH} className={styles.moduleDimWitness} />
            <TickDimension
              x1={x - dimensionOffsets.side}
              y1={y}
              x2={x - dimensionOffsets.side}
              y2={y + aH}
              label={formatMetres(model.spanA)}
              presentation={presentation}
              interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:spanA'] : undefined}
            />
          </g>
        )}

        {showPergolaGeometry && isHipCorner && model.lengthB && model.spanB ? (
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
              interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:lengthB'] : undefined}
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
              interactiveField={allowPergolaModelEditing ? interactiveFields?.['plan:spanB'] : undefined}
            />
          </>
        ) : null}

        {showModelSecondaryAnnotations && rafterXsA.length >= 2
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

        {showFootprintControls && allowAttachmentSideCanvasSelect
          ? edgeFrames.map(({ side, frame: edgeFrame }) => {
              const isActiveEdge = side === attachmentSideCanvasActiveSide;
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
                    onPointerEnter={() => {
                      if (editorSurface === 'card') {
                        footprintEditor?.onContextHoverChange?.(true);
                      }
                      footprintEditor?.onAttachmentSideHover(side);
                    }}
                    onPointerLeave={() => {
                      if (editorSurface === 'card') {
                        footprintEditor?.onContextHoverChange?.(false);
                      }
                      footprintEditor?.onAttachmentSideHover(null);
                    }}
                    onClick={() => footprintEditor?.onAttachmentSideSelect(side)}
                  />
                </g>
              );
            })
          : null}

        {editorSurface !== 'card' && canEditFootprint && allowResizeEdgeDrag
          ? resizeEdgeSpecs.map((edge) => {
              const isActiveEdge = edge.id === footprintEditor?.activeHandleId;
              const isHoveredEdge = edge.id === footprintEditor?.hoveredHandleId;
              return (
                <g key={`footprint-resize-edge-${edge.id}`}>
                  {isActiveEdge || isHoveredEdge ? (
                    <line
                      x1={edge.start.x}
                      y1={edge.start.y}
                      x2={edge.end.x}
                      y2={edge.end.y}
                      data-footprint-resize-edge={edge.id}
                      className={
                        isActiveEdge
                          ? `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeActive}`
                          : `${styles.moduleFootprintResizeEdge} ${styles.moduleFootprintResizeEdgeHover}`
                      }
                    />
                  ) : null}
                  <line
                    x1={edge.start.x}
                    y1={edge.start.y}
                    x2={edge.end.x}
                    y2={edge.end.y}
                    data-footprint-resize-edge-hit={edge.id}
                    className={styles.moduleFootprintResizeEdgeHit}
                    onPointerEnter={() => footprintEditor?.onHandleHover(edge.id)}
                    onPointerLeave={() => footprintEditor?.onHandleHover(null)}
                    onPointerDown={(event: ReactPointerEvent<SVGLineElement>) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      footprintEditor?.onHandleDragStart(
                        {
                          handleId: edge.id,
                          axisX: edge.axisX,
                          axisY: edge.axisY,
                          scale,
                          deltaMultiplier: edge.deltaMultiplier,
                          minValueM: edge.minValueM,
                          maxValueM: edge.maxValueM,
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

        {editorSurface !== 'card' && canEditFootprint
          ? (footprintCanvasLayout?.customEdges ?? []).map((edge) => (
              <g key={`footprint-custom-edge-${edge.index}`}>
                <line
                  x1={edge.start.x}
                  y1={edge.start.y}
                  x2={edge.end.x}
                  y2={edge.end.y}
                  data-footprint-custom-edge={edge.index}
                  data-footprint-custom-edge-kind={edge.kind}
                  data-footprint-custom-preview-edge={edge.previewPointKind ?? undefined}
                  data-footprint-custom-close-preview={edge.isClosePreview ? 'true' : undefined}
                  data-footprint-custom-active-edge={edge.isActive ? 'true' : undefined}
                  data-footprint-custom-invalid={customPolygonHasError ? 'true' : undefined}
                  className={[
                    styles.moduleFootprintResizeEdge,
                    edge.kind === 'preview' ? styles.moduleFootprintCustomPreviewEdge : '',
                    edge.isActive ? styles.moduleFootprintCustomActiveEdge : '',
                    edge.isClosePreview ? styles.moduleFootprintCustomClosePreviewEdge : '',
                    customPolygonHasError ? styles.moduleFootprintCustomInvalidEdge : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                {edge.kind === 'confirmed' ? (
                  <line
                    x1={edge.start.x}
                    y1={edge.start.y}
                    x2={edge.end.x}
                    y2={edge.end.y}
                    data-footprint-custom-edge-hit={edge.index}
                    className={styles.moduleFootprintResizeEdgeHit}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      footprintEditor?.onEdgeAdd?.(edge.index);
                    }}
                  />
                ) : null}
              </g>
            ))
          : null}

        {editorSurface !== 'card' &&
        canEditFootprint &&
        footprintCanvasLayout?.lockedDistanceCenter &&
        footprintCanvasLayout?.landingPoint &&
        footprintEditor?.customPolygonLockedDistanceM !== null &&
        footprintEditor?.customPolygonLockedDistanceM !== undefined ? (
          <g
            pointerEvents="none"
            aria-hidden="true"
            data-draw-outline-locked-radius="true"
            className={styles.moduleFootprintLandingMarker}
          >
            <line
              x1={footprintCanvasLayout.lockedDistanceCenter.x}
              y1={footprintCanvasLayout.lockedDistanceCenter.y}
              x2={footprintCanvasLayout.landingPoint.x}
              y2={footprintCanvasLayout.landingPoint.y}
              strokeDasharray="3 2"
            />
          </g>
        ) : null}

        {editorSurface !== 'card' && canEditFootprint && footprintCanvasLayout?.landingPoint && footprintEditor?.customPolygonLandingPoint ? (
          <g
            pointerEvents="none"
            aria-hidden="true"
            data-draw-outline-landing-marker="true"
            data-draw-outline-landing-along-m={footprintEditor.customPolygonLandingPoint.alongM}
            data-draw-outline-landing-depth-m={footprintEditor.customPolygonLandingPoint.depthM}
            className={styles.moduleFootprintLandingMarker}
          >
            <line
              x1={footprintCanvasLayout.landingPoint.x - 1.15}
              y1={footprintCanvasLayout.landingPoint.y}
              x2={footprintCanvasLayout.landingPoint.x + 1.15}
              y2={footprintCanvasLayout.landingPoint.y}
            />
            <line
              x1={footprintCanvasLayout.landingPoint.x}
              y1={footprintCanvasLayout.landingPoint.y - 1.15}
              x2={footprintCanvasLayout.landingPoint.x}
              y2={footprintCanvasLayout.landingPoint.y + 1.15}
            />
            <circle cx={footprintCanvasLayout.landingPoint.x} cy={footprintCanvasLayout.landingPoint.y} r={0.34} />
          </g>
        ) : null}

        {editorSurface !== 'card' && canEditFootprint
          ? (footprintCanvasLayout?.customVertices ?? []).map((vertex) => (
              <g key={`footprint-custom-vertex-${vertex.index}`}>
                {vertex.isCloseReady ? (
                  <circle
                    cx={vertex.point.x}
                    cy={vertex.point.y}
                    r={2.0}
                    data-footprint-custom-close-target={vertex.index}
                    data-footprint-custom-close-hovered={vertex.isCloseHovered ? 'true' : undefined}
                    className={
                      vertex.isCloseHovered
                        ? `${styles.moduleFootprintCustomCloseTarget} ${styles.moduleFootprintCustomCloseTargetHover}`
                        : styles.moduleFootprintCustomCloseTarget
                    }
                  />
                ) : null}
                <circle
                  cx={vertex.point.x}
                  cy={vertex.point.y}
                  r={
                    vertex.isLatestConfirmed
                      ? 1.16
                      : vertex.kind === 'pending' || vertex.kind === 'hover' || vertex.kind === 'locked-distance'
                        ? 1.08
                        : 1.02
                  }
                  data-footprint-custom-vertex={vertex.index}
                  data-footprint-custom-vertex-kind={vertex.kind}
                  data-footprint-custom-latest-vertex={vertex.isLatestConfirmed ? 'true' : undefined}
                  data-footprint-custom-preview-vertex={
                    vertex.kind === 'pending' || vertex.kind === 'hover' || vertex.kind === 'locked-distance'
                      ? vertex.kind
                      : undefined
                  }
                  data-footprint-custom-close-ready={vertex.isCloseReady ? 'true' : undefined}
                  data-footprint-custom-invalid={customPolygonHasError ? 'true' : undefined}
                  className={[
                    styles.moduleFootprintHandle,
                    vertex.isLatestConfirmed ? styles.moduleFootprintCustomLatestVertex : '',
                    vertex.kind === 'pending' ? styles.moduleFootprintCustomPendingVertex : '',
                    vertex.kind === 'hover' || vertex.kind === 'locked-distance'
                      ? styles.moduleFootprintCustomHoverVertex
                      : '',
                    customPolygonHasError ? styles.moduleFootprintCustomInvalidVertex : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
                <circle
                  cx={vertex.point.x}
                  cy={vertex.point.y}
                  r={2.8}
                  data-footprint-custom-vertex-hit={vertex.index}
                  className={styles.moduleFootprintHandleHit}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onVertexDelete?.(vertex.index);
                  }}
                  onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    footprintEditor?.onVertexDragStart?.(
                      {
                        vertexIndex: vertex.index,
                        alongAxisX: vertex.alongAxisX,
                        alongAxisY: vertex.alongAxisY,
                        depthAxisX: vertex.depthAxisX,
                        depthAxisY: vertex.depthAxisY,
                        scale,
                      },
                      {
                        pointerId: event.pointerId,
                        clientX: event.clientX,
                        clientY: event.clientY,
                      },
                    );
                  }}
                />
                {vertex.isCloseReady && vertex.index === 0 ? (
                  <circle
                    cx={vertex.point.x}
                    cy={vertex.point.y}
                    r={4.2}
                    data-footprint-custom-close-hit={vertex.index}
                    data-footprint-custom-close-hovered={vertex.isCloseHovered ? 'true' : undefined}
                    className={`${styles.moduleFootprintHandleHit} ${styles.moduleFootprintCustomCloseHit}`}
                    onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      footprintEditor?.onCloseStartSelect?.();
                    }}
                  />
                ) : null}
              </g>
            ))
          : null}

        {editorSurface === 'card' && showFootprintControls
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
                    onPointerEnter={() => {
                      footprintEditor?.onContextHoverChange?.(true);
                      footprintEditor?.onHandleHover(handle.id);
                    }}
                    onPointerLeave={() => {
                      footprintEditor?.onContextHoverChange?.(false);
                      footprintEditor?.onHandleHover(null);
                    }}
                    onPointerDown={(event: ReactPointerEvent<SVGCircleElement>) => {
                      if (event.button !== 0) return;
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

      {sheetInternalAngleAnnotationSpec ? (
        <g data-plan-angle-annotation="sheet">
          <line
            x1={sheetInternalAngleAnnotationSpec.lineStart.x}
            y1={sheetInternalAngleAnnotationSpec.lineStart.y}
            x2={sheetInternalAngleAnnotationSpec.lineEnd.x}
            y2={sheetInternalAngleAnnotationSpec.lineEnd.y}
            className={styles.modulePlanInternalAngle}
          />
          <text
            x={sheetInternalAngleAnnotationSpec.textPoint.x}
            y={sheetInternalAngleAnnotationSpec.textPoint.y}
            textAnchor={sheetInternalAngleAnnotationSpec.anchor}
            className={styles.modulePlanAngleText}
          >
            {sheetInternalAngleAnnotationSpec.text}
          </text>
        </g>
      ) : null}

      {sheetFallAnnotationSpec ? (
        <g data-plan-fall-annotation="sheet">
          <line
            x1={sheetFallAnnotationSpec.lineStart.x}
            y1={sheetFallAnnotationSpec.lineStart.y}
            x2={sheetFallAnnotationSpec.lineEnd.x}
            y2={sheetFallAnnotationSpec.lineEnd.y}
            className={styles.moduleFallLine}
          />
          {sheetFallAnnotationSpec.arrowHeads.map((arrowHead, index) => (
            <ArrowHead
              key={`sheet-plan-fall-arrow-${index}`}
              x={arrowHead.point.x}
              y={arrowHead.point.y}
              direction={arrowHead.direction}
              presentation={presentation}
            />
          ))}
          <text
            x={sheetFallAnnotationSpec.labelPoint.x}
            y={sheetFallAnnotationSpec.labelPoint.y}
            textAnchor="middle"
            className={`${styles.moduleFallLabel} ${styles.moduleFallLabelSheet}`}
          >
            {sheetFallAnnotationSpec.label}
          </text>
        </g>
      ) : null}

      {sheetSpacingAnnotationSpec ? (
        <g data-plan-rafter-spacing="sheet">
          <line
            x1={sheetSpacingAnnotationSpec.witness1Start.x}
            y1={sheetSpacingAnnotationSpec.witness1Start.y}
            x2={sheetSpacingAnnotationSpec.witness1End.x}
            y2={sheetSpacingAnnotationSpec.witness1End.y}
            className={styles.moduleDimWitness}
          />
          <line
            x1={sheetSpacingAnnotationSpec.witness2Start.x}
            y1={sheetSpacingAnnotationSpec.witness2Start.y}
            x2={sheetSpacingAnnotationSpec.witness2End.x}
            y2={sheetSpacingAnnotationSpec.witness2End.y}
            className={styles.moduleDimWitness}
          />
          <TickDimension
            x1={sheetSpacingAnnotationSpec.x1}
            y1={sheetSpacingAnnotationSpec.y1}
            x2={sheetSpacingAnnotationSpec.x2}
            y2={sheetSpacingAnnotationSpec.y2}
            label={sheetSpacingAnnotationSpec.label}
            presentation={presentation}
          />
        </g>
      ) : null}

      {showPinnedSheetPrimaryDimensions ? (
        <>
          <g data-plan-primary-dim="bottom">
            <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.maxY} x2={rotatedPrimaryBounds.minX} y2={pinnedBottomDimensionY} className={styles.moduleDimWitness} />
            <line x1={rotatedPrimaryBounds.maxX} y1={rotatedPrimaryBounds.maxY} x2={rotatedPrimaryBounds.maxX} y2={pinnedBottomDimensionY} className={styles.moduleDimWitness} />
            <TickDimension
              x1={rotatedPrimaryBounds.minX}
              y1={pinnedBottomDimensionY}
              x2={rotatedPrimaryBounds.maxX}
              y2={pinnedBottomDimensionY}
              label={bottomDimensionLabel}
              presentation={presentation}
              interactiveField={bottomDimensionField}
            />
          </g>
          <g data-plan-primary-dim="left">
            <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.minY} x2={pinnedLeftDimensionX} y2={rotatedPrimaryBounds.minY} className={styles.moduleDimWitness} />
            <line x1={rotatedPrimaryBounds.minX} y1={rotatedPrimaryBounds.maxY} x2={pinnedLeftDimensionX} y2={rotatedPrimaryBounds.maxY} className={styles.moduleDimWitness} />
            <TickDimension
              x1={pinnedLeftDimensionX}
              y1={rotatedPrimaryBounds.minY}
              x2={pinnedLeftDimensionX}
              y2={rotatedPrimaryBounds.maxY}
              label={leftDimensionLabel}
              presentation={presentation}
              interactiveField={leftDimensionField}
            />
          </g>
        </>
      ) : null}

      {showFootprintControls && highlightedValueSpec && highlightedHandleLabel ? (
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
      {showHousePopover && housePopoverStyle ? (
        <div className={styles.moduleSheetPlanPopoverOverlay} style={housePopoverStyle}>
          <div
            className={styles.moduleSheetPlanPopover}
            data-sheet-plan-popover="house"
            onPointerEnter={() => footprintEditor?.onContextPopoverHoverChange?.(true)}
            onPointerLeave={() => footprintEditor?.onContextPopoverHoverChange?.(false)}
          >
            <label className={styles.moduleSheetPlanPopoverField}>
              <span className={styles.moduleSheetPlanPopoverLabel}>House type</span>
              <select
                className={styles.moduleSheetPlanPopoverSelect}
                aria-label="House footprint preset"
                value={model.houseFootprintPreset}
                onChange={(event) => footprintEditor?.onPresetSelect(event.target.value as ModulePlanModel['houseFootprintPreset'])}
              >
                {HOUSE_FOOTPRINT_PRESET_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}
      {showPergolaPopover ? (
        <div className={styles.moduleSheetPlanPopoverOverlay} style={pergolaPopoverStyle}>
          <div
            className={styles.moduleSheetPlanPopover}
            data-sheet-plan-popover="pergola"
            onPointerEnter={() => sheetPlanInteraction?.onPergolaPopoverHoverChange?.(true)}
            onPointerLeave={() => sheetPlanInteraction?.onPergolaPopoverHoverChange?.(false)}
          >
            <span className={styles.moduleSheetPlanPopoverLabel}>Rotate</span>
            <div className={styles.moduleSheetPlanPopoverButtonRow}>
              <button type="button" className={styles.moduleSheetPlanPopoverButton} onClick={() => footprintEditor?.onRotate(-1)}>
                Rotate -90
              </button>
              <button type="button" className={styles.moduleSheetPlanPopoverButton} onClick={() => footprintEditor?.onRotate(1)}>
                Rotate +90
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {activeEdgeTagLabel && activeEdgeTagStyle ? (
        <div
          className={`${styles.moduleFootprintEdgeBadgeOverlay} ${isSheetFootprintEditor ? styles.moduleFootprintEdgeBadgeOverlaySheet : ''}`}
          style={activeEdgeTagStyle}
          aria-hidden="true"
        >
          <span className={`${styles.moduleFootprintEdgeBadgePill} ${isSheetFootprintEditor ? styles.moduleFootprintEdgeBadgePillSheet : ''}`}>
            {activeEdgeTagLabel}
          </span>
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
  const isModel = presentation === 'model';
  const sectionSheetLayout = isSheet ? resolveSectionSheetLayout({ model, drawingScale, viewportMm: sheetViewportMm }) : null;
  const modelSpaceLayout = isModel ? resolveSectionModelSpaceLayout(model) : null;
  const modelSvgStyle = modelSpaceLayout
    ? {
        width: `${modelSpaceLayout.svgWidthPx}px`,
        height: `${modelSpaceLayout.svgHeightPx}px`,
      }
    : undefined;
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
    modelSpaceLayout?.scale ??
    fixedScale ??
    (() => {
      const scaleX = chartWidth / safeSpanM;
      const scaleY = availableHeight / maxHeightM;
      return Math.min(scaleX, scaleY);
    })();
  const drawHeight = maxHeightM * scale;
  const topOffset =
    sectionSheetLayout || modelSpaceLayout
      ? (sectionSheetLayout?.y ?? modelSpaceLayout?.y ?? 0) - drawHeight
      : topMargin + Math.max(0, availableHeight - drawHeight) * fitFrame.verticalBias;
  const yGround = sectionSheetLayout?.y ?? modelSpaceLayout?.y ?? topOffset + drawHeight;

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
  const xLeft = sectionSheetLayout?.x ?? modelSpaceLayout?.x ?? (fitFrame.fitArea.x + (chartWidth - drawWidth) / 2);
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

  const leftDimX = isModel ? xLeft - 8.6 : Math.max(6, xLeft - (isSheet ? 9.8 : 8.6));
  const rightDimX = isModel ? xRight + 9.4 : Math.min(114, xRight + (isSheet ? 10.6 : 9.4));
  const spanAnchorLeftY = yHouseUnder;
  const spanAnchorSupportY = ySupportUnder;
  const spanAnchorRightY = yOuterGutterUnder;
  const spanDatumY = Math.max(spanAnchorLeftY, spanAnchorSupportY, spanAnchorRightY);
  const spanDimY = isModel
    ? Math.max(yGround + 10.2, spanDatumY + 8.4)
    : Math.min(89.2, Math.max(yGround + (isSheet ? 10.9 : 10.2), spanDatumY + (isSheet ? 9.4 : 8.4)));
  const overhangDimY = Math.max(spanAnchorRightY + (isSheet ? 4.9 : 4.2), spanDimY - (isSheet ? 5.8 : 5.2));
  const pitchLabelY = isSheet || isModel ? spanDimY + 6.2 : 88;
  const metaLabelY = isSheet || isModel ? pitchLabelY - 3.2 : 84.8;
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
  const semanticSectionHouseSurfaces = (model.houseContext?.surfaces ?? []).map((surface) => ({
    ...surface,
    points: surface.boundary.map((point) => sectionHousePointToSvg(point, xLeft, yGround, scale)),
  }));
  const semanticSectionHouseLines = (model.houseContext?.lines ?? []).map((line) => ({
    ...line,
    start: sectionHousePointToSvg(line.line.start, xLeft, yGround, scale),
    end: sectionHousePointToSvg(line.line.end, xLeft, yGround, scale),
  }));
  const hasSemanticSectionHouseContext = semanticSectionHouseSurfaces.length > 0 || semanticSectionHouseLines.length > 0;
  const groundLeftX = isModel ? xLeft - 8 : Math.max(8, xLeft - 8);
  const groundRightX = isModel ? xRight + 8 : Math.min(104, xRight + 8);
  const groundLineRightX = isModel ? xRight + 8 : Math.min(112, xRight + 8);

  return (
    <svg
      viewBox={modelSpaceLayout?.viewBoxValue ?? '0 0 120 90'}
      width={modelSpaceLayout?.svgWidthPx}
      height={modelSpaceLayout?.svgHeightPx}
      overflow={isModel ? 'visible' : undefined}
      style={modelSvgStyle}
      data-model-space-svg={isModel ? 'section' : undefined}
      data-model-space-view-box={modelSpaceLayout?.viewBoxValue}
      data-model-space-world-box={modelSpaceLayout?.worldBoxValue}
      data-model-space-focus-box={modelSpaceLayout?.focusBoxValue}
      role="img"
      aria-label="Module section view"
      className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
        presentation === 'sheet' ? styles.modulePlanSvgSheet : ''
      } ${isModel ? styles.modulePlanSvgModel : ''}`}
    >
      {modelSpaceLayout ? <FocusTarget rect={modelSpaceLayout.focusBox} /> : null}
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

      <rect x={groundLeftX} y={yGround + 1.3} width={groundRightX - groundLeftX} height={8} className={styles.moduleSectionGroundFill} />
      <line x1={groundLeftX} y1={yGround} x2={groundLineRightX} y2={yGround} className={styles.moduleSectionGround} />

      {hasSemanticSectionHouseContext
        ? semanticSectionHouseSurfaces.map((surface) => (
            <polygon
              key={surface.id}
              points={toPointsAttr(surface.points)}
              className={sectionHouseSurfaceClass(surface.kind)}
              data-house-section-surface={surface.kind}
            />
          ))
        : null}
      {hasSemanticSectionHouseContext
        ? semanticSectionHouseLines.map((line) => (
            <line
              key={line.id}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
              className={sectionHouseLineClass(line.kind)}
              data-house-section-line={line.kind}
            />
          ))
        : null}

      <rect x={leftPostX} y={yHouseUnder} width={postW} height={yGround - yHouseUnder} className={styles.moduleSectionPostPrimary} />
      <rect x={secondPostX} y={supportPostTopY} width={postW} height={yGround - supportPostTopY} className={styles.moduleSectionPostPrimary} />
      <rect
        x={ledgerX}
        y={ledgerY}
        width={leftEaveWidth}
        height={leftEaveDepth}
        className={styles.moduleSectionPrimaryBeam}
      />
      {model.houseConnectionType === 'facade' && !hasSemanticSectionHouseContext ? (
        <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
      ) : null}
      {model.houseConnectionType === 'fascia' && !hasSemanticSectionHouseContext ? (
        <>
          <line x1={ledgerX - 1.1} y1={yHouseUnder - 2.2} x2={ledgerX - 1.1} y2={yGround} className={styles.moduleSectionHouseWall} />
          <line x1={ledgerX - 1.1} y1={ledgerY - 0.9} x2={ledgerX + leftEaveWidth} y2={ledgerY - 0.9} className={styles.moduleSectionFasciaBand} />
        </>
      ) : null}
      {model.houseConnectionType === 'soffit' && !hasSemanticSectionHouseContext ? (
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
        tabIndex={pitchInteractiveField?.onActivate ? 0 : undefined}
        onClick={pitchInteractiveField?.onActivate ? (event) => pitchInteractiveField.onActivate?.(pitchInteractiveField.fieldId, event.currentTarget) : undefined}
        onKeyDown={
          pitchInteractiveField?.onActivate
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                pitchInteractiveField.onActivate?.(pitchInteractiveField.fieldId, event.currentTarget as SVGTextElement);
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
