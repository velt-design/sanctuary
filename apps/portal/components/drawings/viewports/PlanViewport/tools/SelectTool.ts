import {
  selectShape,
  type ShapeSelectionCallbacks,
} from '../interactions/selectShape';
import type { Tool, ToolPointerEvent } from './Tool';

export type SelectToolConfig = ShapeSelectionCallbacks;

export function createSelectTool(callbacks: SelectToolConfig): Tool {
  return {
    id: 'select',
    cursor: 'default',
    onPointerDown(event: ToolPointerEvent) {
      // eslint-disable-next-line no-console
      console.log('[toggle-trace] C SelectTool onPointerDown', {
        button: event.button,
        hasShape: !!event.shape,
        shapeKind: event.shape?.kind,
        openGableEndId: event.shape?.metadata?.openGableEndId,
        hasToggleCallback: !!callbacks.onToggleHouseTerminalEnd,
      });
      if (event.button !== 0) return;
      if (event.shape) {
        selectShape(event.shape, callbacks);
        return;
      }
      callbacks.onClearWorkbenchSelection?.();
    },
  };
}
