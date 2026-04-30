import { describe, expect, it } from 'vitest';
import type { AttachmentSide, HouseFootprintPreset, HouseRoofForm } from '@sp/geometry';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import { makeHouseFirstDeckSupportSnapshotFixture } from '@/lib/drawings/state/houseFirstWorkbenchFixtures';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type {
  ObjectWorkbenchCompatibilityOpeningDraft,
  ObjectWorkbenchCompatibilityRoofDraft,
} from '@/lib/drawings/state/compat/objectWorkbenchCompatibilityModel';
import {
  buildObjectFirstOpeningDraftsFromCompatibilityDrafts,
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from '@/lib/drawings/state/objectFirstWorkbenchAdapter';
import type { HouseFormRoofIntentModel } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { applyGeometryEditIntent } from './geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from './buildWorkbenchGeometryPreview';

const HOUSE_FOOTPRINT_PRESETS: readonly HouseFootprintPreset[] = [
  'straight',
  'l_left',
  'l_right',
  'recess_left',
  'recess_right',
  'u_shape',
  'wrap_left',
  'wrap_right',
];

const HOUSE_ROOF_FORMS: readonly HouseRoofForm[] = ['flat', 'mono', 'gable', 'hipped'];
const ATTACHMENT_SIDES: readonly AttachmentSide[] = ['rear', 'front', 'left', 'right'];

function makeScreenshotStyleUHouseFootprint() {
  return [
    { x: -2800, y: 7200, z: 0 },
    { x: 8800, y: 7200, z: 0 },
    { x: 8800, y: 400, z: 0 },
    { x: 7000, y: 400, z: 0 },
    { x: 7000, y: 5400, z: 0 },
    { x: -1000, y: 5400, z: 0 },
    { x: -1000, y: 400, z: 0 },
    { x: -2800, y: 400, z: 0 },
  ];
}

function pointDistanceToSegment2D(
  candidate: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 1e-6) return Math.hypot(candidate.x - start.x, candidate.y - start.y);
  const ratio = Math.min(
    Math.max(((candidate.x - start.x) * dx + (candidate.y - start.y) * dy) / lengthSq, 0),
    1,
  );
  const projectedX = start.x + dx * ratio;
  const projectedY = start.y + dy * ratio;
  return Math.hypot(candidate.x - projectedX, candidate.y - projectedY);
}

function sourceEdgeLineFromFootprint(sourceEdgeId: string) {
  const footprint = makeScreenshotStyleUHouseFootprint();
  const match = /^footprint-edge-(\d+)$/.exec(sourceEdgeId);
  if (!match) return null;
  const index = Number(match[1]) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= footprint.length) return null;
  return {
    start: footprint[index]!,
    end: footprint[(index + 1) % footprint.length]!,
  };
}

function requireFixture(
  slug:
    | 'mono-standard'
    | 'gable-standard'
    | 'box-standard'
    | 'gable-u-hipped-screenshot'
    | 'mono-join-screenshot',
) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(slug);
  if (!fixture) {
    throw new Error(`Missing fixture ${slug}`);
  }
  return fixture;
}

function makeDraft(snapshot: Record<string, unknown> | null, mutate: (draft: EstimateDrawingDraft) => void) {
  const draft = buildEstimateDrawingDraftFromSnapshot(snapshot);
  if (!draft) {
    throw new Error('Expected drawing draft from snapshot.');
  }
  mutate(draft);
  return draft;
}

function ensureObjectFirstDraft(snapshot: Record<string, unknown> | null, draft: EstimateDrawingDraft) {
  const baselineStore = buildDrawingWorkbenchStore({
    snapshot,
    draft,
    ui: createDrawingWorkbenchUiState(),
  });
  draft.objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel);
  return {
    objectFirst: draft.objectFirst,
    sourceFormId: baselineStore.persisted.compatibilityBridge.projectModel.house?.id ?? null,
  };
}

