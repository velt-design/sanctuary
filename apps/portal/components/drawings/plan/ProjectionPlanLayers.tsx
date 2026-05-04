import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanOpeningInteraction,
  ObjectWorkbenchPlanOverlay,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import {
  topProjectionRole,
  topProjectionShapeVisualOwner,
  type ProjectionPlanLayer,
} from '@/lib/drawings/views/plan/planRenderGraph';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';

export type ProjectionPlanPoint = { x: number; y: number };

export type ProjectionPlanTopProjectionItem = {
  shape: GeometryTopProjectionShape;
  points: ProjectionPlanPoint[];
  layer: ProjectionPlanLayer;
};

export type ProjectionPlanOverlayShape = ObjectWorkbenchPlanOverlay['shapes'][number] & {
  points: ProjectionPlanPoint[];
  detailSegments: Array<{ start: ProjectionPlanPoint; end: ProjectionPlanPoint }>;
  deckInteractionSvg?: (ObjectWorkbenchPlanDeckInteraction & {
    hostEdgeStart: ProjectionPlanPoint;
    hostEdgeEnd: ProjectionPlanPoint;
  }) | null;
  openingInteractionSvg?: (ObjectWorkbenchPlanOpeningInteraction & {
    hostEdgeStart: ProjectionPlanPoint;
    hostEdgeEnd: ProjectionPlanPoint;
  }) | null;
};

export type ProjectionPlanPreviewShape = {
  ownerKind: 'deck' | 'opening';
  ownerId: string;
  points: ProjectionPlanPoint[];
  bodyState: 'floating' | 'snap-available' | 'snapped' | 'blocked' | 'grabbed' | 'settling';
  anchorPoint: ProjectionPlanPoint | null;
  lockedCornerPoint: ProjectionPlanPoint | null;
  endCatchPoint: ProjectionPlanPoint | null;
  referenceGuide: {
    start: ProjectionPlanPoint;
    end: ProjectionPlanPoint;
    state: 'none' | 'reference' | 'snap-lane';
  } | null;
  targetHighlights: Array<{
    start: ProjectionPlanPoint;
    end: ProjectionPlanPoint;
    state: 'preview' | 'snap-available' | 'snapped';
  }>;
} | null;

export type ProjectionPlanShapeDragStartMeta =
  | {
      ownerKind: 'deck';
      ownerId: string;
      overlayShape: ObjectWorkbenchPlanOverlay['shapes'][number];
      deckInteraction: ObjectWorkbenchPlanDeckInteraction & {
        hostEdgeStart: ProjectionPlanPoint;
        hostEdgeEnd: ProjectionPlanPoint;
      };
    }
  | {
      ownerKind: 'opening';
      ownerId: string;
      openingInteraction: ObjectWorkbenchPlanOpeningInteraction & {
        hostEdgeStart: ProjectionPlanPoint;
        hostEdgeEnd: ProjectionPlanPoint;
      };
    };

