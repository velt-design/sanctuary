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
  const fields = buildCalculatorSiteFields({
    activeModule,
    values,
    errors: {},
    resolvedDefaults: { downpipeCount: 'Auto - current result uses 1 downpipe' },
    derivedBoxPitch: 3.25,
    derivedBoxRiseMm: 124.4,
    derivedBoxMaxFallMm: 200,
    hasOurGutterUi,
    setModuleField,
    setJobField,
  });

  return { fields, setModuleField, setJobField };
}

describe('calculator site fields', () => {
  it('builds connection, site, and drainage controls in the established order', () => {
    const { fields } = buildFields();
    const ids = fields.map((field) => field.id);

    expect(ids.indexOf('houseConnectionType')).toBeLessThan(ids.indexOf('postConnectionType'));
    expect(ids.indexOf('postConnectionType')).toBeLessThan(ids.indexOf('access'));
    expect(ids.indexOf('jobType')).toBeLessThan(ids.indexOf('downpipeCount'));
    expect(fieldById(fields, 'downpipeCount')).toMatchObject({
      value: '0',
      resolvedDefaultText: 'Auto - current result uses 1 downpipe',
    });
    expect(fieldById(fields, 'downpipeJoinCount')).toMatchObject({
      id: 'downpipeJoinCount',
      label: 'Downpipe joins',
    });
  });

  it('omits legacy footprint controls for attached and freestanding modules', () => {
    const { fields } = buildFields();
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
    expect(fieldById(fields, 'downpipeElbowCount')).toMatchObject({
      id: 'downpipeElbowCount',
      label: 'Downpipe elbows',
    });
    expect(fieldById(fields, 'downpipeElbowCount').options).toHaveLength(21);
  });

  it('keeps Simple selectable and hides drainage controls for an open pergola', () => {
    const { fields, setJobField } = buildFields({ roofMaterial: 'none' }, true);
    const ids = fields.map((field) => field.id);
    const pricingField = fieldById(fields, 'pricingClassification');

    expect(pricingField.disabled).not.toBe(true);
    pricingField.onChange?.('simple');
    expect(setJobField).toHaveBeenCalledWith('pricingClassification', 'simple');
    expect(ids).not.toEqual(expect.arrayContaining(['downpipeCount', 'downpipeJoinCount', 'downpipeElbowCount']));
  });

  it('delegates remaining field changes to the existing module and job setters', () => {
    const { fields, setModuleField, setJobField } = buildFields();

    fieldById(fields, 'postConnectionType').onChange?.('slab_anchors');
    fieldById(fields, 'access').onChange?.('hard');

    expect(setModuleField).toHaveBeenCalledWith('postConnectionType', 'slab_anchors');
    expect(setJobField).toHaveBeenCalledWith('access', 'hard');
  });
});
