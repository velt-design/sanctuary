'use client';

import Link from 'next/link';
import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import type { WorkbenchTrustGateModel } from '@/lib/drawings/state/workbenchSolvedModel';
import ViewportModeSwitch from './ViewportModeSwitch';
import styles from './DrawingWorkbench.module.css';

const VIEW_OPTIONS: Array<{ id: ModuleViewsTab; label: string }> = [
  { id: 'plan', label: 'Plan' },
  { id: 'section', label: 'Section' },
];

type WorkbenchChromeProps = {
  view: ModuleViewsTab;
  onViewChange: (view: ModuleViewsTab) => void;
  viewportMode: DrawingWorkbenchViewportMode;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  availableViewportModes?: DrawingWorkbenchViewportMode[];
  trustGate?: WorkbenchTrustGateModel | null;
  backHref?: string;
};

export default function WorkbenchChrome({
  view,
  onViewChange,
  viewportMode,
  onViewportModeChange,
  availableViewportModes,
  trustGate,
  backHref,
}: WorkbenchChromeProps) {
  const trustBadgeClass =
    trustGate?.status === 'block'
      ? `${styles.trustBadge} ${styles.trustBadgeBlock}`
      : trustGate?.status === 'warn'
        ? `${styles.trustBadge} ${styles.trustBadgeWarn}`
        : styles.trustBadge;

  return (
    <div className={styles.toolbar}>
      <nav className={styles.toolbarNav} aria-label="Drawing workbench controls">
        <ViewportModeSwitch
          value={viewportMode}
          onChange={onViewportModeChange}
          availableModes={availableViewportModes}
        />
        {backHref ? (
          <Link href={backHref} className={styles.toolbarLink}>
            Back to Project
          </Link>
        ) : null}
        {trustGate ? (
          <span
            className={trustBadgeClass}
            data-workbench-trust-status={trustGate.status}
            data-workbench-trust-kind={trustGate.trustStatus}
            aria-label={`Workbench trust: ${trustGate.label}`}
            title={trustGate.message ?? trustGate.label}
          >
            <span className={styles.trustBadgeLabel}>{trustGate.label}</span>
          </span>
        ) : null}
        <div className={styles.toggleGroup} role="tablist" aria-label="Drawing view">
          {VIEW_OPTIONS.map((option) => {
            const active = option.id === view;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
                onClick={() => onViewChange(option.id)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
