import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKBENCH_RUNTIME_ROOTS = [
  path.join('apps', 'portal', 'lib', 'drawings'),
  path.join('apps', 'portal', 'components', 'drawings'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
];

const WORKBENCH_PROJECT_ARTIFACT_BOUNDARY_ROOTS = [
  path.join('apps', 'portal', 'lib', 'drawings'),
  path.join('apps', 'portal', 'components', 'drawings', 'workbench'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
  path.join('apps', 'portal', 'app', 'qa', 'design-workbench-fixture'),
  path.join('apps', 'portal', 'components', 'projects', 'ProjectPage', 'tabs'),
];

const FORBIDDEN_WORKBENCH_RUNTIME_PATTERNS = [
  /@sp\/costing/,
  /CommercialParityReport/,
  /HouseFirst/,
  /houseFirst/,
  /legacyEstimateSnapshotAdapter/,
  /CalculatorModuleInputs/,
  /inputs\.modules/,
  /RawGeometryModuleInput/,
  /houseContext/,
  /ModulePlanModel/,
  /ModuleSectionModel/,
  /activeModuleIndex/,
  /activeModule/,
  /WorkbenchSolvedModule/,
  /moduleInput/,
  /sourceModules/,
  /moduleStates/,
  /kind:\s*['"]module['"]/,
  /moduleId/,
  /moduleLabel/,
  /data-workbench-pricing/,
  /legacy_plan_m/,
  /geometry_plan_fallback/,
  /calculateCostV1/,
  /calculateSiteCostV1/,
  /costingPayload/,
  /@\/app\/staff\/calculator/,
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const FORBIDDEN_LOOSE_PROJECT_ARTIFACT_JSX_PROPS = [
  /\bprojectViewportGeometry\s*=\s*\{/,
  /\bprojectGeometryPreview\s*=\s*\{/,
  /\bprojectPlanProjection\s*=\s*\{/,
  /\bprojectContextShapes\s*=\s*\{/,
  /\bprojectPergolaPlanShapes\s*=\s*\{/,
  /\bprojectPergolaSnapShapes\s*=\s*\{/,
  /\bhouseCommittedShapes\s*=\s*\{/,
  /\bprojectHouseSnapSources\s*=\s*\{/,
  /\bprojectHouseProjectionHealth\s*=\s*\{/,
  /\bprojectPergolaRenderHealth\s*=\s*\{/,
];

const FORBIDDEN_SOLVED_MODEL_ALIAS_REFERENCES = [
  /solvedModel\.projectGeometryPreview/,
  /solvedModel\.projectViewportGeometry/,
  /solvedModel\.projectPlanProjection/,
  /solvedModel\.projectHouseProjectionHealth/,
  /solvedModel\.projectPergolaRenderHealth/,
  /solvedModel\.projectPergolaPlanShapes/,
  /solvedModel\.houseGeometryInputsById/,
  /solvedModel\.projectHouseGeometries/,
  /solvedModel\.projectReferenceShapes/,
  /solvedModel\.projectPergolaFallbackPlanShapes/,
];

function collectSourceFiles(root: string): string[] {
  const absoluteRoot = path.join(process.cwd(), root);
  if (!fs.existsSync(absoluteRoot)) return [];

  const out: string[] = [];
  const stack = [absoluteRoot];
  while (stack.length) {
    const current = stack.pop()!;
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    const fileName = path.basename(current);
    const isTestSource =
      fileName.endsWith('.test.ts') ||
      fileName.endsWith('.test.tsx') ||
      fileName.endsWith('.spec.ts') ||
      fileName.endsWith('.spec.tsx');
    if (!isTestSource && SOURCE_EXTENSIONS.has(path.extname(current))) {
      out.push(current);
    }
  }
  return out;
}

describe('Design Workbench breakaway import boundary', () => {
  it('keeps workbench runtime free of calculator and house-first contracts', () => {
    const violations = WORKBENCH_RUNTIME_ROOTS.flatMap((root) =>
      collectSourceFiles(root).flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return FORBIDDEN_WORKBENCH_RUNTIME_PATTERNS.flatMap((pattern) =>
          pattern.test(source) ? [`${path.relative(process.cwd(), file)} matches ${pattern.source}`] : [],
        );
      }),
    );

    expect(violations).toEqual([]);
  });

  it('keeps project solved geometry behind the workbench project artifact prop', () => {
    const violations = WORKBENCH_PROJECT_ARTIFACT_BOUNDARY_ROOTS.flatMap((root) =>
      collectSourceFiles(root).flatMap((file) => {
        const source = fs.readFileSync(file, 'utf8');
        return [
          ...FORBIDDEN_LOOSE_PROJECT_ARTIFACT_JSX_PROPS,
          ...FORBIDDEN_SOLVED_MODEL_ALIAS_REFERENCES,
        ].flatMap((pattern) =>
          pattern.test(source) ? [`${path.relative(process.cwd(), file)} matches ${pattern.source}`] : [],
        );
      }),
    );

    expect(violations).toEqual([]);
  });
});
