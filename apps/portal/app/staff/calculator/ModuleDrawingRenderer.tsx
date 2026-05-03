import { useId } from 'react';
import styles from './CalculatorGrid.module.css';
import type { ModulePlanModel } from './moduleViews';
import { DEFAULT_ESTIMATE_DRAWING_SCALE } from '@/lib/estimates/drawingSheet';
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
  const effectivePlanModel = drawingSurfaceGeometry?.planModel ?? planModel ?? null;
  const effectiveSectionModel = drawingSurfaceGeometry?.sectionModel ?? sectionModel ?? null;
  const hasSolvedDrawingSurfaceGeometry = drawingSurfaceGeometry?.source === 'solved_geometry';
  const effectiveGeometrySection = hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry?.geometrySection ?? null : null;
  const effectiveModelSpacePergolaGeometry =
    hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry.geometryPlan : null;
  const effectiveModelSpaceTopProjection =
    hasSolvedDrawingSurfaceGeometry ? drawingSurfaceGeometry.geometryTopProjection : null;
  const effectiveModelSpacePergolaRenderSource = drawingSurfaceGeometry
    ? hasSolvedDrawingSurfaceGeometry
      ? 'geometry'
      : 'legacy'
    : undefined;
  const effectiveModelSpacePergolaRenderStatus = drawingSurfaceGeometry
    ? hasSolvedDrawingSurfaceGeometry && effectiveModelSpacePergolaGeometry && effectiveModelSpaceTopProjection
      ? 'geometry_ready'
      : 'invalid_geometry'
    : undefined;
  const effectiveShowDebugOverlays = showDebugOverlays ?? presentation === 'sheet';
  const isCompact = presentation !== 'card';
  const isModel = presentation === 'model';
  const showPlan = view === 'plan' && Boolean(effectivePlanModel);
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
      {showPlan && effectivePlanModel ? (
        <div className={`${styles.modulePlanFrame} ${isCompact ? styles.modulePlanFrameBare : ''} ${isModel ? styles.modulePlanFrameModel : ''}`}>
        {isCompact ? null : (
          <div className={styles.modulePlanSourceRow}>
              <div className={effectivePlanModel.dataSource === 'derived' ? styles.modulePlanSourceDerived : styles.modulePlanSourceFallback}>
                {effectivePlanModel.dataSource === 'derived' ? 'Derived' : 'Input fallback'}
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
          </div>
          {isCompact ? null : (
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




