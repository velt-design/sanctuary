import type { CalculatorModuleInputs } from '@/lib/types/calculator';

export function resolveHiddenWorkbenchGableEndFramesMode(
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'] | null | undefined,
): CalculatorModuleInputs['gableEndFramesMode'] {
  return houseConnectionType === 'none' ? 'both_ends' : 'outer_end_only';
}

export function isHiddenWorkbenchGableEndFramesModeSupported(
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'] | null | undefined,
  endFramesMode: CalculatorModuleInputs['gableEndFramesMode'] | null | undefined,
): boolean {
  if (endFramesMode === 'none') return true;
  if (houseConnectionType === 'none') return endFramesMode === 'both_ends';
  return endFramesMode === 'outer_end_only' || endFramesMode === 'both_ends';
}

export function coerceHiddenWorkbenchGableEndFramesMode(
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'] | null | undefined,
  endFramesMode: CalculatorModuleInputs['gableEndFramesMode'] | null | undefined,
): CalculatorModuleInputs['gableEndFramesMode'] {
  if (isHiddenWorkbenchGableEndFramesModeSupported(houseConnectionType, endFramesMode)) {
    return endFramesMode ?? resolveHiddenWorkbenchGableEndFramesMode(houseConnectionType);
  }

  return resolveHiddenWorkbenchGableEndFramesMode(houseConnectionType);
}

export function resolveHiddenWorkbenchGableHouseEdgeGutter(
  houseConnectionType: CalculatorModuleInputs['houseConnectionType'] | null | undefined,
): CalculatorModuleInputs['gableHouseEdgeGutter'] {
  return houseConnectionType === 'none' ? 'our' : 'house';
}

export function coerceHiddenWorkbenchGableBaseline(module: CalculatorModuleInputs): CalculatorModuleInputs {
  if (module.pergolaStyle !== 'gable') {
    return module;
  }

  return {
    ...module,
    boxPerimeterEnabled: false,
    gableEndFramesMode: coerceHiddenWorkbenchGableEndFramesMode(module.houseConnectionType, module.gableEndFramesMode),
    gableHouseEdgeGutter: resolveHiddenWorkbenchGableHouseEdgeGutter(module.houseConnectionType),
    gableOuterEdgeGutter: 'our',
  };
}
