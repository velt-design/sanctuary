'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ProjectPagePendingFrame from '@/components/projects/ProjectPage/ProjectPagePendingFrame';

export default function ProjectDetailLoading() {
  const params = useParams<{ projectId?: string | string[] }>();
  const searchParams = useSearchParams();
  const rawProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  let projectId = rawProjectId ?? null;
  if (projectId) {
    try {
      projectId = decodeURIComponent(projectId);
    } catch {
      // Preserve a malformed route segment as display-free link input; the frame re-encodes it.
    }
  }

  const activeTab = searchParams.get('tab');
  const quoteId = searchParams.get('quoteId')?.trim() || null;
  const estimateId = searchParams.get('estimateId')?.trim() || null;
  const quoteDetail = activeTab === 'quotes' && Boolean(quoteId);
  const jobPackDetail = activeTab === 'job-packs' && Boolean(estimateId);

  return (
    <ProjectPagePendingFrame
      projectId={projectId}
      activeTab={activeTab}
      quoteDetail={quoteDetail}
      quotePreview={quoteDetail && searchParams.get('quotePreview') === '1'}
      quoteId={quoteId}
      jobPackDetail={jobPackDetail}
      jobPackSheet={searchParams.get('sheet')}
      jobPackEstimateId={estimateId}
    />
  );
}
