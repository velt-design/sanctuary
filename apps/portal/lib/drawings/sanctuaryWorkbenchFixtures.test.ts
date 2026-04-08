import { describe, expect, it } from 'vitest';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import { listSanctuaryGeometryWorkbenchFixtures } from './sanctuaryWorkbenchFixtures';

describe('sanctuary workbench fixtures', () => {
  it('exposes one fixture for each target V1 family', () => {
    expect(listSanctuaryGeometryWorkbenchFixtures().map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
    ]);
  });

  it('builds a non-empty drawing store and sheet meta for every fixture', () => {
    for (const fixture of listSanctuaryGeometryWorkbenchFixtures()) {
      const store = buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
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
});
