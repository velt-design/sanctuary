import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot } from './legacyEstimateSnapshotAdapter';
import { addHouseFormToObjectFirstDraft } from './objectFirstWorkbenchAdapter';
import { buildWorkbenchSolvedModel, type WorkbenchSolvedModel } from './workbenchSolvedModel';

function getFixtureSnapshot(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]): Record<string, unknown> {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) {
    throw new Error(`Missing ${name} workbench fixture.`);
  }
  return fixture.snapshot;
}

function houseReferencePolygon(
  model: WorkbenchSolvedModel,
  houseFormId: string,
) {
  const shape = model.projectReferenceShapes.find(
    (candidate) =>
      candidate.sourceType === 'house_reference' &&
      candidate.sourceObjectId === houseFormId,
  );
  if (!shape) throw new Error(`Missing house reference ${houseFormId}.`);
  return shape.polygon;
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

  it('emits one canonical house_reference shape per house form', () => {
    // End-to-end multi-form rendering check: starting from a single-form
    // legacy snapshot, author a second form, attach it to the draft's
    // objectFirst slot, and run the solver. Every form, including the
    // primary House, must surface through the same project-level reference
    // path so PlanViewport can render and move it by house form id.
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
    expect(houseRefs.map((shape) => shape.sourceObjectId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(new Set(houseRefs.map((shape) => shape.id)).size).toBe(houseRefs.length);
    expect(solvedModel.projectHouseGeometries.map((entry) => entry.houseFormId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(solvedModel.projectHouseGeometries.map((entry) => entry.referenceShape.id)).toEqual([
      'house_reference:house-main',
      'house_reference:house-form-2',
    ]);
    // Primary lives at world origin; second form lives 10m east via
    // `addHouseFormToObjectFirstDraft`'s default offset. Every vertex of
    // the second polygon must be at x >= 10000 mm.
    const secondForm = houseRefs.find((shape) => shape.sourceObjectId === 'house-form-2');
    expect(secondForm).toBeDefined();
    for (const vertex of secondForm!.polygon) {
      expect(vertex.x).toBeGreaterThanOrEqual(10000);
    }
  });

  it('updates only the moved house_reference polygon for each house form', () => {
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

    const initial = buildWorkbenchSolvedModel({ snapshot, draft });
    const initialPrimary = houseReferencePolygon(initial, 'house-main');
    const initialSecond = houseReferencePolygon(initial, 'house-form-2');

    const primaryMovedDraft = structuredClone(draft);
    const primary = primaryMovedDraft.objectFirst?.houseAssembly?.houseForms[0] ?? null;
    if (!primary) throw new Error('Expected primary house form.');
    primary.transform = { offsetXM: 4, offsetYM: 0, rotationQuarterTurns: 0 };
    const primaryMoved = buildWorkbenchSolvedModel({ snapshot, draft: primaryMovedDraft });
    expect(houseReferencePolygon(primaryMoved, 'house-main')).not.toEqual(initialPrimary);
    expect(houseReferencePolygon(primaryMoved, 'house-form-2')).toEqual(initialSecond);

    const secondMovedDraft = structuredClone(draft);
    const second = secondMovedDraft.objectFirst?.houseAssembly?.houseForms[1] ?? null;
    if (!second) throw new Error('Expected second house form.');
    second.transform = { offsetXM: 14, offsetYM: 0, rotationQuarterTurns: 0 };
    const secondMoved = buildWorkbenchSolvedModel({ snapshot, draft: secondMovedDraft });
    expect(houseReferencePolygon(secondMoved, 'house-main')).toEqual(initialPrimary);
    expect(houseReferencePolygon(secondMoved, 'house-form-2')).not.toEqual(initialSecond);
  });

  it('applies the primary house form transform to the solved house projection', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
      snapshot,
      draft,
    });
    if (!baseline) throw new Error('Expected objectFirst baseline draft.');
    const primaryHouseForm = baseline.houseAssembly?.houseForms[0] ?? null;
    if (!primaryHouseForm) throw new Error('Expected primary house form.');
    primaryHouseForm.transform = { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 };
    draft.objectFirst = baseline;

    const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });
    const primary = solvedModel.projectReferenceShapes.find(
      (shape) => shape.sourceType === 'house_reference' && shape.sourceObjectId === 'house-main',
    );

    expect(primary).toBeDefined();
    for (const vertex of primary!.polygon) {
      expect(vertex.x).toBeGreaterThanOrEqual(10000);
    }
  });

  it('composes host-excluded project house form objects into the 3D viewerScene house layer (PR8d)', () => {
    // Project-level references make every form visible in PlanViewport;
    // PR8d closes the 3D gap by appending host-excluded per-form
    // `house_line` / `house_surface_solid` objects to each pergola's
    // `viewerScene` house layer. After this, switching to the 3D viewport
    // shows the same two houses the plan view shows without duplicating
    // the active host.
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
    // (origin-anchored); with PR8d, the second form contributes project
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

  it('uses the resolved module host form for host house tagging and scene host exclusion', () => {
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
    const pergola = draft.objectFirst.pergolas[0];
    if (!pergola) throw new Error('Expected pergola draft.');
    pergola.attachment = {
      spatialKind: 'wall',
      host: {
        objectFamily: 'house_forms',
        objectId: 'house-form-2',
        edgeKind: 'wall',
        edgeId: 'wall-house-wall-1',
        myEdgeIndex: 0,
      },
      method: 'facade_ledger',
    };

    const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });
    const activeModule = solvedModel.activeModule;
    if (!activeModule?.geometryTopProjection || !activeModule.viewerScene) {
      throw new Error('Expected solved active module.');
    }

    const taggedHostShapes = activeModule.geometryTopProjection.shapes.filter(
      (shape) =>
        shape.sourceType !== 'house_reference' &&
        (shape.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'house-form-2',
    );
    expect(taggedHostShapes.length).toBeGreaterThan(0);

    const houseLayer = activeModule.viewerScene.layers.find((layer) => layer.id === 'house');
    if (!houseLayer) throw new Error('Expected house layer in viewer scene.');
    const objectIds = houseLayer.objects.map((object) => object.id);
    expect(objectIds.some((id) => id.startsWith('house-main:'))).toBe(true);
    expect(objectIds.some((id) => id.startsWith('host-house:'))).toBe(true);
    const houseForm2Objects = houseLayer.objects.filter(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'house-form-2',
    );
    expect(houseForm2Objects.length).toBeGreaterThan(0);
    expect(houseLayer.objects.some(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'host-house',
    )).toBe(false);
  });
});
