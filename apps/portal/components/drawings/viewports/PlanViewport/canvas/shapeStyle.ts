import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { ProjectionPlanLayer } from '@/lib/drawings/views/plan/planRenderGraph';
import styles from '@/app/staff/calculator/CalculatorGrid.module.css';

function houseSurfaceClass(
  kind: 'roof' | 'soffit' | 'fascia' | 'attachment_zone' | 'footprint',
): string {
  switch (kind) {
    case 'roof':
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseRoof}`;
    case 'soffit':
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseSoffit}`;
    case 'fascia':
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFascia}`;
    case 'attachment_zone':
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseAttachmentZone}`;
    case 'footprint':
      return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint}`;
  }
}

function houseShapeClass(shape: GeometryTopProjectionShape): string {
  if (shape.kind === 'deck') {
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseDeck}`;
  }
  if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseOpening}`;
  }
  if (shape.kind === 'roof' || shape.kind === 'house_roof_material') {
    return houseSurfaceClass('roof');
  }
  if (shape.kind === 'soffit') return houseSurfaceClass('soffit');
  if (shape.kind === 'fascia') return houseSurfaceClass('fascia');
  if (shape.kind === 'attachment_zone') return houseSurfaceClass('attachment_zone');
  if (shape.kind === 'footprint') return houseSurfaceClass('footprint');
  if (shape.kind === 'gutter' || shape.kind === 'roof_feature' || shape.kind === 'wall_segment') {
    return `${styles.modulePlanHouseSurface} ${styles.modulePlanTopProjectionLine}`;
  }
  return `${styles.modulePlanHouseSurface} ${styles.modulePlanHouseFootprint} ${styles.modulePlanTopProjectionReference}`;
}

function pergolaShapeClass(shape: GeometryTopProjectionShape): string {
  if (shape.kind === 'roof_cladding') return styles.modulePlanBoxInset;
  if (shape.kind === 'rafter') return styles.modulePlanRafter;
  if (shape.kind === 'ridge') return styles.modulePlanRidgeBand;
  return styles.modulePlanPrimaryZone;
}

export function planShapeClass(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house') return houseShapeClass(shape);
  if (shape.family === 'reference') return styles.modulePlanTopProjectionReference;
  return pergolaShapeClass(shape);
}

export function planShapeClassForLayer(
  shape: GeometryTopProjectionShape,
  layer: ProjectionPlanLayer,
): string {
  if (layer === 'contextLines') return styles.modulePlanTopProjectionLine;
  return planShapeClass(shape);
}
