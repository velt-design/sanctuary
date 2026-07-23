'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useRef } from 'react';

import type {
  CalculatorFlashingBand,
  CalculatorFlashingPurpose,
  CalculatorFlashingsState,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  formatFlashingLengthInput,
  isPrimaryFlashingLengthAutoLinked,
  makeDefaultModule,
  makeDefaultPrimaryFlashingRow,
  makeFlashingId,
  normalizeFlashingBand,
  normalizeFlashingPurpose,
  normalizeFlashingsStateForUi,
  roofLengthForPrimaryFlashing,
} from './calculatorInputs';

type UseCalculatorFlashingsControllerOptions = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
};

type FlashingRowPatch = Partial<{
  band: CalculatorFlashingBand;
  lengthM: string;
  purpose: CalculatorFlashingPurpose;
}>;

export function useCalculatorFlashingsController({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  setValues,
}: UseCalculatorFlashingsControllerOptions) {
  const primaryManualOverrideRef = useRef<Record<string, boolean>>({});
  const state = normalizeFlashingsStateForUi(activeModule.flashings, activeModule);
  const primaryRow =
    state.rows.find((row) => row.kind === 'primary') ??
    state.rows[0] ??
    makeDefaultPrimaryFlashingRow(activeModule);

  const setState = (updater: (current: CalculatorFlashingsState) => CalculatorFlashingsState) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const currentModule = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const currentFlashings = normalizeFlashingsStateForUi(currentModule.flashings, currentModule);
      const nextFlashings = normalizeFlashingsStateForUi(updater(currentFlashings), currentModule);
      modules[activeModuleIndex] = { ...currentModule, flashings: nextFlashings };
      return { ...prev, modules };
    });
  };

  const addRow = () => {
    const id = makeFlashingId();
    const defaultLength = formatFlashingLengthInput(roofLengthForPrimaryFlashing(activeModule));
    setState((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          id,
          kind: 'extra',
          band: normalizeFlashingBand(primaryRow.band),
          lengthM: defaultLength || '1.0',
          purpose: 'CUSTOM',
        },
      ],
    }));
    return id;
  };

  const updateRow = (id: string, patch: FlashingRowPatch) => {
    if (patch.lengthM !== undefined) {
      const row = state.rows.find((entry) => entry.id === id);
      if (row?.kind === 'primary') {
        primaryManualOverrideRef.current[row.id] = !isPrimaryFlashingLengthAutoLinked(
          String(patch.lengthM),
          activeModule,
        );
      }
    }
    setState((current) => ({
      ...current,
      rows: current.rows.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          ...(patch.band !== undefined ? { band: normalizeFlashingBand(patch.band) } : null),
          ...(patch.lengthM !== undefined ? { lengthM: String(patch.lengthM) } : null),
          ...(patch.purpose !== undefined ? { purpose: normalizeFlashingPurpose(patch.purpose) } : null),
        };
      }),
    }));
  };

  const removeRow = (id: string) => {
    setState((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== id || row.kind === 'primary'),
    }));
  };

  const syncPrimaryLength = (
    currentModule: CalculatorModuleInputs,
    updatedModule: CalculatorModuleInputs,
  ): CalculatorFlashingsState | null => {
    const flashings = normalizeFlashingsStateForUi(currentModule.flashings, currentModule);
    const primary =
      flashings.rows.find((row) => row.kind === 'primary') ??
      flashings.rows[0] ??
      makeDefaultPrimaryFlashingRow(currentModule);
    const manualOverride = primaryManualOverrideRef.current[primary.id] === true;

    if (manualOverride && !isPrimaryFlashingLengthAutoLinked(primary.lengthM, currentModule)) {
      return null;
    }

    const nextAutoLength = formatFlashingLengthInput(roofLengthForPrimaryFlashing(updatedModule));
    const synced: CalculatorFlashingsState = {
      rows: flashings.rows.map((row) =>
        row.id === primary.id ? { ...row, lengthM: nextAutoLength } : row,
      ),
    };
    primaryManualOverrideRef.current[primary.id] = false;
    return normalizeFlashingsStateForUi(synced, updatedModule);
  };

  return {
    state,
    primaryRow,
    addRow,
    updateRow,
    removeRow,
    syncPrimaryLength,
  };
}
