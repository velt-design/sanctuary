import { useState } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { CalculatorInputs } from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import {
  makeDefaultBlindItem,
  makeDefaultCalculatorInputs,
} from './calculatorInputs';
import { useCalculatorBlindsController } from './useCalculatorBlindsController';

type BlindsController = ReturnType<typeof useCalculatorBlindsController>;

let latest: BlindsController | null = null;
let latestValues: CalculatorInputs | null = null;

function controller(): BlindsController {
  if (!latest) throw new Error('Blinds controller probe has not rendered.');
  return latest;
}

function currentValues(): CalculatorInputs {
  if (!latestValues) throw new Error('Blinds controller values are unavailable.');
  return latestValues;
}

function Probe({ initialValues }: { initialValues: CalculatorInputs }) {
  const [values, setValues] = useState(initialValues);
  latestValues = values;
  latest = useCalculatorBlindsController({ values, setValues });
  return null;
}

function makeValues(): CalculatorInputs {
  return {
    ...makeDefaultCalculatorInputs(),
    blinds: {
      items: [
        makeDefaultBlindItem({
          id: 'blind-1',
          label: 'North side',
          widthMm: '1000',
          coverLengthMm: '2000',
        }),
      ],
    },
  };
}

afterEach(() => {
  latest = null;
  latestValues = null;
  document.body.innerHTML = '';
});

describe('useCalculatorBlindsController', () => {
  it('owns metre input drafts while persisting millimetres', () => {
    const rendered = renderIntoDocument(<Probe initialValues={makeValues()} />);
    const item = controller().state.items[0];

    expect(controller().displayDimensionInput(item, 'widthMm')).toBe('1');

    act(() => controller().updateDimensionInput(item.id, 'widthMm', '1.234'));

    expect(currentValues().blinds?.items[0].widthMm).toBe('1234');
    expect(controller().displayDimensionInput(controller().state.items[0], 'widthMm')).toBe('1.234');

    act(() => controller().commitDimensionInput(item.id, 'widthMm'));

    expect(controller().displayDimensionInput(controller().state.items[0], 'widthMm')).toBe('1.234');
    rendered.unmount();
  });

  it('adds, updates, duplicates, and removes blind rows', () => {
    const rendered = renderIntoDocument(<Probe initialValues={makeValues()} />);

    act(() => controller().setItem('blind-1', { fabric: 'PVC' }));
    expect(currentValues().blinds?.items[0].fabric).toBe('PVC');

    act(() => controller().add({ id: 'blind-2', label: 'West side' }));
    expect(controller().state.items.map((item) => item.id)).toEqual(['blind-1', 'blind-2']);

    act(() => controller().duplicate('blind-1'));
    const duplicate = controller().state.items[2];
    expect(duplicate).toMatchObject({ label: 'North side (copy)', fabric: 'PVC' });
    expect(duplicate.id).not.toBe('blind-1');

    act(() => controller().remove('blind-1'));
    expect(controller().state.items.map((item) => item.id)).toEqual(['blind-2', duplicate.id]);
    rendered.unmount();
  });
});
