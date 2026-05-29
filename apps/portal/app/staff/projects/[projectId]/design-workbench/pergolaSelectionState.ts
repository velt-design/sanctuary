import {
  buildDrawingWorkbenchObjectSelectionState,
  type DrawingWorkbenchUiState,
} from '@/lib/drawings/state/drawingWorkbenchUiState';

export type PergolaSelectionModuleEntry = {
  drawingModule: {
    input: {
      pergolaId?: string | null;
    };
  };
};

export function resolvePergolaModuleIndex(input: {
  modules: ReadonlyArray<PergolaSelectionModuleEntry>;
  pergolaId: string | null | undefined;
}): number | null {
  if (!input.pergolaId) return null;
  const index = input.modules.findIndex(
    (module) => module.drawingModule.input.pergolaId === input.pergolaId,
  );
  return index >= 0 ? index : null;
}

export function buildPergolaSelectionUiState(input: {
  current: DrawingWorkbenchUiState;
  modules: ReadonlyArray<PergolaSelectionModuleEntry>;
  pergolaId: string | null;
}): DrawingWorkbenchUiState {
  const matchedModuleIndex = resolvePergolaModuleIndex({
    modules: input.modules,
    pergolaId: input.pergolaId,
  });

  return {
    ...input.current,
    activeModuleIndex: matchedModuleIndex ?? input.current.activeModuleIndex,
    ...buildDrawingWorkbenchObjectSelectionState({
      activeRailTab: 'pergolas',
      activeObjectRef: { family: 'pergolas', objectId: input.pergolaId },
    }),
    selection: { kind: 'none', targetId: null },
  };
}
