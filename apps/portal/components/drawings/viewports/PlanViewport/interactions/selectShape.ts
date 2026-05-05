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
