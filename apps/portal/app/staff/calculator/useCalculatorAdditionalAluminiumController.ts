import type { Dispatch, SetStateAction } from 'react';

import type {
  CalculatorAdditionalAluminiumRow,
  CalculatorInputs,
} from '@/lib/types/calculator';
import {
  makeAdditionalAluminiumRow,
  normalizeAdditionalAluminiumState,
} from './calculatorAdditionalAluminium';

type Args = {
  values: CalculatorInputs;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
};

export function useCalculatorAdditionalAluminiumController({
  values,
  setValues,
}: Args) {
  const state = normalizeAdditionalAluminiumState(values.additionalAluminium);

  const updateState = (updater: (rows: CalculatorAdditionalAluminiumRow[]) => CalculatorAdditionalAluminiumRow[]) => {
    setValues((current) => {
      const additionalAluminium = normalizeAdditionalAluminiumState(current.additionalAluminium);
      return { ...current, additionalAluminium: { ...additionalAluminium, rows: updater(additionalAluminium.rows) } };
    });
  };

  return {
    state,
    updateFinish: (patch: Partial<Omit<ReturnType<typeof normalizeAdditionalAluminiumState>, 'rows'>>) =>
      setValues((current) => ({
        ...current,
        additionalAluminium: {
          ...normalizeAdditionalAluminiumState(current.additionalAluminium),
          ...patch,
        },
      })),
    addRow: () => updateState((rows) => [...rows, makeAdditionalAluminiumRow()]),
    updateRow: (id: string, patch: Partial<Omit<CalculatorAdditionalAluminiumRow, 'id'>>) =>
      updateState((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row))),
    removeRow: (id: string) => updateState((rows) => rows.filter((row) => row.id !== id)),
  };
}