function toPointsAttr(points: ProjectionPlanPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function planHouseSurfaceClass(kind: 'roof' | 'soffit' | 'fascia' | 'attachment_zone' | 'footprint'): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
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
    if (shape.kind === 'gutter' || shape.kind === 'roof_feature' || shape.kind === 'wall_segment') {
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

function topProjectionShapeClassForLayer(shape: GeometryTopProjectionShape, layer: ProjectionPlanLayer): string {
  if (layer === 'contextLines') return styles.modulePlanTopProjectionLine;
  return topProjectionShapeClass(shape);
}

function objectWorkbenchShapeVisualOwner(shape: Pick<ObjectWorkbenchPlanOverlay['shapes'][number], 'ownerKind' | 'ownerId'>): string {
  if (shape.ownerKind === 'footprint') return 'house';
  return `${shape.ownerKind}:${shape.ownerId}`;
}

export function ProjectionCommittedBodyLayer({
  items,
  projection,
  pergolaTargetId,
  onPergolaSelect,
}: {
  items: ProjectionPlanTopProjectionItem[];
  projection: GeometryTopProjectionViewModel;
  pergolaTargetId?: string | null;
  onPergolaSelect?: (pergolaId: string) => void;
}) {
  return (
    <>
      {items.map(({ shape, points, layer }) => {
        const isPergolaBody = shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding');
        const resolvedPergolaTargetId = isPergolaBody ? pergolaTargetId ?? 'pergola-1' : null;
        return (
          <polygon
            key={shape.id}
            points={toPointsAttr(points)}
            className={topProjectionShapeClassForLayer(shape, layer)}
            data-plan-layer={layer}
            data-plan-coordinate-space="top_projection_screen"
            data-plan-render-source="top_projection_committed"
            data-plan-visual-owner={topProjectionShapeVisualOwner(shape)}
            data-plan-top-projection-shape={shape.id}
            data-top-projection-source-object-id={shape.sourceObjectId}
            data-top-projection-source-id={shape.sourceId ?? ''}
            data-top-projection-source-type={shape.sourceType}
            data-top-projection-family={shape.family}
            data-top-projection-kind={shape.kind}
            data-top-projection-role={topProjectionRole(shape)}
            data-top-projection-z-min={shape.zMin ?? ''}
            data-top-projection-z-max={shape.zMax ?? ''}
            data-top-projection-screen-axis={`${projection.screenAxis.x}_${projection.screenAxis.y}`}
            data-pergola-shape-hit={resolvedPergolaTargetId ?? undefined}
            data-pergola-shape-hit-source={resolvedPergolaTargetId ? 'top_projection_committed' : undefined}
            data-house-plan-surface={
              shape.family === 'house' &&
              shape.kind !== 'gutter' &&
              shape.kind !== 'roof_feature' &&
              shape.kind !== 'attachment_target' &&
              shape.kind !== 'wall_segment'
                ? shape.kind
                : undefined
            }
            data-plan-primary-fill={shape.family === 'pergola' && shape.kind === 'roof_plane' ? 'true' : undefined}
            data-plan-geometry-surface={isPergolaBody ? shape.kind : undefined}
            data-plan-surface-id={isPergolaBody ? shape.sourceId ?? shape.sourceObjectId : undefined}
            data-plan-member-id={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.sourceId ?? shape.sourceObjectId : undefined}
            data-plan-member-role={shape.family === 'pergola' && shape.kind !== 'roof_plane' && shape.kind !== 'roof_cladding' ? shape.kind : undefined}
            data-plan-member-centerline-mm={typeof shape.metadata?.centerlineMm === 'string' ? shape.metadata.centerlineMm : undefined}
            onClick={resolvedPergolaTargetId ? () => onPergolaSelect?.(resolvedPergolaTargetId) : undefined}
          />
        );
      })}
    </>
  );
}

export function ProjectionContextLineLayer({
  items,
  projection,
}: {
  items: ProjectionPlanTopProjectionItem[];
  projection: GeometryTopProjectionViewModel;
}) {
  return (
    <>
      {items.map(({ shape, points, layer }) => (
        <polygon
          key={shape.id}
          points={toPointsAttr(points)}
          className={topProjectionShapeClassForLayer(shape, layer)}
          data-plan-layer={layer}
          data-plan-coordinate-space="top_projection_screen"
          data-plan-render-source="top_projection_context"
          data-plan-visual-owner={topProjectionShapeVisualOwner(shape)}
          data-plan-top-projection-shape={shape.id}
          data-top-projection-source-object-id={shape.sourceObjectId}
          data-top-projection-source-id={shape.sourceId ?? ''}
          data-top-projection-source-type={shape.sourceType}
          data-top-projection-family={shape.family}
          data-top-projection-kind={shape.kind}
          data-top-projection-role={topProjectionRole(shape)}
          data-top-projection-screen-axis={`${projection.screenAxis.x}_${projection.screenAxis.y}`}
          data-house-plan-line={
            shape.family === 'house' &&
            (shape.kind === 'gutter' ||
              shape.kind === 'roof_feature' ||
              shape.kind === 'attachment_target' ||
              shape.kind === 'wall_segment')
              ? shape.kind
              : undefined
          }
          data-plan-detail-role={typeof shape.metadata?.planDetailRole === 'string' ? shape.metadata.planDetailRole : undefined}
          data-plan-snap-role={typeof shape.metadata?.snapRole === 'string' ? shape.metadata.snapRole : undefined}
          data-plan-source-edge-id={typeof shape.metadata?.sourceEdgeId === 'string' ? shape.metadata.sourceEdgeId : undefined}
          data-plan-source-wall-id={typeof shape.metadata?.sourceWallId === 'string' ? shape.metadata.sourceWallId : undefined}
        />
      ))}
    </>
  );
}

export function ProjectionSelectionOutlineLayer({ shapes }: { shapes: ProjectionPlanOverlayShape[] }) {
  return (
    <>
      {shapes
        .filter((shape) => shape.selected)
        .map((shape) => (
          <polygon
            key={`projection-selection-${shape.ownerKind}-${shape.ownerId}`}
            points={toPointsAttr(shape.points)}
            data-plan-layer="selectionOutlines"
            data-plan-coordinate-space="top_projection_screen"
            data-plan-render-source="top_projection_committed"
            data-plan-visual-owner={objectWorkbenchShapeVisualOwner(shape)}
            data-object-workbench-selection-outline={`${shape.ownerKind}:${shape.ownerId}`}
            data-house-first-selection-outline={`${shape.ownerKind}:${shape.ownerId}`}
            className={styles.moduleHouseFirstSelectionOutline}
          />
        ))}
    </>
  );
}

export function ProjectionPreviewLayer({ previewShape }: { previewShape: ProjectionPlanPreviewShape }) {
  if (!previewShape) return null;
  return (
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
          data-plan-layer="dragPreview"
          className={
            previewShape.referenceGuide.state === 'snap-lane'
              ? `${styles.moduleHouseFirstPreviewGuide} ${styles.moduleHouseFirstPreviewGuideSnapLane}`
              : styles.moduleHouseFirstPreviewGuide
          }
        />
      ) : null}
      {previewShape.targetHighlights.map((targetHighlight, index) => (
        <line
          key={`projection-preview-target-${previewShape.ownerId}-${index + 1}`}
          x1={targetHighlight.start.x}
          y1={targetHighlight.start.y}
          x2={targetHighlight.end.x}
          y2={targetHighlight.end.y}
          data-object-workbench-snap-target={targetHighlight.state}
          data-house-first-snap-target={targetHighlight.state}
          data-plan-layer="dragPreview"
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
          data-plan-layer="dragPreview"
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
          data-plan-layer="dragPreview"
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
          data-plan-layer="dragPreview"
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
          data-plan-layer="dragPreview"
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
  );
}

export function ProjectionObjectBadges({ shapes }: { shapes: ProjectionPlanOverlayShape[] }) {
  return (
    <>
      {shapes.map((shape) => {
        const centerX = shape.points.reduce((sum, point) => sum + point.x, 0) / Math.max(shape.points.length, 1);
        const centerY = shape.points.reduce((sum, point) => sum + point.y, 0) / Math.max(shape.points.length, 1);
        return (
          <g key={`projection-badges-${shape.ownerKind}-${shape.ownerId}`}>
            {shape.selected && shape.invalid ? (
              <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" className={styles.moduleHouseFirstInvalidBadge}>
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
            {(shape.ownerKind === 'deck' || shape.ownerKind === 'opening') &&
            shape.selected &&
            (shape.ownerKind === 'deck' ? shape.deckDragEligibility : shape.openingDragEligibility) ? (
              <text
                x={centerX}
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
      })}
    </>
  );
}

export function ProjectionHitTarget({
  shape,
  previewSuppressed,
  hoveredDeckId,
  onDeckHoverChange,
  onShapeSelect,
  onShapeDragStart,
}: {
  shape: ProjectionPlanOverlayShape;
  previewSuppressed: boolean;
  hoveredDeckId?: string | null;
  onDeckHoverChange?: (deckId: string | null) => void;
  onShapeSelect?: (target: { ownerKind: 'footprint' | 'deck' | 'opening'; ownerId: string }) => void;
  onShapeDragStart?: (
    meta: ProjectionPlanShapeDragStartMeta,
    event: { pointerId: number; clientX: number; clientY: number },
  ) => void;
}) {
  const handlePointerDown = (event: ReactPointerEvent<SVGPolygonElement>) => {
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
          deckInteraction: shape.deckInteractionSvg ?? {
            ...shape.deckInteraction,
            hostEdgeStart: shape.points[0] ?? shape.deckInteraction.hostEdgeStart,
            hostEdgeEnd: shape.points[1] ?? shape.deckInteraction.hostEdgeEnd,
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
          openingInteraction: shape.openingInteractionSvg ?? {
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
  };

  return (
    <polygon
      points={toPointsAttr(shape.points)}
      data-object-workbench-shape={`${shape.ownerKind}:${shape.ownerId}`}
      data-house-first-shape={`${shape.ownerKind}:${shape.ownerId}`}
      data-plan-layer="hitTargets"
      data-plan-coordinate-space="top_projection_screen"
      data-plan-render-source="top_projection_committed"
      data-plan-visual-owner={objectWorkbenchShapeVisualOwner(shape)}
      data-object-workbench-shape-visual="false"
      data-object-workbench-shape-muted={shape.muted ? 'true' : 'false'}
      data-house-first-shape-muted={shape.muted ? 'true' : 'false'}
      data-object-workbench-shape-invalid={shape.invalid ? 'true' : 'false'}
      data-house-first-shape-invalid={shape.invalid ? 'true' : 'false'}
      data-object-workbench-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-house-first-shape-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-object-workbench-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-house-first-shape-hit-preview-suppressed={previewSuppressed ? 'true' : 'false'}
      data-object-workbench-shape-hovered={shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined}
      data-house-first-shape-hovered={shape.ownerKind === 'deck' && hoveredDeckId === shape.ownerId ? 'true' : undefined}
      data-object-workbench-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
      data-house-first-shape-hit={`${shape.ownerKind}:${shape.ownerId}`}
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
      onPointerDown={handlePointerDown}
    />
  );
}
