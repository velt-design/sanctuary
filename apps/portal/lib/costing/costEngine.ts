import { COSTING_PACKAGE_SMOKE } from '@sp/costing';
import type { CostInputsV1, CostOutputV1, JobInputsV1, JobOutputV1, SiteInputsV1, SiteOutputV1 } from '@sp/costing';

void COSTING_PACKAGE_SMOKE;

export type CostingConfigVersions = {
  pricebook: string;
  installActions: string;
  overheads: string;
  rules: string;
  manifest: string;
};

export type CostingMeta = {
  manifestPath: string;
  manifestVersion: string;
  generatedAt?: string;
  files: Record<string, string>;
  configVersions: CostingConfigVersions;
};

export async function calculateCostV1(inputs: CostInputsV1): Promise<CostOutputV1> {
  const res = await fetch('/api/staff/costing/v1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Costing failed'));
  return json as CostOutputV1;
}

export async function calculateJobCostV1(inputs: JobInputsV1): Promise<JobOutputV1> {
  const res = await fetch('/api/staff/costing/v1/job', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Costing failed'));
  const site = json as SiteOutputV1;
  const modules = (Array.isArray(site?.pergolas) ? site.pergolas : []).flatMap((p) => (Array.isArray((p as any)?.modules) ? (p as any).modules : []));
  return {
    module_count: modules.length,
    modules,
    materials: site.materials,
    install: site.install,
    overhead: site.overhead,
    add_ons: site.add_ons,
    totals: site.totals,
  } as JobOutputV1;
}

export async function calculateSiteCostV1(inputs: SiteInputsV1): Promise<SiteOutputV1> {
  const res = await fetch('/api/staff/costing/v1/job', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(inputs),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Costing failed'));
  return json as SiteOutputV1;
}

export async function getCostingMeta(): Promise<CostingMeta> {
  const res = await fetch('/api/staff/costing/v1/meta', { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Failed to load costing meta'));
  return json as CostingMeta;
}
