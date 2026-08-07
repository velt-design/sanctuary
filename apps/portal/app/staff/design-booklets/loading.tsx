'use client';

import { useSearchParams } from 'next/navigation';
import DesignBookletPendingFrame from './DesignBookletPendingFrame';

export default function Loading() {
  const projectId = useSearchParams().get('projectId')?.trim() || null;
  return <DesignBookletPendingFrame projectId={projectId} />;
}
