import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SCAN_ROOTS = [
  path.join('apps', 'portal', 'components', 'drawings', 'rail'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
];
const FLAT_COMPATIBILITY_DERIVED_READ_ROOTS = [
  path.join('apps', 'portal', 'lib', 'drawings', 'state'),
  path.join('apps', 'portal', 'lib', 'drawings', 'views', 'plan'),
];
const STATE_SOURCE_ROOT = path.join('apps', 'portal', 'lib', 'drawings', 'state');
const STATE_COMPAT_PATH_SEGMENT = `${path.sep}state${path.sep}compat${path.sep}`;
const GEOMETRY_SOURCE_ROOT = path.join('apps', 'portal', 'lib', 'drawings', 'geometry');
const GEOMETRY_COMPAT_ROOT = path.join(GEOMETRY_SOURCE_ROOT, 'compat');
const ESTIMATES_SOURCE_ROOT = path.join('apps', 'portal', 'lib', 'estimates');
const ESTIMATES_COMPAT_PATH_SEGMENT = `${path.sep}estimates${path.sep}compat${path.sep}`;
const OBJECT_WORKBENCH_GEOMETRY_UI_ROOTS = [
  path.join('apps', 'portal', 'components', 'drawings', 'rail'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports'),
  path.join('apps', 'portal', 'components', 'drawings', 'workbench'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
];
const OBJECT_WORKBENCH_ACTION_SELECTION_FILES = [
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'useObjectWorkbenchActions.ts'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'useObjectWorkbenchSelection.ts'),
];
const OBJECT_WORKBENCH_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'DrawingWorkbench.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'Geometry3DViewport.tsx'),
];
const OBJECT_WORKBENCH_PLAN_OVERLAY_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleViewsCard.tsx'),
  path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleViewsCard.test.tsx'),
  path.join('apps', 'portal', 'lib', 'drawings', 'views', 'plan', 'buildPlanViewModel.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'views', 'plan', 'objectWorkbenchPlanOverlay.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'interactions', 'deckInteractionAdapter.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'interactions', 'openingInteractionAdapter.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'interactions', 'deckInteractionAdapter.test.ts'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'),
];
const OBJECT_WORKBENCH_RENDERER_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'),
];
const OBJECT_WORKBENCH_RENDERER_TEST_FILES = [
  path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleViewsCard.test.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.test.tsx'),
];
const RAIL_SOURCE_ROOT = path.join('apps', 'portal', 'components', 'drawings', 'rail');
const VIEWPORT_SOURCE_ROOT = path.join('apps', 'portal', 'components', 'drawings', 'viewports');
const WORKBENCH_COMPOSITION_BOUNDARY_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'DrawingWorkbench.tsx')),
  path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'WorkbenchViewportHost.tsx')),
]);
const OBJECT_WORKBENCH_GEOMETRY_PUBLIC_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'buildRawGeometryModuleInput.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'buildWorkbenchGeometryPreview.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'deriveWorkbenchGeometry.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'geometryEditAdapter.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'objectWorkbenchGeometryEditAdapterCore.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'objectWorkbenchGeometryContext.ts'),
];
const OBJECT_WORKBENCH_GEOMETRY_EDIT_ADAPTER_FILE = path.join(
  'apps',
  'portal',
  'lib',
  'drawings',
  'geometry',
  'objectWorkbenchGeometryEditAdapterCore.ts',
);
const OBJECT_WORKBENCH_RAIL_INSPECTOR_STATE_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'drawingWorkbenchStore.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'drawingWorkbenchRailModel.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'objectWorkbenchInspectorModel.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'objectWorkbenchStatusModel.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'interactions', 'deckInteractionContract.ts'),
];
const FLAT_COMPATIBILITY_DERIVED_FIELD_READ =
  /\b[A-Za-z_$][\w$]*\.derived\.(?:house|houseCount|decks|openings|activeDeck|activeDeckId|activeOpening|activeOpeningId|pergolas|activePergola|activePergolaId|roofForm|roofReviewStatus|roofValidationStatus|roofValidationCode|roofValidationMessage|roofApproximationReasons|roofProvenance|roofGeometryKind|roofAppendageEnabled|roofAppendageStatus|roofAppendageSupportedHostEdges|roofAppendageSupportReason|migrationWarnings|migrationWarningCount|houseIsLowConfidence)\b/;
