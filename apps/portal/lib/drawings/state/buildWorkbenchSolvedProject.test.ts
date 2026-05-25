import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildWorkbenchSolvedModel,
  buildWorkbenchSolvedProject,
  type SolvedPergola,
  type WorkbenchSolvedModule,
} from './workbenchSolvedModel';

// PR-2B.1a (2026-05-23): equivalence tests pin down the per-pergola shape
// against the per-module shape. After PR-2B.1b retires `WorkbenchSolvedModule[]`,
// the per-pergola fields stay byte-equivalent — these tests prove the
// transposition didn't lose data.

function getFixtureSnapshot(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]): Record<string, unknown> {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) {
    throw new Error(`Missing ${name} workbench fixture.`);
  }
  return fixture.snapshot;
}

// All `SolvedPergola` field names that should equal the matching `WorkbenchSolvedModule`
// field. Excludes `id` / `label` / `pergolaIndex` (derived) and any field on the legacy
// shape that intentionally doesn't carry across (`drawingModule`, `index`).
const PERGOLA_FIELDS_FROM_MODULE = [
  'moduleInput',
  'previewMode',
  'resultSource',
  'draftTouchesGeometry',
  'trust',
  'renderSource',
  'renderStatus',
  'geometryArtifact',
  'config',
  'assembly',
  'geometryPlan',
  'geometrySection',
  'geometryTopProjection',
  'validation',
  'viewerScene',
  'geometryPreview',
  'viewportGeometry',
  'deckSupport',
  'planModel',
  'sectionModel',
] as const satisfies ReadonlyArray<keyof SolvedPergola & keyof WorkbenchSolvedModule>;

describe('buildWorkbenchSolvedProject', () => {
  it('produces a per-pergola entry for each pergola in projectModel.pergolas with calculator data', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });

    expect(solvedProject.pergolas.length).toBeGreaterThan(0);
    expect(solvedProject.pergolas.length).toBe(solvedModel.modules.length);
  });

  it('per-pergola fields are byte-equivalent to the matching per-module fields (1:1 mapping)', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });

    for (const pergola of solvedProject.pergolas) {
      const module = solvedModel.modules.find((m) => m.moduleInput.pergolaId === pergola.id);
      expect(module).toBeDefined();
      if (!module) continue;
      for (const field of PERGOLA_FIELDS_FROM_MODULE) {
        expect(pergola[field]).toBe(module[field]);
      }
      // pergolaIndex tracks the source module's array position.
      expect(solvedModel.modules[pergola.pergolaIndex]).toBe(module);
    }
  });

  it('lifts active selection from activeModuleIndex to activePergolaId', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });

    expect(solvedProject.activePergolaId).toBeTruthy();
    expect(solvedProject.activePergola).not.toBeNull();
    expect(solvedProject.activePergola?.id).toBe(solvedProject.activePergolaId);
    expect(solvedProject.activePergola?.moduleInput.pergolaId).toBe(
      solvedModel.activeModule?.moduleInput.pergolaId,
    );
  });

  it('honours an explicit activePergolaId override when the pergola exists', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const firstPergolaId = solvedModel.projectModel.pergolas[0]?.id ?? '';
    if (!firstPergolaId) throw new Error('Fixture has no pergola to activate.');
    const solvedProject = buildWorkbenchSolvedProject({
      solvedModel,
      activePergolaId: firstPergolaId,
    });
    expect(solvedProject.activePergolaId).toBe(firstPergolaId);
    expect(solvedProject.activePergola?.id).toBe(firstPergolaId);
  });

  it('falls back to the legacy active pergola when explicit activePergolaId is unknown', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({
      solvedModel,
      activePergolaId: 'pergola-that-does-not-exist',
    });
    // Falls back to legacy activeModule's pergola.
    expect(solvedProject.activePergolaId).toBe(solvedModel.activeModule?.moduleInput.pergolaId);
  });

  it('returns null activePergolaId / activePergola when there are no pergolas to solve', () => {
    const solvedModel = buildWorkbenchSolvedModel({ snapshot: null });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });
    expect(solvedProject.pergolas).toEqual([]);
    expect(solvedProject.activePergolaId).toBeNull();
    expect(solvedProject.activePergola).toBeNull();
  });

  it('carries projectModel, projectReferenceShapes, trust, geometryIdentity across unchanged', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });

    expect(solvedProject.projectModel).toBe(solvedModel.projectModel);
    expect(solvedProject.projectReferenceShapes).toBe(solvedModel.projectReferenceShapes);
    expect(solvedProject.trust).toBe(solvedModel.trust);
    expect(solvedProject.geometryIdentity).toBe(solvedModel.geometryIdentity);
  });

  it('skips pergolas in projectModel.pergolas that have no matching calculator module', () => {
    // Build a solved model, then manually add an orphan pergola to the
    // project model with no matching CalculatorModuleInputs. The orphan
    // should NOT appear in the per-pergola output — there's nothing to
    // solve for it.
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const augmented = {
      ...solvedModel,
      projectModel: {
        ...solvedModel.projectModel,
        pergolas: [
          ...solvedModel.projectModel.pergolas,
          {
            id: 'orphan-pergola',
            label: 'Orphan',
            family: 'mono' as const,
            attachmentEdgeId: null,
            attachmentZoneId: null,
            side: 'rear' as const,
            strategy: null,
          },
        ],
      },
    };
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel: augmented });
    expect(solvedProject.pergolas.some((p) => p.id === 'orphan-pergola')).toBe(false);
  });

  it('pergola ordering matches projectModel.pergolas order (not module array order)', () => {
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: getFixtureSnapshot('mono-standard'),
    });
    const solvedProject = buildWorkbenchSolvedProject({ solvedModel });

    const expectedOrder = solvedModel.projectModel.pergolas
      .map((p) => p.id)
      .filter((id) => solvedProject.pergolas.some((sp) => sp.id === id));
    const actualOrder = solvedProject.pergolas.map((p) => p.id);
    expect(actualOrder).toEqual(expectedOrder);
  });
});
