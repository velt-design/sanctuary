import type { Dispatch, SetStateAction } from 'react';

import type {
  CalculatorAdditionalAluminiumRow,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  makeAdditionalAluminiumRow,
  normalizeAdditionalAluminiumState,
} from './calculatorAdditionalAluminium';
import { makeDefaultModule } from './calculatorInputs';

type Args = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
};

export function useCalculatorAdditionalAluminiumController({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  setValues,
}: Args) {
  const state = normalizeAdditionalAluminiumState(activeModule.additionalAluminium);

  const updateState = (updater: (rows: CalculatorAdditionalAluminiumRow[]) => CalculatorAdditionalAluminiumRow[]) => {
    setValues((current) => {
      const modules = current.modules.slice();
      const module = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const rows = normalizeAdditionalAluminiumState(module.additionalAluminium).rows;
      modules[activeModuleIndex] = {
        ...module,
        additionalAluminium: { rows: updater(rows) },
      };
      return { ...current, modules };
    });
  };

  return {
    state,
    addRow: () => updateState((rows) => [...rows, makeAdditionalAluminiumRow()]),
    updateRow: (id: string, patch: Partial<Omit<CalculatorAdditionalAluminiumRow, 'id'>>) =>
      updateState((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row))),
    removeRow: (id: string) => updateState((rows) => rows.filter((row) => row.id !== id)),
  };
}
