'use client';

import Link from 'next/link';
import type { ModuleViewsTab } from '@/app/staff/calculator/ModuleViewsCard';
import type { DrawingWorkbenchViewportMode } from '@/lib/drawings/state/drawingWorkbenchUiState';
import styles from './DrawingWorkbench.module.css';

type PrimaryNavId = 'sheet' | 'plan' | 'geometry3d';

type PrimaryNavItem = {
  id: PrimaryNavId;
  label: string;
  viewportMode: DrawingWorkbenchViewportMode;
  view: ModuleViewsTab | null;
};

const PRIMARY_NAV_ITEMS: PrimaryNavItem[] = [
  { id: 'sheet', label: 'Sheet View', viewportMode: 'sheet', view: 'plan' },
  { id: 'plan', label: 'Plan', viewportMode: 'model', view: 'plan' },
  { id: 'geometry3d', label: '3D', viewportMode: 'geometry3d', view: null },
];

function activeNavId(viewportMode: DrawingWorkbenchViewportMode): PrimaryNavId | null {
  if (viewportMode === 'sheet') return 'sheet';
  if (viewportMode === 'model' || viewportMode === 'plan') return 'plan';
  if (viewportMode === 'geometry3d') return 'geometry3d';
  return null;
}

type WorkbenchChromeProps = {
  view: ModuleViewsTab;
  onViewChange: (view: ModuleViewsTab) => void;
  viewportMode: DrawingWorkbenchViewportMode;
  onViewportModeChange: (mode: DrawingWorkbenchViewportMode) => void;
  backHref?: string;
};

export default function WorkbenchChrome({
  view,
  onViewChange,
  viewportMode,
  onViewportModeChange,
  backHref,
}: WorkbenchChromeProps) {
  void view;
  const active = activeNavId(viewportMode);

  return (
    <div className={styles.toolbar}>
      <nav
        className={styles.toolbarNav}
        aria-label="Drawing workbench primary navigation"
        data-workbench-primary-nav="true"
      >
        <div className={styles.toggleGroup} role="tablist" aria-label="Drawing workbench mode">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                data-workbench-nav-id={item.id}
                className={`${styles.toggleButton} ${isActive ? styles.toggleButtonActive : ''}`}
                onClick={() => {
                  if (item.view) onViewChange(item.view);
                  onViewportModeChange(item.viewportMode);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {backHref ? (
          <Link href={backHref} className={styles.toolbarLink}>
            Back to Project
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
