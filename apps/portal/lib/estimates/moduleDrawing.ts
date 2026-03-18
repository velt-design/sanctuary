import type { CostOutputV1 } from '@sp/costing';
import {
  buildModulePlanModel,
  buildModuleSectionModel,
  type ModulePlanModel,
  type ModuleSectionModel,
} from '../../app/staff/calculator/moduleViews';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, migrateLegacyCalculatorInputsToV2 } from '@/lib/types/calculator';

type AnyRecord = Record<string, unknown>;

export type EstimateDrawingModule = {
  id: string;
  label: string;
  input: CalculatorModuleInputs;
  result: CostOutputV1 | null;
  planModel: ModulePlanModel | null;
  sectionModel: ModuleSectionModel | null;
};

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveCalculatorInputs(snapshot: Record<string, unknown> | null): CalculatorInputs | null {
  if (!snapshot) return null;
  const rawInputs = snapshot.inputs ?? (isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot.inputs : null);
  if (isCalculatorInputsV2(rawInputs)) return rawInputs;
  if (isLegacyCalculatorInputsV1(rawInputs)) return migrateLegacyCalculatorInputsToV2(rawInputs);
  return null;
}

function resolveModuleResults(snapshot: Record<string, unknown> | null): CostOutputV1[] {
  if (!snapshot) return [];
  const rawOutputs = snapshot.outputs ?? (isRecord(snapshot.calculator_snapshot) ? snapshot.calculator_snapshot.outputs : null);
  if (!isRecord(rawOutputs) || !Array.isArray(rawOutputs.pergolas)) return [];
  return rawOutputs.pergolas.flatMap((pergola) => {
    if (!isRecord(pergola) || !Array.isArray(pergola.modules)) return [];
    return pergola.modules.filter((module): module is CostOutputV1 => Boolean(module));
  });
}

export function buildEstimateDrawingModules(snapshot: Record<string, unknown> | null): EstimateDrawingModule[] {
  const inputs = resolveCalculatorInputs(snapshot);
  if (!inputs) return [];

  const results = resolveModuleResults(snapshot);
  return inputs.modules.map((module, index) => {
    const result = results[index] ?? null;
    return {
      id: `module-${index + 1}`,
      label: `M${index + 1}`,
      input: module,
      result,
      planModel: buildModulePlanModel(module, result),
      sectionModel: buildModuleSectionModel(module, result),
    };
  });
}
