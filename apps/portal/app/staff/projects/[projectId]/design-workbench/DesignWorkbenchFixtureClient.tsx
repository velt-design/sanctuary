'use client';

import { useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';

type DesignWorkbenchFixtureClientProps = {
  fixture: SanctuaryGeometryWorkbenchFixture;
  projectName: string;
  siteAddress?: string | null;
};

export default function DesignWorkbenchFixtureClient({
  fixture,
  projectName,
  siteAddress,
}: DesignWorkbenchFixtureClientProps) {
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState());
  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        ui,
        moduleLabels: fixture.moduleLabels,
      }),
    [fixture.moduleLabels, fixture.snapshot, ui],
  );

  const activeModule = store.derived.activeModule;
  const meta = useMemo(
    () =>
      buildEstimateDrawingSheetMeta({
        moduleLabel: store.derived.activeModuleLabel,
        moduleInfoRows: buildEstimateDrawingModuleInfoRows(activeModule?.drawingModule.input),
        view: store.ui.activeView,
        versionLabel: fixture.estimate.versionLabel,
        estimateDate: fixture.estimate.createdAt,
        projectName,
        siteAddress: siteAddress ?? `${projectName} fixture preview`,
        clientName: 'Fixture preview',
      }),
    [activeModule?.drawingModule.input, fixture.estimate.createdAt, fixture.estimate.versionLabel, projectName, siteAddress, store.derived.activeModuleLabel, store.ui.activeView],
  );

  if (!activeModule) {
    return <p>Fixture data did not produce any drawing modules.</p>;
  }

  return (
    <DrawingWorkbench
      moduleLabel={store.derived.activeModuleLabel}
      modules={store.persisted.modules.map((module) => ({
        id: module.id,
        label: module.label,
      }))}
      activeModuleIndex={store.derived.activeModuleIndex}
      onActiveModuleIndexChange={(index) =>
        setUi((current) => ({
          ...current,
          activeModuleIndex: index,
        }))
      }
      view={store.ui.activeView}
      onViewChange={(view) =>
        setUi((current) => ({
          ...current,
          activeView: view,
        }))
      }
      viewportMode={store.ui.viewportMode}
      onViewportModeChange={(viewportMode) =>
        setUi((current) => ({
          ...current,
          viewportMode,
        }))
      }
      status={store.derived.status}
      planModel={store.derived.activePlanModel}
      sectionModel={store.derived.activeSectionModel}
      planViewModel={store.derived.activePlanViewModel}
      viewportTransform={store.ui.viewportTransform}
      onViewportTransformChange={(viewportTransform) =>
        setUi((current) => ({
          ...current,
          viewportTransform,
        }))
      }
      meta={meta}
    />
  );
}
