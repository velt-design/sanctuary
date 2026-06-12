import { useId } from 'react';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import type { ModulePlanModel } from './moduleViews';
import { DEFAULT_ESTIMATE_DRAWING_SCALE } from '@/lib/estimates/drawingSheet';
import { buildPlanSvgPresentationModel } from './ModulePlanSvgPresentationModel';
import {
  ObjectWorkbenchDimensionLayerRenderer,
  ObjectWorkbenchOverlayLayerRenderer,
  ObjectWorkbenchPreviewLayerRenderer,
  TopProjectionLayerRenderer,
} from './ModulePlanLayerRenderers';
import { PlanSvg } from './ModulePlanSvg';
import { SectionSvg } from './ModuleSectionSvg';
import {
  checkPlanConsistency,
  checkSectionConsistency,
} from './ModuleDrawingDiagnostics';
import {
  getModuleDrawingScaleDiagnostics,
  resolveModuleDrawingScaleState,
} from './ModuleDrawingScalePresentation';
import {
  sectionOuterGutterUndersideM,
  sectionOverhangM,
  sectionRafterCutLengthLabel,
  sectionSupportUndersideM,
} from './ModuleSectionPresentation';
import type {
  ModuleDrawingRendererProps,
  ModuleViewsStatus,
} from './ModuleDrawingContracts';
import {
  HOUSE_FOOTPRINT_PRESET_OPTIONS,
  canEditHouseFootprintPlan,
} from './ModulePlanFootprintPresentation';
import {
  formatMetres,
  hasFullLengthPlanRidge,
  LegendRow,
  roofTypeLabel,
} from './ModuleDrawingChromePresentation';
export type { HouseFootprintHandleId } from './moduleViews';
export type * from './ModuleDrawingContracts';
export { resolvePlanSvgPointerFootprintPoint } from './ModulePlanSvgBridge';
export {
  HOUSE_FOOTPRINT_PRESET_OPTIONS,
  canEditHouseFootprintPlan,
} from './ModulePlanFootprintPresentation';
export {
  getModuleDrawingScaleDiagnostics,
  getSuggestedModuleDrawingScale,
  resolveModuleDrawingScaleState,
} from './ModuleDrawingScalePresentation';

const STATUS_TEXT: Record<ModuleViewsStatus, string> = {
  loading: 'Updating module geometry...',
  ready: 'Plan schematic ready.',
  error: 'Live geometry is unavailable. Resolve calculation errors to restore derived data.',
  empty: 'Waiting for valid inputs before geometry is available.',
};

const GEOMETRY_PLAN_SHEET_WIDTH = 120;
const GEOMETRY_PLAN_SHEET_HEIGHT = 90;
const GEOMETRY_PLAN_PADDING = 6;
const GEOMETRY_MODEL_UNITS_PER_METRE = 100;

function resolveGeometryPlanLayout(input: {
  geometryPlan: GeometryPlanViewModel;
  topProjection: GeometryTopProjectionViewModel;
  presentation: NonNullable<ModuleDrawingRendererProps['presentation']>;
}) {
  const extents = input.topProjection.extents ?? {
    minX: input.geometryPlan.extents.minX,
    minY: input.geometryPlan.extents.minY,
    maxX: input.geometryPlan.extents.maxX,
    maxY: input.geometryPlan.extents.maxY,
    widthMm: input.geometryPlan.extents.lengthMm,
    heightMm: input.geometryPlan.extents.projectionMm,
  };
  const safeWidthM = Math.max(0.1, extents.widthMm / 1000);
  const safeHeightM = Math.max(0.1, extents.heightMm / 1000);
  const sheetScale = Math.min(
    (GEOMETRY_PLAN_SHEET_WIDTH - GEOMETRY_PLAN_PADDING * 2) / safeWidthM,
    (GEOMETRY_PLAN_SHEET_HEIGHT - GEOMETRY_PLAN_PADDING * 2) / safeHeightM,
  );
  const scale = input.presentation === 'model' ? GEOMETRY_MODEL_UNITS_PER_METRE : sheetScale;
  const width = safeWidthM * scale + GEOMETRY_PLAN_PADDING * 2;
  const height = safeHeightM * scale + GEOMETRY_PLAN_PADDING * 2;
  const viewBox =
    input.presentation === 'model'
      ? `0 0 ${width.toFixed(2)} ${height.toFixed(2)}`
      : `0 0 ${GEOMETRY_PLAN_SHEET_WIDTH} ${GEOMETRY_PLAN_SHEET_HEIGHT}`;
  const viewportWidth = input.presentation === 'model' ? width : GEOMETRY_PLAN_SHEET_WIDTH;
  const viewportHeight = input.presentation === 'model' ? height : GEOMETRY_PLAN_SHEET_HEIGHT;

  return {
    baseX: GEOMETRY_PLAN_PADDING - (extents.minX / 1000) * scale,
    baseY: GEOMETRY_PLAN_PADDING - (extents.minY / 1000) * scale,
    scale,
    viewBox,
    width: viewportWidth,
    height: viewportHeight,
    worldBoxValue: `${extents.minX},${extents.minY},${extents.widthMm},${extents.heightMm}`,
    focusBoxValue: `${extents.minX},${extents.minY},${extents.widthMm},${extents.heightMm}`,
  };
}

