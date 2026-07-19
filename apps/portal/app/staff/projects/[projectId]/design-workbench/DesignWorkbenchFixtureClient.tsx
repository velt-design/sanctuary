'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DrawingWorkbench from '@/components/drawings/workbench/DrawingWorkbench';
import ObjectWorkbenchRail from '@/components/drawings/rail/ObjectWorkbenchRail';
import RightInspectorPanel from '@/components/drawings/inspector/RightInspectorPanel';
import WorkbenchInspectorHost from './WorkbenchInspectorHost';
import {
  buildFixtureSelectionActions,
  buildFixtureWorkbenchActions,
} from './fixtureWorkbenchActionStubs';
import type { Geometry3DViewportState } from '@/components/drawings/viewports/Geometry3DViewport';
import { useDrawingWorkbenchStore } from '@/lib/drawings/state/useDrawingWorkbenchStore';
import { buildWorkbenchDebugFixtureExport } from '@/lib/drawings/workbenchDebugExport';
import {
  buildPortalPageDebugExport,
  type PortalPageDebugExport,
} from '@/lib/debug/portalPageDebugExport';
import { inferPortalScenarioFromLabel } from '@/lib/debug/portalScenarioDebug';
import {
  buildDrawingWorkbenchObjectSelectionState,
  createDrawingWorkbenchUiState,
  type DrawingWorkbenchViewportTransform,
} from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchObjectRef } from '@/lib/drawings/state/objectFirstWorkbenchModel';
import { buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';
import styles from './DesignWorkbenchEstimateClient.module.css';

type DesignWorkbenchFixtureClientProps = {
  fixture: SanctuaryGeometryWorkbenchFixture;
  projectId?: string;
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
  projectId,
  projectName,
  siteAddress,
  backHref,
}: DesignWorkbenchFixtureClientProps) {
  const resolvedProjectId = projectId ?? `fixture-${fixture.slug}`;
  const [hasHydrated, setHasHydrated] = useState(false);
  const [ui, setUi] = useState(() => createDrawingWorkbenchUiState({ viewportMode: 'geometry3d' }));
  const [modelViewportTransformsByKey, setModelViewportTransformsByKey] = useState<
    Record<string, DrawingWorkbenchViewportTransform>
  >({});
  const [geometryViewportStatesByKey, setGeometryViewportStatesByKey] = useState<
    Record<string, Geometry3DViewportState>
  >({});
  const [hoveredObjectRef, setHoveredObjectRef] = useState<WorkbenchObjectRef | null>(null);
  const { store } = useDrawingWorkbenchStore({
    draft: fixture.draft,
    ui,
    geometryIdentity: {
      projectId: resolvedProjectId,
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
    },
  });
  useEffect(() => {
    setModelViewportTransformsByKey({});
    setGeometryViewportStatesByKey({});
  }, [fixture.slug]);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  // PR-T5 (2026-05-26): mount production WorkbenchInspectorHost with
  // no-op action stubs so the fixture dev loop covers the right
  // inspector. Stubs are memoised so the host's prop identity stays
  // stable across UI state updates.
  const fixtureSelectionActions = useMemo(
    () => buildFixtureSelectionActions(setUi),
    [setUi],
  );
  const fixtureWorkbenchActions = useMemo(() => buildFixtureWorkbenchActions(), []);
  const debugFixtureExport = useMemo(
    () =>
      buildWorkbenchDebugFixtureExport({
        draft: fixture.draft,
        ui: store.ui,
        projectArtifact: store.derived.solvedModel.projectArtifact,
      }),
    [
      fixture.draft,
      store.derived.solvedModel.projectArtifact,
      store.ui,
    ],
  );
  const portalDebugExport = useMemo<PortalPageDebugExport>(
    () =>
      buildPortalPageDebugExport({
        pageId: 'design-workbench',
        route: `/staff/projects/${resolvedProjectId}/design-workbench?fixture=${fixture.slug}`,
        selectedIds: {
          projectId: resolvedProjectId,
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
          activeObjectId: store.ui.activeObjectRef.objectId,
          activePergolaId: store.ui.activePergolaId,
        },
        serverState: {
          project: {
            id: resolvedProjectId,
            name: projectName,
            siteAddress: siteAddress ?? null,
          },
          estimate: {
            id: fixture.estimate.id,
            versionLabel: fixture.estimate.versionLabel,
          },
          designRequest: {
            id: fixture.request.id,
          },
          fixture: {
            slug: fixture.slug,
          },
        },
        clientState: {
          viewportMode: store.ui.viewportMode,
          activeObjectRef: store.ui.activeObjectRef,
          activePergolaId: store.ui.activePergolaId,
        },
        diagnostics: {
          source: 'design-workbench-fixture',
          workbenchDebugFixture: debugFixtureExport,
          projectPreviewSource: debugFixtureExport.renderDiagnostics.projectPreviewSource,
          projectHouseProjectionHealth:
            store.derived.solvedModel.projectArtifact.diagnostics.projectHouseProjectionHealth,
          projectPergolaRenderHealth:
            store.derived.solvedModel.projectArtifact.diagnostics.projectPergolaRenderHealth,
        },
        scenario: inferPortalScenarioFromLabel(projectName),
      }),
    [
      debugFixtureExport,
      fixture.estimate.id,
      fixture.estimate.versionLabel,
      fixture.request.id,
      fixture.slug,
      projectName,
      resolvedProjectId,
      siteAddress,
      store.derived.solvedModel.projectArtifact.diagnostics.projectHouseProjectionHealth,
      store.derived.solvedModel.projectArtifact.diagnostics.projectPergolaRenderHealth,
      store.ui.activeObjectRef,
      store.ui.activePergolaId,
      store.ui.viewportMode,
    ],
  );
  const meta = useMemo(
    () =>
      buildEstimateDrawingSheetMeta({
        sheetLabel: store.derived.projectSheetLabel,
        sheetInfoRows: [],
        view: 'plan',
        versionLabel: fixture.estimate.versionLabel,
        estimateDate: fixture.estimate.createdAt,
        projectName,
        siteAddress: siteAddress ?? `${projectName} fixture preview`,
        clientName: 'Fixture preview',
      }),
    [fixture.estimate.createdAt, fixture.estimate.versionLabel, projectName, siteAddress, store.derived.projectSheetLabel],
  );
  const activeSelectionFamily = store.ui.activeObjectRef.family;
  const objectWorkbenchDisplayFamily = activeSelectionFamily === 'pergolas' ? 'pergolas' : 'house_forms';
  const activePergolaSurfaceKey =
    store.ui.activePergolaId ??
    store.derived.activePergola?.id ??
    'none';
  const modelViewportSurfaceKey = `${activePergolaSurfaceKey}:plan`;
  const geometryViewportSurfaceKey = `${objectWorkbenchDisplayFamily}:${activePergolaSurfaceKey}`;
  const viewportActiveObjectRef = store.ui.activeObjectRef;
  const activeModelViewportTransform =
    modelViewportTransformsByKey[modelViewportSurfaceKey] ?? DEFAULT_MODEL_VIEWPORT_TRANSFORM;
  const activeGeometryViewportState =
    geometryViewportStatesByKey[geometryViewportSurfaceKey] ?? null;
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

  return (
    <div
      className={styles.shell}
      data-fixture-workbench-hydrated={hasHydrated ? 'true' : 'false'}
      data-workbench-density="compact"
    >
      <script
        type="application/json"
        data-workbench-debug-export="true"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(debugFixtureExport).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/json"
        data-portal-debug-export="true"
        data-portal-debug-page-id={portalDebugExport.pageId}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(portalDebugExport).replace(/</g, '\\u003c') }}
      />
      <aside className={styles.configuratorColumn}>
        <div className={styles.configuratorScroll}>
          {/*
            PR-T4 (2026-05-26): mount the same flat OBJECTS TREE rail
            the real workbench uses so visual captures taken against
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
              // fixture renders all four families' "+ Add X" pills.
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
            sheetLabel={store.derived.projectSheetLabel}
            viewportMode={store.ui.viewportMode}
            onViewportModeChange={(viewportMode) =>
              setUi((current) => ({
                ...current,
                viewportMode,
              }))
            }
            status={store.derived.status}
            projectArtifact={store.derived.solvedModel.projectArtifact}
            viewportGeometry={store.derived.activeViewportGeometry}
            objectWorkbenchDisplayFamily={objectWorkbenchDisplayFamily}
            visibility={store.ui.visibility}
            activeObjectRef={viewportActiveObjectRef}
            hoveredObjectRef={hoveredObjectRef}
            onHoverObjectChange={setHoveredObjectRef}
            onSelectObjectWorkbenchTarget={fixtureSelectionActions.selectObjectWorkbenchTarget}
            onSelectPergolaTarget={fixtureSelectionActions.selectPergolaObject}
            onClearWorkbenchSelection={fixtureSelectionActions.clearActiveWorkbenchSelection}
            drawingSurfaceGeometry={store.derived.activeDrawingSurfaceGeometry}
            modelViewportTransform={activeModelViewportTransform}
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
           * fixture dev loop sees the same inspector code path users
           * see in the authenticated workbench. `isLocked={true}`
           * disables controls visually so it's obvious the fixture is
           * read-only. Replaces the prior empty-shell mount.
           */}
          <RightInspectorPanel
            selectionLabel={store.derived.railModel.selectedInspector.selectedObjectLabel}
            trustStatusLabel={store.derived.railModel.selectedInspector.selectedObjectTrustLabel}
          >
            <WorkbenchInspectorHost
              isLocked
              objectSelectionActions={fixtureSelectionActions}
              objectWorkbenchActions={fixtureWorkbenchActions}
              setUi={setUi}
              store={store}
            />
          </RightInspectorPanel>
        </div>
      </aside>
    </div>
  );
}
