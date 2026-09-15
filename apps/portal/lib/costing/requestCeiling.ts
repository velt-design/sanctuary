import { isCeilingOption, type CeilingSelection } from '@sp/costing';

/** Keep selected ceiling identity across the staff calculation HTTP boundary. */
export function parseRequestCeiling(value: unknown, roofMaterial: unknown):
  { ceiling?: CeilingSelection } | { error: string } {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !('option' in value) || !isCeilingOption(value.option)
    || Object.keys(value).some(key => key !== 'option')) {
    return { error: 'ceiling must contain a supported ceiling option' };
  }
  if (roofMaterial !== 'timber' && roofMaterial !== 'mixed') {
    return { error: 'ceiling requires a timber or mixed roof' };
  }
  return { ceiling: { option: value.option } };
}
