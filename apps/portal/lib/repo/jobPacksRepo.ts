import { apiJson } from '@/lib/repo/apiClient';
import type { JobPackGenerationResponse, JobPackGenerationSummary } from '@/lib/jobPacks/types';

export async function listGeneratedJobPacks(projectId: string): Promise<JobPackGenerationSummary[]> {
  const res = await apiJson<{ jobPacks: JobPackGenerationSummary[] }>(
    `/api/staff/v1/projects/${encodeURIComponent(projectId)}/job-packs`,
    { method: 'GET' },
  );
  return Array.isArray(res.jobPacks) ? res.jobPacks : [];
}

export async function generateJobPack(input: { projectId: string; quoteVersionId: string }): Promise<JobPackGenerationSummary> {
  const res = await apiJson<JobPackGenerationResponse>('/api/staff/v1/job-packs/generate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.jobPack) throw new Error('Failed to generate job pack');
  return res.jobPack;
}
