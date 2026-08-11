import { useState } from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CalculatorFlashingsState,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { useCalculatorInputController } from './useCalculatorInputController';

type InputController = ReturnType<typeof useCalculatorInputController>;

let latest: InputController | null = null;
let latestValues: CalculatorInputs | null = null;
const syncPrimaryFlashingLength = vi.fn(
  (
    _currentModule: CalculatorModuleInputs,
    _updatedModule: CalculatorModuleInputs,
  ): CalculatorFlashingsState | null => null,
);

function controller(): InputController {
  if (!latest) throw new Error('Input controller probe has not rendered.');
  return latest;
}

function currentValues(): CalculatorInputs {
  if (!latestValues) throw new Error('Input controller values are unavailable.');
  return latestValues;
}

function Probe({ initialValues }: { initialValues: CalculatorInputs }) {
  const [values, setValues] = useState(initialValues);
  latestValues = values;
  latest = useCalculatorInputController({
    activeModule: values.modules[0],
    activeModuleIndex: 0,
    activePergolaId: 'pergola-1',
    setValues,
    syncPrimaryFlashingLength,
  });
  return null;
}

function makeValues(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorInputs {
  const values = makeDefaultCalculatorInputs();
  return {
    ...values,
    modules: [{ ...values.modules[0], ...overrides }],
  };
}

afterEach(() => {
  latest = null;
  latestValues = null;
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('useCalculatorInputController', () => {
  it('owns job fields and restores the standard Mill powdercoat default', () => {
    const rendered = renderIntoDocument(
      <Probe initialValues={makeValues({
        extrusionColour: 'Mill',
        powdercoatIsCustom: false,
        powdercoatStandardColour: '',
      })} />,
    );

    expect(currentValues().modules[0].powdercoatStandardColour).toBe('Ironsands');

    act(() => controller().setJobField('quoteRef', 'Q-100'));
    expect(currentValues().quoteRef).toBe('Q-100');
    rendered.unmount();
  });

  it('preserves the linked gable defaults when house connection changes', () => {
    const rendered = renderIntoDocument(
      <Probe initialValues={makeValues({
        pergolaStyle: 'gable',
        houseConnectionType: 'soffit',
        boxGutterHouseEdge: 'house',
        boxGutterFarEdge: 'our',
        gableHouseEdgeGutter: 'house',
        gableOuterEdgeGutter: 'our',
        gableEndFramesMode: 'outer_end_only',
      })} />,
    );

    act(() => controller().setModuleField('houseConnectionType', 'none'));
    expect(currentValues().modules[0]).toMatchObject({
      houseConnectionType: 'none',
      boxGutterHouseEdge: 'none',
      boxGutterFarEdge: 'none',
      gableHouseEdgeGutter: 'our',
      gableOuterEdgeGutter: 'our',
      gableEndFramesMode: 'both_ends',
    });

    act(() => controller().setModuleField('houseConnectionType', 'soffit'));
    expect(currentValues().modules[0]).toMatchObject({
      houseConnectionType: 'soffit',
      boxGutterHouseEdge: 'house',
      boxGutterFarEdge: 'our',
      gableHouseEdgeGutter: 'house',
      gableOuterEdgeGutter: 'our',
      gableEndFramesMode: 'outer_end_only',
    });
    rendered.unmount();
  });

  it('updates only an untouched post suggestion when length or attachment changes', () => {
    const rendered = renderIntoDocument(<Probe initialValues={makeValues()} />);

    act(() => controller().setModuleField('lengthM', '9'));
    expect(currentValues().modules[0].postCount).toBe('4');

    act(() => controller().setModuleField('houseConnectionType', 'none'));
    expect(currentValues().modules[0].postCount).toBe('8');

    act(() => controller().setModuleField('postCount', '5'));
    act(() => controller().setModuleField('lengthM', '6'));
    act(() => controller().setModuleField('houseConnectionType', 'facade'));
    expect(currentValues().modules[0].postCount).toBe('5');
    rendered.unmount();
  });

  it('enforces roof and gutter compatibility policy', () => {
    const rendered = renderIntoDocument(
      <Probe initialValues={makeValues({
        overhangEnabled: true,
        invertedEnabled: true,
        invertedHouseGutter: false,
        separateGutterEnabled: true,
        overrides: { frontBeamProfile: '150x50' },
      })} />,
    );

    act(() => controller().setModuleField('boxPerimeterEnabled', true));
    expect(currentValues().modules[0]).toMatchObject({
      boxPerimeterEnabled: true,
      overhangEnabled: false,
      invertedEnabled: false,
      invertedHouseGutter: true,
      separateGutterEnabled: false,
    });

    act(() => controller().setModuleOverride('frontBeamProfile', 'SP Gutter'));
    expect(currentValues().modules[0].overrides?.frontBeamProfile).toBe('SP Gutter');
    expect(currentValues().modules[0].separateGutterEnabled).toBe(false);
    rendered.unmount();
  });

  it('delegates primary flashing linkage only for roof-length fields', () => {
    const values = makeValues();
    const linkedFlashings: CalculatorFlashingsState = {
      rows: values.modules[0].flashings!.rows.map((row) => ({ ...row, lengthM: '8' })),
    };
    syncPrimaryFlashingLength.mockReturnValue(linkedFlashings);
    const rendered = renderIntoDocument(<Probe initialValues={values} />);

    act(() => controller().setModuleField('lengthM', '8'));
    expect(syncPrimaryFlashingLength).toHaveBeenCalledTimes(1);
    expect(syncPrimaryFlashingLength.mock.calls[0][0].lengthM).toBe('6');
    expect(syncPrimaryFlashingLength.mock.calls[0][1].lengthM).toBe('8');
    expect(currentValues().modules[0].flashings).toEqual(linkedFlashings);

    syncPrimaryFlashingLength.mockClear();
    act(() => controller().setModuleField('projectionM', '4'));
    expect(syncPrimaryFlashingLength).not.toHaveBeenCalled();
    rendered.unmount();
  });
});
