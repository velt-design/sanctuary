import { queryOptions } from '@tanstack/react-query';
import type { JobPackPowdercoatSheetResponse } from '@/lib/jobPacks/types';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';

const ONE_DAY = 1000 * 60 * 60 * 24;
const TEN_MINUTES = 1000 * 60 * 10;

async function fetchJobPackPowdercoatingSheet(estimateId: string): Promise<JobPackPowdercoatSheetResponse> {
  return apiJson<JobPackPowdercoatSheetResponse>(
    `/api/staff/v1/job-packs/powdercoating?estimateId=${encodeURIComponent(estimateId)}`,
  );
}

export const jobPackPowdercoatingQueryOptions = (host: string, estimateId: string) =>
  queryOptions({
    queryKey: qk.jobPacks.powdercoating(host, estimateId),
    queryFn: () => fetchJobPackPowdercoatingSheet(estimateId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
