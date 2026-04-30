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
const GEOMETRY_COMPAT_PATH_SEGMENT = `${path.sep}geometry${path.sep}compat${path.sep}`;
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
const OBJECT_WORKBENCH_GEOMETRY_PUBLIC_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'buildRawGeometryModuleInput.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'buildWorkbenchGeometryPreview.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'deriveWorkbenchGeometry.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'geometry', 'objectWorkbenchGeometryContext.ts'),
];
const OBJECT_WORKBENCH_GEOMETRY_EDIT_ADAPTER_FILE = path.join(
  'apps',
  'portal',
  'lib',
  'drawings',
  'geometry',
  'compat',
  'geometryEditAdapter.ts',
);
const OBJECT_WORKBENCH_RAIL_INSPECTOR_STATE_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'drawingWorkbenchRailModel.ts'),
  path.join('apps', 'portal', 'lib', 'drawings', 'state', 'objectWorkbenchInspectorModel.ts'),
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
const LEGACY_RENDERER_BOUNDARY_NAMES =
  /\b(?:HouseFirstPlanShapeDragStartMeta|HouseFirstObjectPreviewOverlay|houseFirstPlanOverlay|houseFirstPreviewOverlay|activeHouseFirstCustomEdgeId|hoveredHouseFirstDeckId|onHouseFirstShapeSelect|onHouseFirstDeckHoverChange|onHouseFirstShapeDragStart|onHouseFirstCustomEdgeSelect|onHouseFirstDimensionActivate)\b/;
const REMOVED_PLAN_VIEW_MODEL_COMPATIBILITY_PROPS =
  /\b(?:objectWorkbenchCompatibilityHouse|objectWorkbenchCompatibilitySelection)\b/;
const ALLOWLISTED_COMPATIBILITY_FILES = new Set<string>();
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
  return relativePath.includes(STATE_COMPAT_PATH_SEGMENT) || basename.startsWith('houseFirst');
}

function isLegacyPersistenceCompatibilityZone(relativePath: string): boolean {
  const basename = path.basename(relativePath);
  return (
    relativePath.includes(STATE_COMPAT_PATH_SEGMENT) ||
    relativePath.includes(GEOMETRY_COMPAT_PATH_SEGMENT) ||
    basename.startsWith('houseFirst') ||
    relativePath.endsWith(path.normalize(path.join('apps', 'portal', 'lib', 'estimates', 'drawingEdits.ts')))
  );
}

describe('object workbench import guards', () => {
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

  it('keeps geometry compatibility imports behind the explicit compat namespace', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), GEOMETRY_SOURCE_ROOT))) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (relativePath.includes(GEOMETRY_COMPAT_PATH_SEGMENT)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(source)) {
        violations.push(`${relativePath} imports house-first workbench state outside geometry compat`);
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_GEOMETRY_PUBLIC_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
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
        if (/from ['"][^'"]*\/geometry\/compat\//.test(source)) {
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

  it('keeps canonical state files behind the object workbench compatibility facade', () => {
    const violations: string[] = [];

    for (const absolutePath of listSourceFiles(path.join(process.cwd(), STATE_SOURCE_ROOT), { includeTests: true })) {
      const relativePath = toRepoRelativePath(absolutePath);
      if (canImportLegacyStateCompatibility(relativePath)) continue;
      const source = fs.readFileSync(absolutePath, 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbench(?:Model|Adapter)['"]/.test(source)) {
        violations.push(`${relativePath} imports legacy state compatibility directly`);
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
