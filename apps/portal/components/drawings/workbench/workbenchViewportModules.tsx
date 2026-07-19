'use client';

import dynamic from 'next/dynamic';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import styles from './DrawingWorkbench.module.css';

const loadGeometry3DViewport = () => import('@/components/drawings/viewports/DesignViewport');

function Geometry3DLoadingState() {
  return (
    <div className={styles.viewportLoading} data-workbench-viewport-loading="geometry3d" role="status">
      Opening 3D review...
    </div>
  );
}

export const Geometry3DDesignViewport = dynamic(loadGeometry3DViewport, {
  ssr: false,
  loading: Geometry3DLoadingState,
});

export async function preloadWorkbenchViewport(mode: DrawingWorkbenchViewportMode): Promise<void> {
  if (mode !== 'geometry3d') return;
  await loadGeometry3DViewport();
}
