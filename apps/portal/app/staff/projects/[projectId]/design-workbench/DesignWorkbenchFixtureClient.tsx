'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import ObjectWorkbenchRail from '@/components/drawings/rail/ObjectWorkbenchRail';
import RightInspectorPanel from '@/components/drawings/inspector/RightInspectorPanel';
import { buildObjectWorkbenchGeometryEditState } from '@/lib/drawings/geometry/geometryEditAdapter';
import { buildProjectContextOverlayShapes } from '@/lib/drawings/state/projectContextOverlayShapes';
import WorkbenchInspectorHost from './WorkbenchInspectorHost';
import {
  buildFixtureSelectionActions,
  buildFixtureWorkbenchActions,
} from './fixtureWorkbenchActionStubs';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import {
  buildDrawingWorkbenchObjectSelectionState,
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
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
  const [hasHydrated, setHasHydrated] = useState(false);
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const [modelViewportTransformsByKey, setModelViewportTransformsByKey] = useState<
    Record<string, DrawingWorkbenchViewportTransform>
  >({});
  const [geometryViewportStatesByKey, setGeometryViewportStatesByKey] = useState<
    Record<string, Geometry3DViewportState>
  >({});
  const [hoveredObjectRef, setHoveredObjectRef] = useState<WorkbenchObjectRef | null>(null);
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
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  const modules = store.persisted.modules.map((module) => ({
    id: module.id,
    label: module.label,
  }));

  const activeModule = store.derived.activeModule;
  // PR-T5 (2026-05-26): mount production WorkbenchInspectorHost with
  // no-op action stubs so the snapshot dev loop covers the right
  // inspector. Stubs are memoised so the host's prop identity stays
  // stable across UI state updates.
  const fixtureSelectionActions = useMemo(
    () => buildFixtureSelectionActions(setUi),
    [setUi],
  );
  const fixtureWorkbenchActions = useMemo(() => buildFixtureWorkbenchActions(), []);
  // Build the real geometry-edit state from fixture snapshot + draft so
  // SanctuaryWorkbenchRail / PergolaInspector / HouseFormInspector all
  // see populated form data and render their PRIMARY / CONNECTIONS /
  // MEMBER SIZES sections (vs the "No Sanctuary controls" empty state).
  const fixtureGeometryEditState = useMemo(() => {
    const result = buildObjectWorkbenchGeometryEditState({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleIndex: store.derived.activeModuleIndex,
    });
    return result.ok ? result.value : null;
  }, [fixture.draft, fixture.snapshot, store.derived.activeModuleIndex]);
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
  const activeSelectionFamily =
    store.ui.activeRailTab === 'diagnostics' ? store.ui.activeObjectFamily : store.ui.activeRailTab;
  const objectWorkbenchDisplayFamily = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house_forms';
  const activePergolaSurfaceKey =
    store.ui.activePergolaId ??
    store.derived.activePergola?.id ??
    activeModule?.drawingModule.input.pergolaId ??
    'none';
  const modelViewportSurfaceKey = `${activePergolaSurfaceKey}:${store.ui.activeView}`;
  const geometryViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${activePergolaSurfaceKey}`;
  const viewportPergolaId =
    store.derived.objectWorkbench.activePergola?.id ??
    activeModule?.drawingModule.input.pergolaId ??
    store.derived.objectWorkbench.pergolas[0]?.id ??
    null;
  const viewportActiveObjectRef = store.ui.activeObjectRef;
  const activePergolaSourceId =
    store.ui.activeObjectRef.family === 'pergolas'
      ? store.ui.activeObjectRef.objectId ?? activeModule?.drawingModule.input.pergolaId ?? null
      : null;
  const projectPergolaPlanShapes = store.derived.solvedModel.projectPergolaPlanShapes;
  const fullDetailPergolaSourceIds = useMemo(
    () =>
      new Set(
        projectPergolaPlanShapes
          .map((shape) =>
            typeof shape.metadata?.pergolaId === 'string' ? shape.metadata.pergolaId : null,
          )
          .filter((value): value is string => Boolean(value)),
      ),
    [projectPergolaPlanShapes],
  );
  const projectContextShapes = useMemo(
    () =>
      buildProjectContextOverlayShapes({
        projectReferenceShapes: store.derived.solvedModel.projectReferenceShapes,
        activePergolaSourceId,
        fullDetailPergolaSourceIds,
      }),
    [
      store.derived.solvedModel.projectReferenceShapes,
      activePergolaSourceId,
      fullDetailPergolaSourceIds,
    ],
  );
  const projectPergolaSnapShapes = useMemo(
    () =>
      buildProjectContextOverlayShapes({
        projectReferenceShapes: store.derived.solvedModel.projectReferenceShapes,
        activePergolaSourceId,
      }),
    [store.derived.solvedModel.projectReferenceShapes, activePergolaSourceId],
  );
  const houseCommittedShapes = useMemo(
    () =>
      store.derived.solvedModel.projectReferenceShapes.filter(
        (shape) => shape.sourceType === 'house_reference',
      ),
    [store.derived.solvedModel.projectReferenceShapes],
  );
  const projectHouseSnapSources = useMemo(
    () =>
      store.derived.solvedModel.projectHouseGeometries.map((entry) => ({
        houseFormId: entry.houseFormId,
        model: entry.model,
      })),
    [store.derived.solvedModel.projectHouseGeometries],
  );
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
    <div
      className={styles.shell}
      data-fixture-workbench-hydrated={hasHydrated ? 'true' : 'false'}
      data-workbench-density="compact"
    >
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
          {/*
            PR-T4-snapshot (2026-05-26): mount the same flat OBJECTS TREE rail
            the real workbench uses so visual snapshots taken against
            /qa/design-workbench-fixture exercise the same CSS as the
            authenticated /staff/projects/[id]/design-workbench route.
            Handlers are no-ops — the fixture is read-only, the rail just
            renders the tree + visibility toggles for layout iteration.
          */}
          <ObjectWorkbenchRail
            model={store.derived.railModel}
            activeObjectRef={store.ui.activeObjectRef}
            visibility={store.ui.visibility}
            disabled
            onSelectObjectRef={(ref) =>
              setUi((current) => ({
                ...current,
                ...(ref.family === 'pergolas' ? { activePergolaId: ref.objectId } : {}),
                ...buildDrawingWorkbenchObjectSelectionState({
                  activeRailTab: ref.family,
                  activeObjectRef: ref,
                }),
              }))
            }
            onVisibilityChange={(family, visible) =>
              setUi((current) => ({
                ...current,
                visibility: {
                  ...current.visibility,
                  [family]: visible,
                },
              }))
            }
            inspectorContext={{
              // PR-T6 (2026-05-26): wire no-op stubs to the add pills so the
              // snapshot fixture renders all four families' "+ Add X" pills.
              // Real add behaviour is wired in `ObjectWorkbenchRailHost` —
              // fixture is read-only by design.
              onAddHouseForm: fixtureWorkbenchActions.addSharedHouseForm,
              onAddDeck: () => fixtureWorkbenchActions.addSharedHouseDeck('preset'),
              onAddOpening: () => fixtureWorkbenchActions.addSharedHouseOpening('window'),
            }}
          />
        </div>
      </aside>

      <div className={styles.workspaceColumn}>
        <div className={styles.workspaceSurface}>
          <DrawingWorkbench
            moduleLabel={store.derived.activeModuleLabel}
            modules={modules}
            activeModuleIndex={store.derived.activeModuleIndex}
            onActiveModuleIndexChange={(index) =>
              setUi((current) => {
                const selectedPergolaId = store.persisted.modules[index]?.drawingModule.input.pergolaId ?? null;
                return {
                  ...current,
                  activeModuleIndex: index,
                  activePergolaId: selectedPergolaId ?? current.activePergolaId,
                };
              })
            }
            view={store.ui.activeView}
            onViewChange={(view) =>
              setUi((current) => ({
                ...current,
                activeView: view,
              }))
            }
            viewportMode={store.ui.viewportMode}
            availableViewportModes={['sheet', 'plan', 'model', 'geometry3d']}
            onViewportModeChange={(viewportMode) =>
              setUi((current) => ({
                ...current,
                viewportMode,
              }))
            }
            status={store.derived.status}
            trustGate={store.derived.activeTrustGate}
            viewportGeometry={store.derived.activeViewportGeometry}
            projectViewportGeometry={store.derived.solvedModel.projectViewportGeometry}
            projectGeometryPreview={store.derived.solvedModel.projectGeometryPreview}
            projectPlanProjection={store.derived.solvedModel.projectPlanProjection}
            objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
            visibility={store.ui.visibility}
            activeObjectRef={viewportActiveObjectRef}
            projectContextShapes={projectContextShapes}
            projectPergolaPlanShapes={projectPergolaPlanShapes}
            projectPergolaSnapShapes={projectPergolaSnapShapes}
            houseCommittedShapes={houseCommittedShapes}
            projectHouseSnapSources={projectHouseSnapSources}
            hoveredObjectRef={hoveredObjectRef}
            onHoverObjectChange={setHoveredObjectRef}
            pergolaTargetId={viewportPergolaId}
            enableProjectionOnlyModelInteractions
            onSelectObjectWorkbenchTarget={fixtureSelectionActions.selectObjectWorkbenchTarget}
            onSelectPergolaTarget={fixtureSelectionActions.selectPergolaObject}
            onClearWorkbenchSelection={fixtureSelectionActions.clearActiveWorkbenchSelection}
            drawingSurfaceGeometry={store.derived.activeDrawingSurfaceGeometry}
            planViewModel={store.derived.activePlanViewModel}
            modelViewportKey={modelViewportSurfaceKey}
            modelViewportTransform={activeModelViewportTransform}
            modelViewportAutoFitOnReady={shouldAutoFitModelViewport}
            geometryViewportKey={geometryViewportSurfaceKey}
            geometryViewportState={activeGeometryViewportState}
            onModelViewportTransformChange={handleModelViewportTransformChange}
            onGeometryViewportStateChange={handleGeometryViewportStateChange}
            meta={meta}
            backHref={backHref}
            projectLabel={projectName}
          />
        </div>
      </div>

      <aside className={styles.inspectorColumn}>
        <div className={styles.inspectorScroll}>
          {/*
           * PR-T5 (2026-05-26): mount the real production
           * `WorkbenchInspectorHost` with no-op action stubs so the AI
           * snapshot dev loop sees the same inspector code path users
           * see in the authenticated workbench. `isLocked={true}`
           * disables controls visually so it's obvious the fixture is
           * read-only. Replaces the prior empty-shell mount.
           */}
          <RightInspectorPanel
            selectionLabel={store.derived.railModel.selectedInspector.selectedObjectLabel}
            trustStatusLabel={store.derived.railModel.selectedInspector.selectedObjectTrustLabel}
          >
            <WorkbenchInspectorHost
              activeModuleInput={activeModule.drawingModule.input}
              geometryEditState={fixtureGeometryEditState}
              isLocked
              objectSelectionActions={fixtureSelectionActions}
              objectWorkbenchActions={fixtureWorkbenchActions}
              setUi={setUi}
              store={store}
              supportsSanctuaryEditing={Boolean(fixtureGeometryEditState)}
            />
          </RightInspectorPanel>
        </div>
      </aside>
    </div>
  );
}
