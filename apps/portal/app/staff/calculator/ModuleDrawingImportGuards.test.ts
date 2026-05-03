import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const calculatorDir = join(process.cwd(), 'apps/portal/app/staff/calculator');

function readCalculatorFile(fileName: string): string {
  return readFileSync(join(calculatorDir, fileName), 'utf8');
}

describe('calculator drawing surface import guards', () => {
  it('keeps plan and section surfaces independent from ModuleDrawingRenderer helpers', () => {
    expect(readCalculatorFile('ModulePlanSvg.tsx')).not.toContain("from './ModuleDrawingRenderer'");
    expect(readCalculatorFile('ModuleSectionSvg.tsx')).not.toContain("from './ModuleDrawingRenderer'");
  });

  it('keeps ModuleDrawingRenderer off the broad helper module', () => {
    expect(readCalculatorFile('ModuleDrawingRenderer.tsx')).not.toContain("from './ModuleDrawingSurfacePrimitives'");
  });

  it('keeps focused plan presenters below the PlanSvg composition boundary', () => {
    [
      'ModulePlanHouseLayer.tsx',
      'ModulePlanPergolaLayer.tsx',
      'ModulePlanDimensionLayer.tsx',
      'ModulePlanFootprintEditLayer.tsx',
      'ModulePlanPopoverLayer.tsx',
    ].forEach((fileName) => {
      const source = readCalculatorFile(fileName);
      [
        "from './ModuleDrawingRenderer'",
        "from './ModulePlanSvg'",
        "from '@/components/drawings/viewports",
        "from '@/components/drawings/rail",
        "from '@/lib/drawings/interactions",
      ].forEach((forbiddenImport) => {
        expect(source).not.toContain(forbiddenImport);
      });
    });
  });

  it('keeps shared drawing primitives below owner presentation modules', () => {
    const primitives = readCalculatorFile('ModuleDrawingSurfacePrimitives.tsx');
    [
      "from './ModuleDrawingRenderer'",
      "from './ModulePlanLayoutPresentation'",
      "from './ModulePlanFootprintPresentation'",
      "from './ModulePlanAnnotations'",
      "from './ModuleSectionPresentation'",
      "from './ModuleDrawingScalePresentation'",
      "from './ModuleDrawingDiagnostics'",
    ].forEach((forbiddenImport) => {
      expect(primitives).not.toContain(forbiddenImport);
    });
  });
});
