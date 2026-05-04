import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { DrawingWorkbenchGeometrySelectionKind } from '@/lib/drawings/state/drawingWorkbenchUiState';

export type WorkbenchSelectionTarget =
  | { kind: 'none' }
  | { kind: 'pergola'; pergolaId: string }
  | { kind: 'workbench'; targetKind: DrawingWorkbenchGeometrySelectionKind; targetId: string }
  | { kind: 'unhandled'; objectId: string };

export type SelectionClassifier = (objectId: string) => WorkbenchSelectionTarget;

export function routeSelectedObject(
  objectId: string | null | undefined,
  classify: SelectionClassifier,
): WorkbenchSelectionTarget {
  if (!objectId) return { kind: 'none' };
  return classify(objectId);
}

const OPENING_DERIVED_SUFFIX = /(?:-marker|-outline-\d+|-edge)$/;

export function stripOpeningDerivedSuffix(objectId: string): string {
  return objectId.replace(OPENING_DERIVED_SUFFIX, '');
}

export function defaultPrefixClassifier(objectId: string): WorkbenchSelectionTarget {
  if (objectId.startsWith('deck-') || objectId.startsWith('deck_')) {
    return { kind: 'workbench', targetKind: 'deck', targetId: objectId };
  }
  if (objectId.startsWith('opening-') || objectId.startsWith('opening_')) {
    return {
      kind: 'workbench',
      targetKind: 'opening',
      targetId: stripOpeningDerivedSuffix(objectId),
    };
  }
  if (objectId.startsWith('pergola-') || objectId.startsWith('pergola_')) {
    return { kind: 'pergola', pergolaId: objectId };
  }
  return { kind: 'unhandled', objectId };
}

export function topProjectionShapeClassifier(
  shape: GeometryTopProjectionShape,
): WorkbenchSelectionTarget {
  if (shape.family === 'pergola') {
    const pergolaIdCandidates: Array<string | null | undefined> = [
      typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null,
      shape.sourceObjectId,
      shape.sourceId,
      shape.id,
    ];
    const pergolaId =
      pergolaIdCandidates.find((value): value is string => Boolean(value)) ?? shape.id;
    return { kind: 'pergola', pergolaId };
  }
  if (shape.family === 'house') {
    const targetId = shape.sourceId ?? shape.sourceObjectId ?? shape.id;
    if (shape.kind === 'deck') {
      return { kind: 'workbench', targetKind: 'deck', targetId };
    }
    if (shape.kind === 'opening_marker' || shape.kind === 'opening_outline') {
      return { kind: 'workbench', targetKind: 'opening', targetId };
    }
    if (shape.kind === 'footprint') {
      return { kind: 'workbench', targetKind: 'footprint', targetId };
    }
    if (shape.kind === 'attachment_target') {
      return { kind: 'workbench', targetKind: 'attachment_zone', targetId };
    }
    if (shape.kind === 'roof') {
      return { kind: 'workbench', targetKind: 'roof', targetId };
    }
    return { kind: 'workbench', targetKind: 'house', targetId };
  }
  return { kind: 'unhandled', objectId: shape.id };
}