function setObjectFirstRoofIntent(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft,
  roof: Partial<ObjectWorkbenchCompatibilityRoofDraft>,
) {
  const { objectFirst } = ensureObjectFirstDraft(snapshot, draft);
  const houseForm = objectFirst.houseAssembly?.houseForms[0] ?? null;
  if (!houseForm) {
    throw new Error('Expected object-first house form.');
  }
  const appendage = roof.appendage
    ? {
        ...houseForm.roofIntent.appendage,
        ...roof.appendage,
      }
    : houseForm.roofIntent.appendage;
  houseForm.roofIntent = {
    ...houseForm.roofIntent,
    ...(roof as Partial<HouseFormRoofIntentModel>),
    appendage,
  };
  houseForm.roofIntentAuthored = true;
}

function setObjectFirstOpeningDrafts(
  snapshot: Record<string, unknown> | null,
  draft: EstimateDrawingDraft,
  openings: ObjectWorkbenchCompatibilityOpeningDraft[],
) {
  const { objectFirst, sourceFormId } = ensureObjectFirstDraft(snapshot, draft);
  objectFirst.openings = buildObjectFirstOpeningDraftsFromCompatibilityDrafts(openings, sourceFormId);
}

function makeStaleGableSnapshot(
  snapshot: Record<string, unknown>,
  overrides: { houseConnectionType?: 'none' | 'soffit' | 'fascia' | 'facade' } = {},
) {
  const stale = structuredClone(snapshot) as {
    inputs?: {
      modules?: Array<{
        houseConnectionType?: string;
        gableEndFramesMode?: string;
        gableHouseEdgeGutter?: string;
        gableOuterEdgeGutter?: string;
      }>;
    };
  };
  const module = stale.inputs?.modules?.[0];
  if (!module) {
    throw new Error('Expected fixture snapshot module.');
  }
  module.gableEndFramesMode = 'none';
  if (overrides.houseConnectionType) {
    module.houseConnectionType = overrides.houseConnectionType;
  }
  module.gableHouseEdgeGutter = 'house';
  module.gableOuterEdgeGutter = 'our';
  return stale as Record<string, unknown>;
}

