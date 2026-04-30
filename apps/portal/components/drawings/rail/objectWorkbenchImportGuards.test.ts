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
const OBJECT_WORKBENCH_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'DrawingWorkbench.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'Geometry3DViewport.tsx'),
];
const OBJECT_WORKBENCH_PLAN_OVERLAY_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleViewsCard.tsx'),
  path.join('apps', 'portal', 'app', 'staff', 'calculator', 'ModuleViewsCard.test.tsx'),
  path.join('apps', 'portal', 'lib', 'drawings', 'views', 'plan', 'buildPlanViewModel.ts'),
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
const FLAT_COMPATIBILITY_DERIVED_FIELD_READ =
  /\b[A-Za-z_$][\w$]*\.derived\.(?:house|houseCount|decks|openings|activeDeck|activeDeckId|activeOpening|activeOpeningId|pergolas|activePergola|activePergolaId|roofForm|roofReviewStatus|roofValidationStatus|roofValidationCode|roofValidationMessage|roofApproximationReasons|roofProvenance|roofGeometryKind|roofAppendageEnabled|roofAppendageStatus|roofAppendageSupportedHostEdges|roofAppendageSupportReason|migrationWarnings|migrationWarningCount|houseIsLowConfidence)\b/;
const LEGACY_RENDERER_BOUNDARY_NAMES =
  /\b(?:HouseFirstPlanShapeDragStartMeta|HouseFirstObjectPreviewOverlay|houseFirstPlanOverlay|houseFirstPreviewOverlay|activeHouseFirstCustomEdgeId|hoveredHouseFirstDeckId|onHouseFirstShapeSelect|onHouseFirstDeckHoverChange|onHouseFirstShapeDragStart|onHouseFirstCustomEdgeSelect|onHouseFirstDimensionActivate)\b/;
const ALLOWLISTED_COMPATIBILITY_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'compat', 'objectWorkbenchDraftActionBridge.ts')),
  path.normalize(path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'compat', 'workbenchCompatibilityDraftBuilders.ts')),
]);
const ALLOWLISTED_COMPATIBILITY_BRIDGE_READERS = new Set([
  path.normalize(path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'useObjectWorkbenchActions.ts')),
]);
const ALLOWLISTED_CONFIGURATOR_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'rail', 'ConfiguratorRail.tsx')),
]);

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

function canReadCompatibilityBridge(relativePath: string): boolean {
  return ALLOWLISTED_COMPATIBILITY_BRIDGE_READERS.has(relativePath) || relativePath.includes(`${path.sep}compat${path.sep}`);
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
        const readsCompatibilityBridge = /\bstore\.derived\.compatibilityBridge\b/.test(source);
        const readsPersistenceCompatibilityDraft =
          /\b(?:draft|nextDraft|drawingDraft|baseDraft)\.houseFirst\b|\bhouseFirst\s*:/.test(source);

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
        if (readsCompatibilityBridge && !canReadCompatibilityBridge(relativePath)) {
          violations.push(`${relativePath} reads compatibilityBridge outside an explicit bridge/compat file`);
        }
        if (readsPersistenceCompatibilityDraft && !relativePath.includes(`${path.sep}compat${path.sep}`)) {
          violations.push(`${relativePath} reads or writes EstimateDrawingDraft.houseFirst outside compat`);
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
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_RENDERER_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (LEGACY_RENDERER_BOUNDARY_NAMES.test(source)) {
        violations.push(`${relativeBoundaryPath} uses legacy house-first renderer boundary names`);
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

    for (const root of OBJECT_WORKBENCH_GEOMETRY_UI_ROOTS) {
      for (const absolutePath of listSourceFiles(path.join(process.cwd(), root), { includeTests: true })) {
        const relativePath = toRepoRelativePath(absolutePath);
        const source = fs.readFileSync(absolutePath, 'utf8');
        if (/from ['"][^'"]*\/geometry\/compat\//.test(source)) {
          violations.push(`${relativePath} imports geometry compatibility internals`);
        }
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
