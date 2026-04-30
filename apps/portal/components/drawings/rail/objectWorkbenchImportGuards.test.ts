import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const SCAN_ROOTS = [
  path.join('apps', 'portal', 'components', 'drawings', 'rail'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
];
const OBJECT_WORKBENCH_BOUNDARY_FILES = [
  path.join('apps', 'portal', 'components', 'drawings', 'workbench', 'DrawingWorkbench.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'ModelSpaceViewport.tsx'),
  path.join('apps', 'portal', 'components', 'drawings', 'viewports', 'Geometry3DViewport.tsx'),
];
const ALLOWLISTED_COMPATIBILITY_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'compat', 'objectWorkbenchDraftActionBridge.ts')),
  path.normalize(path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench', 'compat', 'workbenchCompatibilityDraftBuilders.ts')),
]);
const ALLOWLISTED_CONFIGURATOR_FILES = new Set([
  path.normalize(path.join('apps', 'portal', 'components', 'drawings', 'rail', 'ConfiguratorRail.tsx')),
]);

function listSourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(absolutePath);
    }
    if (!entry.isFile()) return [];
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) return [];
    if (entry.name.includes('.test.')) return [];
    return [absolutePath];
  });
}

function toRepoRelativePath(absolutePath: string): string {
  return path.normalize(path.relative(process.cwd(), absolutePath));
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

        if (importsHouseFirstModel && !ALLOWLISTED_COMPATIBILITY_FILES.has(relativePath)) {
          violations.push(`${relativePath} imports houseFirstWorkbenchModel`);
        }
        if (importsConfiguratorRail && !ALLOWLISTED_CONFIGURATOR_FILES.has(relativePath)) {
          violations.push(`${relativePath} imports ConfiguratorRail`);
        }
        if (readsCompatibilityUiSelection) {
          violations.push(`${relativePath} reads compatibility selection fields from ui`);
        }
      }
    }

    for (const relativeBoundaryPath of OBJECT_WORKBENCH_BOUNDARY_FILES.map((filePath) => path.normalize(filePath))) {
      const source = fs.readFileSync(path.join(process.cwd(), relativeBoundaryPath), 'utf8');
      if (/from ['"][^'"]*houseFirstWorkbenchModel['"]/.test(source)) {
        violations.push(`${relativeBoundaryPath} imports houseFirstWorkbenchModel`);
      }
    }

    expect(violations).toEqual([]);
  });
});
