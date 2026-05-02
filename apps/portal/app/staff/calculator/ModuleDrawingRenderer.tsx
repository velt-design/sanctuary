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
export { PlanSvg, SectionSvg };
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

export const STATUS_TEXT: Record<ModuleViewsStatus, string> = {
  loading: 'Updating module geometry...',
  ready: 'Plan schematic ready.',
  error: 'Live geometry is unavailable. Resolve calculation errors to restore derived data.',
  empty: 'Waiting for valid inputs before geometry is available.',
};
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
  enableProjectionOnlyModelInteractions = false,
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
              enableProjectionOnlyModelInteractions={enableProjectionOnlyModelInteractions}
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




