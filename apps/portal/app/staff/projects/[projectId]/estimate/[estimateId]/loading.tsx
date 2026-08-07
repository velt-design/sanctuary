'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ProjectPagePendingFrame from '@/components/projects/ProjectPage/ProjectPagePendingFrame';

export default function EstimateViewerLoading() {
  const params = useParams<{
    projectId?: string | string[];
    estimateId?: string | string[];
  }>();
  const searchParams = useSearchParams();
  const rawProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const rawEstimateId = Array.isArray(params.estimateId) ? params.estimateId[0] : params.estimateId;

  let projectId = rawProjectId ?? null;
  let estimateId = rawEstimateId ?? null;
  try {
    projectId = projectId ? decodeURIComponent(projectId) : null;
  } catch {
    // Keep the safe raw segment; the pending frame re-encodes project links.
  }
  try {
    estimateId = estimateId ? decodeURIComponent(estimateId) : null;
  } catch {
    // The route identity remains useful even when the segment is malformed.
  }

  return (
    <ProjectPagePendingFrame
      projectId={projectId}
      activeTab="job-packs"
      jobPackDetail
      jobPackSheet={searchParams.get('sheet') ?? 'materials'}
      jobPackEstimateId={estimateId}
    />
  );
}
