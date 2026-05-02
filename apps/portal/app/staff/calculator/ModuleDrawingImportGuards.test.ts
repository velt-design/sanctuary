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
});
