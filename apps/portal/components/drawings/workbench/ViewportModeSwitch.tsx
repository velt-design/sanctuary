'use client';

import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import styles from './DrawingWorkbench.module.css';

const VIEWPORT_MODE_OPTIONS: Array<{ id: DrawingWorkbenchViewportMode; label: string }> = [
  { id: 'sheet', label: 'Sheet View' },
  { id: 'model', label: 'Model Space' },
];

export default function ViewportModeSwitch({
  value,
  onChange,
}: {
  value: DrawingWorkbenchViewportMode;
  onChange: (next: DrawingWorkbenchViewportMode) => void;
}) {
  return (
    <div className={styles.toggleGroup} role="tablist" aria-label="Drawing viewport mode">
      {VIEWPORT_MODE_OPTIONS.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
