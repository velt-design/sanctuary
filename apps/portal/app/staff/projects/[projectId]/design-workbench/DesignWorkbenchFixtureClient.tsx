'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import type { ObjectWorkbenchGeometryPreviewState } from '@/lib/drawings/geometry/buildWorkbenchGeometryPreview';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchFixtureClientProps = {
  fixture: SanctuaryGeometryWorkbenchFixture;
  projectName: string;
  siteAddress?: string | null;
  backHref?: string;
};

const DEFAULT_MODEL_VIEWPORT_TRANSFORM = createDrawingWorkbenchUiState().viewportTransform;

function viewportTransformsEqual(
  a: DrawingWorkbenchViewportTransform,
  b: DrawingWorkbenchViewportTransform,
): boolean {
  return a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY;
}

function geometryViewportStatesEqual(
  a: Geometry3DViewportState,
  b: Geometry3DViewportState,
): boolean {
  return (
    a.cameraState.distanceMm === b.cameraState.distanceMm &&
    a.cameraState.viewPreset === b.cameraState.viewPreset &&
    a.cameraState.focusMode === b.cameraState.focusMode &&
    a.cameraState.position.x === b.cameraState.position.x &&
    a.cameraState.position.y === b.cameraState.position.y &&
    a.cameraState.position.z === b.cameraState.position.z &&
    a.cameraState.target.x === b.cameraState.target.x &&
    a.cameraState.target.y === b.cameraState.target.y &&
    a.cameraState.target.z === b.cameraState.target.z
  );
}

export default function DesignWorkbenchFixtureClient({
  fixture,
  projectName,
  siteAddress,
  backHref,
}: DesignWorkbenchFixtureClientProps) {
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const [modelViewportTransformsByKey, setModelViewportTransformsByKey] = useState<
    Record<string, DrawingWorkbenchViewportTransform>
  >({});
  const [geometryViewportStatesByKey, setGeometryViewportStatesByKey] = useState<
    Record<string, Geometry3DViewportState>
  >({});
  const store = useMemo(
    () =>
      buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        ui,
        moduleLabels: fixture.moduleLabels,
        geometryIdentity: {
          projectId: `fixture-${fixture.slug}`,
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
        },
      }),
    [fixture.draft, fixture.estimate.id, fixture.moduleLabels, fixture.request.id, fixture.slug, fixture.snapshot, ui],
  );
  useEffect(() => {
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
  }, [fixture.slug]);
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
  const geometryPreview: ObjectWorkbenchGeometryPreviewState =
    store.derived.activeSolution?.geometryPreview ?? {
      kind: 'error',
      message: 'No active 3D geometry preview is available.',
    };
  const activeSelectionFamily =
    store.ui.activeRailTab === 'diagnostics' ? store.ui.activeObjectFamily : store.ui.activeRailTab;
  const canonicalWorkbenchDisplayMode = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house';
  const modelViewportSurfaceKey = `${canonicalWorkbenchDisplayMode}:${store.derived.activeModuleIndex}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${canonicalWorkbenchDisplayMode}:${store.derived.activeModuleIndex}`;
  const activeModelViewportTransform =
    modelViewportTransformsByKey[modelViewportSurfaceKey] ?? DEFAULT_MODEL_VIEWPORT_TRANSFORM;
  const activeGeometryViewportState =
    geometryViewportStatesByKey[geometryViewportSurfaceKey] ?? null;
  const shouldAutoFitModelViewport = !Object.prototype.hasOwnProperty.call(
    modelViewportTransformsByKey,
    modelViewportSurfaceKey,
  );
  const handleModelViewportTransformChange = useCallback(
    (viewportTransform: DrawingWorkbenchViewportTransform) => {
      setModelViewportTransformsByKey((current) => {
        const existing = current[modelViewportSurfaceKey];
        if (existing && viewportTransformsEqual(existing, viewportTransform)) return current;
        return {
          ...current,
          [modelViewportSurfaceKey]: viewportTransform,
        };
      });
      setUi((current) =>
        viewportTransformsEqual(current.viewportTransform, viewportTransform)
          ? current
          : {
              ...current,
              viewportTransform,
            },
      );
    },
    [modelViewportSurfaceKey],
  );
  const handleGeometryViewportStateChange = useCallback(
    (viewportState: Geometry3DViewportState) => {
      setGeometryViewportStatesByKey((current) => {
        const existing = current[geometryViewportSurfaceKey];
        if (existing && geometryViewportStatesEqual(existing, viewportState)) return current;
        return {
          ...current,
          [geometryViewportSurfaceKey]: viewportState,
        };
      });
    },
    [geometryViewportSurfaceKey],
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
            modelViewportKey={modelViewportSurfaceKey}
            modelViewportTransform={activeModelViewportTransform}
            modelViewportAutoFitOnReady={shouldAutoFitModelViewport}
            geometryViewportKey={geometryViewportSurfaceKey}
            geometryViewportState={activeGeometryViewportState}
            onModelViewportTransformChange={handleModelViewportTransformChange}
            onGeometryViewportStateChange={handleGeometryViewportStateChange}
            meta={meta}
            backHref={backHref}
          />
        </div>
      </div>
    </div>
  );
}
