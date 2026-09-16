import type { GeometryPlanViewModel, Point3 } from '@sp/geometry';
import type { PreviewDimensionAxis } from './usePreviewDimension';

export function dimensionGuide(plan: GeometryPlanViewModel, roof: Point3[], axis: PreviewDimensionAxis) {
  const { minX, maxX, minY, maxY, lengthMm, projectionMm } = plan.extents;
  const front = roof.reduce((a, b) => b.y > a.y ? b : a);
  const back = roof.reduce((a, b) => b.y < a.y ? b : a);
  // Projection measures the horizontal footprint, not the longer pitched rafter.
  const start = axis === 'width' ? { x: minX, y: maxY, z: front.z } : { x: maxX, y: minY, z: front.z };
  const end = { x: maxX, y: maxY, z: front.z };
  const edgeStart = axis === 'width' ? { x: minX, y: front.y, z: front.z } : { x: maxX, y: back.y, z: back.z };
  const edgeEnd = { x: maxX, y: front.y, z: front.z };
  return { start, end, edgeStart, edgeEnd, lengthMm: axis === 'width' ? lengthMm : projectionMm };
}
