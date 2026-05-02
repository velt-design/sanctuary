import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { AttachmentSide } from '@sp/costing';
import type { GeometryPlanViewModel, GeometryTopProjectionViewModel } from '@sp/geometry';
import styles from './CalculatorGrid.module.css';
import { DEFAULT_ESTIMATE_DRAWING_SCALE, type EstimateDrawingScale } from '@/lib/estimates/drawingSheet';
import type { DrawingWorkbenchVisibilityState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  ObjectWorkbenchPlanCustomEdgeCandidate,
  ObjectWorkbenchPlanOverlay,
  ObjectWorkbenchPlanPresetDimensionAnnotation,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type {
  ObjectWorkbenchPergolaRenderSource,
  ObjectWorkbenchPergolaRenderStatus,
} from '@/lib/drawings/geometry/deriveWorkbenchGeometry';
import type { ModulePlanModel } from './moduleViews';
import {
  ObjectWorkbenchDimensionLayerRenderer,
  ObjectWorkbenchOverlayLayerRenderer,
  ObjectWorkbenchPreviewLayerRenderer,
  TopProjectionLayerRenderer,
} from './ModulePlanLayerRenderers';
import { buildPlanSvgPresentationModel } from './ModulePlanSvgPresentationModel';
import {
  buildPlanSvgGeometryPresentation,
  resolvePlanSvgGeometryPresentationMode,
} from './ModulePlanSvgGeometryPresentation';
import { createPlanSvgPointResolvers, syncPlanSvgInteractionBridge } from './ModulePlanSvgBridge';
import {
  DebugOutline,
  FocusTarget,
  TickDimension,
  boundsFromPoints,
  clamp,
  formatMetres,
  memberSizeM,
  rectToPoints,
  rotatePointQuarterTurns,
  rotatePointsQuarterTurns,
  toPointsAttr,
  type Point,
} from './ModuleDrawingSurfacePrimitives';
import {
  HOUSE_FOOTPRINT_PRESET_OPTIONS,
  canEditHouseFootprintPlan,
  footprintLabelPoint,
  resolveFootprintCanvasLayout,
} from './ModulePlanFootprintPresentation';
import {
  ArrowHead,
  buildPlanFallAnnotationSpec,
  buildPlanInternalAngleAnnotationSpec,
  buildPlanRafterSpacingAnnotationSpec,
  geometryFallDirectionToCardinal,
} from './ModulePlanAnnotations';
import {
  attachmentFrameForRect,
  buildSheetDebugMetrics,
  getPlanRealExtents,
  getPlanSheetFrame,
  getSheetDrawingField,
  hasFullLengthPlanRidge,
  hipCornerInnerPoints,
  interiorPlanRafterXs,
  planHouseLineClass,
  planHouseSurfaceClass,
  planRotationTurnsForPresentation,
  pointOnAttachmentFrame,
  projectLinearPositions,
  resolvePlanFitBox,
  resolvePlanModelSpaceLayout,
  resolvePlanRotationFrame,
  resolvePlanSheetLayout,
} from './ModulePlanLayoutPresentation';
import type {
  ModuleDrawingDisplayMode,
  ModuleDrawingInteractiveFieldMap,
  ModuleDrawingPresentation,
  ModuleDrawingScaleDiagnostic,
  ModuleDrawingScaleState,
  ModuleFootprintCanvasPoint,
  ModuleFootprintEditorProps,
  ModulePlanInteractionProps,
  ModulePlanSheetInteractionProps,
  ObjectWorkbenchPlanShapeDragStartMeta,
  ObjectWorkbenchPreviewOverlay,
} from './ModuleDrawingContracts';

export function PlanSvg({
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
  enableProjectionOnlyModelInteractions = false,
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
  enableProjectionOnlyModelInteractions?: boolean;
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
  const geometryMode = resolvePlanSvgGeometryPresentationMode({
    presentation,
    showPergolaGeometry,
    modelSpacePergolaRenderSource,
    modelSpacePergolaRenderStatus,
    modelSpaceTopProjection,
    modelSpacePergolaGeometry,
  });
  const {
    useTopProjectionBackedPlan,
    useGeometryBackedPergola,
    useProjectionOnlyModelSpacePlan,
    canRenderPergolaPlanGeometry,
  } = geometryMode;
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
  const planPresentationInput = {
    isModel,
    useTopProjectionBackedPlan,
    useProjectionOnlyModelSpacePlan,
    modelSpaceTopProjection: modelSpaceTopProjection ?? null,
    familyVisibility,
    baseX: x,
    baseY: y,
    scale,
    rawObjectWorkbenchOverlayShapes,
    rawObjectWorkbenchPresetAnnotations,
    rawObjectWorkbenchCustomEdgeCandidates,
    rawObjectWorkbenchPreviewShape,
    enableProjectionOnlyModelInteractions,
  };
  const planPresentation = buildPlanSvgPresentationModel(planPresentationInput);
  const {
    renderedTopProjectionShapes,
    topProjectionPergolaHitPoints,
    visibleObjectWorkbenchDeckIds,
    objectWorkbenchOverlayShapes,
    renderObjectWorkbenchCommittedBodies,
    objectWorkbenchPresetAnnotations,
    objectWorkbenchCustomEdgeCandidates,
    objectWorkbenchPreviewShape,
    diagnostics: planPresentationDiagnostics,
  } = planPresentation;
  const geometryPresentation = buildPlanSvgGeometryPresentation({
    model,
    presentation,
    mode: geometryMode,
    modelSpaceTopProjection,
    modelSpacePergolaGeometry,
    familyVisibility,
    objectWorkbenchOverlayShapes,
    visibleObjectWorkbenchDeckIds,
    customPolygonOverrideActive,
    hideHouseFootprint,
    baseX: x,
    baseY: y,
    scale,
  });
  const {
    geometryOutlinePoints,
    geometryRoofPlaneSurfaces,
    geometryRoofCladdingSurfaces,
    geometryPergolaStripMembers,
    geometryRafterMembers,
    geometryRidgeMembers,
    geometryAttachmentEdge,
    geometryFallAnchor,
    semanticPlanHouseSurfaces,
    semanticPlanHouseLines,
    hasSemanticPlanHouseContext,
  } = geometryPresentation;

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
    (!useTopProjectionBackedPlan ||
      (!useProjectionOnlyModelSpacePlan && (Boolean(footprintEditor?.isEditing) || customPolygonOverrideActive || isDrawOutlineDraftOpen)));
  const isMergedHouseModelDisplay = isModel && displayMode === 'house';
  const allowPergolaModelEditing = !isSheet && canRenderPergolaPlanGeometry && !isMergedHouseModelDisplay && !useProjectionOnlyModelSpacePlan;
  const showPinnedSheetPrimaryDimensions = isSheet && !isHipCorner;
  const showModelPrimaryDimensions = !isSheet && canRenderPergolaPlanGeometry && !useProjectionOnlyModelSpacePlan;
  const showModelSecondaryAnnotations = !isSheet && !isModel;
  const showPlanResizeHandles =
    isModel &&
    canRenderPergolaPlanGeometry &&
    !isMergedHouseModelDisplay &&
    Boolean(planInteraction?.available) &&
    !isHipCorner &&
    (!useProjectionOnlyModelSpacePlan || enableProjectionOnlyModelInteractions);
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
  const planSvgPointResolvers = createPlanSvgPointResolvers({
    origin: { x, y },
    scale,
    rotationFrame,
    footprintRect,
    attachmentSide,
    lengthA: model.lengthA,
    spanA: model.spanA,
    houseFootprintPreset: model.houseFootprintPreset,
    houseFootprintParams: model.houseFootprintParams,
    isHipCorner,
    useTopProjectionBackedPlan,
    topProjection: modelSpaceTopProjection,
  });
  const resolvePlanClientPoint = planSvgPointResolvers.resolveFootprintCanvasPoint;
  const resolveRawPlanClientPoint = planSvgPointResolvers.resolveRawPlanPoint;
  const resolveDeckDragPlanClientPoint = planSvgPointResolvers.resolveDeckDragPlanPoint;
  const planSvgRef = useRef<SVGSVGElement | null>(null);
  const footprintEditorRef = useRef(footprintEditor);
  const planInteractionRef = useRef(planInteraction);
  const resolvePlanClientPointRef = useRef(resolvePlanClientPoint);
  const resolveRawPlanClientPointRef = useRef(resolveRawPlanClientPoint);
  const resolveDeckDragPlanClientPointRef = useRef(resolveDeckDragPlanClientPoint);

  useEffect(() => {
    footprintEditorRef.current = footprintEditor;
    planInteractionRef.current = planInteraction;
    resolvePlanClientPointRef.current = resolvePlanClientPoint;
    resolveRawPlanClientPointRef.current = resolveRawPlanClientPoint;
    resolveDeckDragPlanClientPointRef.current = resolveDeckDragPlanClientPoint;
  }, [
    footprintEditor,
    planInteraction,
    resolvePlanClientPoint,
    resolveRawPlanClientPoint,
    resolveDeckDragPlanClientPoint,
  ]);

  const syncPlanSvgBridge = useCallback((node: SVGSVGElement | null) => {
    syncPlanSvgInteractionBridge({
      node,
      footprintEditor: footprintEditorRef.current,
      planInteraction: planInteractionRef.current,
      resolvers: {
        resolveFootprintCanvasPoint: (svg, clientX, clientY) => resolvePlanClientPointRef.current(svg, clientX, clientY),
        resolveRawPlanPoint: (svg, clientX, clientY) => resolveRawPlanClientPointRef.current(svg, clientX, clientY),
        resolveDeckDragPlanPoint: (svg, clientX, clientY) => resolveDeckDragPlanClientPointRef.current(svg, clientX, clientY),
      },
    });
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
  }, [syncPlanSvgBridge, footprintEditor, planInteraction, resolvePlanClientPoint, resolveRawPlanClientPoint, resolveDeckDragPlanClientPoint]);

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
        data-model-space-render-contract={isModel ? planPresentationDiagnostics.renderContract : undefined}
        data-model-space-view-box={modelSpaceLayout?.viewBoxValue}
        data-model-space-world-box={modelSpaceLayout?.worldBoxValue}
        data-model-space-focus-box={modelSpaceLayout?.focusBoxValue}
        data-plan-render-source={exposesPlanProjectionDiagnostics ? modelSpacePergolaRenderSource : 'legacy'}
        data-plan-render-status={exposesPlanProjectionDiagnostics ? modelSpacePergolaRenderStatus : 'legacy_unsupported_family'}
        data-top-projection-parity-status={exposesPlanProjectionDiagnostics && planPresentationDiagnostics.topProjectionParityStatus ? planPresentationDiagnostics.topProjectionParityStatus : undefined}
        data-top-projection-screen-axis={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.topProjectionScreenAxis ?? undefined : undefined}
        data-top-projection-top-visible-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.topProjectionTopVisibleCount : undefined}
        data-top-projection-context-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.topProjectionContextCount : undefined}
        data-top-projection-hidden-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.topProjectionHiddenCount : undefined}
        data-top-projection-rendered-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.topProjectionRenderedCount : undefined}
        data-top-projection-hidden-rendered-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.topProjectionHiddenRenderedCount : undefined}
        data-plan-rendered-context-line-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.renderedTopProjectionContextLineCount : undefined}
        data-plan-wall-detail-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.renderedTopProjectionWallDetailCount : undefined}
        data-plan-deck-snap-frame-source={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.selectedDeckSnapFrameSource ?? undefined : undefined}
        data-plan-committed-top-projection-body-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.committedTopProjectionBodyCount : undefined}
        data-plan-committed-top-projection-object-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.committedTopProjectionObjectCount : undefined}
        data-plan-object-overlay-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.objectWorkbenchRenderedBodyCount : undefined}
        data-plan-visible-legacy-overlay-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.visibleLegacyPlanOverlayBodyCount : undefined}
        data-plan-visible-geometry-fallback-overlay-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.visibleGeometryFallbackOverlayBodyCount : undefined}
        data-plan-visible-top-projection-context-overlay-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.visibleTopProjectionContextOverlayBodyCount : undefined}
        data-plan-visible-top-projection-committed-overlay-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.visibleTopProjectionCommittedOverlayBodyCount : undefined}
        data-plan-rendered-context-body-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.renderedTopProjectionContextBodyCount : undefined}
        data-plan-suppressed-context-body-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.suppressedTopProjectionContextBodyCount : undefined}
        data-plan-suppressed-top-visible-body-count={exposesPlanProjectionDiagnostics && modelSpaceTopProjection ? planPresentationDiagnostics.suppressedTopProjectionTopVisibleBodyCount : undefined}
        data-plan-duplicate-visual-body-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.duplicateCommittedBodyCount : undefined}
        data-plan-duplicate-semantic-owner-count={exposesPlanProjectionDiagnostics ? planPresentationDiagnostics.duplicateSemanticOwnerCount : undefined}
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

        {useTopProjectionBackedPlan ? (
          <TopProjectionLayerRenderer
            shapes={renderedTopProjectionShapes}
            projection={modelSpaceTopProjection ?? null}
            hideHouseFootprint={hideHouseFootprint}
            customPolygonOverrideActive={customPolygonOverrideActive}
          />
        ) : null}

        {useTopProjectionBackedPlan && !useProjectionOnlyModelSpacePlan && showPergolaGeometry && geometryAttachmentEdge ? (
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
        {useTopProjectionBackedPlan && !useProjectionOnlyModelSpacePlan && showPergolaGeometry && geometryFallAnchor ? (
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
              {geometryPergolaStripMembers.map(({ member, footprint }) => (
                <g
                  key={member.id}
                  data-plan-member-id={member.id}
                  data-plan-member-role={member.role}
                  data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`}
                >
                  <polygon points={toPointsAttr(footprint)} className={styles.modulePlanPrimaryZone} />
                  <polygon points={toPointsAttr(footprint)} className={styles.modulePlanMemberEdge} />
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

        <ObjectWorkbenchOverlayLayerRenderer
          shapes={objectWorkbenchOverlayShapes}
          renderCommittedBodies={renderObjectWorkbenchCommittedBodies}
          previewShape={objectWorkbenchPreviewShape}
          hoveredDeckId={hoveredObjectWorkbenchDeckId ?? null}
          onDeckHoverChange={onObjectWorkbenchDeckHoverChange}
          onShapeSelect={onObjectWorkbenchShapeSelect}
          onShapeDragStart={onObjectWorkbenchShapeDragStart}
        />
        <ObjectWorkbenchPreviewLayerRenderer previewShape={objectWorkbenchPreviewShape} />
        <ObjectWorkbenchDimensionLayerRenderer
          customEdgeCandidates={objectWorkbenchCustomEdgeCandidates}
          presetAnnotations={objectWorkbenchPresetAnnotations}
          activeCustomEdgeId={activeObjectWorkbenchCustomEdgeId ?? null}
          previewShape={objectWorkbenchPreviewShape}
          onCustomEdgeSelect={onObjectWorkbenchCustomEdgeSelect}
          onDimensionActivate={onObjectWorkbenchDimensionActivate}
        />

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

