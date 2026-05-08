import type { GeometryTopProjectionShape } from '@sp/geometry';
import {
  topProjectionShapeClassifier,
  type WorkbenchSelectionTarget,
} from '@/components/drawings/viewports/selection/selectionRouter';
import type { ObjectWorkbenchViewportTargetSelection } from '@/lib/drawings/state/objectWorkbenchViewportTypes';

export type ShapeSelectionCallbacks = {
  onSelectObjectWorkbenchTarget?: (selection: ObjectWorkbenchViewportTargetSelection) => void;
  onSelectPergolaTarget?: (pergolaId: string) => void;
  onClearWorkbenchSelection?: () => void;
  // Plan-view click on a house_terminal_end marker. The viewport passes
  // through whatever the dispatcher resolved -- the workbench shell is
  // responsible for actually inverting `isOpen` and committing the
  // updated `openGableEndIds` to the house draft.
  onToggleHouseTerminalEnd?: (endId: string, currentlyOpen: boolean) => void;
};

export function dispatchSelectionTarget(
  target: WorkbenchSelectionTarget,
  callbacks: ShapeSelectionCallbacks,
): void {
  switch (target.kind) {
    case 'pergola':
      callbacks.onSelectPergolaTarget?.(target.pergolaId);
      return;
    case 'workbench':
      callbacks.onSelectObjectWorkbenchTarget?.({
        kind: target.targetKind,
        targetId: target.targetId,
      });
      return;
    case 'house_terminal_end_toggle':
      callbacks.onToggleHouseTerminalEnd?.(target.endId, target.isOpen);
      return;
    case 'none':
      callbacks.onClearWorkbenchSelection?.();
      return;
    case 'unhandled':
      return;
  }
}

export function selectShape(
  shape: GeometryTopProjectionShape,
  callbacks: ShapeSelectionCallbacks,
): void {
  dispatchSelectionTarget(topProjectionShapeClassifier(shape), callbacks);
}
