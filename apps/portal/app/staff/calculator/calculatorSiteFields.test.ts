import { describe, expect, it, vi } from 'vitest';

import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { CalculatorConfigurationField } from './calculatorConfigurationSections';
import { makeDefaultCalculatorInputs, makeDefaultModule } from './calculatorInputs';
import { buildCalculatorSiteFields, type CalculatorSiteFieldBuilderInput } from './calculatorSiteFields';

function fieldById(fields: readonly CalculatorConfigurationField[], id: string): CalculatorConfigurationField {
  const field = fields.find((candidate) => candidate.id === id);
  if (!field) throw new Error(`Missing calculator site field: ${id}`);
  return field;
}

function buildFields(moduleOverrides: Partial<CalculatorModuleInputs> = {}, hasOurGutterUi = false) {
  const activeModule = makeDefaultModule('pergola-1');
  Object.assign(activeModule, moduleOverrides);
  const values = { ...makeDefaultCalculatorInputs(), modules: [activeModule] };
  const setModuleField = vi.fn() as unknown as CalculatorSiteFieldBuilderInput['setModuleField'];
  const setJobField = vi.fn() as unknown as CalculatorSiteFieldBuilderInput['setJobField'];
  const setHouseFootprintParam = vi.fn() as unknown as CalculatorSiteFieldBuilderInput['setHouseFootprintParam'];
  const fields = buildCalculatorSiteFields({
    activeModule,
    activeDrawingRotationQuarterTurns: 0,
    values,
    errors: {},
    derivedBoxPitch: 3.25,
    derivedBoxRiseMm: 124.4,
    derivedBoxMaxFallMm: 200,
    hasOurGutterUi,
    setModuleField,
    setJobField,
    setHouseFootprintParam,
  });

  return { fields, setModuleField, setJobField, setHouseFootprintParam };
}

describe('calculator site fields', () => {
  it('builds connection, footprint, site, and drainage controls in the established order', () => {
    const { fields } = buildFields();
    const ids = fields.map((field) => field.id);

    expect(ids.indexOf('houseConnectionType')).toBeLessThan(ids.indexOf('attachmentSide'));
    expect(ids.indexOf('postConnectionType')).toBeLessThan(ids.indexOf('access'));
    expect(ids.indexOf('jobType')).toBeLessThan(ids.indexOf('downpipeCount'));
    expect(fieldById(fields, 'attachmentSide').value).toBe('rear');
  });

  it('omits footprint controls when the module is freestanding', () => {
    const { fields } = buildFields({ houseConnectionType: 'none' });
    const ids = fields.map((field) => field.id);

    expect(ids).not.toContain('attachmentSide');
    expect(ids).not.toContain('houseFootprintPreset');
    expect(ids).toContain('postConnectionType');
  });

  it('adds conditional pile, box-perimeter, and gutter fields', () => {
    const { fields } = buildFields({
      boxPerimeterEnabled: true,
      postConnectionType: 'pile_1m',
    }, true);

    expect(fieldById(fields, 'ground').value).toBe('easy');
    expect(fieldById(fields, 'boxPitchDeg').value).toBe('3.3');
    expect(fieldById(fields, 'boxRiseMm').value).toBe('124');
    expect(fieldById(fields, 'downpipeElbowCount').options).toHaveLength(21);
  });

  it('delegates field changes to the existing module, job, and footprint setters', () => {
    const { fields, setModuleField, setJobField, setHouseFootprintParam } = buildFields();

    fieldById(fields, 'drawingRotationQuarterTurns').onChange?.('2');
    fieldById(fields, 'access').onChange?.('hard');
    fieldById(fields, 'houseFootprintBandDepthM').onChange?.('4.5');

    expect(setModuleField).toHaveBeenCalledWith('drawingRotationQuarterTurns', 2);
    expect(setJobField).toHaveBeenCalledWith('access', 'hard');
    expect(setHouseFootprintParam).toHaveBeenCalledWith('bandDepthM', '4.5');
  });
});
