import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot } from './legacyEstimateSnapshotAdapter';
import { addHouseFormToObjectFirstDraft } from './objectFirstWorkbenchAdapter';
import {
  buildWorkbenchSolvedModel,
  buildWorkbenchSolvedProject,
  type WorkbenchSolvedModel,
} from './workbenchSolvedModel';

const HOUSE_FORM_PRESET_REGRESSION_CASES = [
  'straight',
  'recess_right',
  'l_right',
  'wrap_right',
] as const;

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

function polygonMinX(polygon: ReadonlyArray<{ x: number }>): number {
  return Math.min(...polygon.map((point) => point.x));
}

function addFreestandingPergolaTwo(
  draft: NonNullable<ReturnType<typeof buildEstimateDrawingDraftFromSnapshot>>,
  snapshot: Record<string, unknown> = getFixtureSnapshot('mono-standard'),
) {
  const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
    snapshot,
    draft,
  });
  if (!baseline) throw new Error('Expected objectFirst baseline draft.');
  baseline.pergolas.push({
    id: 'pergola-2',
    label: 'Freestanding pergola',
    family: 'mono',
    connectionKind: 'freestanding',
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: 'rear',
    strategy: 'none',
    geometry: {
      dimensions: { lengthM: '4', projectionM: '2.5' },
      roof: { pitchDeg: '5', material: 'acrylic' },
      supports: {
        postCount: '4',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      },
    },
    position: { originXMm: '12000', originYMm: '0', rotationDeg: '0' },
    attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
  });
  draft.objectFirst = baseline;
}

function addSecondHouseFormAndFreestandingPergolaTwo(
  draft: NonNullable<ReturnType<typeof buildEstimateDrawingDraftFromSnapshot>>,
  snapshot: Record<string, unknown> = getFixtureSnapshot('mono-standard'),
) {
  const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
    snapshot,
    draft,
  });
  if (!baseline) throw new Error('Expected objectFirst baseline draft.');
  const objectFirst = addHouseFormToObjectFirstDraft({
    draft: baseline,
    label: 'Sleepout',
  });
  objectFirst.pergolas.push({
    id: 'pergola-2',
    label: 'Freestanding pergola',
    family: 'mono',
    connectionKind: 'freestanding',
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: 'rear',
    strategy: 'none',
    geometry: {
      dimensions: { lengthM: '4', projectionM: '2.5' },
      roof: { pitchDeg: '5', material: 'acrylic' },
      supports: {
        postCount: '4',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      },
    },
    position: { originXMm: '12000', originYMm: '0', rotationDeg: '0' },
    attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
  });
  draft.objectFirst = objectFirst;
}

function readyProjectScene(model: WorkbenchSolvedModel) {
  const preview = model.projectGeometryPreview;
  expect(preview.kind).toBe('ready');
  if (preview.kind !== 'ready') throw new Error('Expected ready project preview.');
  return preview.scene;
}

function sceneLayerObjectsByHouseForm(
  model: WorkbenchSolvedModel,
  layerId: string,
  houseFormId: string,
) {
  return readyProjectScene(model)
    .layers.find((layer) => layer.id === layerId)
    ?.objects.filter(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === houseFormId,
    ) ?? [];
}

