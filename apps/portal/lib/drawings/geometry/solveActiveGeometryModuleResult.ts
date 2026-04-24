import { calculateCostV1, type CostOutputV1 } from '@sp/costing';
import { buildModuleCostInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import type { CalculatorInputs } from '@/lib/types/calculator';

export type ActiveGeometryModuleSolveResult =
  | {
      ok: true;
      moduleResult: CostOutputV1;
    }
  | {
      ok: false;
      message: string;
    };

export function solveActiveGeometryModuleResult(input: {
  calculatorInputs: CalculatorInputs;
  moduleIndex: number;
}): ActiveGeometryModuleSolveResult {
  const moduleCostInputs = buildModuleCostInputsFromCalculatorInputs(input.calculatorInputs, input.moduleIndex);

  if (!moduleCostInputs) {
    return {
      ok: false,
      message: 'The selected module is not available for local 3D geometry preview.',
    };
  }

  try {
    return {
      ok: true,
      moduleResult: calculateCostV1(moduleCostInputs),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Local 3D geometry preview solve failed.',
    };
  }
}