describe('buildWorkbenchGeometryPreview', () => {
  it('returns ready + snapshot_validated for solved fixture snapshots', () => {
    const fixture = requireFixture('mono-standard');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('snapshot_validated');
    expect(preview.resultSource).toBe('snapshot');
    expect(preview.config.family).toBe('mono');
    expect(preview.validation.status).toBe('pass');
    expect(preview.scene.layers.map((layer) => layer.id)).toContain('roof_planes');
  });

  it('returns ready + draft_local_resolved when local geometry edits are present', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.lengthM = '6.4';
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.resultSource).toBe('local_resolve');
    expect(preview.config.dimensions.lengthMm).toBe(6400);
    expect(preview.validation.status).toBe('pass');
    expect(preview.assembly.outline[1]?.x).toBe(6400);
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'ledger.length_mm')?.quantity).toBe(6400);
  });

  it('locally resolves stale snapshot pricing outputs', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<{ lengthM?: string }> };
      outputs?: Record<string, unknown>;
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs) {
      throw new Error('Expected fixture snapshot module.');
    }
    snapshot.inputs.modules[0].lengthM = '6.8';
    snapshot.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY] = 'stale';

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: snapshot as Record<string, unknown>,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('snapshot_local_resolved');
    expect(preview.resultSource).toBe('local_resolve');
    expect(preview.config.dimensions.lengthMm).toBe(6800);
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'ledger.length_mm')?.quantity).toBe(6800);
  });

  it('re-solves draft pitch changes locally instead of reusing stale snapshot geometry', () => {
    const fixture = requireFixture('mono-standard');
    const baseline = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });
    if (baseline.kind !== 'ready') {
      throw new Error('Expected baseline geometry preview');
    }

    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.roofPitchDeg = '10';
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.resultSource).toBe('local_resolve');
    expect(preview.config.dimensions.roofPitchDeg).toBe(10);
    expect(preview.assembly.roofPlanes[0]?.boundary[2]?.z).not.toBe(baseline.assembly.roofPlanes[0]?.boundary[2]?.z);
  });

  it('surfaces supported hip geometry through the ready preview path', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: { pergolas?: Array<{ modules?: Array<Record<string, unknown>> }> };
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
      throw new Error('Expected fixture snapshot modules.');
    }
    snapshot.inputs.modules[0].pergolaStyle = 'hip';
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
      projection_m: null,
    };

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('snapshot_local_resolved');
    expect(preview.config.family).toBe('hip');
    expect(preview.validation.status).toBe('pass');
  });

  it('surfaces supported hip-corner draft geometry instead of falling back to stale snapshot outputs', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.pergolaStyle = 'hip_corner';
      current.inputs.modules[0]!.hipCornerLengthBM = '4';
      current.inputs.modules[0]!.hipCornerProjectionBM = '2';
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.config.family).toBe('hip_corner');
    expect(preview.validation.status).toBe('pass');
  });

  it('reports shared attachment-zone counts and pergola resolution metadata in the 3D preview', () => {
    const fixture = requireFixture('mono-standard');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.scene.metadata?.houseAttachmentZoneCount).toBeGreaterThan(0);
    expect(preview.scene.metadata?.houseAttachmentZoneKinds).toContain('rear:soffit');
    expect(preview.scene.metadata?.pergolaResolvedAttachmentZoneCount).toBe(1);
    expect(preview.scene.metadata?.pergolaUnresolvedAttachmentZoneCount).toBe(0);
  });

  it('reports blocked shared attachment zones when side openings suppress them', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      setObjectFirstOpeningDrafts(fixture.snapshot, current, [
        {
          id: 'opening-slider-rear',
          kind: 'slider',
          wallId: 'rear',
          widthM: '2.4',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '0.8',
        },
      ]);
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.scene.metadata?.houseAttachmentZoneBlockedReasons).toContain(
      'rear:soffit:side_openings_block_roof_zone',
    );
    expect(preview.scene.metadata?.pergolaResolvedAttachmentZoneCount).toBe(0);
    expect(preview.scene.metadata?.pergolaUnresolvedAttachmentZoneCount).toBe(1);
  });

  it('returns an error for malformed geometry inputs that cannot normalize', () => {
    const fixture = requireFixture('mono-standard');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: { pergolas?: Array<{ modules?: Array<Record<string, unknown>> }> };
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
      throw new Error('Expected fixture snapshot modules.');
    }
    snapshot.inputs.modules[0].lengthM = '';
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
    };

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('error');
    if (preview.kind !== 'error') return;
    expect(preview.message).toContain('length');
  });

  it('builds validated fixture geometry previews for gable snapshots as well', () => {
    const fixture = requireFixture('gable-standard');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('snapshot_validated');
    expect(preview.resultSource).toBe('snapshot');
    expect(preview.config.family).toBe('gable');
    expect(preview.config.gable.endFramesMode).toBe('outer_end_only');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(1);
    const beamLayer = preview.scene.layers.find((layer) => layer.id === 'beams');
    expect(beamLayer?.objects.some((object) => object.id === 'ridge')).toBe(true);
    expect(beamLayer?.objects.some((object) => object.id === 'outer-end-tie-beam')).toBe(true);
    expect(beamLayer?.objects.some((object) => object.id === 'outer-end-king-post-strut')).toBe(true);
    expect(preview.scene.layers.find((layer) => layer.id === 'support_beams')?.objects.some((object) => object.id === 'outer-end-tie-beam')).toBe(false);
  });

  it('preserves explicit attached gable no-frame snapshots while constraining gutters', () => {
    const fixture = requireFixture('gable-standard');
    const snapshot = makeStaleGableSnapshot(fixture.snapshot, {
      houseConnectionType: 'soffit',
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.gable.endFramesMode).toBe('none');
    expect(preview.config.gable.houseEaveGutterMode).toBe('house');
    expect(preview.config.gable.outerEaveGutterMode).toBe('our');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')).toBeUndefined();
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')).toBeUndefined();
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(0);
  });

  it('preserves explicit freestanding gable no-frame snapshots while constraining gutters', () => {
    const fixture = requireFixture('gable-standard');
    const snapshot = makeStaleGableSnapshot(fixture.snapshot, {
      houseConnectionType: 'none',
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.gable.endFramesMode).toBe('none');
    expect(preview.config.gable.houseEaveGutterMode).toBe('our');
    expect(preview.config.gable.outerEaveGutterMode).toBe('our');
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-tie-beam')).toBeUndefined();
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-king-post-strut')).toBeUndefined();
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')).toBeUndefined();
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')).toBeUndefined();
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(0);
  });

  it('re-solves attached gable end-frame edits into outer tie and king-post members', () => {
    const fixture = requireFixture('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected drawing draft from snapshot.');
    }

    const endFrames = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'outer_end_only',
      },
    });

    expect(endFrames.ok).toBe(true);
    if (!endFrames.ok) return;

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: endFrames.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.gable.endFramesMode).toBe('outer_end_only');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(1);
  });

  it('re-solves attached both-end gable edits into inner and outer frame members', () => {
    const fixture = requireFixture('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected drawing draft from snapshot.');
    }

    const endFrames = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'both_ends',
      },
    });

    expect(endFrames.ok).toBe(true);
    if (!endFrames.ok) return;

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: endFrames.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.gable.endFramesMode).toBe('both_ends');
    expect(preview.config.gable.houseEaveGutterMode).toBe('house');
    expect(preview.config.gable.outerEaveGutterMode).toBe('our');
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(2);
  });

  it('re-solves freestanding gable end-frame edits into inner and outer frame members', () => {
    const fixture = requireFixture('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected drawing draft from snapshot.');
    }

    const freestanding = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'house_connection',
        value: 'freestanding',
      },
    });
    expect(freestanding.ok).toBe(true);
    if (!freestanding.ok) return;

    const endFrames = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft: freestanding.draft,
      moduleIndex: 0,
      intent: {
        type: 'gable_end_frames',
        value: 'both_ends',
      },
    });

    expect(endFrames.ok).toBe(true);
    if (!endFrames.ok) return;

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: endFrames.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.gable.endFramesMode).toBe('both_ends');
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'inner-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-tie-beam')?.role).toBe('beam');
    expect(preview.assembly.members.find((member) => member.id === 'outer-end-king-post-strut')?.role).toBe('brace');
    expect(preview.assembly.quantityHooks.find((hook) => hook.key === 'gable_end_frames.count')?.quantity).toBe(2);
  });

  it('re-solves mono drafts switched to gable against the supported baseline', () => {
    const fixture = requireFixture('mono-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected drawing draft from snapshot.');
    }

    const switched = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'family',
        value: 'gable',
      },
    });

    expect(switched.ok).toBe(true);
    if (!switched.ok) return;

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: switched.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.config.family).toBe('gable');
    expect(preview.validation.status).toBe('pass');
  });

  it('re-solves gable acrylic drafts into a real roof-pack instead of fallback roof planes', () => {
    const fixture = requireFixture('gable-standard');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) {
      throw new Error('Expected drawing draft from snapshot.');
    }
    const acrylic = applyGeometryEditIntent({
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
      intent: {
        type: 'roof_material',
        value: 'acrylic',
      },
    });
    expect(acrylic.ok).toBe(true);
    if (!acrylic.ok) return;

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: acrylic.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.config.family).toBe('gable');
    expect(preview.config.roof.material).toBe('acrylic');
    expect(preview.validation.status).toBe('pass');
    expect(preview.assembly.roofCladdingPanels.some((panel) => panel.id === 'house-acrylic-panel-1')).toBe(true);
    expect(preview.assembly.roofCladdingPanels.some((panel) => panel.id === 'outer-acrylic-panel-1')).toBe(true);
    expect(preview.scene.layers.find((layer) => layer.id === 'roof_cladding')?.visibleByDefault).toBe(true);
    expect(preview.scene.layers.find((layer) => layer.id === 'roof_planes')?.visibleByDefault).toBe(false);
  });

  it('keeps the screenshot-style complex house roof fixture on the supported hipped baseline', () => {
    const fixture = requireFixture('gable-u-hipped-screenshot');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    const houseObjects =
      preview.scene.layers.find((layer) => layer.id === 'house')?.objects ?? [];
    const joinSourceEdgeId =
      houseObjects.find(
        (object) => object.type === 'house_line' && object.kind === 'attachment_target',
      )?.metadata?.sourceEdgeId ?? null;
    const joinEdgeEaveObjects = houseObjects.filter((object) => {
      if (
        object.type !== 'house_surface_solid' &&
        object.type !== 'house_linear_solid'
      ) {
        return false;
      }
      const sourceEdgeId = String(object.metadata?.sourceEdgeId ?? '');
      if (!joinSourceEdgeId || sourceEdgeId !== joinSourceEdgeId) return false;
      return (
        (object.type === 'house_surface_solid' &&
          (object.kind === 'soffit' || object.kind === 'fascia')) ||
        (object.type === 'house_linear_solid' && object.kind === 'gutter')
      );
    });

    expect(preview.scene.metadata?.houseRoofQaStatus).toBe('valid');
    expect(preview.scene.metadata?.houseRoofTopologyValleyCount).toBe(2);
    expect(preview.scene.metadata?.houseRoofTopologyInternalEaveHeightSegmentCount).toBe(0);
    expect(Number(preview.scene.metadata?.houseRoofSolidExpectedCount ?? 0)).toBeGreaterThan(0);
    expect(Number(preview.scene.metadata?.houseRoofSolidSkippedCount ?? 0)).toBe(0);
    expect(joinEdgeEaveObjects).toHaveLength(0);
  });

  it('renders the screenshot-style mono join fixture through the ready preview path', () => {
    const fixture = requireFixture('mono-join-screenshot');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.scene.metadata?.houseRoofQaStatus).toBe('valid');
    expect(
      preview.scene.layers
        .flatMap((layer) => layer.objects)
        .some((object) => object.type === 'house_surface_solid' && object.kind === 'roof'),
    ).toBe(true);
  });

  it('renders every preset and editable shared house roof form through the ready preview path', () => {
    const fixture = requireFixture('mono-standard');

    for (const preset of HOUSE_FOOTPRINT_PRESETS) {
      for (const form of HOUSE_ROOF_FORMS) {
        const roof = {
          form,
          primaryPitchDeg: form === 'flat' ? '0' : form === 'mono' ? '12' : form === 'gable' ? '18' : '22',
          primaryFallDirection: 'negative_y',
          ridgeAxis: 'x',
        } as const;
        const draft = makeDraft(fixture.snapshot, (current) => {
          current.inputs.modules[0]!.houseFootprintPreset = preset;
          setObjectFirstRoofIntent(fixture.snapshot, current, roof);
        });

        const preview = buildWorkbenchGeometryPreview({
          projectId: 'proj_preview',
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
          snapshot: fixture.snapshot,
          draft,
          moduleIndex: 0,
        });

        expect(preview.kind, `${preset}/${form} preview kind`).toBe('ready');
        if (preview.kind !== 'ready') continue;
        expect(preview.config.houseContext.model?.roofForm, `${preset}/${form} roof form`).toBe(form);
        expect(preview.scene.metadata?.houseRoofQaStatus, `${preset}/${form} roof QA`).toBe('valid');
        expect(
          preview.scene.layers
            .flatMap((layer) => layer.objects)
            .some((object) => object.type === 'house_surface_solid' && object.kind === 'roof'),
          `${preset}/${form} roof solid`,
        ).toBe(true);
      }
    }
  });

  it('renders gable and hipped preset roof rotations through the ready preview path', () => {
    const fixture = requireFixture('mono-standard');

    for (const attachmentSide of ATTACHMENT_SIDES) {
      for (const preset of HOUSE_FOOTPRINT_PRESETS) {
        for (const form of ['gable', 'hipped'] as const) {
          const draft = makeDraft(fixture.snapshot, (current) => {
            current.inputs.modules[0]!.attachmentSide = attachmentSide;
            current.inputs.modules[0]!.houseFootprintPreset = preset;
            setObjectFirstRoofIntent(fixture.snapshot, current, {
              form,
              primaryPitchDeg: form === 'gable' ? '' : '0',
              material: 'corrugated_iron',
            });
          });

          const preview = buildWorkbenchGeometryPreview({
            projectId: 'proj_preview',
            estimateId: fixture.estimate.id,
            designRequestId: fixture.request.id,
            snapshot: fixture.snapshot,
            draft,
            moduleIndex: 0,
          });

          expect(preview.kind, `${preset}/${attachmentSide}/${form} preview kind`).toBe('ready');
          if (preview.kind !== 'ready') continue;
          expect(preview.config.connection.attachmentSide, `${preset}/${attachmentSide}/${form} side`).toBe(
            attachmentSide,
          );
          expect(preview.config.houseContext.model?.roofForm, `${preset}/${attachmentSide}/${form} form`).toBe(form);
          expect(
            preview.config.houseContext.model?.roofPitchDeg,
            `${preset}/${attachmentSide}/${form} pitch`,
          ).toBe(5);
          expect(
            preview.config.houseContext.model?.footprint.length,
            `${preset}/${attachmentSide}/${form} footprint points`,
          ).toBeGreaterThan(3);
          expect(preview.scene.metadata?.houseRoofQaStatus, `${preset}/${attachmentSide}/${form} roof QA`).toBe(
            'valid',
          );
          expect(
            preview.scene.layers
              .flatMap((layer) => layer.objects)
              .some((object) => object.type === 'house_surface_solid' && object.kind === 'roof'),
            `${preset}/${attachmentSide}/${form} roof solid`,
          ).toBe(true);
        }
      }
    }
  });

  it('renders stale object-first hipped preset ridge drafts through the ready preview path', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.attachmentSide = 'rear';
      current.inputs.modules[0]!.houseFootprintPreset = 'wrap_left';
      current.inputs.modules[0]!.houseFootprintParams = {
        ...(current.inputs.modules[0]!.houseFootprintParams ?? {}),
        widthM: '10',
        offsetXM: '-.5',
        setbackM: '.5',
        bandDepthM: '6',
        sideRunM: '4',
      };
    });
    const baselineStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({ workbenchMode: 'house' }),
    });
    draft.objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel);
    const houseForm = draft.objectFirst.houseAssembly?.houseForms[0];
    if (!houseForm) throw new Error('Expected object-first house form.');
    houseForm.roofIntentAuthored = true;
    houseForm.roofIntent = {
      ...houseForm.roofIntent,
      form: 'hipped',
      primaryPitchDeg: '0',
      ridgeAxis: 'y',
      openGableEndIds: ['house-gable-end-y-1'],
      appendage: {
        ...houseForm.roofIntent.appendage,
        enabled: true,
      },
    };

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.config.houseContext.model?.roofForm).toBe('hipped');
    expect(preview.config.houseContext.model?.roofPitchDeg).toBe(5);
    expect(preview.config.houseContext.model?.roofRidgeAxis).toBe('x');
    expect(preview.scene.metadata?.houseRoofQaStatus).toBe('valid');
    expect(
      preview.scene.layers
        .flatMap((layer) => layer.objects)
        .some((object) => object.type === 'house_surface_solid' && object.kind === 'roof'),
    ).toBe(true);
  });

  it('exposes deck support diagnostics for active-side attached and detached deck contexts', () => {
    const attachedFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_threshold_attached');
    const detachedFixture = makeHouseFirstDeckSupportSnapshotFixture('detached_rear_near_house');

    const attachedPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: 'est_preview',
      snapshot: attachedFixture.snapshot,
      draft: attachedFixture.draft,
      moduleIndex: 0,
    });
    const detachedPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: 'est_preview',
      snapshot: detachedFixture.snapshot,
      draft: detachedFixture.draft,
      moduleIndex: 0,
    });

    expect(attachedPreview.kind).toBe('ready');
    if (attachedPreview.kind !== 'ready') return;
    expect(attachedPreview.deckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'threshold_attached',
        deckBracketEligible: true,
      }),
    );

    expect(detachedPreview.kind).toBe('ready');
    if (detachedPreview.kind !== 'ready') return;
    expect(detachedPreview.deckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'ground_supported',
        deckBracketEligible: false,
      }),
    );
  });

  it('keeps warning-heavy and non-relevant deck contexts visible while attached warnings stay advisory in preview diagnostics', () => {
    const warningFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_warning_heavy_attached');
    const nonRelevantFixture = makeHouseFirstDeckSupportSnapshotFixture(
      'left_non_relevant_when_rear_active',
    );

    const warningPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: 'est_preview',
      snapshot: warningFixture.snapshot,
      draft: warningFixture.draft,
      moduleIndex: 0,
    });
    const nonRelevantPreview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: 'est_preview',
      snapshot: nonRelevantFixture.snapshot,
      draft: nonRelevantFixture.draft,
      moduleIndex: 0,
    });

    expect(warningPreview.kind).toBe('ready');
    if (warningPreview.kind !== 'ready') return;
    expect(warningPreview.deckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'threshold_attached',
        deckBracketEligible: true,
      }),
    );
    expect(warningPreview.deckSupport.warningCodes).toContain('threshold_alignment_offset');

    expect(nonRelevantPreview.kind).toBe('ready');
    if (nonRelevantPreview.kind !== 'ready') return;
    expect(nonRelevantPreview.deckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: false,
        resolvedClassification: 'none',
        deckBracketEligible: false,
      }),
    );
  });

  it('builds a ready preview with house scene objects present', () => {
    const fixture = requireFixture('mono-standard');

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const houseObjects = preview.scene.layers.find((layer) => layer.id === 'house')?.objects ?? [];
    expect(houseObjects.length).toBeGreaterThan(0);
  });

  it('renders valid shared-house window markers and reports opening diagnostics in 3D preview metadata', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      setObjectFirstOpeningDrafts(fixture.snapshot, current, [
        {
          id: 'opening-valid',
          label: 'Kitchen window',
          kind: 'window',
          panelCount: null,
          wallId: 'rear',
          widthM: '2.4',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '1.1',
        },
        {
          id: 'opening-invalid',
          label: 'Bad window',
          kind: 'window',
          panelCount: null,
          wallId: 'rear',
          widthM: '20',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.2',
        },
      ]);
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const houseObjects = preview.scene.layers.find((layer) => layer.id === 'house')?.objects ?? [];
    const marker = houseObjects.find(
      (object) => object.type === 'house_surface' && object.kind === 'opening_marker',
    );
    const outlines = houseObjects.filter(
      (object) =>
        object.type === 'house_line' &&
        object.kind === 'opening_outline' &&
        object.metadata?.openingId === 'opening-valid',
    );

    expect(marker?.metadata?.openingId).toBe('opening-valid');
    expect(marker?.metadata?.openingWallId).toBe('rear');
    expect(marker?.metadata?.openingHostEdgeId).toBe('footprint-edge-3');
    expect(marker?.metadata?.resolvedHostEdgeId).toBe('footprint-edge-3');
    expect(outlines).toHaveLength(4);
    expect(preview.scene.metadata?.houseOpeningCount).toBe(2);
    expect(preview.scene.metadata?.houseOpeningValidCount).toBe(1);
    expect(preview.scene.metadata?.houseOpeningHostEdgeResolvedCount).toBe(1);
    expect(preview.scene.metadata?.houseOpeningHostEdgeUnresolvedCount).toBe(0);
    expect(preview.scene.metadata?.houseOpeningRenderedMarkerCount).toBe(1);
    expect(preview.scene.metadata?.houseOpeningSkippedInvalidCount).toBe(1);
    expect(preview.scene.metadata?.houseOpeningUnresolvedValidCount).toBe(0);
  });

  it('keeps hinged-door and stacker metadata in the shared-house 3D preview', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      setObjectFirstOpeningDrafts(fixture.snapshot, current, [
        {
          id: 'opening-door',
          label: 'Rear door',
          kind: 'hinged_door',
          panelCount: null,
          wallId: 'rear',
          widthM: '0.9',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '4.9',
        },
        {
          id: 'opening-stacker',
          label: 'Rear stacker',
          kind: 'stacker',
          panelCount: null,
          wallId: 'rear',
          widthM: '3.6',
          heightM: '2.1',
          sillHeightM: '0',
          offsetAlongWallM: '1.2',
        },
      ]);
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;

    const houseObjects = preview.scene.layers.find((layer) => layer.id === 'house')?.objects ?? [];
    const markerKinds = houseObjects
      .filter((object) => object.type === 'house_surface' && object.kind === 'opening_marker')
      .map((object) => object.metadata?.openingKind);

    expect(markerKinds).toContain('hinged_door');
    expect(markerKinds).toContain('stacker');
    expect(preview.scene.metadata?.houseOpeningCount).toBe(2);
    expect(preview.scene.metadata?.houseOpeningValidCount).toBe(2);
    expect(preview.scene.metadata?.houseOpeningRenderedMarkerCount).toBe(2);
  });
});
