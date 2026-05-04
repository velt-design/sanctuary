import type { GeometryTopProjectionShape, GeometryTopProjectionViewModel } from '@sp/geometry';
import {
  topProjectionRole,
  topProjectionShapeVisualOwner,
  type ProjectionPlanLayer,
} from '@/lib/drawings/views/plan/planRenderGraph';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';

type ProjectionTopPoint = { x: number; y: number };

export type ProjectionTopItem = {
  shape: GeometryTopProjectionShape;
  points: ProjectionTopPoint[];
  layer: ProjectionPlanLayer;
};

export function toProjectionTopPointsAttr(points: ProjectionTopPoint[]): string {
  return points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function planHouseSurfaceClass(kind: 'roof' | 'soffit' | 'fascia' | 'attachment_zone' | 'footprint'): string {
  if (kind === 'roof') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
  if (kind === 'soffit') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
  if (kind === 'fascia') return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
  if (kind === 'attachment_zone') {
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
  }
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
}

function projectionTopShapeClass(shape: GeometryTopProjectionShape): string {
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
  if (
    shape.kind === 'post' ||
    shape.kind === 'beam' ||
    shape.kind === 'ledger' ||
    shape.kind === 'gutter' ||
    shape.kind === 'joiner'
  ) {
    return styles.modulePlanPrimaryZone;
  }
  return styles.modulePlanPrimaryZone;
}

function projectionTopShapeClassForLayer(shape: GeometryTopProjectionShape, layer: ProjectionPlanLayer): string {
  if (layer === 'contextLines') return styles.modulePlanTopProjectionLine;
  return projectionTopShapeClass(shape);
}

export function ProjectionTopCommittedBodyLayer({
  items,
  projection,
}: {
  items: ProjectionTopItem[];
  projection: GeometryTopProjectionViewModel;
}) {
  return (
    <>
      {items.map(({ shape, points, layer }) => {
        const isPergolaBody =
          shape.family === 'pergola' && (shape.kind === 'roof_plane' || shape.kind === 'roof_cladding');
        return (
          <polygon
            key={shape.id}
            points={toProjectionTopPointsAttr(points)}
            className={projectionTopShapeClassForLayer(shape, layer)}
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
            data-plan-member-id={
              shape.family === 'pergola' && !isPergolaBody ? shape.sourceId ?? shape.sourceObjectId : undefined
            }
            data-plan-member-role={shape.family === 'pergola' && !isPergolaBody ? shape.kind : undefined}
            data-plan-member-centerline-mm={
              typeof shape.metadata?.centerlineMm === 'string' ? shape.metadata.centerlineMm : undefined
            }
          />
        );
      })}
    </>
  );
}

export function ProjectionTopContextLineLayer({
  items,
  projection,
}: {
  items: ProjectionTopItem[];
  projection: GeometryTopProjectionViewModel;
}) {
  return (
    <>
      {items.map(({ shape, points, layer }) => (
        <polygon
          key={shape.id}
          points={toProjectionTopPointsAttr(points)}
          className={projectionTopShapeClassForLayer(shape, layer)}
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
          data-plan-detail-role={
            typeof shape.metadata?.planDetailRole === 'string' ? shape.metadata.planDetailRole : undefined
          }
          data-plan-snap-role={typeof shape.metadata?.snapRole === 'string' ? shape.metadata.snapRole : undefined}
          data-plan-source-edge-id={
            typeof shape.metadata?.sourceEdgeId === 'string' ? shape.metadata.sourceEdgeId : undefined
          }
          data-plan-source-wall-id={
            typeof shape.metadata?.sourceWallId === 'string' ? shape.metadata.sourceWallId : undefined
          }
        />
      ))}
    </>
  );
}

export function ProjectionTopSelectionOutlineLayer({ items }: { items: ProjectionTopItem[] }) {
  return (
    <>
      {items.map(({ shape, points }) => (
        <polygon
          key={`projection-top-selection-${shape.id}`}
          points={toProjectionTopPointsAttr(points)}
          data-plan-layer="selectionOutlines"
          data-plan-coordinate-space="top_projection_screen"
          data-plan-render-source="top_projection_committed"
          data-plan-visual-owner={topProjectionShapeVisualOwner(shape)}
          data-object-workbench-selection-outline={topProjectionShapeVisualOwner(shape)}
          className={styles.moduleHouseFirstSelectionOutline}
        />
      ))}
    </>
  );
}
