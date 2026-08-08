import { queryOptions } from '@tanstack/react-query';
import { apiJson } from '@/lib/repo/apiClient';
import type { EstimateDetail, EstimateMeta } from '@/lib/estimates/types';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TEN_MINUTES = 1000 * 60 * 10;

async function fetchEstimateMetasByProject(projectId: string): Promise<{
  estimates: EstimateMeta[];
  activeDraftEstimate: EstimateDetail | null;
}> {
  const res = await apiJson<{
    estimates: EstimateMeta[];
    activeDraftEstimate?: EstimateDetail | null;
  }>(`/api/projects/${encodeURIComponent(projectId)}/estimates`);
  return {
    estimates: Array.isArray(res.estimates) ? res.estimates : [],
    activeDraftEstimate: res.activeDraftEstimate ?? null,
  };
}

async function fetchEstimateDetail(estimateId: string): Promise<EstimateDetail> {
  const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(estimateId)}`);
  if (!res.estimate) throw new Error('Estimate not found');
  return res.estimate;
}

export const estimateMetasByProjectQueryOptions = (host: string, projectId: string) =>
  queryOptions({
    queryKey: qk.estimates.metaByProject(host, projectId),
    queryFn: async ({ client }) => {
      const response = await fetchEstimateMetasByProject(projectId);
      const activeDraft = response.activeDraftEstimate;
      if (
        activeDraft?.projectId === projectId &&
        response.estimates.some((estimate) => estimate.id === activeDraft.id && estimate.isActiveDraft)
      ) {
        client.setQueryData(qk.estimates.detail(host, activeDraft.id), activeDraft);
      }
      return response.estimates;
    },
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });

export const estimateDetailQueryOptions = (host: string, estimateId: string) =>
  queryOptions({
    queryKey: qk.estimates.detail(host, estimateId),
    queryFn: () => fetchEstimateDetail(estimateId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
