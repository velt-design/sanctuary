import { useCallback, useState } from 'react';
import type { GeometryTopProjectionShape } from '@sp/geometry';

export type HoveredShape = {
  shapeId: string;
  family: GeometryTopProjectionShape['family'];
  kind: string;
};

export type UseHoveredShapeOutput = {
  hoveredShape: HoveredShape | null;
  onShapeEnter: (shape: GeometryTopProjectionShape) => void;
  onShapeLeave: (shapeId: string) => void;
};

export function useHoveredShape(): UseHoveredShapeOutput {
  const [hoveredShape, setHoveredShape] = useState<HoveredShape | null>(null);

  const onShapeEnter = useCallback((shape: GeometryTopProjectionShape) => {
    setHoveredShape({ shapeId: shape.id, family: shape.family, kind: shape.kind });
  }, []);

  const onShapeLeave = useCallback((shapeId: string) => {
    setHoveredShape((current) => (current?.shapeId === shapeId ? null : current));
  }, []);

  return { hoveredShape, onShapeEnter, onShapeLeave };
}
