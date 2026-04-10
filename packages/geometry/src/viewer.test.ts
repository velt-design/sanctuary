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
    const fixtureIds = {
      mono_attached_soffit_away_standard: [
        'house',
        'posts',
        'beams',
        'support_beams',
        'rafters',
        'joiners',
        'gutters',
        'roof_cladding',
        'roof_planes',
        'attachment_edge',
      ],
      gable_attached_standard: [
        'house',
        'posts',
        'beams',
        'support_beams',
        'rafters',
        'joiners',
        'gutters',
        'roof_cladding',
        'roof_planes',
        'attachment_edge',
      ],
      box_attached_standard: [
        'house',
        'posts',
        'beams',
        'rafters',
        'joiners',
        'gutters',
        'roof_cladding',
        'roof_planes',
        'attachment_edge',
      ],
    } as const;

    for (const [fixtureId, expectedLayers] of Object.entries(fixtureIds)) {
      const fixture = requireSupportedFixture(fixtureId);
      const solveResult = solveAssembly3D(fixture.config);
      if (!solveResult.ok) {
        throw new Error(`Expected fixture ${fixtureId} to solve: ${solveResult.error}`);
      }

      const scene = buildViewerSceneModel(solveResult.value);
      expect(scene.layers.map((layer) => layer.id), fixtureId).toEqual(expectedLayers);
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
    expect(ridge.localFrame.yAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(ridge.localFrame.zAxis).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('preserves corrected beam and rafter local-frame orientation for the viewer', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const outerBeam = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-beam');
    const rafter = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'rafter-1');

    if (!outerBeam || outerBeam.type !== 'member_prism') {
      throw new Error('Expected outer beam member prism.');
    }
    if (!rafter || rafter.type !== 'member_prism') {
      throw new Error('Expected mono rafter member prism.');
    }

    expect(outerBeam.localFrame.yAxis).toEqual({ x: 0, y: 1, z: 0 });
    expect(outerBeam.localFrame.zAxis).toEqual({ x: 0, y: 0, z: 1 });
    expect(rafter.localFrame.yAxis.x).toBeCloseTo(-1, 6);
    expect(rafter.localFrame.yAxis.y).toBeCloseTo(0, 6);
    expect(rafter.localFrame.yAxis.z).toBeCloseTo(0, 6);
    expect(rafter.localFrame.zAxis.x).toBeCloseTo(0, 6);
    expect(rafter.localFrame.zAxis.y).toBeCloseTo(0.074447, 5);
    expect(rafter.localFrame.zAxis.z).toBeCloseTo(0.997225, 5);
  });

  it('renders the mono gutter from an outline-backed profile extrusion', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const outerGutter = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-gutter');

    expect(outerGutter).toMatchObject({
      id: 'outer-gutter',
      type: 'member_prism',
      renderMode: 'outline_extrusion',
    });

    if (!outerGutter || outerGutter.type !== 'member_prism') {
      throw new Error('Expected outer gutter member prism.');
    }

    expect(outerGutter.profile.profileKey).toBe('sp_gutter');
    expect(outerGutter.profile.shape).toBe('custom');
    expect(outerGutter.lengthMm).toBe(6090);
    expect(outerGutter.profile.sectionOutline?.length).toBeGreaterThanOrEqual(3);
    expect(outerGutter.profile.anchors).toMatchObject({
      backFaceY: -50,
      frontFaceY: 50,
      roofBearingFaceY: -24.003203,
      roofBearingFaceZ: 73.009886,
    });
    expect(outerGutter.metadata).toMatchObject({
      renderedFromOutline: true,
      bodyInsetStartMm: 3,
      bodyInsetEndMm: 3,
      endCapStartMm: 3,
      endCapEndMm: 3,
      endCapWidthMm: 100,
      endCapDepthMm: 150,
    });
  });

  it('renders mono joiners from the DXF-backed outline profile', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const joiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'joiner-1');

    expect(joiner).toMatchObject({
      id: 'joiner-1',
      type: 'member_prism',
      renderMode: 'outline_extrusion',
    });

    if (!joiner || joiner.type !== 'member_prism') {
      throw new Error('Expected joiner member prism.');
    }

    expect(joiner.profile.profileKey).toBe('sp_joiners');
    expect(joiner.profile.shape).toBe('custom');
    expect(joiner.profile.widthMm).toBe(50);
    expect(joiner.profile.depthMm).toBe(16);
    expect(joiner.profile.sectionOutline).toHaveLength(20);
  });

  it('moves the mono outer support beam into a hidden structural layer when the outer edge is an integrated SP gutter', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const beamLayer = scene.layers.find((layer) => layer.id === 'beams');
    const supportBeamLayer = scene.layers.find((layer) => layer.id === 'support_beams');
    const gutterLayer = scene.layers.find((layer) => layer.id === 'gutters');

    expect(beamLayer?.objects.some((object) => object.id === 'outer-beam')).toBe(false);
    expect(supportBeamLayer?.visibleByDefault).toBe(false);
    expect(supportBeamLayer?.objects.find((object) => object.id === 'outer-beam')).toMatchObject({
      id: 'outer-beam',
      type: 'member_prism',
      role: 'beam',
    });
    expect(gutterLayer?.visibleByDefault).toBe(true);
    expect(gutterLayer?.objects.find((object) => object.id === 'outer-gutter')).toMatchObject({
      id: 'outer-gutter',
      type: 'member_prism',
      role: 'gutter',
    });
  });

  it('keeps standard gable gutters primary and routes paired support beams into the hidden support layer', () => {
    const attachedFixture = requireSupportedFixture('gable_attached_standard');
    const attachedSolveResult = solveAssembly3D(attachedFixture.config);
    if (!attachedSolveResult.ok) {
      throw new Error(attachedSolveResult.error);
    }

    const attachedScene = buildViewerSceneModel(attachedSolveResult.value);
    const attachedBeamLayer = attachedScene.layers.find((layer) => layer.id === 'beams');
    const attachedSupportLayer = attachedScene.layers.find((layer) => layer.id === 'support_beams');
    const attachedGutter = attachedScene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-gutter');

    expect(attachedBeamLayer?.objects.some((object) => object.id === 'outer-beam')).toBe(false);
    expect(attachedSupportLayer?.visibleByDefault).toBe(false);
    expect(attachedSupportLayer?.objects.find((object) => object.id === 'outer-beam')).toMatchObject({
      id: 'outer-beam',
      type: 'member_prism',
      role: 'beam',
    });
    expect(attachedGutter).toMatchObject({
      id: 'outer-gutter',
      type: 'member_prism',
      renderMode: 'outline_extrusion',
    });

    if (!attachedGutter || attachedGutter.type !== 'member_prism') {
      throw new Error('Expected attached gable outer gutter member prism.');
    }

    expect(attachedGutter.profile.profileKey).toBe('sp_gutter');
    expect(attachedGutter.lengthMm).toBe(6590);
    expect(attachedGutter.metadata).toMatchObject({
      bodyInsetStartMm: 3,
      bodyInsetEndMm: 3,
      endCapWidthMm: 100,
      endCapDepthMm: 150,
    });

    const freestandingFixture = requireSupportedFixture('gable_freestanding_standard');
    const freestandingSolveResult = solveAssembly3D(freestandingFixture.config);
    if (!freestandingSolveResult.ok) {
      throw new Error(freestandingSolveResult.error);
    }

    const freestandingScene = buildViewerSceneModel(freestandingSolveResult.value);
    const freestandingBeamLayer = freestandingScene.layers.find((layer) => layer.id === 'beams');
    const freestandingSupportLayer = freestandingScene.layers.find((layer) => layer.id === 'support_beams');
    const houseGutter = freestandingScene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'house-gutter');
    const outerGutter = freestandingScene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-gutter');

    expect(freestandingBeamLayer?.objects.some((object) => object.id === 'house-beam')).toBe(false);
    expect(freestandingBeamLayer?.objects.some((object) => object.id === 'outer-beam')).toBe(false);
    expect(freestandingSupportLayer?.visibleByDefault).toBe(false);
    expect(freestandingSupportLayer?.objects.map((object) => object.id).sort()).toEqual(['house-beam', 'outer-beam']);

    if (!houseGutter || houseGutter.type !== 'member_prism' || !outerGutter || outerGutter.type !== 'member_prism') {
      throw new Error('Expected freestanding gable gutter member prisms.');
    }

    expect(houseGutter.renderMode).toBe('outline_extrusion');
    expect(outerGutter.renderMode).toBe('outline_extrusion');
    expect(houseGutter.profile.profileKey).toBe('sp_gutter');
    expect(outerGutter.profile.profileKey).toBe('sp_gutter');
    expect(houseGutter.lengthMm).toBe(6590);
    expect(outerGutter.lengthMm).toBe(6590);
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

  it('projects mono acrylic roof cladding panels into their own visible layer and hides structural roof planes by default', () => {
    const fixture = requireSupportedFixture('mono_attached_soffit_away_standard');
    const solveResult = solveAssembly3D(fixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const claddingLayer = scene.layers.find((layer) => layer.id === 'roof_cladding');
    const roofPlaneLayer = scene.layers.find((layer) => layer.id === 'roof_planes');
    const panel = claddingLayer?.objects.find((object) => object.type === 'roof_cladding_panel' && object.id === 'acrylic-panel-1');

    expect(claddingLayer?.visibleByDefault).toBe(true);
    expect(roofPlaneLayer?.visibleByDefault).toBe(false);
    expect(panel).toMatchObject({
      id: 'acrylic-panel-1',
      type: 'roof_cladding_panel',
      sourceId: 'acrylic-panel-1',
      material: 'acrylic',
      thicknessMm: 6,
    });

    if (!panel || panel.type !== 'roof_cladding_panel') {
      throw new Error('Expected mono acrylic cladding panel object.');
    }

    expect(panel.boundary).toHaveLength(4);
    expect(panel.metadata).toMatchObject({
      index: 1,
      areaMm2: expect.any(Number),
      gutterEmbedMm: 15,
    });
  });

  it('projects gable acrylic roof cladding into visible house and outer roof-half layers while keeping roof planes secondary', () => {
    const fixture = requireSupportedFixture('gable_attached_standard');
    const acrylicFixture = structuredClone(fixture);
    acrylicFixture.config.roof.material = 'acrylic';
    acrylicFixture.config.roofCovering.kind = 'acrylic';
    acrylicFixture.config.roofCovering.houseAllowanceMm = 50;

    const solveResult = solveAssembly3D(acrylicFixture.config);
    if (!solveResult.ok) {
      throw new Error(solveResult.error);
    }

    const scene = buildViewerSceneModel(solveResult.value);
    const claddingLayer = scene.layers.find((layer) => layer.id === 'roof_cladding');
    const roofPlaneLayer = scene.layers.find((layer) => layer.id === 'roof_planes');
    const housePanel = claddingLayer?.objects.find(
      (object) => object.type === 'roof_cladding_panel' && object.id === 'house-acrylic-panel-1',
    );
    const outerPanel = claddingLayer?.objects.find(
      (object) => object.type === 'roof_cladding_panel' && object.id === 'outer-acrylic-panel-1',
    );
    const houseJoiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'house-joiner-1');
    const outerJoiner = scene.layers
      .flatMap((layer) => layer.objects)
      .find((object) => object.type === 'member_prism' && object.id === 'outer-joiner-1');

    expect(claddingLayer?.visibleByDefault).toBe(true);
    expect(roofPlaneLayer?.visibleByDefault).toBe(false);
    expect(housePanel).toMatchObject({
      id: 'house-acrylic-panel-1',
      type: 'roof_cladding_panel',
      material: 'acrylic',
      thicknessMm: 6,
    });
    expect(outerPanel).toMatchObject({
      id: 'outer-acrylic-panel-1',
      type: 'roof_cladding_panel',
      material: 'acrylic',
      thicknessMm: 6,
    });

    if (!houseJoiner || houseJoiner.type !== 'member_prism' || !outerJoiner || outerJoiner.type !== 'member_prism') {
      throw new Error('Expected gable acrylic joiner member prisms.');
    }

    expect(houseJoiner.renderMode).toBe('outline_extrusion');
    expect(outerJoiner.renderMode).toBe('outline_extrusion');
    expect(houseJoiner.profile.profileKey).toBe('sp_joiners');
    expect(outerJoiner.profile.profileKey).toBe('sp_joiners');
  });

  it('falls back to line render metadata when a non-rectangular profile is missing its section outline', () => {
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
    beam.profile.sectionOutline = null;

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
