import { describe, expect, it } from 'vitest';
import { buildViewerSceneModel, solveAssembly3D } from '@sp/geometry';
import { getGeometryFixtureCase } from './fixtures';

function requireSupportedFixture(id: string) {
  const fixture = getGeometryFixtureCase(id);
  if (!fixture || fixture.kind !== 'supported') {
    throw new Error(`Missing supported fixture: ${id}`);
  }
  return fixture;
}

describe('buildViewerSceneModel', () => {
  it('produces deterministic layer grouping for mono, gable, and box assemblies', () => {
    const fixtureIds = [
      'mono_attached_soffit_away_standard',
      'gable_attached_standard',
      'box_attached_standard',
    ] as const;

    for (const fixtureId of fixtureIds) {
      const fixture = requireSupportedFixture(fixtureId);
      const solveResult = solveAssembly3D(fixture.config);
      if (!solveResult.ok) {
        throw new Error(`Expected fixture ${fixtureId} to solve: ${solveResult.error}`);
      }

      const scene = buildViewerSceneModel(solveResult.value);
      expect(scene.layers.map((layer) => layer.id), fixtureId).toEqual([
        'house',
        'posts',
        'beams',
        'rafters',
        'gutters',
        'roof_planes',
        'attachment_edge',
      ]);
    }
  });

  it('preserves member geometry fields for rendered member objects', () => {
    const fixture = requireSupportedFixture('gable_attached_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const ridge = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'ridge');

    expect(ridge).toMatchObject({
      id: 'ridge',
      type: 'member_prism',
      role: 'ridge',
      sourceId: 'ridge',
      renderMode: 'prism',
    });

    if (!ridge || ridge.type !== 'member_prism') {
      throw new Error('Expected ridge member prism.');
    }

    expect(ridge.lengthMm).toBeGreaterThan(0);
    expect(ridge.centerline.start.x).toBe(0);
    expect(ridge.profile.depthMm).toBeGreaterThan(0);
    expect(ridge.localFrame.origin.y).toBe(2000);
  });

  it('preserves roof-plane geometry fields for rendered roof-plane objects', () => {
    const fixture = requireSupportedFixture('box_attached_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const roofPlane = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'roof_plane' && object.id === 'box-roof');

    expect(roofPlane).toMatchObject({
      id: 'box-roof',
      type: 'roof_plane',
      sourceId: 'box-roof',
    });

    if (!roofPlane || roofPlane.type !== 'roof_plane') {
      throw new Error('Expected box roof plane.');
    }

    expect(roofPlane.boundary).toHaveLength(4);
    expect(roofPlane.plane.origin.y).toBe(150);
    expect(roofPlane.fallVector.y).toBeGreaterThan(0);
  });

  it('falls back to line render metadata for unsupported profile shapes', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const mutated = structuredClone(solveResult.value);
    const beam = mutated.members.find((member) => member.id === 'outer-beam');
    if (!beam) {
      throw new Error('Expected outer-beam.');
    }
    beam.profile.shape = 'custom';

    const scene = buildViewerSceneModel(mutated);
    const outerBeam = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-beam');

    expect(outerBeam).toMatchObject({
      id: 'outer-beam',
      type: 'member_prism',
      renderMode: 'line_fallback',
    });

    if (!outerBeam || outerBeam.type !== 'member_prism') {
      throw new Error('Expected outer beam member object.');
    }

    expect(outerBeam.metadata).toMatchObject({
      profileShapeFallback: true,
      unsupportedProfileShape: 'custom',
    });
  });

  it('is independent of source member ordering', () => {
    const fixture = requireSupportedFixture('gable_freestanding_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const reordered = structuredClone(solveResult.value);
    reordered.members.reverse();
    reordered.roofPlanes.reverse();

    expect(buildViewerSceneModel(reordered)).toEqual(buildViewerSceneModel(solveResult.value));
  });
});
