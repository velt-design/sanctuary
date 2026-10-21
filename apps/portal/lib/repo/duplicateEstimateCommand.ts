import { isCalculatorInputsV2, isLegacyCalculatorInputsV1, migrateLegacyCalculatorInputsToV2, type CalculatorInputs } from '@/lib/types/calculator';
import { getEstimate } from './estimatesRepo';

export async function duplicateEstimateToDraft(estimateId: string): Promise<CalculatorInputs> {
  const estimate = await getEstimate(estimateId);
  if (!estimate) throw new Error('Estimate not found');
  const inputs: unknown = (estimate as any).inputs;
  if (isCalculatorInputsV2(inputs)) return inputs;
  if (isLegacyCalculatorInputsV1(inputs)) return migrateLegacyCalculatorInputsToV2(inputs);
  throw new Error('Estimate inputs are not compatible with this calculator version.');
}
