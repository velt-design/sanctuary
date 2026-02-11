import { queryOptions } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import { qk } from './keys';

async function fetchEstimateMetasByProject(projectId: string): Promise<EstimateMeta[]> {
  const res = await apiJson<{ estimates: EstimateMeta[] }>(`/api/projects/${encodeURIComponent(projectId)}/estimates`);
  return Array.isArray(res.estimates) ? res.estimates : [];
}

async function fetchEstimateDetail(estimateId: string): Promise<EstimateDetail> {
  const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(estimateId)}`);
  if (!res.estimate) throw new Error('Estimate not found');
  return res.estimate;
}

export const estimateMetasByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.estimates.metaByProject(host, projectId),
    queryFn: () => fetchEstimateMetasByProject(projectId),
  });

export const estimateDetailQueryOptions = (host: string, estimateId: string) =>
  queryOptions({
    queryKey: qk.estimates.detail(host, estimateId),
    queryFn: () => fetchEstimateDetail(estimateId),
  });