const REMOVED_DERIVED_COMPATIBILITY_BRIDGE_READ =
  /\b[A-Za-z_$][\w$]*\.derived\.compatibilityBridge\b/;
const FLAT_PERSISTED_COMPATIBILITY_PROJECT_MODEL_READ =
  /\b[A-Za-z_$][\w$]*\.persisted\.compatibilityProjectModel\b/;
const REMOVED_PERSISTED_COMPATIBILITY_BRIDGE_READ =
  /\b[A-Za-z_$][\w$]*\.persisted\.compatibilityBridge\b/;
const PERSISTED_COMPATIBILITY_BRIDGE_PROJECT_MODEL_READ =
  /\b[A-Za-z_$][\w$]*\.persisted\.compatibilityBridge\.projectModel\b/;
const REMOVED_ESTIMATE_HOUSE_FIRST_API =
  /\b(?:EstimateDrawingHouseFirst[A-Za-z0-9_]*|updateEstimateDrawingHouseFirst[A-Za-z0-9_]*)\b/;
const PERSISTED_HOUSE_FIRST_DRAFT_USAGE =
  /\b[A-Za-z_$][\w$]*\.houseFirst\b|\bhouseFirst\s*:/;
const OBJECT_FIRST_TO_COMPATIBILITY_DRAFT_BUILDER =
  /\bbuildObjectWorkbenchCompatibilityDraftFromObjectFirstDraft\b/;
const ACTIVE_WORKBENCH_PREVIEW_BUILDER =
  /\bbuildObjectWorkbenchGeometryPreview\b/;
const RETIRED_ACTIVE_GEOMETRY_ALIAS_NAMES =
  /\b(?:buildObjectWorkbenchRawGeometryModuleInput|deriveObjectWorkbenchGeometry|ObjectWorkbenchGeometryDerivation|ObjectWorkbenchPergolaRenderSource|ObjectWorkbenchPergolaRenderStatus|buildObjectWorkbenchGeometryPreview|ObjectWorkbenchGeometryPreviewMode|ObjectWorkbenchGeometryPreviewState)\b/;
const LEGACY_RENDERER_BOUNDARY_NAMES =
  /\b(?:HouseFirstPlanShapeDragStartMeta|HouseFirstObjectPreviewOverlay|houseFirstPlanOverlay|houseFirstPreviewOverlay|activeHouseFirstCustomEdgeId|hoveredHouseFirstDeckId|onHouseFirstShapeSelect|onHouseFirstDeckHoverChange|onHouseFirstShapeDragStart|onHouseFirstCustomEdgeSelect|onHouseFirstDimensionActivate)\b/;
const REMOVED_PLAN_VIEW_MODEL_COMPATIBILITY_PROPS =
  /\b(?:objectWorkbenchCompatibilityHouse|objectWorkbenchCompatibilitySelection)\b/;
const ALLOWLISTED_COMPATIBILITY_FILES = new Set<string>();
const LEGACY_STATE_COMPATIBILITY_ADAPTER_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'lib', 'drawings', 'state', 'legacyEstimateSnapshotAdapter.ts')),
  path.normalize(path.join('apps', 'portal', 'lib', 'drawings', 'state', 'legacyObjectFirstCompatibilityAdapter.ts')),
  path.normalize(path.join('apps', 'portal', 'lib', 'drawings', 'state', 'legacyObjectFirstCompatibilityAdapter.test.ts')),
]);
const ALLOWLISTED_CONFIGURATOR_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'rail', 'ConfiguratorRail.tsx')),
]);
const ALLOWLISTED_PERSISTED_COMPATIBILITY_BRIDGE_READERS = new Set<string>();

