'use client';

import { useParams, usePathname, useSearchParams } from 'next/navigation';
import ProjectPagePendingFrame from '@/components/projects/ProjectPage/ProjectPagePendingFrame';

export default function QuoteEditorLoading() {
  const params = useParams<{
    projectId?: string | string[];
    quoteId?: string | string[];
  }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const rawQuoteId = Array.isArray(params.quoteId) ? params.quoteId[0] : params.quoteId;

  let projectId = rawProjectId ?? null;
  let quoteId = rawQuoteId ?? null;
  try {
    projectId = projectId ? decodeURIComponent(projectId) : null;
  } catch {
    // Keep the safe raw segment; the pending frame re-encodes project links.
  }
  try {
    quoteId = quoteId ? decodeURIComponent(quoteId) : null;
  } catch {
    // The route identity remains useful even when the segment is malformed.
  }

  return (
    <ProjectPagePendingFrame
      projectId={projectId}
      activeTab="quotes"
      quoteDetail
      quotePreview={searchParams.get('quotePreview') === '1' || /\/print\/?$/.test(pathname)}
      quoteId={quoteId}
    />
  );
}