function projectPlanHouseShapeIds(
  model: WorkbenchSolvedModel,
  houseFormId: string,
): string[] {
  const projection = model.projectPlanProjection;
  if (!projection) throw new Error('Expected project plan projection.');
  return projection.shapes
    .filter((shape) => {
      if (shape.family !== 'house') return false;
      const owner =
        typeof shape.metadata?.houseFormId === 'string'
          ? shape.metadata.houseFormId
          : shape.sourceType === 'house_reference'
            ? shape.sourceObjectId
            : null;
      return owner === houseFormId;
    })
    .map((shape) => shape.id)
    .sort();
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
    expect(activeModule.sourceKind).toBe('drawing_module');
  });

  it('solves object-first pergolas without adding persisted calculator modules', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const baseline = buildObjectFirstWorkbenchDraftBaselineFromLegacyEstimateSnapshot({
      snapshot,
      draft,
    });
    if (!baseline) throw new Error('Expected objectFirst baseline draft.');
    const initialModuleCount = draft.inputs.modules.length;
    baseline.pergolas.push({
      id: 'pergola-2',
      label: 'Freestanding pergola',
      family: 'mono',
      connectionKind: 'freestanding',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: 'none',
      geometry: {
        dimensions: { lengthM: '4', projectionM: '2.5' },
        roof: { pitchDeg: '5', material: 'acrylic' },
        supports: {
          postCount: '4',
          postCutHeightM: '2.4',
          postConnectionType: 'slab_anchors',
          ground: 'easy',
        },
      },
      position: { originXMm: '12000', originYMm: '0', rotationDeg: '0' },
      attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
    });
    draft.objectFirst = baseline;

    const solvedModel = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activeModuleIndex: 1,
    });

    expect(draft.inputs.modules).toHaveLength(initialModuleCount);
    expect(solvedModel.modules).toHaveLength(initialModuleCount + 1);
    expect(solvedModel.activeModule?.sourceKind).toBe('object_first_pergola');
    expect(solvedModel.activeModule?.moduleInput).toMatchObject({
      pergolaId: 'pergola-2',
      houseConnectionType: 'none',
      lengthM: '4',
      projectionM: '2.5',
      postCount: '4',
      postConnectionType: 'slab_anchors',
    });
    expect(solvedModel.activeModule?.geometryArtifact).toBeTruthy();
    const projectPergolaPlanIds = solvedModel.projectPergolaPlanShapes.map(
      (shape) => (typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null),
    );
    expect(new Set(projectPergolaPlanIds)).toEqual(new Set(['pergola-1', 'pergola-2']));
    expect(
      solvedModel.projectPergolaPlanShapes.every((shape) =>
        shape.id.startsWith(`project_pergola:${shape.metadata?.pergolaId}:`),
      ),
    ).toBe(true);
    expect(new Set(solvedModel.projectPergolaPlanShapes.map((shape) => shape.id)).size).toBe(
      solvedModel.projectPergolaPlanShapes.length,
    );

    const pergolaRefs = solvedModel.projectReferenceShapes.filter(
      (shape) => shape.sourceType === 'pergola_reference',
    );
    expect(pergolaRefs.map((shape) => shape.sourceObjectId)).toEqual([
      'pergola-1',
      'pergola-2',
    ]);
    expect(new Set(pergolaRefs.map((shape) => shape.id)).size).toBe(pergolaRefs.length);

    const solvedProject = buildWorkbenchSolvedProject({
      solvedModel,
      activePergolaId: 'pergola-2',
    });
    expect(solvedProject.pergolas.map((pergola) => pergola.id)).toEqual([
      'pergola-1',
      'pergola-2',
    ]);
    expect(solvedProject.activePergola?.id).toBe('pergola-2');
    expect(solvedProject.activePergola?.sourceModules[0]?.sourceKind).toBe('object_first_pergola');
  });

  it('aggregates valid pergolas into a project-wide 3D preview with unique pergola ids', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addFreestandingPergolaTwo(draft, snapshot as Record<string, unknown>);

    const solvedModel = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activeModuleIndex: 1,
    });
    const preview = solvedModel.projectGeometryPreview;
    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const sceneObjects = preview.scene.layers.flatMap((layer) => layer.objects);
    const objectIds = sceneObjects.map((object) => object.id);
    expect(new Set(objectIds).size).toBe(objectIds.length);
    expect(objectIds.some((id) => id.startsWith('project_pergola:pergola-1:'))).toBe(true);
    expect(objectIds.some((id) => id.startsWith('project_pergola:pergola-2:'))).toBe(true);
    expect(
      sceneObjects.some(
        (object) => object.id.startsWith('project_pergola:pergola-2:') && object.metadata?.pergolaId === 'pergola-2',
      ),
    ).toBe(true);
    expect(preview.scene.metadata?.projectPergolaSceneIds).toBe('pergola-1,pergola-2');
  });

  it('keeps house geometry single-sourced in the project-wide 3D preview', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addFreestandingPergolaTwo(draft);

    const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });
    const activeHouseLayer = solvedModel.activeModule?.viewerScene?.layers.find(
      (layer) => layer.id === 'house',
    );
    const preview = solvedModel.projectGeometryPreview;
    if (preview.kind !== 'ready' || !activeHouseLayer) {
      throw new Error('Expected ready project preview and active house layer.');
    }
    const projectHouseLayer = preview.scene.layers.find((layer) => layer.id === 'house');
    expect(projectHouseLayer?.objects.length).toBeGreaterThan(0);
    expect(projectHouseLayer?.objects.every(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'house-main',
    )).toBe(true);
    expect(projectHouseLayer?.objects.some((object) => object.id.startsWith('project_pergola:'))).toBe(false);
    expect(projectHouseLayer?.objects).not.toHaveLength(activeHouseLayer.objects.length);
  });

  it('keeps project house bodies and roof materials stable when active pergola changes', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addSecondHouseFormAndFreestandingPergolaTwo(draft, snapshot);
    const houseForms = draft.objectFirst?.houseAssembly?.houseForms ?? [];
    for (const form of houseForms) {
      form.footprint = { ...form.footprint, preset: 'u_shape' as typeof form.footprint.preset };
    }

    const pergolaOneActive = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activePergolaId: 'pergola-1',
    });
    const pergolaTwoActive = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activePergolaId: 'pergola-2',
    });

    expect(pergolaOneActive.projectHouseGeometries.map((entry) => entry.houseFormId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(pergolaTwoActive.projectHouseGeometries.map((entry) => entry.houseFormId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(houseReferencePolygon(pergolaTwoActive, 'house-form-2')).toEqual(
      houseReferencePolygon(pergolaOneActive, 'house-form-2'),
    );
    expect(
      sceneLayerObjectsByHouseForm(pergolaOneActive, 'house', 'house-form-2').length,
    ).toBeGreaterThan(0);
    expect(
      sceneLayerObjectsByHouseForm(pergolaTwoActive, 'house', 'house-form-2').length,
    ).toBeGreaterThan(0);
    expect(
      sceneLayerObjectsByHouseForm(pergolaOneActive, 'house_roof_materials', 'house-form-2').length,
    ).toBeGreaterThan(0);
    expect(
      sceneLayerObjectsByHouseForm(pergolaTwoActive, 'house_roof_materials', 'house-form-2').length,
    ).toBeGreaterThan(0);
    expect(
      sceneLayerObjectsByHouseForm(pergolaTwoActive, 'house_roof_materials', 'house-form-2').map(
        (object) => object.id,
      ),
    ).toEqual(
      sceneLayerObjectsByHouseForm(pergolaOneActive, 'house_roof_materials', 'house-form-2').map(
        (object) => object.id,
      ),
    );
  });

  it('keeps project plan house bodies stable when active pergola changes', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addSecondHouseFormAndFreestandingPergolaTwo(draft, snapshot);

    const pergolaOneActive = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activePergolaId: 'pergola-1',
    });
    const pergolaTwoActive = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activePergolaId: 'pergola-2',
    });

    expect(pergolaOneActive.activeModule?.moduleInput.pergolaId).toBe('pergola-1');
    expect(pergolaTwoActive.activeModule?.moduleInput.pergolaId).toBe('pergola-2');
    expect(projectPlanHouseShapeIds(pergolaOneActive, 'house-main')).toEqual(
      projectPlanHouseShapeIds(pergolaTwoActive, 'house-main'),
    );
    expect(projectPlanHouseShapeIds(pergolaOneActive, 'house-form-2')).toEqual(
      projectPlanHouseShapeIds(pergolaTwoActive, 'house-form-2'),
    );
    expect(
      projectPlanHouseShapeIds(pergolaOneActive, 'house-form-2').some((id) =>
        id.startsWith('house_surface_solid:'),
      ),
    ).toBe(true);
    expect(
      projectPlanHouseShapeIds(pergolaOneActive, 'house-form-2').some((id) =>
        id.startsWith('house_roof_material:'),
      ),
    ).toBe(true);
    expect(
      projectPlanHouseShapeIds(pergolaOneActive, 'house-form-2').some((id) =>
        id.startsWith('house_reference:'),
      ),
    ).toBe(true);
    const solvedProject = buildWorkbenchSolvedProject({
      solvedModel: pergolaTwoActive,
      activePergolaId: 'pergola-2',
    });
    expect(solvedProject.projectPlanProjection).toBe(pergolaTwoActive.projectPlanProjection);
  });

  it('skips invalid pergolas from the full project-wide 3D aggregation', () => {
    const snapshot = getFixtureSnapshot('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    addFreestandingPergolaTwo(draft, snapshot);
    draft.objectFirst?.pergolas.push({
      id: 'pergola-3',
      label: 'Invalid pergola',
      family: 'mono',
      connectionKind: 'freestanding',
      attachmentEdgeId: null,
      attachmentZoneId: null,
      side: 'rear',
      strategy: 'none',
      geometry: {
        dimensions: { lengthM: '', projectionM: '2.5' },
        roof: { pitchDeg: '5', material: 'acrylic' },
        supports: {
          postCount: '2',
          postCutHeightM: '2.4',
          postConnectionType: 'slab_anchors',
          ground: 'easy',
        },
      },
      position: { originXMm: '17000', originYMm: '0', rotationDeg: '0' },
      attachment: { spatialKind: 'freestanding', host: null, method: 'none' },
    });

    const solvedModel = buildWorkbenchSolvedModel({
      snapshot,
      draft,
      activeModuleIndex: 2,
    });
    const preview = solvedModel.projectGeometryPreview;
    expect(solvedModel.activeModule?.geometryPreview.kind).toBe('error');
    expect(solvedModel.activeModule?.geometryArtifact).toBeNull();
    expect(solvedModel.projectViewportGeometry?.artifact).toBeTruthy();
    expect(solvedModel.projectReferenceShapes.some(
      (shape) => shape.sourceType === 'house_reference',
    )).toBe(true);
    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    const objectIds = preview.scene.layers.flatMap((layer) => layer.objects.map((object) => object.id));
    expect(objectIds.some((id) => id.startsWith('project_pergola:pergola-1:'))).toBe(true);
    expect(objectIds.some((id) => id.startsWith('project_pergola:pergola-2:'))).toBe(true);
    expect(objectIds.some((id) => id.startsWith('project_pergola:pergola-3:'))).toBe(false);
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
    expect(solvedModel.projectPergolaPlanShapes).toEqual([]);
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

  it.each(HOUSE_FORM_PRESET_REGRESSION_CASES)(
    'keeps project house geometry entries aligned to each selected %s house form',
    (preset) => {
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
      const forms = draft.objectFirst.houseAssembly?.houseForms ?? [];
      const primary = forms[0];
      const second = forms[1];
      if (!primary || !second) throw new Error('Expected two house forms.');
      primary.footprint = { ...primary.footprint, preset };
      second.footprint = { ...second.footprint, preset };
      second.transform = { offsetXM: 10, offsetYM: 0, rotationQuarterTurns: 0 };

      const solvedModel = buildWorkbenchSolvedModel({ snapshot, draft });
      expect(solvedModel.projectHouseGeometries.map((entry) => entry.houseFormId)).toEqual([
        'house-main',
        'house-form-2',
      ]);
      expect(solvedModel.projectHouseGeometries.map((entry) => entry.referenceShape.id)).toEqual([
        'house_reference:house-main',
        'house_reference:house-form-2',
      ]);
      const primaryPolygon = houseReferencePolygon(solvedModel, 'house-main');
      const secondPolygon = houseReferencePolygon(solvedModel, 'house-form-2');
      expect(polygonMinX(secondPolygon)).toBeGreaterThanOrEqual(10000);
      expect(polygonMinX(secondPolygon)).toBeGreaterThan(polygonMinX(primaryPolygon));
    },
  );

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
    expect(objectIds.some((id) => id.startsWith('house-form-2:'))).toBe(true);
    expect(objectIds.some((id) => id.startsWith('host-house:'))).toBe(false);
    const houseForm2Objects = houseLayer.objects.filter(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'house-form-2',
    );
    expect(houseForm2Objects.length).toBeGreaterThan(0);
    expect(houseLayer.objects.some(
      (object) => (object.metadata as { houseFormId?: string } | undefined)?.houseFormId === 'host-house',
    )).toBe(false);
  });
});
