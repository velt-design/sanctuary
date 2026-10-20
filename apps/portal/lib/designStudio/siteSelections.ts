import { MAX_CUSTOMER_PRICE_DISCOUNT_PCT } from '@sp/costing';
import type { StudioJsonObject } from './contracts';

const keys = ['access', 'height', 'jobType', 'pricingClassification', 'approvalRequirement', 'travelExGst', 'extrasAllowanceExGst', 'quoteDiscountPct', 'blinds', 'additionalAluminium', 'standaloneInfills'];
function choice<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw Error('Select a valid site option.');
  return value as T;
}
function amount(value: unknown): number {
  if (value === undefined || value === '') return 0;
  if (typeof value !== 'string' || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) throw Error('Enter a valid site allowance or discount.');
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > Number.MAX_SAFE_INTEGER / 100) throw Error('Invalid site amount.');
  return result;
}
/** Shared job selections also apply when the scene contains no new pergola. */
export function resolveStudioSiteSelections(site: StudioJsonObject) {
  if (Object.keys(site).some(key => !keys.includes(key))) throw Error('Unsupported site option.');
  const job = { jobType: choice(site.jobType, ['residential', 'commercial']), classification: choice(site.pricingClassification, ['simple', 'bespoke']),
    approvalRequirement: choice(site.approvalRequirement, ['neither', 'engineering_required', 'full_building_consent']),
    travelExGst: amount(site.travelExGst), extrasAllowanceExGst: amount(site.extrasAllowanceExGst), quoteDiscountPct: amount(site.quoteDiscountPct) };
  if (job.quoteDiscountPct > MAX_CUSTOMER_PRICE_DISCOUNT_PCT) throw Error(`Discount must be between 0 and ${MAX_CUSTOMER_PRICE_DISCOUNT_PCT}.`);
  return job;
}
