import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
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
    expect(solvedModel.activeModule?.viewerScene).toBeNull();
    expect(solvedModel.activeModule?.geometryTopProjection).toBeNull();
  });
});
