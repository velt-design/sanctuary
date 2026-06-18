type CostingConfigVersions = {
  pricebook: string;
  installActions: string;
  overheads: string;
  rules: string;
  manifest: string;
};

type CostingMeta = {
  manifestPath: string;
  manifestVersion: string;
  generatedAt?: string;
  files: Record<string, string>;
  configVersions: CostingConfigVersions;
};

export async function getCostingMeta(): Promise<CostingMeta> {
  const res = await fetch('/api/staff/costing/v1/meta', { method: 'GET' });
  const json = await res.json();
  if (!res.ok) throw new Error(String(json?.error ?? 'Failed to load costing meta'));
  return json as CostingMeta;
}
