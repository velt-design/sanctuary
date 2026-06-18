import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import type { AttachmentSide } from '@sp/costing';
import styles from './CalculatorGrid.module.css';
import { ArrowHead, geometryFallDirectionToCardinal } from './ModulePlanAnnotations';
import { TopProjectionLayerRenderer, type TopProjectionLayerItem } from './ModulePlanLayerRenderers';
import { toPointsAttr, type Point } from './ModuleDrawingSurfacePrimitives';
import type { ModuleDrawingPresentation } from './ModuleDrawingContracts';

type GeometryMemberFootprint = {
  member: {
    id: string;
    role: string;
    centerline: { start: Point; end: Point };
  };
  footprint: Point[];
};

type GeometrySurface = {
  id: string;
  kind: string;
  points: Point[];
};

type GeometryFallAnchor = {
  point: Point;
  direction: Point;
  dual?: boolean;
};

type GeometryAttachmentEdge = {
  start: Point;
  end: Point;
};

type ModulePlanPergolaLayerProps = {
  aH: number;
  aW: number;
  attachmentSide: AttachmentSide;
  bW: number;
  bottomY: number;
  canRenderPergolaPlanGeometry: boolean;
  centerX: number;
  centerY: number;
  currentPergolaId?: string | null;
  customPolygonOverrideActive: boolean;
  fallEnd: Point;
  fallIsHorizontal: boolean;
  fallLabelPoint: Point;
  fallStart: Point;
  geometryAttachmentEdge: GeometryAttachmentEdge | null;
  geometryFallAnchor: GeometryFallAnchor | null;
  geometryOutlinePoints: Point[];
  geometryPergolaStripMembers: GeometryMemberFootprint[];
  geometryRafterMembers: GeometryMemberFootprint[];
  geometryRidgeMembers: GeometryMemberFootprint[];
  geometryRoofCladdingSurfaces: GeometrySurface[];
  geometryRoofPlaneSurfaces: GeometrySurface[];
  gutterW: number;
  hasFullLengthRidge: boolean;
  hasSemanticPlanHouseContext: boolean;
  hideHouseFootprint: boolean;
  hipInner: Point[] | null;
  hipRidgeEndX: number;
  hipRidgeStartX: number;
  isGableLike: boolean;
  isHipCorner: boolean;
  isSheet: boolean;
  isModel: boolean;
  model: {
    boxPerimeterEnabled?: boolean;
    houseConnectionType?: string;
    overhangEnabled?: boolean;
    roofType?: string;
    slopeDirection?: string;
  };
  modelSpaceTopProjection?: GeometryTopProjectionViewModel | null;
  overhangDepth: number;
  overhangWidth: number;
  overhangX: number;
  overhangY: number;
  presentation: ModuleDrawingPresentation;
  primaryPoints: Point[];
  renderedTopProjectionShapes: TopProjectionLayerItem[];
  ridgeBandW: number;
  ridgeBandWidth: number;
  ridgeBandX: number;
  ridgeBandY: number;
  scale: number;
  showModelSecondaryAnnotations: boolean;
  showPergolaGeometry: boolean;
  sideFrameW: number;
  soffitBracketLines: Array<{ start: Point; end: Point }>;
  soffitGuideEnd: Point;
  soffitGuideStart: Point;
  soffitXs: number[];
  splitY: number;
  topFrameW: number;
  topProjectionPergolaHitPoints: Point[];
  useGeometryBackedPergola: boolean;
  useProjectionOnlyModelSpacePlan: boolean;
  useTopProjectionBackedPlan: boolean;
  x: number;
  y: number;
  yBottomInner: number;
  yTopInner: number;
  gableMidY: number;
  insetPoints: Point[];
  interiorRafterXsA: number[];
  interiorRafterXsB: number[];
  rafterW: number;
  onPergolaSelect?: (pergolaId: string) => void;
  onPergolaHoverChange?: (hovered: boolean) => void;
};

