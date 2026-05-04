import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';

function shapeIdentityValues(shape: GeometryTopProjectionShape): string[] {
  const candidates: Array<string | null | undefined> = [
    shape.id,
    shape.sourceId ?? null,
    shape.sourceObjectId,
    typeof shape.metadata?.deckId === 'string' ? shape.metadata.deckId : null,
    typeof shape.metadata?.openingId === 'string' ? shape.metadata.openingId : null,
    typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null,
    typeof shape.metadata?.houseFormId === 'string' ? shape.metadata.houseFormId : null,
  ];
  return candidates.filter((value): value is string => Boolean(value));
}

export function activeObjectMatchesPlanShape(
  activeObjectRef: WorkbenchObjectRef | null | undefined,
  shape: GeometryTopProjectionShape,
): boolean {
  if (!activeObjectRef) return false;
  const identities = shapeIdentityValues(shape);
  const objectId = activeObjectRef.objectId;

  switch (activeObjectRef.family) {
    case 'decks':
      return (
        shape.family === 'house' &&
        shape.kind === 'deck' &&
        Boolean(objectId && identities.includes(objectId))
      );
    case 'openings':
      return (
        shape.family === 'house' &&
        (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') &&
        Boolean(objectId && identities.includes(objectId))
      );
    case 'pergolas':
      return shape.family === 'pergola' && Boolean(objectId && identities.includes(objectId));
    case 'house_forms':
      return (
        shape.family === 'house' &&
        shape.kind !== 'deck' &&
        shape.kind !== 'opening_marker' &&
        shape.kind !== 'opening_outline' &&
        (!objectId || identities.includes(objectId) || shape.sourceType.startsWith('house_'))
      );
    default:
      return false;
  }
}
