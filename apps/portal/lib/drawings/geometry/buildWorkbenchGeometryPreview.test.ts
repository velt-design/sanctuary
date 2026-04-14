import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import { applyGeometryEditIntent } from './geometryEditAdapter';
import { buildWorkbenchGeometryPreview } from './buildWorkbenchGeometryPreview';

function requireFixture(slug: 'mono-standard' | 'gable-standard' | 'box-standard') {
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

  it('surfaces unsupported family geometry instead of crashing', () => {
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

    expect(preview.kind).toBe('unsupported');
    if (preview.kind !== 'unsupported') return;
    expect(preview.message).toContain('not supported by Sanctuary geometry V1');
  });

  it('surfaces unsupported draft geometry instead of falling back to stale snapshot outputs', () => {
    const fixture = requireFixture('mono-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.pergolaStyle = 'hip';
    });

    const preview = buildWorkbenchGeometryPreview({
      projectId: 'proj_preview',
      estimateId: fixture.estimate.id,
      snapshot: fixture.snapshot,
      draft,
      moduleIndex: 0,
    });

    expect(preview.kind).toBe('unsupported');
    if (preview.kind !== 'unsupported') return;
    expect(preview.previewMode).toBe('draft_local_resolved');
    expect(preview.message).toContain('not supported by Sanctuary geometry V1');
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
});
