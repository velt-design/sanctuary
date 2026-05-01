import type { ObjectWorkbenchDeckPatch } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type {
  ObjectWorkbenchPlanDeckInteraction,
  ObjectWorkbenchPlanShapeOverlay,
  PlanPoint,
} from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { InteractionToolDiagnostics, InteractionToolPointer } from './interactionToolController';
import {
  buildDeckDragSession,
  buildDeckObjectPatchCommit,
  resolveDeckCommitTransformDiagnostics,
  resolveDeckPreviewState,
  type DeckCommitTransformDiagnostics,
  type DeckDragSession,
  type DeckObjectRef,
  type DeckPreviewState,
  type DeckSvgInteraction,
} from './deckInteractionAdapter';

export type DeckMoveStartInput = {
  deckId: string;
  overlayShape: ObjectWorkbenchPlanShapeOverlay;
  svgInteraction: DeckSvgInteraction;
};

export type DeckMoveStartResult =
  | {
      ok: true;
      session: DeckDragSession;
      diagnostics: InteractionToolDiagnostics;
    }
  | {
      ok: false;
      diagnostics: InteractionToolDiagnostics;
    };

export type DeckReleaseCommitSource =
  | 'none'
  | 'custom_outline'
  | 'snapped_frame_commit'
  | 'floating_rect_from_projection_preview';

export type DeckMoveReleaseResult = {
  target: DeckObjectRef;
  patch: ObjectWorkbenchDeckPatch;
  preview: DeckPreviewState;
  releasePlacement: DeckPreviewState['releasePlacement'];
  commitSource: DeckReleaseCommitSource;
  commitCoordinateSpace: DeckCommitTransformDiagnostics['commitCoordinateSpace'];
  commitTransform: DeckCommitTransformDiagnostics;
  diagnostics: InteractionToolDiagnostics;
};

function projectionBackedDeckDrag(interaction: ObjectWorkbenchPlanDeckInteraction | null | undefined): boolean {
  return (
    interaction?.dragSource === 'top_projection_committed' ||
    interaction?.dragCoordinateSpace === 'top_projection_world_m'
  );
}

function buildDiagnostics(input: {
  status: InteractionToolDiagnostics['status'];
  source?: string | null;
  coordinateSpace?: string | null;
  message?: string | null;
}): InteractionToolDiagnostics {
  return {
    toolId: 'deck_move',
    source: input.source ?? 'none',
    coordinateSpace: input.coordinateSpace ?? 'unknown',
    status: input.status,
    message: input.message ?? null,
  };
}

export function startDeckMoveTool(input: DeckMoveStartInput, pointer: InteractionToolPointer): DeckMoveStartResult {
  const interaction = input.overlayShape.deckInteraction;
  if (!interaction) {
    return {
      ok: false,
      diagnostics: buildDiagnostics({
        status: 'blocked',
        message: 'Deck interaction metadata is unavailable.',
      }),
    };
  }

  const requiresProjectionPoint = projectionBackedDeckDrag(interaction);
  if (requiresProjectionPoint && !pointer.planPoint) {
    return {
      ok: false,
      diagnostics: buildDiagnostics({
        status: 'blocked',
        source: interaction.dragSource,
        coordinateSpace: interaction.dragCoordinateSpace,
        message: 'Projection-backed deck drag requires a resolved projection plan point.',
      }),
    };
  }

  const session = buildDeckDragSession({
    pointerId: pointer.pointerId,
    clientX: pointer.clientX,
    clientY: pointer.clientY,
    startSvgX: pointer.svgPoint.x,
    startSvgY: pointer.svgPoint.y,
    startDragPlanPoint: pointer.planPoint ?? null,
    deckId: input.deckId,
    overlayShape: input.overlayShape,
    svgInteraction: input.svgInteraction,
  });

  if (!session) {
    return {
      ok: false,
      diagnostics: buildDiagnostics({
        status: 'blocked',
        source: interaction.dragSource,
        coordinateSpace: interaction.dragCoordinateSpace,
        message: 'Unable to start deck drag.',
      }),
    };
  }

  return {
    ok: true,
    session,
    diagnostics: buildDiagnostics({
      status: 'active',
      source: session.dragSource,
      coordinateSpace: session.dragCoordinateSpace,
    }),
  };
}

export function moveDeckMoveTool(input: {
  session: DeckDragSession;
  pointer: InteractionToolPointer;
  previousPreviewState: DeckPreviewState | null;
}): DeckPreviewState {
  return resolveDeckPreviewState({
    session: input.session,
    nextSvgX: input.pointer.svgPoint.x,
    nextSvgY: input.pointer.svgPoint.y,
    nextDragPlanPoint: input.pointer.planPoint ?? null,
    previousPreviewState: input.previousPreviewState,
  });
}

export function resolveDeckMoveCommitSource(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): DeckReleaseCommitSource {
  if (input.session.interaction.kind === 'custom_outline') return 'custom_outline';
  return input.preview.releasePlacement === 'floating'
    ? 'floating_rect_from_projection_preview'
    : 'snapped_frame_commit';
}

export function releaseDeckMoveTool(input: {
  session: DeckDragSession;
  preview: DeckPreviewState;
}): DeckMoveReleaseResult {
  const commit = buildDeckObjectPatchCommit(input);
  const commitTransform = resolveDeckCommitTransformDiagnostics(input);
  const commitSource = resolveDeckMoveCommitSource(input);

  return {
    target: commit.target,
    patch: commit.patch,
    preview: input.preview,
    releasePlacement: input.preview.releasePlacement,
    commitSource,
    commitCoordinateSpace: commitTransform.commitCoordinateSpace,
    commitTransform,
    diagnostics: buildDiagnostics({
      status: 'committed',
      source: input.session.dragSource,
      coordinateSpace: input.session.dragCoordinateSpace,
    }),
  };
}

export function cancelDeckMoveTool(session: DeckDragSession | null): InteractionToolDiagnostics {
  return buildDiagnostics({
    status: session ? 'idle' : 'blocked',
    source: session?.dragSource ?? 'none',
    coordinateSpace: session?.dragCoordinateSpace ?? 'unknown',
    message: session ? null : 'No active deck drag session.',
  });
}

export function translateDeckPointerForTest(point: PlanPoint): InteractionToolPointer {
  return {
    pointerId: 1,
    clientX: point.x,
    clientY: point.y,
    svgPoint: point,
    planPoint: point,
  };
}