function listSourceFiles(directory: string, options: { includeTests?: boolean } = {}): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(absolutePath, options);
    }
    if (!entry.isFile()) return [];
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    if (!options.includeTests && entry.name.includes('.test.')) return [];
    return [absolutePath];
  });
}

function toRepoRelativePath(absolutePath: string): string {
  return path.normalize(path.relative(process.cwd(), absolutePath));
}

function canImportLegacyStateCompatibility(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  return (
    relativePath.includes(STATE_COMPAT_PATH_SEGMENT) ||
    LEGACY_STATE_COMPATIBILITY_ADAPTER_FILES.has(relativePath) ||
    basename.startsWith('houseFirst')
  );
}

function isLegacyPersistenceCompatibilityZone(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  return (
    relativePath.includes(STATE_COMPAT_PATH_SEGMENT) ||
    LEGACY_STATE_COMPATIBILITY_ADAPTER_FILES.has(relativePath) ||
    basename.startsWith('houseFirst') ||
    relativePath.endsWith(path.normalize(path.join('apps', 'portal', 'lib', 'estimates', 'drawingEdits.ts')))
  );
}

describe('object workbench import guards', () => {
  it('keeps active plan view construction on the solved geometry artifact contract', () => {
    const planViewBuilderPath = path.normalize(
      path.join('apps', 'portal', 'lib', 'drawings', 'views', 'plan', 'buildPlanViewModel.ts'),
    );
    const source = fs.readFileSync(path.join(process.cwd(), planViewBuilderPath), 'utf8');

    expect(source).toContain('geometryArtifact?: WorkbenchSolvedGeometryArtifact | null');
    expect(source).toContain('geometryArtifact?.plan');
    expect(source).toContain('geometryArtifact?.topProjection');
    expect(source).toContain('geometryArtifact?.assembly');
    expect(source).toContain('topProjectionFromViewerSceneArtifact');
  });

  it('routes shell and viewport geometry through the viewport geometry bundle', () => {
    const shellPath = path.normalize(
      path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'DrawingWorkbench.tsx'),
    );
    const viewportHostPath = path.normalize(
      path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'WorkbenchViewportHost.tsx'),
    );
    const hiddenWorkbenchClientPath = path.normalize(
      path.join(
        'apps',
        'portal',
        'app',
        'staff',
        'projects',
        '[projectId]',
        'design-workbench',
        'DesignWorkbenchEstimateClient.tsx',
      ),
    );
    const fixtureClientPath = path.normalize(
      path.join(
        'apps',
        'portal',
        'app',
        'staff',
        'projects',
        '[projectId]',
        'design-workbench',
        'DesignWorkbenchFixtureClient.tsx',
      ),
    );
    const projectEstimateTabPath = path.normalize(
      path.join('apps', 'portal', 'components', 'projects', 'ProjectPage', 'tabs', 'EstimatesTab.tsx'),
    );
    const shellSource = fs.readFileSync(path.join(process.cwd(), shellPath), 'utf8');
    const viewportHostSource = fs.readFileSync(path.join(process.cwd(), viewportHostPath), 'utf8');
    const sheetViewportSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'SheetViewport.tsx'))),
      'utf8',
    );
    const estimateSheetSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'components', 'estimates', 'EstimateDrawingSheet.tsx'))),
      'utf8',
    );
    const moduleDrawingRendererSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleDrawingRenderer.tsx'))),
      'utf8',
    );
    const moduleDrawingContractsSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleDrawingContracts.ts'))),
      'utf8',
    );
    const modelSpaceViewportSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'))),
      'utf8',
    );
    const geometry3DViewportSource = fs.readFileSync(
      path.join(process.cwd(), path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'Geometry3DViewport.tsx'))),
      'utf8',
    );

    expect(shellSource).toContain('viewportGeometry?: WorkbenchViewportGeometry | null');
    expect(shellSource).toContain('viewportGeometry={viewportGeometry}');
    expect(viewportHostSource).toContain('viewportGeometry?: WorkbenchViewportGeometry | null');
    expect(viewportHostSource).toContain('viewportGeometry?.preview');
    expect(viewportHostSource).toContain('buildWorkbenchDrawingSurfaceGeometry');
    expect(viewportHostSource).toContain('drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null');
    expect(viewportHostSource).toContain('drawingSurfaceGeometry={routedDrawingSurfaceGeometry}');
    expect(shellSource).not.toContain('planModel?:');
    expect(shellSource).not.toContain('sectionModel?:');
    expect(shellSource).not.toContain('geometryPreview?:');
    expect(viewportHostSource).not.toContain('planModel?:');
    expect(viewportHostSource).not.toContain('sectionModel?:');
    expect(viewportHostSource).not.toContain('geometryPreview?:');
    expect(sheetViewportSource).toContain('drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null');
    expect(sheetViewportSource).not.toContain('planModel?:');
    expect(sheetViewportSource).not.toContain('sectionModel?:');
    expect(estimateSheetSource).toContain('drawingSurfaceGeometry?: WorkbenchDrawingSurfaceGeometry | null');
    expect(estimateSheetSource).toContain('data-drawing-surface-source');
    expect(moduleDrawingRendererSource).toContain("drawingSurfaceGeometry?.source === 'solved_geometry'");
    expect(moduleDrawingRendererSource).toContain('drawingSurfaceGeometry?.legacyPlanModel');
    expect(moduleDrawingRendererSource).toContain('drawingSurfaceGeometry?.legacySectionModel');
    expect(moduleDrawingRendererSource).toContain('drawingSurfaceGeometry?.geometrySection');
    expect(moduleDrawingRendererSource).toContain('geometrySection={effectiveGeometrySection}');
    expect(moduleDrawingRendererSource).toContain('data-drawing-surface-source');
    expect(moduleDrawingRendererSource).not.toContain('drawingSurfaceGeometry?.planModel');
    expect(moduleDrawingRendererSource).not.toContain('drawingSurfaceGeometry?.sectionModel');
    expect(moduleDrawingContractsSource).not.toContain('modelSpacePergolaGeometry?:');
    expect(modelSpaceViewportSource).toContain("from '@/components/drawings/viewports/Geometry3DViewport'");
    expect(modelSpaceViewportSource).toContain('<Geometry3DViewport');
    expect(modelSpaceViewportSource).toContain('lockedViewPreset="top"');
    expect(modelSpaceViewportSource).not.toContain('ProjectionPlanViewport');
    expect(modelSpaceViewportSource).not.toContain("from '@/components/drawings/viewports/ProjectionTopViewport'");
    expect(modelSpaceViewportSource).not.toContain('<ProjectionTopViewport');
    expect(geometry3DViewportSource).toContain('lockedViewPreset?: GeometryCameraPreset');
    expect(geometry3DViewportSource).not.toContain('ModulePlanModel');
    expect(geometry3DViewportSource).not.toContain('legacyPlanModel');
    expect(geometry3DViewportSource).not.toContain('objectWorkbenchPlanOverlay');
    expect(moduleDrawingContractsSource).not.toContain('modelSpaceTopProjection?:');
    expect(moduleDrawingContractsSource).not.toContain('modelSpacePergolaRenderSource?:');
    expect(moduleDrawingContractsSource).not.toContain('modelSpacePergolaRenderStatus?:');
    expect(modelSpaceViewportSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaGeometry=/);
    expect(modelSpaceViewportSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpaceTopProjection=/);
    expect(modelSpaceViewportSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaRenderSource=/);
    expect(modelSpaceViewportSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaRenderStatus=/);
    expect(modelSpaceViewportSource).not.toContain("source: 'solved_geometry' as const");
    expect(estimateSheetSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaGeometry=/);
    expect(estimateSheetSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpaceTopProjection=/);
    expect(estimateSheetSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaRenderSource=/);
    expect(estimateSheetSource).not.toMatch(/<ModuleDrawingRenderer[\s\S]*?modelSpacePergolaRenderStatus=/);
    expect(moduleDrawingRendererSource).not.toContain(
      "modelSpacePergolaGeometry ?? (drawingSurfaceGeometry?.source === 'solved_geometry'",
    );
    expect(moduleDrawingRendererSource).not.toContain(
      "modelSpaceTopProjection ?? (drawingSurfaceGeometry?.source === 'solved_geometry'",
    );

    for (const relativePath of [hiddenWorkbenchClientPath, fixtureClientPath, projectEstimateTabPath]) {
      const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
      expect(source).toContain('viewportGeometry={');
      expect(source).toContain('drawingSurfaceGeometry={');
      expect(source).not.toMatch(/<DrawingWorkbench[\s\S]*?geometryPreview=/);
      expect(source).not.toMatch(/<DrawingWorkbench[\s\S]*?planModel=/);
      expect(source).not.toMatch(/<DrawingWorkbench[\s\S]*?sectionModel=/);
    }
  });

  it('keeps rail and viewport composition behind the workbench shell boundary', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), RAIL_SOURCE_ROOT))) {
      const relativePath = toRepoRelativePath(absolutePath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*(?:@\/components\/drawings\/viewports|\.\.\/viewports|\.\/viewports)/.test(source)) {
        violations.push(`${relativePath} imports viewport modules from rail`);
      }
    }

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), VIEWPORT_SOURCE_ROOT))) {
      const relativePath = toRepoRelativePath(absolutePath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*(?:@\/components\/drawings\/rail|\.\.\/rail|\.\/rail)/.test(source)) {
        violations.push(`${relativePath} imports rail modules from viewport`);
      }
    }

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), path.join('apps', 'portal', 'components', 'drawings', 'workbench')))) {
      const relativePath = toRepoRelativePath(absolutePath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      const importsViewport = /from ['"][^'"]*(?:@\/components\/drawings\/viewports|\.\.\/viewports|\.\/viewports)/.test(source);
      const importsRail = /from ['"][^'"]*(?:@\/components\/drawings\/rail|\.\.\/rail|\.\/rail)/.test(source);
      if ((importsViewport || importsRail) && !WORKBENCH_COMPOSITION_BOUNDARY_FILES.has(relativePath)) {
        violations.push(`${relativePath} composes rail or viewport modules outside the shell boundary`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps canonical rail and hidden-route UI off compatibility-only imports', () => {
    const violations: string[] = [];

    for (const root of SCAN_ROOTS) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root))) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        const importsHouseFirstModel = /from ['"][^'"]*houseFirstWorkbenchModel['"]/.test(source);
        const importsConfiguratorRail = /from ['"][^'"]*ConfiguratorRail['"]/.test(source);
        const readsCompatibilityUiSelection =
          /\b(?:ui|current|store\.ui)\.(?:workbenchMode|activeHouseSelection|activePergolaId)\b/.test(source);
        const readsFlatCompatibilityDerivedField = FLAT_COMPATIBILITY_DERIVED_FIELD_READ.test(source);
        const readsFlatPersistedCompatibilityModel = FLAT_PERSISTED_COMPATIBILITY_PROJECT_MODEL_READ.test(source);
        const readsPersistedCompatibilityBridge = REMOVED_PERSISTED_COMPATIBILITY_BRIDGE_READ.test(source);
        const readsPersistedCompatibilityBridgeProjectModel =
          PERSISTED_COMPATIBILITY_BRIDGE_PROJECT_MODEL_READ.test(source);
        const readsCompatibilityBridge = REMOVED_DERIVED_COMPATIBILITY_BRIDGE_READ.test(source);
        const readsPersistenceCompatibilityDraft = PERSISTED_HOUSE_FIRST_DRAFT_USAGE.test(source);
        const callsObjectFirstToCompatibilityDraftBuilder =
          OBJECT_FIRST_TO_COMPATIBILITY_DRAFT_BUILDER.test(source);
        const callsActiveWorkbenchPreviewBuilder = ACTIVE_WORKBENCH_PREVIEW_BUILDER.test(source);

        if (importsHouseFirstModel && !ALLOWLISTED_COMPATIBILITY_FILES.has(relativePath)) {
          violations.push(`${relativePath} imports houseFirstWorkbenchModel`);
        }
        if (importsConfiguratorRail && !ALLOWLISTED_CONFIGURATOR_FILES.has(relativePath)) {
          violations.push(`${relativePath} imports ConfiguratorRail`);
        }
        if (readsCompatibilityUiSelection) {
          violations.push(`${relativePath} reads compatibility selection fields from ui`);
        }
        if (readsFlatCompatibilityDerivedField) {
          violations.push(`${relativePath} reads flat compatibility fields from store.derived`);
        }
        if (readsFlatPersistedCompatibilityModel) {
          violations.push(`${relativePath} reads removed flat compatibility model from store.persisted`);
        }
        if (readsPersistedCompatibilityBridge) {
          violations.push(`${relativePath} reads removed persisted compatibilityBridge`);
        }
        if (
          readsPersistedCompatibilityBridgeProjectModel &&
          !ALLOWLISTED_PERSISTED_COMPATIBILITY_BRIDGE_READERS.has(relativePath)
        ) {
          violations.push(`${relativePath} reads the persisted compatibility project model outside a write bridge`);
        }
        if (readsCompatibilityBridge) {
          violations.push(`${relativePath} reads removed derived compatibilityBridge`);
        }
        if (readsPersistenceCompatibilityDraft && !relativePath.includes(`${path.sep}compat${path.sep}`)) {
          violations.push(`${relativePath} reads or writes EstimateDrawingDraft.houseFirst outside compat`);
        }
        if (callsObjectFirstToCompatibilityDraftBuilder && !relativePath.includes(`${path.sep}compat${path.sep}`)) {
          violations.push(`${relativePath} calls the object-first to compatibility draft builder outside compat`);
        }
        if (
          callsActiveWorkbenchPreviewBuilder &&
          relativePath.includes(path.normalize(path.join('projects', '[projectId]', 'design-workbench')))
        ) {
          violations.push(`${relativePath} rebuilds active 3D geometry outside the solved workbench model`);
        }
        if (source.includes('useHouseDraftPersistence')) {
          violations.push(`${relativePath} uses the legacy house draft persistence hook name`);
        }
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbenchModel['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports houseFirstWorkbenchModel`);
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_PLAN_OVERLAY_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/from ['"][^'"]*houseFirstPlanOverlay['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports houseFirstPlanOverlay directly`);
      }
      if (REMOVED_PLAN_VIEW_MODEL_COMPATIBILITY_PROPS.test(source)) {
        violations.push(`${relativeBoundaryPath} uses removed plan view-model compatibility overlay props`);
      }
      if (
        relativeBoundaryPath.endsWith(path.normalize(path.join('views', 'plan', 'buildPlanViewModel.ts'))) &&
        /from ['"][^'"]*(?:houseFirstWorkbench(?:Model|Adapter)|state\/compat\/objectWorkbenchCompatibilityModel)['"]/.test(source)
      ) {
        violations.push(`${relativeBoundaryPath} imports compatibility state directly`);
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_RENDERER_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (LEGACY_RENDERER_BOUNDARY_NAMES.test(source)) {
        violations.push(`${relativeBoundaryPath} uses legacy house-first renderer boundary names`);
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_ACTION_SELECTION_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/\b(?:buildDrawingWorkbenchObjectSelectionStateFromBridgeTarget|deriveDrawingWorkbenchCompatibilitySelection|ObjectWorkbenchCompatibilitySelection)\b/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports or uses public compatibility selection helpers`);
      }
      if (/from ['"][^'"]*\/geometry\/compat\//.test(source)) {
        violations.push(`${relativeBoundaryPath} imports geometry compatibility internals`);
      }
    }

    for (const relativeTestPath of OBJECT_WORKBENCH_RENDERER_TEST_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeTestPath), 'utf8');
      if (/data-house-first-|dataset\.houseFirst|waitForHouseFirst/.test(source)) {
        violations.push(`${relativeTestPath} uses legacy house-first renderer selectors`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps state and plan coverage off removed flat compatibility store fields', () => {
    const violations: string[] = [];

    for (const root of FLAT_COMPATIBILITY_DERIVED_READ_ROOTS) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (FLAT_COMPATIBILITY_DERIVED_FIELD_READ.test(source)) {
          violations.push(`${relativePath} reads removed flat compatibility fields from store.derived`);
        }
        if (REMOVED_DERIVED_COMPATIBILITY_BRIDGE_READ.test(source)) {
          violations.push(`${relativePath} reads removed derived compatibilityBridge`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps public workbench persistence off removed house-first draft APIs', () => {
    const violations: string[] = [];
    const roots = [
      path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
      path.join('apps', 'portal', 'components', 'drawings'),
      path.join('apps', 'portal', 'lib', 'drawings'),
      path.join('apps', 'portal', 'lib', 'estimates'),
    ];

    for (const root of roots) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        if (relativePath.endsWith(path.normalize(path.join('components', 'drawings', 'rail', 'objectWorkbenchImportGuards.test.ts')))) {
          continue;
        }
        if (isLegacyPersistenceCompatibilityZone(relativePath)) continue;
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (REMOVED_ESTIMATE_HOUSE_FIRST_API.test(source)) {
          violations.push(`${relativePath} references removed house-first drawing draft API`);
        }
        if (PERSISTED_HOUSE_FIRST_DRAFT_USAGE.test(source)) {
          violations.push(`${relativePath} reads or writes removed EstimateDrawingDraft.houseFirst data`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps callers off removed persisted compatibility store models', () => {
    const violations: string[] = [];
    const roots = [
      path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
      path.join('apps', 'portal', 'components', 'drawings'),
      path.join('apps', 'portal', 'lib', 'drawings'),
    ];

    for (const root of roots) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (FLAT_PERSISTED_COMPATIBILITY_PROJECT_MODEL_READ.test(source)) {
          violations.push(`${relativePath} reads removed flat compatibility model from store.persisted`);
        }
        if (REMOVED_PERSISTED_COMPATIBILITY_BRIDGE_READ.test(source)) {
          violations.push(`${relativePath} reads removed persisted compatibilityBridge`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps the retired geometry compatibility namespace absent', () => {
    expect(fs.existsSync(path.join(process.cwd(), GEOMETRY_COMPAT_ROOT))).toBe(false);
  });

  it('keeps geometry compatibility imports off active geometry files', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), GEOMETRY_SOURCE_ROOT))) {
      const relativePath = toRepoRelativePath(absolutePath);
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(source)) {
        violations.push(`${relativePath} imports house-first workbench state`);
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_GEOMETRY_PUBLIC_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/from ['"][^'"]*(?:\/compat\/|\.\/compat\/|\.\.\/compat\/)/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports geometry compatibility internals from a public geometry facade`);
      }
      if (/from ['"][^'"]*(?:houseFirstWorkbench(?:Model|Adapter)|state\/compat\/objectWorkbenchCompatibilityModel)['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports compatibility state directly from a public geometry facade`);
      }
      if (PERSISTED_COMPATIBILITY_BRIDGE_PROJECT_MODEL_READ.test(source)) {
        violations.push(`${relativeBoundaryPath} reads the persisted compatibility project model from a public geometry facade`);
      }
      if (/\bsharedHouse\b/.test(source)) {
        violations.push(`${relativeBoundaryPath} exposes sharedHouse from a public geometry facade`);
      }
    }

    for (const root of OBJECT_WORKBENCH_GEOMETRY_UI_ROOTS) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (/from ['"][^'"]*[/\\]geometry[/\\]compat[/\\]/.test(source)) {
          violations.push(`${relativePath} imports geometry compatibility internals`);
        }
      }
    }

    const geometryEditAdapterPath = path.normalize(OBJECT_WORKBENCH_GEOMETRY_EDIT_ADAPTER_FILE);
    const geometryEditAdapterSource = fs.readFileSync(path.join(process.cwd(), geometryEditAdapterPath), 'utf8');
    if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(geometryEditAdapterSource)) {
      violations.push(`${geometryEditAdapterPath} imports house-first workbench state directly`);
    }
    if (/\bbuildHouseFirstWorkbenchProjectModel\b/.test(geometryEditAdapterSource)) {
      violations.push(`${geometryEditAdapterPath} calls buildHouseFirstWorkbenchProjectModel directly`);
    }

    expect(violations).toEqual([]);
  });

  it('keeps active geometry consumers on canonical geometry names', () => {
    const violations: string[] = [];
    const roots = [
      path.join('apps', 'portal', 'lib', 'drawings', 'geometry'),
      path.join('apps', 'portal', 'lib', 'drawings', 'state'),
      path.join('apps', 'portal', 'components', 'drawings'),
      path.join('apps', 'portal', 'app', 'staff', 'calculator'),
      path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
    ];
    const guardPath = path.normalize(
      path.join('apps', 'portal', 'components', 'drawings', 'rail', 'objectWorkbenchImportGuards.test.ts'),
    );

    for (const root of roots) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        if (relativePath === guardPath) continue;
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (RETIRED_ACTIVE_GEOMETRY_ALIAS_NAMES.test(source)) {
          violations.push(`${relativePath} uses a retired active geometry alias name`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps canonical state files behind the object workbench compatibility facade', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), STATE_SOURCE_ROOT), { includeTests: true })) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (canImportLegacyStateCompatibility(relativePath)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(source)) {
        violations.push(`${relativePath} imports legacy state compatibility directly`);
      }
      if (/from ['"][^'"]*(?:state\/compat\/|\.\/compat\/|\.\.\/compat\/)/.test(source)) {
        violations.push(`${relativePath} imports state compatibility internals directly`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps rail and inspector read models on neutral object-workbench status inputs', () => {
    const violations: string[] = [];

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_RAIL_INSPECTOR_STATE_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports legacy house-first state directly`);
      }
      if (/from ['"][^'"]*state\/compat\/objectWorkbenchCompatibilityModel['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports the compatibility state facade directly`);
      }
      if (/from ['"][^'"]*\.\/compat\/objectWorkbenchCompatibilityModel['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports the compatibility state facade directly`);
      }
      if (/from ['"][^'"]*state\/compat\//.test(source) || /from ['"][^'"]*\.\/compat\//.test(source)) {
        violations.push(`${relativeBoundaryPath} imports state compatibility internals directly`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps estimate drawing persistence compatibility behind the explicit compat namespace', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), ESTIMATES_SOURCE_ROOT))) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (relativePath.includes(ESTIMATES_COMPAT_PATH_SEGMENT)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbenchModel['"]/.test(source)) {
        violations.push(`${relativePath} imports houseFirstWorkbenchModel outside estimates compat`);
      }
    }

    expect(violations).toEqual([]);
  });
});
