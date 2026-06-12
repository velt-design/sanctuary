import type { ObjectWorkbenchOpeningPatch } from '@/lib/drawings/state/objectWorkbenchViewportTypes';
import type { ObjectWorkbenchPlanShapeOverlay } from '@/lib/drawings/views/plan/objectWorkbenchPlanOverlay';
import type { InteractionToolDiagnostics, InteractionToolPointer } from './interactionToolController';
import {
  buildOpeningDragSession,
  buildOpeningObjectPatchCommit,
  resolveOpeningPreviewState,
  type OpeningDragSession,
  type OpeningObjectRef,
  type OpeningPreviewState,
  type OpeningSvgInteraction,
} from './openingInteractionAdapter';

type OpeningMoveStartInput = {
  openingId: string;
  overlayShape: ObjectWorkbenchPlanShapeOverlay;
  svgInteraction: OpeningSvgInteraction;
};

type OpeningMoveStartResult =
  | {
      ok: true;
      session: OpeningDragSession;
      diagnostics: InteractionToolDiagnostics;
    }
  | {
      ok: false;
      diagnostics: InteractionToolDiagnostics;
    };

type OpeningMoveReleaseResult = {
  target: OpeningObjectRef;
  patch: ObjectWorkbenchOpeningPatch;
  preview: OpeningPreviewState;
  commitCoordinateSpace: 'object_outline_plan_m';
  diagnostics: InteractionToolDiagnostics;
};

function buildDiagnostics(input: {
  status: InteractionToolDiagnostics['status'];
  message?: string | null;
}): InteractionToolDiagnostics {
  return {
    toolId: 'opening_move',
    source: 'object_outline_plan',
    coordinateSpace: 'object_outline_plan_m',
    status: input.status,
    message: input.message ?? null,
  };
}

export function startOpeningMoveTool(input: OpeningMoveStartInput, pointer: InteractionToolPointer): OpeningMoveStartResult {
  if (!input.overlayShape.openingInteraction) {
    return {
      ok: false,
      diagnostics: buildDiagnostics({
        status: 'blocked',
        message: 'Opening interaction metadata is unavailable.',
      }),
    };
  }

  const session = buildOpeningDragSession({
    pointerId: pointer.pointerId,
    startSvgX: pointer.svgPoint.x,
    startSvgY: pointer.svgPoint.y,
    openingId: input.openingId,
    overlayShape: input.overlayShape,
    svgInteraction: input.svgInteraction,
  });

  if (!session) {
    return {
      ok: false,
      diagnostics: buildDiagnostics({
        status: 'blocked',
        message: 'Unable to start opening drag.',
      }),
    };
  }

  return {
    ok: true,
    session,
    diagnostics: buildDiagnostics({ status: 'active' }),
  };
}

export function moveOpeningMoveTool(input: {
  session: OpeningDragSession;
  pointer: InteractionToolPointer;
}): OpeningPreviewState {
  return resolveOpeningPreviewState({
    session: input.session,
    nextSvgX: input.pointer.svgPoint.x,
    nextSvgY: input.pointer.svgPoint.y,
  });
}

export function releaseOpeningMoveTool(input: {
  session: OpeningDragSession;
  preview: OpeningPreviewState;
}): OpeningMoveReleaseResult {
  const commit = buildOpeningObjectPatchCommit(input);
  return {
    target: commit.target,
    patch: commit.patch,
    preview: input.preview,
    commitCoordinateSpace: 'object_outline_plan_m',
    diagnostics: buildDiagnostics({ status: 'committed' }),
  };
}
