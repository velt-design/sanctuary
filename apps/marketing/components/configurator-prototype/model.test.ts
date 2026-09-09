import { describe, expect, it } from 'vitest';
import { solveCustomerConfigurationV1 } from '@sp/configurator/geometry';
import { configurationForSimpleCover, constrainPreviewConnection, INITIAL_INPUT } from './model';
import { solveSimpleCoverPreview } from './solvePreview';

describe('Simple cover preview design boundary', () => {
  it('allows soffit at 4m and resolves larger projections before rendering or pricing', () => {
    expect(constrainPreviewConnection({ ...INITIAL_INPUT, projectionMm: 4000, connection: 'soffit' }).connection).toBe('soffit');
    expect(constrainPreviewConnection({ ...INITIAL_INPUT, projectionMm: 4100, connection: 'soffit' })).toEqual({ ...INITIAL_INPUT, projectionMm: 4100, connection: 'fascia' });
    expect(constrainPreviewConnection({ ...INITIAL_INPUT, projectionMm: 6000 }).connection).toBe('facade');
  });
  it.each([1500, 5100, 6000, 10000])('updates the solved footprint across the preview width range at %i mm', (widthMm) => {
    const artifact = solveSimpleCoverPreview({ ...INITIAL_INPUT, widthMm });
    if (!('geometry' in artifact)) throw new Error(artifact.messages[0]?.message);
    expect(artifact.geometry.plan.extents.lengthMm).toBeCloseTo(widthMm, 0);
    expect(artifact.geometry.plan.extents.projectionMm).toBeCloseTo(INITIAL_INPUT.projectionMm, 0);
  });
  it.each(['facade', 'fascia', 'soffit'] as const)('solves matching Plan and 3D for %s without pricing fields', (connection) => {
    const configuration = configurationForSimpleCover({ ...INITIAL_INPUT, widthMm: 5100, projectionMm: 2700, connection });
    expect(configuration.intent.pergola.placement.connectionIntent).toBe(connection === 'facade' ? 'wall' : connection);
    expect(JSON.stringify(configuration)).not.toMatch(/price|calculationRef|costingConfiguration/);
    const artifact = solveCustomerConfigurationV1(configuration, { projectId: 'preview', estimateId: 'preview', designRequestId: 'preview' });
    expect('geometry' in artifact).toBe(true);
    if (!('geometry' in artifact)) throw new Error(artifact.messages[0]?.message);
    expect(artifact.geometry.plan.extents.lengthMm).toBeCloseTo(5100, 0);
    expect(artifact.geometry.plan.extents.projectionMm).toBeCloseTo(2700, 0);
    expect(artifact.geometry.viewerScene.layers.flatMap((layer) => layer.objects).length).toBeGreaterThan(0);
  });
});
