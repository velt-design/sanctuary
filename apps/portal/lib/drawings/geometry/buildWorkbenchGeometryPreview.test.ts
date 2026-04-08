import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildEstimateDrawingDraftFromSnapshot,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
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
    expect(preview.config.family).toBe('mono');
    expect(preview.validation.status).toBe('pass');
    expect(preview.scene.layers.map((layer) => layer.id)).toContain('roof_planes');
  });

  it('returns ready + best_effort_draft when local geometry edits are present', () => {
    const fixture = requireFixture('box-standard');
    const draft = makeDraft(fixture.snapshot, (current) => {
      current.inputs.modules[0]!.lengthM = '5.9';
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
    expect(preview.previewMode).toBe('best_effort_draft');
    expect(preview.config.dimensions.lengthMm).toBe(5500);
    expect(preview.validation.status).toBe('pass');
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
    expect(preview.config.family).toBe('gable');
    expect(preview.scene.layers.find((layer) => layer.id === 'beams')?.objects.some((object) => object.id === 'ridge')).toBe(true);
  });
});
