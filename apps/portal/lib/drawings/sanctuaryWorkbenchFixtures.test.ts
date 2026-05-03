import { describe, expect, it } from 'vitest';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildWorkbenchSolvedModel } from '@/lib/drawings/state/workbenchSolvedModel';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import {
  listParityCriticalSanctuaryGeometryWorkbenchFixtures,
  listSanctuaryGeometryWorkbenchFixtures,
} from './sanctuaryWorkbenchFixtures';

describe('sanctuary workbench fixtures', () => {
  it('exposes one fixture for each target V1 family', () => {
    expect(listSanctuaryGeometryWorkbenchFixtures().map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
      'gable-u-hipped-screenshot',
      'mono-join-screenshot',
    ]);
  });

  it('keeps parity-critical fixture metadata explicit and stable', () => {
    expect(listParityCriticalSanctuaryGeometryWorkbenchFixtures().map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
      'gable-u-hipped-screenshot',
      'mono-join-screenshot',
    ]);

    for (const fixture of listParityCriticalSanctuaryGeometryWorkbenchFixtures()) {
      const module = (
        fixture.snapshot as {
          inputs?: {
            modules?: Array<{
              attachmentSide?: string;
              lengthM?: string;
              projectionM?: string;
              roofMaterial?: string;
              roofPitchDeg?: string;
            }>;
          };
        }
      ).inputs?.modules?.[0];

      expect(fixture.qa.source, fixture.slug).toBe('baked_workbench_fixture');
      expect(fixture.qa.purpose.trim(), fixture.slug).toBeTruthy();
      expect(module?.lengthM, fixture.slug).toBe(String(fixture.qa.expectedModule.lengthM));
      expect(module?.projectionM, fixture.slug).toBe(String(fixture.qa.expectedModule.projectionM));
      expect(module?.roofMaterial, fixture.slug).toBe(fixture.qa.expectedModule.roofMaterial);
      expect(module?.attachmentSide, fixture.slug).toBe(fixture.qa.expectedModule.attachmentSide);
      expect(module?.roofPitchDeg, fixture.slug).toBe(String(fixture.qa.expectedModule.roofPitchDeg));
    }
  });

  it('keeps the gable fixture on the installed end-frame baseline', () => {
    const gable = listSanctuaryGeometryWorkbenchFixtures().find((fixture) => fixture.slug === 'gable-standard');
    const module = (gable?.snapshot as { inputs?: { modules?: Array<{ gableEndFramesMode?: string }> } } | undefined)?.inputs?.modules?.[0];

    expect(module?.gableEndFramesMode).toBe('outer_end_only');
  });

  it('builds a non-empty drawing store and sheet meta for every fixture', () => {
    for (const fixture of listSanctuaryGeometryWorkbenchFixtures()) {
      const store = buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        ui: createDrawingWorkbenchUiState(),
        moduleLabels: fixture.moduleLabels,
      });

      expect(store.persisted.modules.length, fixture.slug).toBeGreaterThan(0);
      expect(store.derived.activeModule, fixture.slug).not.toBeNull();
      expect(store.derived.status, fixture.slug).toBe('ready');

      const meta = buildEstimateDrawingSheetMeta({
        moduleLabel: store.derived.activeModuleLabel,
        moduleInfoRows: buildEstimateDrawingModuleInfoRows(store.derived.activeModule?.drawingModule.input),
        view: store.ui.activeView,
        versionLabel: fixture.estimate.versionLabel,
        estimateDate: fixture.estimate.createdAt,
        projectName: 'Fixture Project',
        siteAddress: '1 Fixture Street',
        clientName: 'Fixture Preview',
      });

      expect(meta.moduleTitle, fixture.slug).toBeTruthy();
      expect(meta.drawingTitle, fixture.slug).toContain(store.derived.activeModuleLabel);
    }
  });

  it('solves every parity-critical fixture through the geometry-ready workbench path', () => {
    for (const fixture of listParityCriticalSanctuaryGeometryWorkbenchFixtures()) {
      const solvedModel = buildWorkbenchSolvedModel({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        moduleLabels: fixture.moduleLabels,
        geometryIdentity: {
          projectId: 'fixture-roof',
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
        },
      });
      const activeModule = solvedModel.activeModule;

      expect(solvedModel.trust.status, fixture.slug).toBe('geometry_ready');
      expect(activeModule?.trust.status, fixture.slug).toBe('geometry_ready');
      expect(activeModule?.assembly?.family, fixture.slug).toBe(fixture.qa.shapeFamily);
      expect(activeModule?.assembly?.roofPlanes, fixture.slug).toHaveLength(fixture.qa.expectedModule.roofPlaneCount);
      expect(activeModule?.geometryArtifact?.quantityTakeoff?.primaryDimensionsM, fixture.slug).toMatchObject({
        length: fixture.qa.expectedModule.lengthM,
        projection: fixture.qa.expectedModule.projectionM,
      });
    }
  });
});