function GeometryPlanSvg({
  geometryPlan,
  topProjection,
  idBase,
  presentation,
  visibility,
  objectWorkbenchPlanOverlay,
  hoveredObjectWorkbenchDeckId,
  onObjectWorkbenchDeckHoverChange,
  activeObjectWorkbenchCustomEdgeId,
  onObjectWorkbenchShapeSelect,
  enableProjectionOnlyModelInteractions,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  objectWorkbenchPreviewOverlay,
}: {
  geometryPlan: GeometryPlanViewModel;
  topProjection: GeometryTopProjectionViewModel;
  idBase: string;
  presentation: NonNullable<ModuleDrawingRendererProps['presentation']>;
  visibility: ModuleDrawingRendererProps['visibility'];
  objectWorkbenchPlanOverlay: ModuleDrawingRendererProps['objectWorkbenchPlanOverlay'];
  hoveredObjectWorkbenchDeckId: ModuleDrawingRendererProps['hoveredObjectWorkbenchDeckId'];
  onObjectWorkbenchDeckHoverChange: ModuleDrawingRendererProps['onObjectWorkbenchDeckHoverChange'];
  activeObjectWorkbenchCustomEdgeId: ModuleDrawingRendererProps['activeObjectWorkbenchCustomEdgeId'];
  onObjectWorkbenchShapeSelect: ModuleDrawingRendererProps['onObjectWorkbenchShapeSelect'];
  enableProjectionOnlyModelInteractions: boolean;
  onObjectWorkbenchShapeDragStart: ModuleDrawingRendererProps['onObjectWorkbenchShapeDragStart'];
  onObjectWorkbenchCustomEdgeSelect: ModuleDrawingRendererProps['onObjectWorkbenchCustomEdgeSelect'];
  onObjectWorkbenchDimensionActivate: ModuleDrawingRendererProps['onObjectWorkbenchDimensionActivate'];
  objectWorkbenchPreviewOverlay: ModuleDrawingRendererProps['objectWorkbenchPreviewOverlay'];
}) {
  const isModel = presentation === 'model';
  const isSheet = presentation === 'sheet';
  const familyVisibility = visibility ?? {
    house: true,
    pergolas: true,
    decks: true,
    openings: true,
  };
  const rawObjectWorkbenchOverlayShapes = isModel ? objectWorkbenchPlanOverlay?.shapes ?? [] : [];
  const rawObjectWorkbenchPresetAnnotations = isModel ? objectWorkbenchPlanOverlay?.presetAnnotations ?? [] : [];
  const rawObjectWorkbenchCustomEdgeCandidates = isModel ? objectWorkbenchPlanOverlay?.customEdgeCandidates ?? [] : [];
  const rawObjectWorkbenchPreviewShape =
    isModel && objectWorkbenchPreviewOverlay
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
  const layout = resolveGeometryPlanLayout({ geometryPlan, topProjection, presentation });
  const presentationModel = buildPlanSvgPresentationModel({
    isModel,
    useTopProjectionBackedPlan: true,
    useProjectionOnlyModelSpacePlan: isModel,
    modelSpaceTopProjection: topProjection,
    familyVisibility,
    baseX: layout.baseX,
    baseY: layout.baseY,
    scale: layout.scale,
    rawObjectWorkbenchOverlayShapes,
    rawObjectWorkbenchPresetAnnotations,
    rawObjectWorkbenchCustomEdgeCandidates,
    rawObjectWorkbenchPreviewShape,
    enableProjectionOnlyModelInteractions,
  });
  const diagnostics = presentationModel.diagnostics;
  const lengthLabel = formatMetres(geometryPlan.extents.lengthMm / 1000);
  const spanLabel = formatMetres(geometryPlan.extents.projectionMm / 1000);
  const dimensionY = layout.height - GEOMETRY_PLAN_PADDING / 2;
  const dimensionX = GEOMETRY_PLAN_PADDING / 2;

  return (
    <svg
      id={idBase}
      viewBox={layout.viewBox}
      width={isModel ? layout.width : undefined}
      height={isModel ? layout.height : undefined}
      overflow={isModel ? 'visible' : undefined}
      data-model-space-svg={isModel ? 'plan' : undefined}
      data-model-space-render-contract={isModel ? diagnostics.renderContract : undefined}
      data-model-space-view-box={isModel ? layout.viewBox : undefined}
      data-model-space-world-box={isModel ? layout.worldBoxValue : undefined}
      data-model-space-focus-box={isModel ? layout.focusBoxValue : undefined}
      data-plan-render-source="geometry"
      data-plan-render-status="geometry_ready"
      data-top-projection-parity-status={diagnostics.topProjectionParityStatus ?? undefined}
      data-top-projection-screen-axis={diagnostics.topProjectionScreenAxis ?? undefined}
      data-top-projection-top-visible-count={diagnostics.topProjectionTopVisibleCount}
      data-top-projection-context-count={diagnostics.topProjectionContextCount}
      data-top-projection-hidden-count={diagnostics.topProjectionHiddenCount}
      data-top-projection-rendered-count={diagnostics.topProjectionRenderedCount}
      data-top-projection-hidden-rendered-count={diagnostics.topProjectionHiddenRenderedCount}
      data-plan-rendered-context-line-count={diagnostics.renderedTopProjectionContextLineCount}
      data-plan-wall-detail-count={diagnostics.renderedTopProjectionWallDetailCount}
      data-plan-committed-top-projection-body-count={diagnostics.committedTopProjectionBodyCount}
      data-plan-committed-top-projection-object-count={diagnostics.committedTopProjectionObjectCount}
      data-plan-object-overlay-body-count={diagnostics.objectWorkbenchRenderedBodyCount}
      data-plan-visible-legacy-overlay-body-count={diagnostics.visibleLegacyPlanOverlayBodyCount}
      data-plan-visible-geometry-fallback-overlay-body-count={diagnostics.visibleGeometryFallbackOverlayBodyCount}
      data-plan-visible-top-projection-context-overlay-body-count={diagnostics.visibleTopProjectionContextOverlayBodyCount}
      data-plan-visible-top-projection-committed-overlay-body-count={diagnostics.visibleTopProjectionCommittedOverlayBodyCount}
      data-plan-rendered-context-body-count={diagnostics.renderedTopProjectionContextBodyCount}
      data-plan-suppressed-context-body-count={diagnostics.suppressedTopProjectionContextBodyCount}
      data-plan-suppressed-top-visible-body-count={diagnostics.suppressedTopProjectionTopVisibleBodyCount}
      data-plan-duplicate-visual-body-count={diagnostics.duplicateCommittedBodyCount}
      data-plan-duplicate-semantic-owner-count={diagnostics.duplicateSemanticOwnerCount}
      role="img"
      aria-label="Module plan view"
      className={`${styles.modulePlanSvg} ${presentation !== 'card' ? styles.modulePlanSvgBare : ''} ${
        isSheet ? styles.modulePlanSvgSheet : ''
      } ${isModel ? styles.modulePlanSvgModel : ''}`}
    >
      <TopProjectionLayerRenderer
        shapes={presentationModel.renderedTopProjectionShapes}
        projection={topProjection}
      />
      <ObjectWorkbenchOverlayLayerRenderer
        shapes={presentationModel.objectWorkbenchOverlayShapes}
        renderCommittedBodies={presentationModel.renderObjectWorkbenchCommittedBodies}
        previewShape={presentationModel.objectWorkbenchPreviewShape}
        hoveredDeckId={hoveredObjectWorkbenchDeckId ?? null}
        onDeckHoverChange={onObjectWorkbenchDeckHoverChange}
        onShapeSelect={onObjectWorkbenchShapeSelect}
        onShapeDragStart={onObjectWorkbenchShapeDragStart}
      />
      <ObjectWorkbenchPreviewLayerRenderer previewShape={presentationModel.objectWorkbenchPreviewShape} />
      <ObjectWorkbenchDimensionLayerRenderer
        customEdgeCandidates={presentationModel.objectWorkbenchCustomEdgeCandidates}
        presetAnnotations={presentationModel.objectWorkbenchPresetAnnotations}
        activeCustomEdgeId={activeObjectWorkbenchCustomEdgeId ?? null}
        previewShape={presentationModel.objectWorkbenchPreviewShape}
        onCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
        onDimensionActivate={onObjectWorkbenchDimensionActivate}
      />
      <g data-plan-primary-dim="bottom">
        <text
          x={layout.width / 2}
          y={dimensionY}
          textAnchor="middle"
          className={styles.moduleDimText}
          data-plan-geometry-dimension="length"
        >
          {lengthLabel}
        </text>
      </g>
      <g data-plan-primary-dim="left">
        <text
          x={dimensionX}
          y={layout.height / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${dimensionX} ${layout.height / 2})`}
          className={styles.moduleDimText}
          data-plan-geometry-dimension="span"
        >
          {spanLabel}
        </text>
      </g>
    </svg>
  );
}
export function ModuleDrawingRenderer({
  view,
  status,
  statusDetail,
  drawingSurfaceGeometry,
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
  enableProjectionOnlyModelInteractions = false,
  onPergolaSelect,
  onCanvasSelect,
  onObjectWorkbenchShapeDragStart,
  onObjectWorkbenchCustomEdgeSelect,
  onObjectWorkbenchDimensionActivate,
  objectWorkbenchPreviewOverlay,
}: ModuleDrawingRendererProps) {
  const hasSolvedDrawingSurfaceGeometry = drawingSurfaceGeometry?.source === 'solved_geometry';
  const isModel = presentation === 'model';
  const effectivePlanModel = hasSolvedDrawingSurfaceGeometry && isModel ? null : planModel ?? null;
  const effectiveSectionModel = sectionModel ?? null;
  const effectiveGeometrySection = hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry?.geometrySection ?? null : null;
  const effectiveModelSpacePergolaGeometry = hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry.geometryPlan : null;
  const effectiveModelSpaceTopProjection = hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry.geometryTopProjection : null;
  const effectiveModelSpacePergolaRenderSource = hasSolvedDrawingSurfaceGeometry ? 'geometry' : undefined;
  const effectiveModelSpacePergolaRenderStatus = hasSolvedDrawingSurfaceGeometry
    ? effectiveModelSpacePergolaGeometry && effectiveModelSpaceTopProjection
      ? 'geometry_ready'
      : 'invalid_geometry'
    : undefined;
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isCompact = presentation !== 'card';
  const hasSolvedPlan =
    !isModel &&
    hasSolvedDrawingSurfaceGeometry &&
    Boolean(effectiveModelSpacePergolaGeometry) &&
    Boolean(effectiveModelSpaceTopProjection);
  const showPlan = view === 'plan' && (Boolean(effectivePlanModel) || hasSolvedPlan);
  const showSection = view === 'section' && (Boolean(effectiveGeometrySection) || Boolean(effectiveSectionModel));
  const planConsistency = effectivePlanModel ? checkPlanConsistency(effectivePlanModel) : null;
  const sectionConsistency = effectiveSectionModel ? checkSectionConsistency(effectiveSectionModel) : null;
  const sectionOverhangDisplayM = effectiveSectionModel ? sectionOverhangM(effectiveSectionModel) : 0;
  const sectionOuterDisplayM = effectiveSectionModel ? sectionOuterGutterUndersideM(effectiveSectionModel) : null;
  const sectionSupportDisplayM = effectiveSectionModel ? sectionSupportUndersideM(effectiveSectionModel) : null;
  const sectionRafterCutDisplay = effectiveSectionModel ? sectionRafterCutLengthLabel(effectiveSectionModel) : null;
  const activeConsistency = view === 'plan' ? planConsistency : sectionConsistency;
  const stateText = view === 'section' && status === 'ready' ? 'Section schematic ready.' : STATUS_TEXT[status];
  const svgId = useId().replace(/:/g, '_');
  const footprintEditorSurface = footprintEditor?.surface ?? 'card';
  const sheetScaleState =
    presentation === 'sheet'
      ? resolveModuleDrawingScaleState({
          view,
          requestedScale: drawingScale,
          planModel: effectivePlanModel,
          sectionModel: effectiveSectionModel,
          viewportMm: sheetViewportMm,
        })
      : null;
  const sheetScaleDiagnostics =
    presentation === 'sheet'
      ? getModuleDrawingScaleDiagnostics({
          view,
          planModel: effectivePlanModel,
          sectionModel: effectiveSectionModel,
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
      data-drawing-surface-source={drawingSurfaceGeometry?.source}
    >
      {showPlan ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''} ${isModel ? styles.modulePlanFrameModel : ''}`}>
        {isCompact ? null : (
          <div className={styles.modulePlanSourceRow}>
              <div className={hasSolvedPlan ? styles.modulePlanSourceDerived : effectivePlanModel?.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {hasSolvedPlan ? 'Solved geometry' : effectivePlanModel?.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
              </div>
              {planConsistency ? (
                <div className={planConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {planConsistency.level === 'ok' ? 'Geometry OK' : `Check ${planConsistency.details.length}`}
                </div>
              ) : null}
            </div>
          )}
          <div className={`${styles.modulePlanCanvas} ${isModel ? styles.modulePlanCanvasModel : ''}`}>
            {effectivePlanModel && presentation === 'card' && footprintEditorSurface === 'card' && footprintEditor?.available && footprintEditor.isEditing ? (
              <div className={styles.moduleFootprintToolbar} aria-label="House footprint editor">
                <div className={styles.moduleFootprintToolbarGroup}>
                  <label className={styles.moduleFootprintToolbarField}>
                    <span className={styles.moduleFootprintToolbarFieldLabel}>Mode</span>
                    <select
                      aria-label="House footprint mode"
                      className={styles.moduleFootprintToolbarSelect}
                      value={effectivePlanModel.houseFootprintMode ?? 'preset'}
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
                      value={effectivePlanModel.houseFootprintPreset}
                      disabled={(effectivePlanModel.houseFootprintMode ?? 'preset') === 'custom_polygon'}
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
            {effectivePlanModel ? (
              <PlanSvg
                model={effectivePlanModel}
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
                enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
                onPergolaSelect={onPergolaSelect}
                onCanvasSelect={onCanvasSelect}
                onObjectWorkbenchShapeDragStart={onObjectWorkbenchShapeDragStart}
                onObjectWorkbenchCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
                onObjectWorkbenchDimensionActivate={onObjectWorkbenchDimensionActivate}
                objectWorkbenchPreviewOverlay={objectWorkbenchPreviewOverlay}
                modelSpacePergolaGeometry={effectiveModelSpacePergolaGeometry}
                modelSpaceTopProjection={effectiveModelSpaceTopProjection}
                modelSpacePergolaRenderSource={effectiveModelSpacePergolaRenderSource}
                modelSpacePergolaRenderStatus={effectiveModelSpacePergolaRenderStatus}
              />
            ) : effectiveModelSpacePergolaGeometry && effectiveModelSpaceTopProjection ? (
              <GeometryPlanSvg
                geometryPlan={effectiveModelSpacePergolaGeometry}
                topProjection={effectiveModelSpaceTopProjection}
                idBase={`${svgId}_plan`}
                presentation={presentation}
                visibility={visibility}
                objectWorkbenchPlanOverlay={objectWorkbenchPlanOverlay}
                hoveredObjectWorkbenchDeckId={hoveredObjectWorkbenchDeckId}
                onObjectWorkbenchDeckHoverChange={onObjectWorkbenchDeckHoverChange}
                activeObjectWorkbenchCustomEdgeId={activeObjectWorkbenchCustomEdgeId}
                onObjectWorkbenchShapeSelect={onObjectWorkbenchShapeSelect}
                enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
                onObjectWorkbenchShapeDragStart={onObjectWorkbenchShapeDragStart}
                onObjectWorkbenchCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
                onObjectWorkbenchDimensionActivate={onObjectWorkbenchDimensionActivate}
                objectWorkbenchPreviewOverlay={objectWorkbenchPreviewOverlay}
              />
            ) : null}
          </div>
          {isCompact || !effectivePlanModel ? null : (
            <>
              <LegendRow
                items={
                  effectivePlanModel.houseConnectionType === 'none'
                    ? hasFullLengthPlanRidge(effectivePlanModel.roofType)
                      ? ['Frame member', 'Rafters', 'Ridge beam']
                      : ['Frame member', 'Rafters']
                    : effectivePlanModel.houseConnectionType === 'soffit'
                      ? hasFullLengthPlanRidge(effectivePlanModel.roofType)
                        ? ['Frame member', 'Rafters', 'Ridge beam', 'Soffit brackets', 'House side']
                        : ['Frame member', 'Rafters', 'Soffit brackets', 'House side']
                      : hasFullLengthPlanRidge(effectivePlanModel.roofType)
                        ? ['Frame member', 'Rafters', 'Ridge beam', 'House side']
                        : ['Frame member', 'Rafters', 'House side']
                }
              />
              <div className={styles.modulePlanStats}>
                <span className={styles.modulePlanStat}>{`A: ${formatMetres(effectivePlanModel.lengthA)} x ${formatMetres(effectivePlanModel.spanA)}`}</span>
                {effectivePlanModel.roofType === 'hip_corner' && effectivePlanModel.lengthB && effectivePlanModel.spanB ? (
                  <span className={styles.modulePlanStat}>{`B: ${formatMetres(effectivePlanModel.lengthB)} x ${formatMetres(effectivePlanModel.spanB)}`}</span>
                ) : null}
                <span className={styles.modulePlanStat}>{`Roof: ${roofTypeLabel(effectivePlanModel.roofType)}`}</span>
                <span className={styles.modulePlanStat}>{`Rafters: ${effectivePlanModel.rafterCountA} @ ${formatMetres(effectivePlanModel.rafterSpacingA)} c/c`}</span>
                {hasFullLengthPlanRidge(effectivePlanModel.roofType) ? (
                  <span className={styles.modulePlanStat}>{`Ridge beam: ${Math.round(effectivePlanModel.ridgeBeamDepthM * 1000)}x${Math.round(effectivePlanModel.ridgeBeamWidthM * 1000)}mm`}</span>
                ) : null}
                {effectivePlanModel.houseConnectionType === 'soffit' ? (
                  <span className={styles.modulePlanStat}>{`Soffit brackets: ${effectivePlanModel.soffitBracketPositionsA.length}`}</span>
                ) : null}
                {effectivePlanModel.boxPerimeterEnabled ? <span className={styles.modulePlanStat}>Box perimeter enabled</span> : null}
              </div>
            </>
          )}
        </div>
      ) : showSection ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''} ${isModel ? styles.modulePlanFrameModel : ''}`}>
          {isCompact ? null : (
            <div className={styles.modulePlanSourceRow}>
              <div className={hasSolvedDrawingSurfaceGeometry && effectiveGeometrySection ? styles.modulePlanSourceDerived : effectiveSectionModel?.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {hasSolvedDrawingSurfaceGeometry && effectiveGeometrySection
                  ? 'Solved geometry'
                  : effectiveSectionModel?.dataSource === 'derived'
                    ? 'Derived'
                    : 'Input fallback'}
              </div>
              {sectionConsistency ? (
                <div className={sectionConsistency.level === 'ok' ? styles.modulePlanConsistencyOk : styles.modulePlanConsistencyWarn}>
                  {sectionConsistency.level === 'ok' ? 'Geometry OK' : `Check ${sectionConsistency.details.length}`}
                </div>
              ) : null}
            </div>
          )}
          <SectionSvg
            model={effectiveSectionModel}
            geometrySection={effectiveGeometrySection}
            presentation={presentation}
            drawingScale={appliedDrawingScale}
            sheetViewportMm={sheetViewportMm}
            debugScaleState={sheetScaleState}
            scaleDiagnostics={sheetScaleDiagnostics}
            interactiveFields={interactiveFields}
            showDebugOverlays={effectiveShowDebugOverlays}
          />
          {isCompact || !effectiveSectionModel ? null : (
            <>
              <LegendRow
                items={
                  effectiveSectionModel.sectionKind === 'gable'
                    ? ['Primary frame', 'Internal roof line', 'Ridge beam', 'Tie beam / king strut']
                    : effectiveSectionModel.overhangEnabled && effectiveSectionModel.overhangAmountM > 0
                      ? ['Primary frame', 'Internal roof line', 'Overhang support']
                      : ['Primary frame', 'Internal roof line']
                }
              />
              <div className={styles.modulePlanStats}>
                <span className={styles.modulePlanStat}>{`Span: ${formatMetres(effectiveSectionModel.spanA)}`}</span>
                <span className={styles.modulePlanStat}>{`Pitch: ${effectiveSectionModel.pitchDeg.toFixed(1)} deg`}</span>
                <span className={styles.modulePlanStat}>{`House: ${formatMetres(effectiveSectionModel.leftEdgeHeightM)}`}</span>
                <span className={styles.modulePlanStat}>{`Outer: ${formatMetres(sectionOuterDisplayM ?? effectiveSectionModel.rightEdgeHeightM)}`}</span>
                {sectionOverhangDisplayM > 0 ? <span className={styles.modulePlanStat}>{`Support: ${formatMetres(sectionSupportDisplayM ?? effectiveSectionModel.rightEdgeHeightM)}`}</span> : null}
                <span className={styles.modulePlanStat}>{`Post: ${Math.round(effectiveSectionModel.postDepthM * 1000)}x${Math.round(effectiveSectionModel.postWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Rafter: ${Math.round(effectiveSectionModel.rafterDepthM * 1000)}x${Math.round(effectiveSectionModel.rafterWidthM * 1000)}mm`}</span>
                {sectionRafterCutDisplay ? <span className={styles.modulePlanStat}>{sectionRafterCutDisplay}</span> : null}
                <span className={styles.modulePlanStat}>{`Ledger: ${Math.round(effectiveSectionModel.ledgerBeamDepthM * 1000)}x${Math.round(effectiveSectionModel.ledgerBeamWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Support beam: ${Math.round(effectiveSectionModel.supportBeamDepthM * 1000)}x${Math.round(effectiveSectionModel.supportBeamWidthM * 1000)}mm`}</span>
                <span className={styles.modulePlanStat}>{`Gutter: ${Math.round(effectiveSectionModel.gutterDepthM * 1000)}x${Math.round(effectiveSectionModel.gutterWidthM * 1000)}mm`}</span>
                {typeof effectiveSectionModel.ridgeHeightM === 'number' ? (
                  <span className={styles.modulePlanStat}>{`Ridge beam: ${Math.round(effectiveSectionModel.ridgeBeamDepthM * 1000)}x${Math.round(effectiveSectionModel.ridgeBeamWidthM * 1000)}mm`}</span>
                ) : null}
                {typeof effectiveSectionModel.ridgeHeightM === 'number' ? (
                  <span className={styles.modulePlanStat}>{`Ridge: ${formatMetres(effectiveSectionModel.ridgeHeightM)}`}</span>
                ) : null}
                {sectionOverhangDisplayM > 0 ? <span className={styles.modulePlanStat}>{`Overhang: ${formatMetres(sectionOverhangDisplayM)}`}</span> : null}
                {effectiveSectionModel.boxPerimeterEnabled && effectiveSectionModel.boxRiseM ? (
                  <span className={styles.modulePlanStat}>{`Box fall: ${formatMetres(effectiveSectionModel.boxRiseM)}`}</span>
                ) : null}
                {effectiveSectionModel.roofType === 'hip_corner' ? <span className={styles.modulePlanStat}>Primary wing section (A)</span> : null}
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



