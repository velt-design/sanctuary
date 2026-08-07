'use client';

import { useParams } from 'next/navigation';
import DesignWorkbenchPendingFrame from '@/components/page-state/DesignWorkbenchPendingFrame';

export default function DesignWorkbenchLoading() {
  const params = useParams<{ projectId?: string | string[] }>();
  const rawProjectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  let projectId = rawProjectId ?? null;
  if (projectId) {
    try {
      projectId = decodeURIComponent(projectId);
    } catch {
      // Keep the safe raw segment; the pending-frame link encodes it again.
    }
  }
  return <DesignWorkbenchPendingFrame projectId={projectId} />;
}
