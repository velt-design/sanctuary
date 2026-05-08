import type { GeometryTopProjectionShape } from '@sp/geometry';
import type { DrawingWorkbenchGeometrySelectionKind } from '@/lib/drawings/state/drawingWorkbenchUiState';

export type WorkbenchSelectionTarget =
  | { kind: 'none' }
  | { kind: 'pergola'; pergolaId: string }
  | { kind: 'workbench'; targetKind: DrawingWorkbenchGeometrySelectionKind; targetId: string }
  // Click-as-action: clicking a house_terminal_end shape in plan view
  // toggles whether that hip end renders as an open gable wall. This is
  // an action target rather than a selection target -- the workbench
  // shell mutates the house draft (openGableEndIds) and does NOT update
  // the active selection. Kept on this union so the existing dispatcher
  // can route it without a parallel pathway.
  | { kind: 'house_terminal_end_toggle'; endId: string; isOpen: boolean }
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
    // For decks: the canonical-outline shape is the `house_surface_solid`
    // prism whose `sourceId` is the solid's own id (`house-solid-deck-1`),
    // not the deck's id (`deck-1`). The geometry builder copies the deck.id
    // into `metadata.sourceId`. Prefer that when present so consumers
    // (selection, move, edge-drag) all resolve to the same deck.id without
    // each having to reinvent the lookup. Mirrors the pergola pattern
    // above (which prefers `metadata.pergolaId`). See
    // `docs/maintainability-principles.md` -- "workarounds belong at the
    // source": every consumer that needed `metadata.sourceId` was a
    // signal that the classifier was wrong.
    const taggedDeckId =
      shape.kind === 'deck' && typeof shape.metadata?.sourceId === 'string'
        ? shape.metadata.sourceId
        : null;
    const targetId = taggedDeckId ?? shape.sourceId ?? shape.sourceObjectId ?? shape.id;
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
      // Milestone 13 plan-view UX: a hip facet that corresponds to a
      // terminal end of a hipped roof carries `metadata.openGableEndId`
      // (added by `enrichHouseRoofShapesWithTerminalEnds` in
      // `packages/geometry/src/topProjection.ts`). Clicking that
      // specific roof facet should TOGGLE the end's open state rather
      // than select the roof. All other roof facets fall through to
      // the standard workbench roof selection.
      const terminalEndId =
        typeof shape.metadata?.openGableEndId === 'string'
          ? shape.metadata.openGableEndId
          : null;
      if (terminalEndId) {
        return {
          kind: 'house_terminal_end_toggle',
          endId: terminalEndId,
          isOpen: shape.metadata?.isOpen === true,
        };
      }
      return { kind: 'workbench', targetKind: 'roof', targetId };
    }
    return { kind: 'workbench', targetKind: 'house', targetId };
  }
  return { kind: 'unhandled', objectId: shape.id };
}
