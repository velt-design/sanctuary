'use client';

import { useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import { buildWorkbenchGeometryPreview } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchFixtureClientProps = {
  fixture: SanctuaryGeometryWorkbenchFixture;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

export default function DesignWorkbenchFixtureClient({
  fixture,
  projectName,
  siteAddress,
  backHref,
}: DesignWorkbenchFixtureClientProps) {
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        ui,
        moduleLabels: fixture.moduleLabels,
      }),
    [fixture.draft, fixture.moduleLabels, fixture.snapshot, ui],
  );
  const modules = store.persisted.modules.map((module) => ({
    id: module.id,
    label: module.label,
  }));

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
  const geometryPreview = useMemo(
    () =>
      buildWorkbenchGeometryPreview({
        projectId: `fixture-${fixture.slug}`,
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        moduleIndex: store.derived.activeModuleIndex,
      }),
    [fixture.draft, fixture.estimate.id, fixture.request.id, fixture.slug, fixture.snapshot, store.derived.activeModuleIndex],
  );

  if (!activeModule) {
    return <p>Fixture data did not produce any drawing modules.</p>;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
          {modules.length > 1 ? (
            <section className={styles.moduleSection}>
              <p className={styles.moduleSectionTitle}>Module</p>
              <select
                className={styles.moduleSelect}
                aria-label="Drawing module"
                value={String(store.derived.activeModuleIndex)}
                onChange={(event) =>
                  setUi((current) => ({
                    ...current,
                    activeModuleIndex: Number(event.target.value),
                  }))
                }
              >
                {modules.map((module, index) => (
                  <option key={module.id} value={String(index)}>
                    {module.label}
                  </option>
                ))}
              </select>
            </section>
          ) : null}

          <section className={styles.notice}>
            <p className={styles.noticeTitle}>Fixture Preview</p>
            <p className={styles.noticeText}>
              This hidden route is rendering a baked fixture snapshot. The workspace stays interactive for plan, section, and 3D review, but configurator editing is not part of fixture mode.
            </p>
          </section>
        </div>
      </aside>

      <div className={styles.workspaceColumn}>
        <div className={styles.workspaceSurface}>
          <DrawingWorkbench
            moduleLabel={store.derived.activeModuleLabel}
            modules={modules}
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
            availableViewportModes={['sheet', 'model', 'geometry3d']}
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
            geometryPreview={geometryPreview}
            viewportTransform={store.ui.viewportTransform}
            onViewportTransformChange={(viewportTransform) =>
              setUi((current) => ({
                ...current,
                viewportTransform,
              }))
            }
            meta={meta}
            backHref={backHref}
          />
        </div>
      </div>
    </div>
  );
}
