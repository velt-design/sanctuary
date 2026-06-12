import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const WORKBENCH_RUNTIME_ROOTS = [
  path.join('apps', 'portal', 'lib', 'drawings'),
  path.join('apps', 'portal', 'components', 'drawings'),
  path.join('apps', 'portal', 'app', 'staff', 'projects', '[projectId]', 'design-workbench'),
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
});
