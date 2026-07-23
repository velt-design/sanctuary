'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

import type {
  CalculatorFlashingsState,
  CalculatorInputs,
  CalculatorModuleInputs,
} from '@/lib/types/calculator';
import {
  isGutterBeamProfile,
  makeDefaultModule,
  normalizeOverrideValue,
} from './calculatorInputs';

type SyncPrimaryFlashingLength = (
  currentModule: CalculatorModuleInputs,
  updatedModule: CalculatorModuleInputs,
) => CalculatorFlashingsState | null;

type UseCalculatorInputControllerOptions = {
  activeModule: CalculatorModuleInputs;
  activeModuleIndex: number;
  activePergolaId: string;
  setValues: Dispatch<SetStateAction<CalculatorInputs>>;
  syncPrimaryFlashingLength: SyncPrimaryFlashingLength;
};

export function useCalculatorInputController({
  activeModule,
  activeModuleIndex,
  activePergolaId,
  setValues,
  syncPrimaryFlashingLength,
}: UseCalculatorInputControllerOptions) {
  const setJobField = <K extends Exclude<keyof CalculatorInputs, 'modules'>>(
    key: K,
    next: CalculatorInputs[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const setModuleField = <K extends keyof CalculatorModuleInputs>(
    key: K,
    next: CalculatorModuleInputs[K],
  ) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const updated: CalculatorModuleInputs = { ...current, [key]: next };
      const nextHouseConnection =
        key === 'houseConnectionType'
          ? (next as CalculatorModuleInputs['houseConnectionType'])
          : updated.houseConnectionType;
      const nextBoxEnabled =
        key === 'boxPerimeterEnabled' ? Boolean(next) : updated.boxPerimeterEnabled;

      if (key === 'extrusionColour') {
        if (next === 'Mill' && !updated.powdercoatIsCustom && !updated.powdercoatStandardColour) {
          updated.powdercoatStandardColour = 'Ironsands';
        }
      }
      if (key === 'powdercoatIsCustom') {
        if (!next && updated.extrusionColour === 'Mill' && !updated.powdercoatStandardColour) {
          updated.powdercoatStandardColour = 'Ironsands';
        }
      }

      if (key === 'houseConnectionType') {
        if (nextHouseConnection === 'none') {
          updated.boxGutterHouseEdge = 'none';
          updated.boxGutterFarEdge = 'none';
        } else if (current.houseConnectionType === 'none') {
          if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
          if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
        }

        if (updated.pergolaStyle === 'gable') {
          if (nextHouseConnection === 'none') {
            updated.gableHouseEdgeGutter = 'our';
            updated.gableOuterEdgeGutter = 'our';
          } else if (current.houseConnectionType === 'none') {
            if (current.gableHouseEdgeGutter === 'our') updated.gableHouseEdgeGutter = 'house';
            if (current.gableOuterEdgeGutter === 'our') updated.gableOuterEdgeGutter = 'our';
          }

          const prevDefault = current.houseConnectionType !== 'none' ? 'outer_end_only' : 'both_ends';
          const nextDefault = nextHouseConnection !== 'none' ? 'outer_end_only' : 'both_ends';
          if (updated.gableEndFramesMode === prevDefault) {
            updated.gableEndFramesMode = nextDefault;
          }
        }
      }

      if (key === 'boxPerimeterEnabled' && nextBoxEnabled) {
        if (nextHouseConnection === 'none') {
          updated.boxGutterHouseEdge = 'none';
          updated.boxGutterFarEdge = 'none';
        } else {
          if (current.boxGutterHouseEdge === 'none') updated.boxGutterHouseEdge = 'house';
          if (current.boxGutterFarEdge === 'none') updated.boxGutterFarEdge = 'our';
        }
        updated.overhangEnabled = false;
        updated.invertedEnabled = false;
        updated.invertedHouseGutter = true;
        updated.separateGutterEnabled = false;
      }

      if (key === 'pergolaStyle' && next !== 'pitched') {
        updated.invertedEnabled = false;
        updated.invertedHouseGutter = true;
        updated.separateGutterEnabled = false;
      }

      if (key === 'pergolaStyle' && next === 'gable') {
        updated.gableHouseEdgeGutter = nextHouseConnection === 'none' ? 'our' : 'house';
        updated.gableOuterEdgeGutter = 'our';
      }

      if (key === 'overhangEnabled' && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      if (key === 'invertedEnabled' && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      if (key === 'invertedHouseGutter' && updated.invertedEnabled && Boolean(next)) {
        updated.separateGutterEnabled = false;
      }

      const frontBeamOverride = normalizeOverrideValue(updated.overrides?.frontBeamProfile);
      const frontBeamProfileUsed = frontBeamOverride ?? 'SP Gutter';
      if (isGutterBeamProfile(frontBeamProfileUsed)) {
        updated.separateGutterEnabled = false;
      }

      if (key === 'lengthM' || key === 'hipCornerLengthBM' || key === 'pergolaStyle') {
        const syncedFlashings = syncPrimaryFlashingLength(current, updated);
        if (syncedFlashings) updated.flashings = syncedFlashings;
      }

      modules[activeModuleIndex] = updated;
      return { ...prev, modules };
    });
  };

  const setModuleOverride = (
    key: keyof NonNullable<CalculatorModuleInputs['overrides']>,
    value: string,
  ) => {
    setValues((prev) => {
      const modules = prev.modules.slice();
      const current = modules[activeModuleIndex] ?? makeDefaultModule(activePergolaId);
      const overrides = { ...(current.overrides ?? {}) };
      if (value) overrides[key] = value;
      else delete overrides[key];
      const updated: CalculatorModuleInputs = { ...current, overrides };

      if (key === 'frontBeamProfile') {
        const frontBeamProfileUsed = normalizeOverrideValue(overrides.frontBeamProfile) ?? 'SP Gutter';
        if (isGutterBeamProfile(frontBeamProfileUsed)) {
          updated.separateGutterEnabled = false;
        }
      }

      modules[activeModuleIndex] = updated;
      return { ...prev, modules };
    });
  };

  useEffect(() => {
    if (activeModule.extrusionColour !== 'Mill') return;
    if (activeModule.powdercoatIsCustom) return;
    if (activeModule.powdercoatStandardColour?.trim()) return;
    setModuleField('powdercoatStandardColour', 'Ironsands');
  }, [
    activeModule.extrusionColour,
    activeModule.powdercoatIsCustom,
    activeModule.powdercoatStandardColour,
    activeModuleIndex,
  ]);

  return {
    setJobField,
    setModuleField,
    setModuleOverride,
  };
}
