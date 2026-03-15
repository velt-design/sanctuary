import { apiJson } from '@/lib/repo/apiClient';
import type { RunningJobCellMutationRequest, RunningJobCellMutationResponse, RunningJobsResponse } from '@/lib/runningJobs/types';

export async function fetchRunningJobs(): Promise<RunningJobsResponse> {
  return apiJson<RunningJobsResponse>('/api/staff/v1/running-jobs', { method: 'GET' });
}

export async function mutateRunningJobCell(input: RunningJobCellMutationRequest): Promise<RunningJobCellMutationResponse> {
  return apiJson<RunningJobCellMutationResponse>('/api/staff/v1/running-jobs/cell', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
