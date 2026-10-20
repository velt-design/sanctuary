import type { CalculatorInputs, LegacyCalculatorInputsV1 } from './calculator';

export function isCalculatorInputsV2(value: unknown): value is CalculatorInputs {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return v.schemaVersion === 'v2' && Array.isArray(v.modules);
}

export function isLegacyCalculatorInputsV1(value: unknown): value is LegacyCalculatorInputsV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as any;
  return typeof v.projectName === 'string' && typeof v.pergolaStyle === 'string' && !Array.isArray(v.modules);
}
