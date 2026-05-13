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
      if (event.button !== 0) return;
      if (event.shape) {
        selectShape(event.shape, callbacks);
        return;
      }
      callbacks.onClearWorkbenchSelection?.();
    },
  };
}
