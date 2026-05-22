import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot } from './legacyEstimateSnapshotAdapter';
import { addHouseFormToObjectFirstDraft } from './objectFirstWorkbenchAdapter';
import { buildWorkbenchSolvedModel } from './workbenchSolvedModel';

function getFixtureSnapshot(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]): Record<string, unknown> {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) {
    throw new Error(`Missing ${name} workbench fixture.`);
  }
  return fixture.snapshot;
}

describe('buildWorkbenchSolvedModel geometry artifact', () => {
  it('exposes one solved geometry artifact and compatibility aliases for geometry-ready modules', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const activeModule = solvedModel.activeModule;
    if (!activeModule) {
      throw new Error('Expected active solved module.');
    }
    const artifact = activeModule.geometryArtifact;
    if (!artifact) {
      throw new Error('Expected solved geometry artifact.');
    }

    expect(artifact.source).toBe('solved_geometry');
    expect(artifact.fallback).toBeNull();
    expect(artifact.previewMode).toBe(activeModule.previewMode);
    expect(artifact.resultSource).toBe(activeModule.resultSource);
    expect(artifact.deckSupport).toBe(activeModule.deckSupport);
    expect(artifact.renderSource).toBe(activeModule.renderSource);
    expect(artifact.renderStatus).toBe(activeModule.renderStatus);
    expect(artifact.trust).toBe(activeModule.trust);
    expect(activeModule.config).toBe(artifact.config);
    expect(activeModule.assembly).toBe(artifact.assembly);
    expect(activeModule.geometryPlan).toBe(artifact.plan);
    expect(activeModule.geometrySection).toBe(artifact.section);
    expect(activeModule.geometryTopProjection).toBe(artifact.topProjection);
    expect(activeModule.viewerScene).toBe(artifact.viewerScene);
    expect(activeModule.validation).toBe(artifact.validation);
    expect(activeModule.geometryPreview.kind).toBe('ready');
    if (activeModule.geometryPreview.kind !== 'ready') {
      throw new Error('Expected ready geometry preview.');
    }
    expect(activeModule.geometryPreview.config).toBe(artifact.config);
    expect(activeModule.geometryPreview.assembly).toBe(artifact.assembly);
    expect(activeModule.geometryPreview.validation).toBe(artifact.validation);
    expect(activeModule.geometryPreview.scene).toBe(artifact.viewerScene);
    expect(activeModule.geometryPreview.topProjection).toBe(artifact.topProjection);
    expect(activeModule.viewportGeometry.artifact).toBe(artifact);
    expect(activeModule.viewportGeometry.preview.kind).toBe('ready');
    if (activeModule.viewportGeometry.preview.kind !== 'ready') {
      throw new Error('Expected ready viewport preview.');
    }
    expect(activeModule.viewportGeometry.preview.assembly).toBe(artifact.assembly);
    expect(activeModule.viewportGeometry.preview.scene).toBe(artifact.viewerScene);
    expect(activeModule.viewportGeometry.preview.topProjection).toBe(artifact.topProjection);
    expect(activeModule.viewportGeometry.preview.validation).toBe(artifact.validation);
    expect(activeModule.viewportGeometry.legacyFallback.planModel).toBe(activeModule.planModel);
    expect(activeModule.viewportGeometry.legacyFallback.sectionModel).toBe(activeModule.sectionModel);
  });

  it('keeps invalid geometry outside the solved artifact contract', () => {
    const snapshot = structuredClone(getFixtureSnapshot('mono-standard')) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: { pergolas?: Array<{ modules?: Array<Record<string, unknown>> }> };
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
      throw new Error('Expected fixture module.');
    }
    snapshot.inputs.modules[0].lengthM = '';
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
    };

    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: snapshot as Record<string, unknown>,
    });

    expect(solvedModel.activeModule?.trust.status).toBe('invalid_geometry');
    expect(solvedModel.activeModule?.geometryArtifact).toBeNull();
    expect(solvedModel.activeModule?.viewportGeometry.artifact).toBeNull();
    expect(solvedModel.activeModule?.viewportGeometry.preview.kind).toBe('error');
    expect(solvedModel.activeModule?.viewerScene).toBeNull();
    expect(solvedModel.activeModule?.geometryTopProjection).toBeNull();
  });

  it('emits a house_reference shape in projectReferenceShapes for each additional house form (PR8c-iii)', () => {
    // End-to-end multi-form rendering check: starting from a single-form
    // legacy snapshot, author a second form via PR5's persistence helper,
    // attach to the draft's objectFirst slot, and run the solver. The
    // additional form must surface as a house_reference shape in the
    // project-level overlay so PlanViewport can render it at the authored
    // 10m east offset. Without PR8c-iii's solver wiring (PR8b's freestanding
    // geometry support + PR8c-i/ii's portal helpers), the form would be
    // persisted but invisible.
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
      snapshot,
      draft,
    });
    if (!baseline) throw new Error('Expected objectFirst baseline draft.');
    draft.objectFirst = addHouseFormToObjectFirstDraft({
      draft: baseline,
      label: 'Sleepout',
    });

    const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });

    const houseRefs = solvedModel.projectReferenceShapes.filter(
      (shape) => shape.sourceType === 'house_reference',
    );
    // One reference for the primary (emitted by the pergola overlay) plus
    // one for the additional form (emitted by PR8c-iii's new loop).
    expect(houseRefs.map((shape) => shape.sourceObjectId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    // Primary lives at world origin; additional form lives 10m east via
    // `addHouseFormToObjectFirstDraft`'s default offset. Every vertex of
    // the second polygon must be at x >= 10000 mm.
    const additional = houseRefs.find((shape) => shape.sourceObjectId === 'house-form-2');
    expect(additional).toBeDefined();
    for (const vertex of additional!.polygon) {
      expect(vertex.x).toBeGreaterThanOrEqual(10000);
    }
  });

  it('composes additional house form objects into the 3D viewerScene house layer (PR8d)', () => {
    // PR8c-iii made additional forms visible in PlanViewport's projection
    // overlay; PR8d closes the 3D gap by appending per-form
    // `house_line` / `house_surface_solid` objects to each pergola's
    // `viewerScene` house layer. After this, switching to the 3D viewport
    // shows the same two houses the plan view shows.
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
      snapshot,
      draft,
    });
    if (!baseline) throw new Error('Expected objectFirst baseline draft.');
    draft.objectFirst = addHouseFormToObjectFirstDraft({
      draft: baseline,
      label: 'Sleepout',
    });

    const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });
    const scene = solvedModel.activeModule?.viewerScene;
    if (!scene) throw new Error('Expected viewer scene for active module.');

    const houseLayer = scene.layers.find((layer) => layer.id === 'house');
    if (!houseLayer) throw new Error('Expected house layer in viewer scene.');

    // Find house_line wall_segment objects -- these are the wall edges.
    // With one form, the primary contributes wall edges in world coords
    // (origin-anchored); with PR8d, the second form contributes additional
    // wall edges offset 10m east. Detect by finding at least one wall edge
    // whose endpoint sits at x >= 10000mm (only the 2nd form can produce
    // those -- the primary's east extent is much smaller).
    const wallEdges = houseLayer.objects.filter(
      (object) => object.type === 'house_line' && object.kind === 'wall_segment',
    );
    expect(wallEdges.length).toBeGreaterThan(0);
    const easternEdges = wallEdges.filter((object) => {
      if (object.type !== 'house_line') return false;
      return object.line.start.x >= 10000 || object.line.end.x >= 10000;
    });
    expect(easternEdges.length).toBeGreaterThan(0);
  });
});