function GeometryFallAnnotation({
  anchor,
  presentation,
  scale,
}: {
  anchor: GeometryFallAnchor;
  presentation: ModuleDrawingPresentation;
  scale: number;
}) {
  const fallLineLength = Math.max(4.8, scale * 0.72);
  const halfLength = anchor.dual ? fallLineLength / 2 : fallLineLength * 0.35;
  const start = {
    x: anchor.point.x - anchor.direction.x * halfLength,
    y: anchor.point.y - anchor.direction.y * halfLength,
  };
  const end = {
    x: anchor.point.x + anchor.direction.x * halfLength,
    y: anchor.point.y + anchor.direction.y * halfLength,
  };
  const labelPoint = {
    x: anchor.point.x + (Math.abs(anchor.direction.x) >= Math.abs(anchor.direction.y) ? 0 : 2.2),
    y: anchor.point.y + (Math.abs(anchor.direction.x) >= Math.abs(anchor.direction.y) ? -2.2 : 0),
  };
  const arrowDirection = geometryFallDirectionToCardinal(anchor.direction);
  const reverseArrowDirection =
    arrowDirection === 'up' ? 'down' : arrowDirection === 'down' ? 'up' : arrowDirection === 'left' ? 'right' : 'left';

  return (
    <>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        className={styles.moduleFallLine}
        data-plan-fall-direction={`${anchor.direction.x},${anchor.direction.y}`}
      />
      {anchor.dual ? (
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
}

export function ModulePlanPergolaLayer({
  aH,
  aW,
  attachmentSide,
  bW,
  bottomY,
  canRenderPergolaPlanGeometry,
  centerX,
  centerY,
  currentPergolaId,
  customPolygonOverrideActive,
  fallEnd,
  fallIsHorizontal,
  fallLabelPoint,
  fallStart,
  geometryAttachmentEdge,
  geometryFallAnchor,
  geometryOutlinePoints,
  geometryPergolaStripMembers,
  geometryRafterMembers,
  geometryRidgeMembers,
  geometryRoofCladdingSurfaces,
  geometryRoofPlaneSurfaces,
  gutterW,
  hasFullLengthRidge,
  hasSemanticPlanHouseContext,
  hideHouseFootprint,
  hipInner,
  hipRidgeEndX,
  hipRidgeStartX,
  isGableLike,
  isHipCorner,
  isSheet,
  isModel,
  model,
  modelSpaceTopProjection,
  overhangDepth,
  overhangWidth,
  overhangX,
  overhangY,
  presentation,
  primaryPoints,
  renderedTopProjectionShapes,
  ridgeBandW,
  ridgeBandWidth,
  ridgeBandX,
  ridgeBandY,
  scale,
  showModelSecondaryAnnotations,
  showPergolaGeometry,
  sideFrameW,
  soffitBracketLines,
  soffitGuideEnd,
  soffitGuideStart,
  soffitXs,
  splitY,
  topFrameW,
  topProjectionPergolaHitPoints,
  useGeometryBackedPergola,
  useProjectionOnlyModelSpacePlan,
  useTopProjectionBackedPlan,
  x,
  y,
  yBottomInner,
  yTopInner,
  gableMidY,
  insetPoints,
  interiorRafterXsA,
  interiorRafterXsB,
  rafterW,
  onPergolaSelect,
  onPergolaHoverChange,
}: ModulePlanPergolaLayerProps) {
  const showPergolaSelectionHitTarget = !isSheet && canRenderPergolaPlanGeometry && Boolean(onPergolaSelect) && Boolean(currentPergolaId);
  const showPergolaHoverTarget = isSheet && Boolean(onPergolaHoverChange) && !isHipCorner;

  return (
    <>
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
        <GeometryFallAnnotation anchor={geometryFallAnchor} presentation={presentation} scale={scale} />
      ) : null}

      {canRenderPergolaPlanGeometry && !useTopProjectionBackedPlan ? (
        useGeometryBackedPergola ? (
          <>
            <polygon points={toPointsAttr(geometryOutlinePoints)} className={styles.modulePlanFill} data-plan-primary-fill="true" data-plan-geometry-outline="true" />
            {geometryRoofPlaneSurfaces.map((surface) => (
              <polygon key={surface.id} points={toPointsAttr(surface.points)} className={styles.modulePlanPrimaryZone} data-plan-geometry-surface={surface.kind} data-plan-surface-id={surface.id} />
            ))}
            {geometryRoofCladdingSurfaces.map((surface) => (
              <polygon key={surface.id} points={toPointsAttr(surface.points)} className={styles.modulePlanBoxInset} data-plan-geometry-surface={surface.kind} data-plan-surface-id={surface.id} />
            ))}
            {geometryPergolaStripMembers.map(({ member, footprint }) => (
              <g key={member.id} data-plan-member-id={member.id} data-plan-member-role={member.role} data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`}>
                <polygon points={toPointsAttr(footprint)} className={styles.modulePlanPrimaryZone} />
                <polygon points={toPointsAttr(footprint)} className={styles.modulePlanMemberEdge} />
              </g>
            ))}
            {geometryRafterMembers.map(({ member, footprint }) => (
              <polygon key={member.id} points={toPointsAttr(footprint)} className={styles.modulePlanRafter} data-plan-member-id={member.id} data-plan-member-role={member.role} data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`} />
            ))}
            {geometryRidgeMembers.map(({ member, footprint }) => (
              <polygon key={member.id} points={toPointsAttr(footprint)} className={styles.modulePlanRidgeBand} data-plan-member-id={member.id} data-plan-member-role={member.role} data-plan-member-centerline-mm={`${member.centerline.start.x},${member.centerline.start.y},${member.centerline.end.x},${member.centerline.end.y}`} />
            ))}
            <polygon points={toPointsAttr(geometryOutlinePoints)} className={styles.modulePlanPerimeter} />
            {geometryAttachmentEdge ? (
              <line x1={geometryAttachmentEdge.start.x} y1={geometryAttachmentEdge.start.y} x2={geometryAttachmentEdge.end.x} y2={geometryAttachmentEdge.end.y} className={styles.modulePlanHouseWall} data-plan-attachment-edge="geometry" data-house-plan-line="attachment_target" />
            ) : null}
            {geometryFallAnchor ? <GeometryFallAnnotation anchor={geometryFallAnchor} presentation={presentation} scale={scale} /> : null}
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
              <rect key={`rafter_a_${rx.toFixed(3)}`} x={rx - rafterW / 2} y={yTopInner} width={rafterW} height={Math.max(0.2, (isHipCorner ? splitY - gutterW : yBottomInner) - yTopInner)} className={styles.modulePlanRafter} />
            ))}
            {isHipCorner
              ? interiorRafterXsB.map((rx) => (
                  <rect key={`rafter_b_${rx.toFixed(3)}`} x={rx - rafterW / 2} y={splitY + topFrameW} width={rafterW} height={Math.max(0.2, bottomY - gutterW - (splitY + topFrameW))} className={styles.modulePlanRafter} />
                ))
              : null}
            {model.houseConnectionType === 'soffit' && soffitXs.length > 0 && !hasSemanticPlanHouseContext ? (
              <>
                <line x1={soffitGuideStart.x} y1={soffitGuideStart.y} x2={soffitGuideEnd.x} y2={soffitGuideEnd.y} className={styles.modulePlanSoffitGuide} />
                {soffitBracketLines.map((line, idx) => (
                  <line key={`bracket_${idx}`} x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} className={styles.modulePlanSoffitBracket} />
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
                <text x={fallLabelPoint.x} y={fallLabelPoint.y} className={`${styles.moduleFallLabel} ${presentation === 'sheet' ? styles.moduleFallLabelSheet : ''}`}>
                  fall both sides
                </text>
              </>
            ) : showModelSecondaryAnnotations ? (
              <>
                <ArrowHead x={model.slopeDirection === 'toward_house' ? fallStart.x : fallEnd.x} y={model.slopeDirection === 'toward_house' ? fallStart.y : fallEnd.y} direction={fallIsHorizontal ? (attachmentSide === 'left' ? 'left' : 'right') : model.slopeDirection === 'toward_house' ? 'up' : 'down'} presentation={presentation} />
                <text x={fallLabelPoint.x} y={fallLabelPoint.y} className={`${styles.moduleFallLabel} ${presentation === 'sheet' ? styles.moduleFallLabelSheet : ''}`}>
                  fall
                </text>
              </>
            ) : null}
          </>
        ) : null
      ) : null}

      {showPergolaSelectionHitTarget && currentPergolaId ? (
        <polygon
          points={toPointsAttr(useTopProjectionBackedPlan && topProjectionPergolaHitPoints.length > 0 ? topProjectionPergolaHitPoints : useGeometryBackedPergola && geometryOutlinePoints.length > 0 ? geometryOutlinePoints : primaryPoints)}
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
          onPointerEnter={() => onPergolaHoverChange?.(true)}
          onPointerLeave={() => onPergolaHoverChange?.(false)}
        />
      ) : null}
    </>
  );
}
