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
  WorkbenchPergolaRenderSource,
  WorkbenchPergolaRenderStatus,
} from '@/lib/drawings/state/workbenchSolvedModel';
import type { ModulePlanModel } from './moduleViews';
import {
  ObjectWorkbenchDimensionLayerRenderer,
  ObjectWorkbenchOverlayLayerRenderer,
  ObjectWorkbenchPreviewLayerRenderer,
} from './ModulePlanLayerRenderers';
import { ModulePlanDimensionLayer } from './ModulePlanDimensionLayer';
import { ModulePlanFootprintEditLayer } from './ModulePlanFootprintEditLayer';
import { ModulePlanHouseLayer } from './ModulePlanHouseLayer';
import { ModulePlanPergolaLayer } from './ModulePlanPergolaLayer';
import { ModulePlanPopoverLayer } from './ModulePlanPopoverLayer';
import { buildPlanSvgPresentationModel } from './ModulePlanSvgPresentationModel';
import {
  buildPlanSvgGeometryPresentation,
  resolveObjectWorkbenchHousePolygonOverlay,
  resolvePlanSvgGeometryPresentationMode,
} from './ModulePlanSvgGeometryPresentation';
import { createPlanSvgPointResolvers, syncPlanSvgInteractionBridge } from './ModulePlanSvgBridge';
import {
  DebugOutline,
  FocusTarget,
  boundsFromPoints,
  clamp,
  formatMetres,
  memberSizeM,
  rectToPoints,
  rotatePointQuarterTurns,
  rotatePointsQuarterTurns,
  type Point,
} from './ModuleDrawingSurfacePrimitives';
import {
  canEditHouseFootprintPlan,
  footprintLabelPoint,
  resolveFootprintCanvasLayout,
} from './ModulePlanFootprintPresentation';
import {
  buildPlanFallAnnotationSpec,
  buildPlanInternalAngleAnnotationSpec,
  buildPlanRafterSpacingAnnotationSpec,
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
  modelSpacePergolaRenderSource = 'none',
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
  modelSpacePergolaRenderSource?: WorkbenchPergolaRenderSource;
  modelSpacePergolaRenderStatus?: WorkbenchPergolaRenderStatus;
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
    const overlayHousePolygon = resolveObjectWorkbenchHousePolygonOverlay({
      overlay: objectWorkbenchPlanOverlay,
      useTopProjectionBackedPlan,
      modelSpaceTopProjection,
      baseX: x,
      baseY: y,
      scale,
    });
    if (overlayHousePolygon) return overlayHousePolygon;
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
          <ModulePlanHouseLayer
            effectiveHousePolygon={effectiveHousePolygon}
            hasSemanticPlanHouseContext={hasSemanticPlanHouseContext}
            hatchId={hatchId}
            houseLabel={houseLabel}
            isSheetFootprintEditor={isSheetFootprintEditor}
            renderLegacyHouseContext={renderLegacyHouseContext}
            semanticPlanHouseLines={semanticPlanHouseLines}
            semanticPlanHouseSurfaces={semanticPlanHouseSurfaces}
            showFootprintControls={showFootprintControls}
            showHouseHoverState={showHouseHoverState}
            showHouseHoverTarget={showHouseHoverTarget}
            showHouseLabel={showHouseLabel}
            onHouseContextHoverChange={footprintEditor?.onContextHoverChange}
          />
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

        <ModulePlanPergolaLayer
          aH={aH}
          aW={aW}
          attachmentSide={attachmentSide}
          bW={bW}
          bottomY={bottomY}
          canRenderPergolaPlanGeometry={canRenderPergolaPlanGeometry}
          centerX={centerX}
          centerY={centerY}
          currentPergolaId={currentPergolaId}
          customPolygonOverrideActive={customPolygonOverrideActive}
          fallEnd={fallEnd}
          fallIsHorizontal={fallIsHorizontal}
          fallLabelPoint={fallLabelPoint}
          fallStart={fallStart}
          geometryAttachmentEdge={geometryAttachmentEdge}
          geometryFallAnchor={geometryFallAnchor}
          geometryOutlinePoints={geometryOutlinePoints}
          geometryPergolaStripMembers={geometryPergolaStripMembers}
          geometryRafterMembers={geometryRafterMembers}
          geometryRidgeMembers={geometryRidgeMembers}
          geometryRoofCladdingSurfaces={geometryRoofCladdingSurfaces}
          geometryRoofPlaneSurfaces={geometryRoofPlaneSurfaces}
          gutterW={gutterW}
          hasFullLengthRidge={hasFullLengthRidge}
          hasSemanticPlanHouseContext={hasSemanticPlanHouseContext}
          hideHouseFootprint={hideHouseFootprint}
          hipInner={hipInner}
          hipRidgeEndX={hipRidgeEndX}
          hipRidgeStartX={hipRidgeStartX}
          isGableLike={isGableLike}
          isHipCorner={isHipCorner}
          isModel={isModel}
          isSheet={isSheet}
          model={model}
          modelSpaceTopProjection={modelSpaceTopProjection}
          overhangDepth={overhangDepth}
          overhangWidth={overhangWidth}
          overhangX={overhangX}
          overhangY={overhangY}
          presentation={presentation}
          primaryPoints={primaryPoints}
          renderedTopProjectionShapes={renderedTopProjectionShapes}
          ridgeBandW={ridgeBandW}
          ridgeBandWidth={ridgeBandWidth}
          ridgeBandX={ridgeBandX}
          ridgeBandY={ridgeBandY}
          scale={scale}
          showModelSecondaryAnnotations={showModelSecondaryAnnotations}
          showPergolaGeometry={showPergolaGeometry}
          sideFrameW={sideFrameW}
          soffitBracketLines={soffitBracketLines}
          soffitGuideEnd={soffitGuideEnd}
          soffitGuideStart={soffitGuideStart}
          soffitXs={soffitXs}
          splitY={splitY}
          topFrameW={topFrameW}
          topProjectionPergolaHitPoints={topProjectionPergolaHitPoints}
          useGeometryBackedPergola={useGeometryBackedPergola}
          useProjectionOnlyModelSpacePlan={useProjectionOnlyModelSpacePlan}
          useTopProjectionBackedPlan={useTopProjectionBackedPlan}
          x={x}
          y={y}
          yBottomInner={yBottomInner}
          yTopInner={yTopInner}
          gableMidY={gableMidY}
          insetPoints={insetPoints}
          interiorRafterXsA={interiorRafterXsA}
          interiorRafterXsB={interiorRafterXsB}
          rafterW={rafterW}
          onPergolaSelect={onPergolaSelect}
          onPergolaHoverChange={sheetPlanInteraction?.onPergolaHoverChange}
        />

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

        <ModulePlanDimensionLayer
          aH={aH}
          aW={aW}
          bW={bW}
          bottomDimensionField={bottomDimensionField}
          bottomDimensionLabel={bottomDimensionLabel}
          bottomY={bottomY}
          dimBaseY={dimBaseY}
          dimensionOffsets={dimensionOffsets}
          gutterW={gutterW}
          interactiveFields={interactiveFields}
          isHipCorner={isHipCorner}
          leftDimensionField={leftDimensionField}
          leftDimensionLabel={leftDimensionLabel}
          model={model}
          planInteraction={planInteraction}
          planResizeHandles={planResizeHandles}
          pinnedBottomDimensionY={pinnedBottomDimensionY}
          pinnedLeftDimensionX={pinnedLeftDimensionX}
          presentation={presentation}
          rafterDimY={rafterDimY}
          rafterXsA={rafterXsA}
          rotatedPrimaryBounds={rotatedPrimaryBounds}
          scale={scale}
          secondaryDimY={secondaryDimY}
          sheetFallAnnotationSpec={sheetFallAnnotationSpec}
          sheetInternalAngleAnnotationSpec={sheetInternalAngleAnnotationSpec}
          sheetSpacingAnnotationSpec={sheetSpacingAnnotationSpec}
          showModelPrimaryDimensions={showModelPrimaryDimensions}
          showModelSecondaryAnnotations={showModelSecondaryAnnotations}
          showPergolaGeometry={showPergolaGeometry}
          showPinnedSheetPrimaryDimensions={showPinnedSheetPrimaryDimensions}
          splitY={splitY}
          y={y}
          yBottomInner={yBottomInner}
          x={x}
          allowPergolaModelEditing={allowPergolaModelEditing}
          scope="rotated"
        />

        <ModulePlanFootprintEditLayer
          allowAttachmentSideCanvasSelect={allowAttachmentSideCanvasSelect}
          allowResizeEdgeDrag={allowResizeEdgeDrag}
          canEditFootprint={canEditFootprint}
          customPolygonHasError={customPolygonHasError}
          edgeFrames={edgeFrames}
          editorSurface={editorSurface}
          footprintCanvasLayout={footprintCanvasLayout}
          footprintEditor={footprintEditor}
          handleSpecs={handleSpecs}
          resizeEdgeSpecs={resizeEdgeSpecs}
          scale={scale}
          showFootprintControls={showFootprintControls}
          attachmentSideCanvasActiveSide={attachmentSideCanvasActiveSide}
        />
      </g>
      <ModulePlanDimensionLayer
        aH={aH}
        aW={aW}
        bW={bW}
        bottomDimensionField={bottomDimensionField}
        bottomDimensionLabel={bottomDimensionLabel}
        bottomY={bottomY}
        dimBaseY={dimBaseY}
        dimensionOffsets={dimensionOffsets}
        gutterW={gutterW}
        interactiveFields={interactiveFields}
        isHipCorner={isHipCorner}
        leftDimensionField={leftDimensionField}
        leftDimensionLabel={leftDimensionLabel}
        model={model}
        planInteraction={planInteraction}
        planResizeHandles={planResizeHandles}
        pinnedBottomDimensionY={pinnedBottomDimensionY}
        pinnedLeftDimensionX={pinnedLeftDimensionX}
        presentation={presentation}
        rafterDimY={rafterDimY}
        rafterXsA={rafterXsA}
        rotatedPrimaryBounds={rotatedPrimaryBounds}
        scale={scale}
        secondaryDimY={secondaryDimY}
        sheetFallAnnotationSpec={sheetFallAnnotationSpec}
        sheetInternalAngleAnnotationSpec={sheetInternalAngleAnnotationSpec}
        sheetSpacingAnnotationSpec={sheetSpacingAnnotationSpec}
        showModelPrimaryDimensions={showModelPrimaryDimensions}
        showModelSecondaryAnnotations={showModelSecondaryAnnotations}
        showPergolaGeometry={showPergolaGeometry}
        showPinnedSheetPrimaryDimensions={showPinnedSheetPrimaryDimensions}
        splitY={splitY}
        y={y}
        yBottomInner={yBottomInner}
        x={x}
        allowPergolaModelEditing={allowPergolaModelEditing}
        scope="sheet"
      />
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
      <ModulePlanPopoverLayer
        activeEdgeTagLabel={activeEdgeTagLabel}
        activeEdgeTagStyle={activeEdgeTagStyle}
        footprintEditor={footprintEditor}
        houseFootprintPreset={model.houseFootprintPreset}
        housePopoverStyle={housePopoverStyle}
        isSheetFootprintEditor={isSheetFootprintEditor}
        pergolaPopoverStyle={pergolaPopoverStyle}
        sheetPlanInteraction={sheetPlanInteraction}
        showHousePopover={showHousePopover}
        showPergolaPopover={showPergolaPopover}
      />
    </>
  );
}
