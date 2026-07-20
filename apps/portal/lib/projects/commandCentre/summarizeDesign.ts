import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  formatModuleRoof,
  formatModuleSize,
  formatModuleStyle,
} from '@/lib/quotes/moduleFormatters';
import type { CommandCentreCostingState, CommandCentreDesignSummary } from './types';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readModules(inputs: unknown): CalculatorModuleInputs[] {
  if (!isRecord(inputs) || !Array.isArray(inputs.modules)) return [];
  return inputs.modules.filter((module): module is CalculatorModuleInputs => isRecord(module));
}

function moduleArea(module: CalculatorModuleInputs): number {
  const length = Number.parseFloat(String(module.lengthM ?? ''));
  const projection = Number.parseFloat(String(module.projectionM ?? ''));
  return Number.isFinite(length) && Number.isFinite(projection) ? length * projection : 0;
}

function primaryModule(modules: CalculatorModuleInputs[]): CalculatorModuleInputs | null {
  return modules.reduce<CalculatorModuleInputs | null>((selected, candidate) => {
    if (!selected || moduleArea(candidate) > moduleArea(selected)) return candidate;
    return selected;
  }, null);
}

export function summarizeCommandCentreDesign(inputs: unknown): CommandCentreDesignSummary {
  const modules = readModules(inputs);
  const primary = primaryModule(modules);
  return {
    size: primary ? formatModuleSize(primary) : 'Size not recorded',
    shape: primary ? formatModuleStyle(primary) ?? 'Shape not recorded' : 'Shape not recorded',
    roofing: primary ? formatModuleRoof(primary) ?? 'Roofing not recorded' : 'Roofing not recorded',
    additionalModuleCount: Math.max(0, modules.length - 1),
  };
}

export function resolveCommandCentreCostingState(outputs: unknown): CommandCentreCostingState {
  if (!isRecord(outputs)) return 'unavailable';
  const raw = typeof outputs.pricing_sync_state === 'string'
    ? outputs.pricing_sync_state.trim().toLowerCase()
    : '';
  if (raw === 'current') return 'current';
  if (raw === 'stale') return 'may_be_stale';
  return Object.keys(outputs).length > 0 ? 'stored' : 'unavailable';
}
