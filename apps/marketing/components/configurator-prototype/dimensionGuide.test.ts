import { describe, expect, it } from 'vitest';
import { solveSimpleCoverPreview } from './solvePreview';
import { INITIAL_INPUT } from './model';
import { dimensionGuide } from './dimensionGuide';

describe('preview dimension annotations use solved extents', () => {
  it.each([[1500, 6000], [5900, 2600], [10000, 1500]])('measures horizontal dimensions for %i × %i', (widthMm, projectionMm) => {
    const artifact = solveSimpleCoverPreview({ ...INITIAL_INPUT, widthMm, projectionMm });
    if (!('geometry' in artifact)) throw new Error('Expected solved preview');
    const { plan, assembly } = artifact.geometry;
    const roof = assembly.roofPlanes[0]!.boundary;
    const width = dimensionGuide(plan, roof, 'width');
    const projection = dimensionGuide(plan, roof, 'projection');
    expect(width.end.x - width.start.x).toBe(widthMm);
    expect(width.lengthMm).toBe(widthMm);
    expect(projection.end.y - projection.start.y).toBe(projectionMm);
    expect(projection.lengthMm).toBe(projectionMm);
    expect(projection.start.z).toBe(projection.end.z);
    expect(projection.edgeStart.z).not.toBe(projection.edgeEnd.z);
  });
});
