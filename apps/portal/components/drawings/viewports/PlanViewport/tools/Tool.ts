import type { GeometryTopProjectionShape } from '@sp/geometry';

export type ToolPointerEvent = {
  shape: GeometryTopProjectionShape | null;
  point: { x: number; y: number };
  button: number;
  pointerId: number;
};

export type Tool = {
  id: string;
  cursor?: string;
  onPointerDown?: (event: ToolPointerEvent) => void;
  onPointerMove?: (event: ToolPointerEvent) => void;
  onPointerUp?: (event: ToolPointerEvent) => void;
  onCancel?: () => void;
};
