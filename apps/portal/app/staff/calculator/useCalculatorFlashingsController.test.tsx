import { useState } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { CalculatorInputs } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useCalculatorFlashingsController } from './useCalculatorFlashingsController';

type FlashingsController = ReturnType<typeof useCalculatorFlashingsController>;

let latest: FlashingsController | null = null;
let latestValues: CalculatorInputs | null = null;

function controller(): FlashingsController {
  if (!latest) throw new Error('Flashings controller probe has not rendered.');
  return latest;
}

function currentValues(): CalculatorInputs {
  if (!latestValues) throw new Error('Flashings controller values are unavailable.');
  return latestValues;
}

function Probe({ initialValues }: { initialValues: CalculatorInputs }) {
  const [values, setValues] = useState(initialValues);
  latestValues = values;
  latest = useCalculatorFlashingsController({
    activeModule: values.modules[0],
    activeModuleIndex: 0,
    activePergolaId: 'pergola-1',
    setValues,
  });
  return null;
}

afterEach(() => {
  latest = null;
  latestValues = null;
  document.body.innerHTML = '';
});

describe('useCalculatorFlashingsController', () => {
  it('owns extra-row add, update, and guarded removal mutations', () => {
    const rendered = renderIntoDocument(<Probe initialValues={makeDefaultCalculatorInputs()} />);
    const primaryId = controller().primaryRow.id;
    let extraId = '';

    act(() => {
      extraId = controller().addRow();
    });
    expect(controller().state.rows.find((row) => row.id === extraId)).toMatchObject({
      kind: 'extra',
      lengthM: '6',
      purpose: 'CUSTOM',
    });

    act(() => controller().updateRow(extraId, {
      band: '301-400',
      lengthM: '2.5',
      purpose: 'HEAD',
    }));
    expect(controller().state.rows.find((row) => row.id === extraId)).toMatchObject({
      band: '301-400',
      lengthM: '2.5',
      purpose: 'HEAD',
    });

    act(() => controller().removeRow(primaryId));
    expect(controller().state.rows.some((row) => row.id === primaryId)).toBe(true);

    act(() => controller().removeRow(extraId));
    expect(controller().state.rows.some((row) => row.id === extraId)).toBe(false);
    rendered.unmount();
  });

  it('keeps automatic primary lengths linked without overwriting manual edits', () => {
    const rendered = renderIntoDocument(<Probe initialValues={makeDefaultCalculatorInputs()} />);
    const primaryId = controller().primaryRow.id;
    const current = currentValues().modules[0];
    const automatic = controller().syncPrimaryLength(current, { ...current, lengthM: '8' });

    expect(automatic?.rows.find((row) => row.id === primaryId)?.lengthM).toBe('8');

    act(() => controller().updateRow(primaryId, { lengthM: '4' }));
    const manuallyEdited = currentValues().modules[0];
    expect(controller().syncPrimaryLength(manuallyEdited, { ...manuallyEdited, lengthM: '8' })).toBeNull();

    act(() => controller().updateRow(primaryId, { lengthM: '6' }));
    const relinked = currentValues().modules[0];
    const resynced = controller().syncPrimaryLength(relinked, { ...relinked, lengthM: '8' });
    expect(resynced?.rows.find((row) => row.id === primaryId)?.lengthM).toBe('8');
    rendered.unmount();
  });
});
