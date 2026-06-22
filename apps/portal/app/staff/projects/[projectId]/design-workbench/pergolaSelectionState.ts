import {
  buildDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';

export function buildPergolaSelectionUiState(input: {
  current: DrawingWorkbenchUiState;
  pergolaId: string | null;
}): DrawingWorkbenchUiState {
  return {
    ...input.current,
    activePergolaId: input.pergolaId,
    ...buildDrawingWorkbenchObjectSelectionState({
      activeObjectRef: { family: 'pergolas', objectId: input.pergolaId },
    }),
    selection: { kind: 'none', targetId: null },
  };
}
