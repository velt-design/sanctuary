import type { SiteInputsV1 } from '@sp/costing';

export type StudioPriceAssumptions = Partial<Record<'access' | 'height' | 'jobType' | 'pricingClassification' | 'approvalRequirement', string>>;
const labels: Record<string, string> = {
  easy: 'Easy', normal: 'Normal', hard: 'Difficult', single_storey: 'Single storey', two_storey: 'Two storey',
  residential: 'Residential', commercial: 'Commercial', simple: 'Simple', bespoke: 'Bespoke',
  neither: 'Neither', engineering_required: 'Engineering required', full_building_consent: 'Full building consent',
};
/** Allowlisted effective selections from the same priced inputs, without cost/configuration data. */
export function studioPriceAssumptions(site: SiteInputsV1): StudioPriceAssumptions {
  const modules = site.pergolas.flatMap(p => p.modules);
  const describe = (values: unknown[]) => [...new Set(values.filter((v): v is string => typeof v === 'string').map(v => labels[v]).filter(Boolean))].join(' / ') || undefined;
  return {
    access: describe(modules.map(m => m.access)), height: describe(modules.map(m => m.height)),
    jobType: describe([site.job_type]), pricingClassification: describe([site.pricing_classification]), approvalRequirement: describe([site.approval_requirement]),
  };
}
