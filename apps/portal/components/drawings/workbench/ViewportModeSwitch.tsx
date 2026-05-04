'use client';

import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import styles from './DrawingWorkbench.module.css';

const VIEWPORT_MODE_LABELS: Record<DrawingWorkbenchViewportMode, string> = {
  sheet: 'Sheet View',
  plan: 'Plan',
  model: 'Model Space',
  geometry3d: '3D',
};

export default function ViewportModeSwitch({
  value,
  onChange,
  availableModes = ['sheet', 'geometry3d'],
}: {
  value: DrawingWorkbenchViewportMode;
  onChange: (next: DrawingWorkbenchViewportMode) => void;
  availableModes?: DrawingWorkbenchViewportMode[];
}) {
  return (
    <div className={styles.toggleGroup} role="tablist" aria-label="Drawing viewport mode">
      {availableModes.map((mode) => {
        const active = mode === value;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
            onClick={() => onChange(mode)}
          >
            {VIEWPORT_MODE_LABELS[mode]}
          </button>
        );
      })}
    </div>
  );
}
