import type { GeometryTopProjectionShape } from '@sp/geometry';

const DECORATIVE_HOUSE_HIT_TARGET_KINDS: ReadonlySet<string> = new Set([
  'roof',
  'fascia',
  'soffit',
  'gutter',
  'roof_feature',
]);

export function planHouseFormOwner(shape: GeometryTopProjectionShape): string | null {
  if (shape.family !== 'house') return null;
  const taggedHouseFormId =
    typeof shape.metadata?.houseFormId === 'string' ? shape.metadata.houseFormId : null;
  if (taggedHouseFormId) return taggedHouseFormId;
  if (shape.sourceType === 'house_reference') {
    return shape.sourceObjectId ?? shape.sourceId ?? null;
  }
  return null;
}

export function planShapeVisualOwner(shape: GeometryTopProjectionShape): string {
  if (shape.family === 'house' && shape.kind === 'deck') {
    return `deck:${shape.sourceId ?? shape.sourceObjectId ?? shape.id}`;
  }
  if (shape.family === 'house') return `house:${planHouseFormOwner(shape) ?? 'unowned'}`;
  if (shape.family === 'pergola') return `pergola:${shape.sourceObjectId ?? shape.sourceId ?? shape.id}`;
  return `${shape.family}:${shape.sourceObjectId ?? shape.sourceId ?? shape.id}`;
}

export function planShapeIsHouseRoofBody(shape: GeometryTopProjectionShape): boolean {
  return shape.family === 'house' && shape.kind === 'roof';
}

export function planShapeIsVisibleHouseReferenceFallback(shape: GeometryTopProjectionShape): boolean {
  return (
    shape.family === 'house' &&
    shape.kind === 'footprint' &&
    shape.sourceType === 'house_reference'
  );
}

export function planShapeIsPergolaDiagnosticFallback(shape: GeometryTopProjectionShape): boolean {
  return (
    shape.family === 'pergola' &&
    shape.sourceType === 'pergola_reference' &&
    shape.kind === 'outline' &&
    (shape.metadata?.renderRole === 'diagnostic_fallback' ||
      typeof shape.metadata?.fallbackReason === 'string')
  );
}

export function planShapeIsPlanHitTarget(shape: GeometryTopProjectionShape): boolean {
  if (shape.family === 'house' && DECORATIVE_HOUSE_HIT_TARGET_KINDS.has(shape.kind)) {
    return shape.kind === 'roof' && typeof shape.metadata?.openGableEndId === 'string';
  }
  return true;
}
