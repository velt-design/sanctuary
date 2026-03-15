import { apiJson } from '@/lib/repo/apiClient';
import type { RunningJobsResponse } from '@/lib/runningJobs/types';

export async function fetchRunningJobs(): Promise<RunningJobsResponse> {
  return apiJson<RunningJobsResponse>('/api/staff/v1/running-jobs', { method: 'GET' });
}
